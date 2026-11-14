import {describe,it,expect,vi} from 'vitest';
import {createCatalog,rankCatalogWorks,type CatalogWork} from '../server/lib/catalog';
import {createItem} from '../client/src/lib/item';
import {mergeLibraryImport} from '../client/src/lib/library-merge';
import {seedState} from '../client/src/lib/seed';
describe('catalog resilience and canonical identities',()=>{
 it('retains successful sources and caches concurrent queries',async()=>{
  const fetcher=vi.fn(async(input:any)=>{const url=String(input);if(url.includes('anilist'))throw Error('offline');if(url.includes('tvmaze'))return Response.json([{show:{id:1,name:'Animation',type:'Animation',network:{country:{code:'JP'}},externals:{},genres:[]}}]);if(url.includes('openlibrary'))return Response.json({docs:[]});if(url.includes('steampowered'))return Response.json({results_html:'data-ds-appid="4126040"><span class="title">Aniimo</span> data-ds-appid="2"><span class="title">Aniimo Soundtrack</span>'});return Response.json({query:{pages:{}}});});
  const search=createCatalog(fetcher as typeof fetch),[a,b]=await Promise.all([search('Aniimo'),search('Aniimo')]);expect(a).toEqual(b);expect(fetcher).toHaveBeenCalledTimes(7);expect(a.results[0].externalIds.steam).toBe('4126040');expect(a.results.find(r=>r.title==='Animation')?.format).toBe('ANIME');expect(a.sources.find(s=>s.name==='AniList')?.ok).toBe(false);await search('aniimo');expect(fetcher).toHaveBeenCalledTimes(7);expect(a.results).toHaveLength(2);
 });
 it('does not merge conflicting provider identities with the same title',()=>{const state={...seedState(),items:[createItem({title:'Colony',type:'watching',externalIds:{imdb:'tt1'}})]};expect(mergeLibraryImport(state,{items:[{title:'Colony',type:'watching',externalIds:{imdb:'tt2'}}]}).state.items).toHaveLength(2);});
 it('matches translated titles through a shared provider id',()=>{const state={...seedState(),items:[createItem({title:'Original title',externalIds:{anilist:123},country:'KR',genres:['Action']})]};const result=mergeLibraryImport(state,{items:[{title:'Titre traduit',externalIds:{anilist:123},chapter:5}]});expect(result.state.items).toHaveLength(1);expect(result.state.items[0].country).toBe('KR');expect(result.state.items[0].chapter).toBe(5);});
});

describe('catalogue overload protection',()=>{
 it('coalesces identical queries and refuses extra distinct requests without contacting providers',async()=>{
  const releases:Array<()=>void>=[];
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>releases.push(()=>resolve(Response.json({})))));
  const search=createCatalog(fetcher as typeof fetch,{maxPending:2});
  const one=search('first'),same=search('FIRST'),two=search('second');
  await expect(search('third')).rejects.toThrow('catalog_busy');
  expect(fetcher).toHaveBeenCalledTimes(14);
  releases.forEach(done=>done());await Promise.all([one,same,two]);
 });
 it('temporarily caches total provider failure and releases capacity after recovery',async()=>{
  let time=0;const fetcher=vi.fn(async()=>{throw Error('offline');});
  const search=createCatalog(fetcher as typeof fetch,{now:()=>time,startsPerMinute:2});
  await search('example');await search('example');expect(fetcher).toHaveBeenCalledTimes(7);
  time=30001;await search('example');expect(fetcher).toHaveBeenCalledTimes(14);
  await expect(search('different')).rejects.toThrow('catalog_busy');
  time=60001;await search('different');expect(fetcher).toHaveBeenCalledTimes(21);
 });
});


describe('catalog search relevance',()=>{
 const work=(id:string,title:string,extra:Partial<CatalogWork>={}):CatalogWork=>({id,title,type:'watching',format:'SERIES',source:'fixture',url:'https://example.com/'+id,externalIds:{},...extra});
 it('ranks exact alternative and original titles ahead of prefixes, synopsis mentions and unrelated provider results',()=>{
  const rows=[work('unrelated','Another story'),work('synopsis','A documentary',{synopsis:'A look at Solo Leveling.'}),work('prefix','Solo Leveling Ragnarok'),work('alias','Ore dake Level Up na Ken',{aliases:['Solo Leveling']}),work('native','A translated title',{originalTitle:'Solo Leveling'})];
  expect(rankCatalogWorks('solo leveling',rows).map(x=>x.id)).toEqual(['alias','native','prefix','synopsis','unrelated']);
  expect(rows[0].id).toBe('unrelated');
 });
 it('normalizes accents and punctuation while preserving non-Latin titles and numbered sequels',()=>{
  const rows=[work('sequel','Pokemon 2'),work('exact','Pokémon!'),work('wiki','Pokémon (film)')];
  expect(rankCatalogWorks('pokemon',rows).map(x=>x.id)).toEqual(['exact','wiki','sequel']);
  expect(rankCatalogWorks('進撃の巨人',[work('other','Other'),work('native','Attack on Titan',{originalTitle:'進撃の巨人'})])[0].id).toBe('native');
  expect(rankCatalogWorks('portal 2',[work('one','Portal'),work('two','Portal 2')])[0].id).toBe('two');
 });
 it('places complete word matches before incidental substrings and keeps equally relevant provider order',()=>{
  const rows=[work('partial','The Portalist'),work('word','A Portal Story'),work('first','Portal of Dreams'),work('second','Portal of Time')];
  expect(rankCatalogWorks('portal',rows).map(x=>x.id)).toEqual(['first','second','word','partial']);
  expect(rankCatalogWorks('   ',rows)).toEqual(rows);
 });
 it('applies alias relevance to federated provider responses and cached searches',async()=>{
  const fetcher=vi.fn(async(input:any)=>{
   const url=String(input);
   if(url.includes('anilist'))return Response.json({data:{Page:{media:[{id:1,title:{english:'Unrelated title'},synonyms:[],format:'TV'},{id:2,title:{english:'Ore dake Level Up na Ken',native:'나 혼자만 레벨업'},synonyms:['Solo Leveling'],format:'TV'}]}}});
   if(url.includes('jikan'))return Response.json({data:[]});
   if(url.includes('tvmaze'))return Response.json([{show:{id:3,name:'Solo Leveling Ragnarok',genres:[],externals:{}}}]);
   if(url.includes('openlibrary'))return Response.json({docs:[]});
   if(url.includes('steampowered'))return Response.json({results_html:''});
   return Response.json({query:{pages:{}}});
  });
  const search=createCatalog(fetcher as typeof fetch);
  const result=await search('Solo Leveling');
  expect(result.results.map(x=>x.id)).toEqual(['anilist-2','tvmaze-3','anilist-1']);
  expect((await search('solo leveling')).results).toEqual(result.results);
  expect(fetcher).toHaveBeenCalledTimes(7);
 });
});
