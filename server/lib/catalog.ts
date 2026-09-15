
export interface CatalogWork {
 id:string;title:string;type:'reading'|'watching'|'game';format:string;source:string;url:string;
 cover?:string;coverFallback?:string;synopsis?:string;country?:string;year?:number;genres?:string[];total?:number;
 externalIds:Record<string,string|number>;platform?:string;price?:string;originalTitle?:string;aliases?:string[];
}
export type CatalogResponse={results:CatalogWork[];sources:{name:string;ok:boolean}[]};
const plain=(s:any)=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#0?39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
async function json(url:string,init:RequestInit={},fetcher=fetch){const r=await fetcher(url,{...init,signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('catalog_'+r.status);return r.json();}
export function createCatalog(fetcher=fetch){
 const cache=new Map<string,{at:number;value:CatalogResponse}>(),pending=new Map<string,Promise<CatalogResponse>>();
 const get=(url:string,init?:RequestInit)=>json(url,init,fetcher);
 const anilist=async(q:string):Promise<CatalogWork[]>=>{
  const data=await get('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query($s:String){Page(perPage:20){media(search:$s,sort:SEARCH_MATCH,isAdult:false){id title{romaji english native} synonyms format countryOfOrigin seasonYear episodes chapters coverImage{large medium} description genres siteUrl}}}',variables:{s:q}})});
  if(data.errors)throw Error('anilist_unavailable');
  return (data.data?.Page?.media||[]).map((m:any)=>{const reading=['MANGA','NOVEL','ONE_SHOT'].includes(m.format);return {id:'anilist-'+m.id,title:m.title.english||m.title.romaji||m.title.native,originalTitle:m.title.native,aliases:[m.title.english,m.title.romaji,...(m.synonyms||[])].filter(Boolean),type:reading?'reading':'watching',format:reading?(m.countryOfOrigin==='KR'?'MANHWA':m.countryOfOrigin==='CN'?'MANHUA':m.format):m.format==='MOVIE'?'MOVIE':'ANIME',source:'AniList',externalIds:{anilist:m.id},url:m.siteUrl,cover:m.coverImage?.large,coverFallback:m.coverImage?.medium,synopsis:plain(m.description),genres:m.genres||[],country:m.countryOfOrigin,year:m.seasonYear||undefined,total:(reading?m.chapters:m.episodes)||undefined};});
 };

 const jikan=async(q:string):Promise<CatalogWork[]>=>{
  const responses=await Promise.allSettled(['manga','anime'].map(kind=>get('https://api.jikan.moe/v4/'+kind+'?q='+encodeURIComponent(q)+'&limit=12&sfw=true').then(data=>({kind,data}))));
  if(responses.every(r=>r.status==='rejected'))throw Error('jikan_unavailable');
  return responses.flatMap(r=>r.status==='rejected'?[]:(r.value.data.data||[]).map((m:any)=>{const reading=r.value.kind==='manga';return {id:'mal-'+r.value.kind+'-'+m.mal_id,title:m.title_english||m.title,originalTitle:m.title_japanese,aliases:(m.titles||[]).map((t:any)=>t.title),type:reading?'reading':'watching',format:reading?String(m.type||'MANGA').toUpperCase():m.type==='Movie'?'MOVIE':'ANIME',source:'MyAnimeList via Jikan',externalIds:{[reading?'malManga':'malAnime']:m.mal_id},url:m.url,cover:m.images?.jpg?.large_image_url,synopsis:plain(m.synopsis),genres:(m.genres||[]).map((g:any)=>g.name),year:m.year||Number((m.published?.from||m.aired?.from||'').slice(0,4))||undefined,total:(reading?m.chapters:m.episodes)||undefined} as CatalogWork;}));
 };
 const tvmaze=async(q:string):Promise<CatalogWork[]>=>{
  const data=await get('https://api.tvmaze.com/search/shows?q='+encodeURIComponent(q));
  return data.slice(0,15).map(({show:s}:any)=>{const country=s.network?.country?.code||s.webChannel?.country?.code;return {id:'tvmaze-'+s.id,title:s.name,type:'watching',format:s.type==='Animation'?'ANIME':s.type==='Scripted'?(country==='KR'?'KDRAMA':country==='CN'?'CDRAMA':country==='JP'?'JDRAMA':'SERIES'):'SERIES',source:'TVmaze',externalIds:{tvmaze:s.id,...(s.externals?.imdb?{imdb:s.externals.imdb}:{})},url:s.url,cover:s.image?.original||s.image?.medium,synopsis:plain(s.summary),genres:s.genres||[],country,year:Number(String(s.premiered||'').slice(0,4))||undefined};});
 };
 const books=async(q:string):Promise<CatalogWork[]>=>{
  const data=await get('https://openlibrary.org/search.json?q='+encodeURIComponent(q)+'&limit=12&fields=key,title,author_name,cover_i,first_publish_year,subject');
  return (data.docs||[]).map((b:any)=>({id:'openlibrary-'+b.key,title:b.title,type:'reading',format:'BOOK',source:'Open Library',externalIds:{openlibrary:b.key},url:'https://openlibrary.org'+b.key,cover:b.cover_i?'https://covers.openlibrary.org/b/id/'+b.cover_i+'-L.jpg':undefined,synopsis:(b.author_name||[]).join(', '),year:b.first_publish_year,genres:(b.subject||[]).slice(0,6)}));
 };
 const steam=async(q:string):Promise<CatalogWork[]>=>{
  const data=await get('https://store.steampowered.com/search/results/?term='+encodeURIComponent(q)+'&start=0&count=20&category1=998&infinite=1&json=1&cc=us&l=en');
  const out:CatalogWork[]=[],seen=new Set<string>();
  for(const chunk of String(data.results_html||'').split('data-ds-appid="').slice(1)){
   const id=chunk.match(/^(\d+)/)?.[1],name=chunk.match(/<span class="title">([^<]+)<\/span>/i)?.[1];
   if(!id||!name||seen.has(id)||/\b(soundtrack|artbook|demo|playtest|steam deck|controller|hardware)\b/i.test(name))continue;seen.add(id);
   out.push({id:'steam-'+id,title:plain(name),type:'game',format:'GAME',source:'Steam',externalIds:{steam:id},url:'https://store.steampowered.com/app/'+id,cover:'https://cdn.cloudflare.steamstatic.com/steam/apps/'+id+'/library_600x900.jpg',coverFallback:'https://cdn.cloudflare.steamstatic.com/steam/apps/'+id+'/header.jpg',platform:'Steam'});
  }return out;
 };
 const wiki=async(q:string):Promise<CatalogWork[]>=>{
  const data=await get('https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch='+encodeURIComponent('intitle:'+q+' film')+'&gsrlimit=40&prop=pageimages|description|extracts&piprop=thumbnail&pithumbsize=400&exintro=1&explaintext=1&exlimit=12');
  return Object.values(data.query?.pages||{}).flatMap((p:any)=>{
   const d=String(p.description||'').toLowerCase();if(!/film|movie|television|series|manga|manhwa|manhua|webtoon|novel|video game/.test(d)||/company|publisher|developer|actor|actress|director|producer|studio|list of/.test(d))return [];
   const origin=d+' '+String(p.extract||'').slice(0,400).toLowerCase();
   const country=/south korean|korean/.test(origin)?'KR':/japanese/.test(origin)?'JP':/chinese/.test(origin)?'CN':/french/.test(origin)?'FR':/british/.test(origin)?'GB':/american/.test(origin)?'US':undefined;
   const type=/video game/.test(d)?'game':/manga|manhwa|manhua|webtoon|novel/.test(d)?'reading':'watching';
   return [{id:'wikipedia-'+p.pageid,title:p.title,type,format:type==='game'?'GAME':/film|movie/.test(d+' '+p.title)?'MOVIE':type==='reading'?'BOOK':'SERIES',source:'Wikipedia',externalIds:{wikipedia:p.pageid},url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(p.title.replaceAll(' ','_')),country,year:Number(d.match(/\b(19|20)\d{2}\b/)?.[0])||undefined,cover:p.thumbnail?.source,synopsis:plain(p.extract)} as CatalogWork];
  });
 };
 return async(q:string):Promise<CatalogResponse>=>{
  const key=q.trim().toLowerCase();if(key.length<2)return {results:[],sources:[]};const hit=cache.get(key);if(hit&&Date.now()-hit.at<900000)return hit.value;
  if(pending.has(key))return pending.get(key)!;
  const work=(async()=>{
   const adapters=[['AniList',anilist],['Jikan',jikan],['TVmaze',tvmaze],['Open Library',books],['Steam',steam],['Wikipedia',wiki]] as const;
   const settled=await Promise.allSettled(adapters.map(([,search])=>search(q)));
   const results:CatalogWork[]=[],seen=new Set<string>();settled.forEach(r=>{if(r.status==='fulfilled')for(const item of r.value){if(!item.title)continue;const id=item.type+'|'+item.format+'|'+item.title.toLowerCase()+'|'+(item.year||'');if(!seen.has(id)){seen.add(id);results.push(item);}}});
   const value={results:results.sort((a,b)=>Number(b.title.toLowerCase().replace(/\s*\([^)]*\)$/, '')===key)-Number(a.title.toLowerCase().replace(/\s*\([^)]*\)$/, '')===key)),sources:adapters.map(([name],i)=>({name,ok:settled[i].status==='fulfilled'}))};
   if(value.sources.some(s=>s.ok)){if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),value});}
   return value;
  })();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
 };
}
