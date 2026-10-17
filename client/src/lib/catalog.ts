/**
 * Optional online title lookup (AniList public GraphQL — free, no key).
 * Preserves provider identities and metadata for manual-add results. Failures
 * are reported to the caller; manually entering a work remains available.
 */
import {serviceApiUrl} from "./sync";
import type { ContentType } from "./types";

export interface CatalogResult {
  title: string;
  type: ContentType;
  cover?: string;
  originalTitle?:string;aliases?:string[];id?:string;url?:string;format?:string;year?:number;total?:number;synopsis?:string;country?:string;genres?:string[];externalIds?:Record<string,string|number>;source?:string;
}

const MEDIA_FIELDS = 'id idMal title { english romaji native } synonyms siteUrl format countryOfOrigin seasonYear episodes chapters description genres coverImage { large medium }';
const QUERY = `query ($s: String) {
  anime: Page(perPage: 6) { media(search: $s, type: ANIME, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} } }
  manga: Page(perPage: 6) { media(search: $s, type: MANGA, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} } }
}`;

interface Media {
  id:number;idMal?:number;siteUrl?:string;format?:string;countryOfOrigin?:string;seasonYear?:number;episodes?:number;chapters?:number;description?:string;genres?:string[];synonyms?:string[];
  title: { english: string | null; romaji: string | null; native?:string | null };
  coverImage: { large?:string | null; medium: string | null };
}

export async function searchCatalog(query: string, signal?: AbortSignal, onSources?: (sources:{name:string;ok:boolean}[])=>void): Promise<CatalogResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const api=serviceApiUrl();
  if(api){const response=await fetch(`${api}/catalog?q=${encodeURIComponent(q)}`,{signal});if(!response.ok)throw new Error("Catalog unavailable");const body=await response.json();onSources?.(body.sources||[]);return body.results;}
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { s: q } }),
      signal,
    });
    if (!res.ok) throw new Error("Catalog unavailable");
    const data = (await res.json()) as { errors?:unknown[];data?: { anime?: { media: Media[] }; manga?: { media: Media[] } } };
    if(data.errors?.length||!Array.isArray(data.data?.anime?.media)||!Array.isArray(data.data?.manga?.media))throw new Error("Catalog unavailable");
    onSources?.([{name:'AniList',ok:true}]);
    const map = (m: Media, type: ContentType): CatalogResult | null => {
      const title = m.title?.english || m.title?.romaji || m.title?.native;
      if(!title||!Number.isSafeInteger(m.id)||m.id<=0)return null;
      const reading=type==='reading',count=reading?m.chapters:m.episodes;
      return {id:'anilist-'+m.id,title,type,originalTitle:m.title.native||undefined,
        aliases:[...new Set([m.title.english,m.title.romaji,m.title.native,...(Array.isArray(m.synonyms)?m.synonyms:[])].filter((v):v is string=>typeof v==='string'&&!!v.trim()))],
        externalIds:{anilist:m.id,...(Number.isSafeInteger(m.idMal)&&m.idMal!>0?{[reading?'malManga':'malAnime']:m.idMal!}:{})},
        source:'AniList',url:'https://anilist.co/'+(reading?'manga':'anime')+'/'+m.id,
        cover:m.coverImage?.large||m.coverImage?.medium||undefined,
        format:reading?(m.countryOfOrigin==='KR'?'MANHWA':m.countryOfOrigin==='CN'?'MANHUA':m.format):m.format==='MOVIE'?'MOVIE':'ANIME',
        country:m.countryOfOrigin,year:m.seasonYear||undefined,total:Number.isInteger(count)&&count!>0?count:undefined,
        synopsis:typeof m.description==='string'?m.description.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim():undefined,
        genres:Array.isArray(m.genres)?m.genres:[]};
    };
    const anime = (data.data?.anime?.media ?? []).map((m) => map(m, "watching"));
    const manga = (data.data?.manga?.media ?? []).map((m) => map(m, "reading"));
    // Interleave so both media types surface near the top.
    const out: CatalogResult[] = [];
    for (let i = 0; i < Math.max(anime.length, manga.length); i++) {
      if (anime[i]) out.push(anime[i]!);
      if (manga[i]) out.push(manga[i]!);
    }
    return out.slice(0, 8);
  } catch (error) {
    throw error;
  }
}
