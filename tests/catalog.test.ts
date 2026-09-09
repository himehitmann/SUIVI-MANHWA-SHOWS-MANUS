import {describe,it,expect,vi} from 'vitest';
import {createCatalog} from '../server/lib/catalog';
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
