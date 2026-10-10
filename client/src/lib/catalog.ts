/**
 * Optional online title lookup (AniList public GraphQL — free, no key).
 * Purely a convenience for the manual-add flow: it prefills title, type and
 * cover. It is best-effort — if the network or API is unavailable, it returns
 * an empty list and the user still adds works manually. Never a hard dependency.
 */
import {serviceApiUrl} from "./sync";
import type { ContentType } from "./types";

export interface CatalogResult {
  title: string;
  type: ContentType;
  cover?: string;
  id?:string;url?:string;format?:string;year?:number;total?:number;synopsis?:string;country?:string;genres?:string[];externalIds?:Record<string,string|number>;source?:string;
}

const QUERY = `query ($s: String) {
  anime: Page(perPage: 6) { media(search: $s, type: ANIME, sort: SEARCH_MATCH) { title { english romaji } coverImage { medium } } }
  manga: Page(perPage: 6) { media(search: $s, type: MANGA, sort: SEARCH_MATCH) { title { english romaji } coverImage { medium } } }
}`;

interface Media {
  title: { english: string | null; romaji: string | null };
  coverImage: { medium: string | null };
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
    const data = (await res.json()) as { data?: { anime?: { media: Media[] }; manga?: { media: Media[] } } };
    const map = (m: Media, type: ContentType): CatalogResult | null => {
      const title = m.title.english || m.title.romaji;
      return title ? { title, type, cover: m.coverImage.medium || undefined } : null;
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
