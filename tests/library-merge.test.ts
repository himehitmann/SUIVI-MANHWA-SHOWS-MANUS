import {describe,it,expect} from 'vitest';
import {mergeLibraryImport,normalizeLibraryItem} from '../client/src/lib/library-merge';
import {seedState} from '../client/src/lib/seed';
import {createItem} from '../client/src/lib/item';
describe('web library interoperability',()=>{
 it('starts new accounts without fake library items, sites or notifications',()=>{const s=seedState();for(const k of ['items','sites','lists','notifications'] as const)expect(s[k]).toEqual([]);});
 it('imports extension games without dropping their id, metadata or progress',()=>{
  const item=normalizeLibraryItem({id:'steam-4126040',title:'Aniimo',type:'game',externalIds:{steam:4126040},tags:['RPG'],released:false,url:'https://store.steampowered.com/app/4126040',progress:10});
  expect(item?.id).toBe('steam-4126040');expect(item?.type).toBe('game');expect(item?.externalIds?.steam).toBe(4126040);expect(item?.tags).toEqual(['RPG']);expect(item?.progress).toBe(10);
 });
 it('preserves a library when importing a partial backup',()=>{
  const before={...seedState(),items:[createItem({title:'Saved',chapter:20})]},result=mergeLibraryImport(before,{version:2,items:[{id:'new',title:'Imported',type:'reading'}],lists:[{id:'list',name:'Imported list',itemIds:['new']}]});
  expect(result.state.items).toHaveLength(2);expect(result.state.lists[0].itemIds).toEqual(['new']);expect(result.added).toBe(1);
 });
 it('separates adaptations and remaps their imported list references',()=>{
  const before={...seedState(),items:[createItem({title:'Solo Leveling',type:'reading'})]};
  const result=mergeLibraryImport(before,{items:[{id:'solo-leveling',title:'Solo Leveling',type:'watching'}],lists:[{id:'anime',itemIds:['solo-leveling']}]});
  expect(result.state.items).toHaveLength(2);expect(result.state.lists[0].itemIds).toEqual(['solo-leveling-watching']);
 });
 it('keeps furthest progression, while accepting the first episode of the next season',()=>{
  const before={...seedState(),items:[createItem({title:'Show',type:'watching',season:1,episode:20,total:20})]};
  const older=mergeLibraryImport(before,{items:[{title:'Show',type:'watching',season:1,episode:2}]}).state;
  expect(older.items[0].episode).toBe(20);
  const next=mergeLibraryImport(older,{items:[{title:'Show',type:'watching',season:2,episode:1,total:10}]}).state;
  expect(next.items[0].season).toBe(2);expect(next.items[0].episode).toBe(1);expect(next.items[0].total).toBe(10);
 });
 it('drops unsafe links and keeps timestamps deterministic for legacy records',()=>{
  const a=normalizeLibraryItem({id:'x',title:'Title',url:'javascript:alert(1)'});
  expect(a?.url).toBe('');expect(a?.updatedAt).toBe(0);expect(normalizeLibraryItem(a)).toEqual(a);
 });
});

describe("reimporting progress into a personal library",()=>{
 const merged=(saved:any, incoming:any[])=>mergeLibraryImport({...seedState(),items:[normalizeLibraryItem(saved)!]}, {items:incoming}).state.items[0];
 it("retains personal fields, later pages, provider ids and list memberships on repeated imports",()=>{
  const saved={id:"comic",type:"reading",title:"My title",volume:2,chapter:12.75,page:8,total:30,progress:43,status:"on_hold",notes:"My notes",rating:4,favorite:true,tags:["Mine"],notifyUpdates:false,externalIds:{anilist:"42",mal:"7"},url:"https://reader.example/current",updatedAt:100};
  const incoming={...saved,id:"export-id",title:"Catalogue title",page:2,notes:"Other note",rating:1,favorite:false,notifyUpdates:true,status:"completed",progress:100,tags:["Imported"],externalIds:{anilist:"42",book:"8"},url:"https://other.example/older",updatedAt:1};
  const before={...seedState(),items:[normalizeLibraryItem(saved)!]};
  const backup={items:[incoming],lists:[{id:"tracker",itemIds:["export-id"]}]};
  const first=mergeLibraryImport(before,backup).state;
  expect(first.items[0]).toMatchObject({...saved,tags:["Mine","Imported"],externalIds:{anilist:"42",mal:"7",book:"8"}});
  expect(first.lists[0].itemIds).toEqual(["comic"]);
  expect(mergeLibraryImport(first,backup).state).toEqual(first);
 });
 it("starts a later chapter or volume at its own page and ignores an older volume",()=>{
  const saved={id:"comic",type:"reading",title:"Comic",volume:2,chapter:12.75,page:88,totalPages:90,total:30,progress:40};
  const newer=merged(saved,[{...saved,chapter:13,page:undefined,totalPages:undefined,progress:undefined}]);
  expect(newer).toMatchObject({chapter:13,total:30,progress:43});
  expect(newer.page).toBeUndefined();expect(newer.totalPages).toBeUndefined();
  const last=merged(saved,[{id:"comic",title:"Comic",type:"reading",volume:3,chapter:1,page:2},{...saved,chapter:25,page:55}]);
  expect(last).toMatchObject({volume:3,chapter:1,page:2});expect(last.total).toBeUndefined();
 });
 it("keeps playback time with its episode, and does not advance to an unstarted season",()=>{
  const saved={id:"show",type:"watching",title:"Show",season:1,episode:8,position:500,duration:900,episodeTitle:"Eight",notes:"Keep",total:10};
  expect(merged(saved,[{...saved,position:10}])).toMatchObject({episode:8,position:500,duration:900});
  expect(merged(saved,[{id:"show",type:"watching",title:"Show",season:2}])).toMatchObject({season:1,episode:8,position:500});
  const next=merged(saved,[{id:"show",type:"watching",title:"Show",season:2,episode:1}]);
  expect(next).toMatchObject({season:2,episode:1,notes:"Keep"});
  for(const field of ["position","duration","episodeTitle","total"] as const)expect(next[field]).toBeUndefined();
 });
 it("compares game completion as a percentage even when an old record contains reading fields",()=>{
  const saved={id:"game",type:"game",title:"Game",progress:80,chapter:2,notes:"Keep"};
  expect(merged(saved,[{...saved,progress:10,chapter:100}])).toMatchObject({progress:80,notes:"Keep"});
  expect(merged(saved,[{...saved,progress:90}]).progress).toBe(90);
 });
});
