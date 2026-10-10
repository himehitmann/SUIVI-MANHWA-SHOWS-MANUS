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
