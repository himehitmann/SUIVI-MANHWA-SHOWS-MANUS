import {afterEach,describe,expect,it,vi} from 'vitest';
import {searchCatalog} from '../client/src/lib/catalog';
import {createItem} from '../client/src/lib/item';
vi.mock('../client/src/lib/sync',()=>({serviceApiUrl:()=>''}));
afterEach(()=>vi.unstubAllGlobals());
describe('standalone catalog metadata',()=>{
 it('keeps canonical identity and rich metadata when adding a fallback result',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({data:{anime:{media:[{id:21,idMal:321,title:{english:'A show',romaji:'Show',native:'作品'},synonyms:['Alternative title'],format:'TV',countryOfOrigin:'JP',seasonYear:2025,episodes:12,description:'<b>A story</b> &amp; more',genres:['Drama'],siteUrl:'javascript:alert(1)',coverImage:{large:'https://example.com/large.jpg',medium:'https://example.com/small.jpg'}}]},manga:{media:[]}}}));
  vi.stubGlobal('fetch',fetcher);const source=vi.fn(),results=await searchCatalog('A show',undefined,source);
  const saved=createItem(results[0]);
  expect(saved.externalIds).toEqual({anilist:21,malAnime:321});
  expect(saved).toMatchObject({title:'A show',url:'https://anilist.co/anime/21',total:12,year:2025,format:'ANIME',synopsis:'A story & more',cover:'https://example.com/large.jpg'});
  expect(results[0].aliases).toContain('Alternative title');expect(results[0].originalTitle).toBe('作品');
  expect(source).toHaveBeenCalledWith([{name:'AniList',ok:true}]);
  const request=JSON.parse(fetcher.mock.calls[0][1]!.body as string);expect(request.query).toContain('isAdult: false');expect(request.query).toContain('idMal');
 });
 it('keeps unknown counts unknown and rejects invalid identities',async()=>{
  vi.stubGlobal('fetch',async()=>Response.json({data:{anime:{media:[{id:0,title:{english:'Invalid'},coverImage:{}}]},manga:{media:[{id:32,idMal:0,title:{native:'作品'},format:'MANGA',countryOfOrigin:'KR',chapters:null,coverImage:{}}]}}}));
  const results=await searchCatalog('作品');
  expect(results).toHaveLength(1);expect(results[0]).toMatchObject({title:'作品',format:'MANHWA',url:'https://anilist.co/manga/32',externalIds:{anilist:32}});
  expect(results[0].total).toBeUndefined();
 });
 it('reports provider GraphQL failures instead of presenting them as empty results',async()=>{
  vi.stubGlobal('fetch',async()=>Response.json({errors:[{message:'Rate limit'}]}));
  await expect(searchCatalog('Example')).rejects.toThrow('Catalog unavailable');
 });
});
