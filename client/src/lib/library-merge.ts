import "../../../import-position.js";
import {createItem,sameWork} from './item';
import type {DasiState,LibraryItem} from './types';
const webUrl=(u:unknown)=>typeof u==='string'&&/^https?:\/\//i.test(u)?u:'';
export function normalizeLibraryItem(raw:any):LibraryItem|null {
 if(!raw||typeof raw.title!=='string'||!raw.title.trim())return null;
 const type=raw.type==='game'?'game':raw.type==='watching'?'watching':'reading';
 const item=createItem({...raw,type,url:webUrl(raw.url)});
 return {...raw,...item,id:typeof raw.id==='string'&&raw.id?raw.id:item.id,
  sources:Array.isArray(raw.sources)?raw.sources.filter((s:any)=>typeof s==='string'):item.sources,
  createdAt:Number(raw.createdAt)||Number(raw.updatedAt)||0,updatedAt:Number(raw.updatedAt)||0};
}
const compatible=(a:LibraryItem,b:LibraryItem)=>a.type===b.type&&!Object.keys(a.externalIds||{}).some(k=>b.externalIds?.[k]!==undefined&&String(a.externalIds![k])!==String(b.externalIds[k]))&&(!a.year||!b.year||a.year===b.year)&&(!(a.format==='MOVIE'||b.format==='MOVIE')||!a.format||!b.format||a.format===b.format);
type ImportedPosition = Pick<LibraryItem, "chapter" | "volume" | "page" | "totalPages" | "season" | "episode" | "position" | "duration" | "episodeTitle" | "progress" | "total">;
declare const YomuImportedPosition: (saved: LibraryItem, incoming: LibraryItem, suppliedProgress?: boolean) => {
  advances: boolean; difference: number; fields: ImportedPosition;
};
function mergeExistingItem(saved: LibraryItem, incoming: LibraryItem, suppliedProgress: boolean): LibraryItem {
  const {advances, difference, fields} = YomuImportedPosition(saved, incoming, suppliedProgress);
  const winner = advances ? incoming : saved;
  const other = advances ? saved : incoming;
  // An import can fill missing information without replacing personal edits on the saved work.
  const present = Object.fromEntries(Object.entries(saved).filter(([,value]) => value !== undefined && value !== ""));
  const merged = {
    ...incoming, ...present,
    id: saved.id, title: saved.title, createdAt: saved.createdAt, updatedAt: Math.max(saved.updatedAt, incoming.updatedAt),
    externalIds: {...incoming.externalIds, ...saved.externalIds},
    tags: [...new Set([...(saved.tags || []), ...(incoming.tags || [])])],
    sources: [...new Set([...saved.sources, ...incoming.sources])],
    favorite: saved.favorite || incoming.favorite,
    url: winner.url || other.url, domain: winner.domain || other.domain,
    status: saved.status === "in_progress" && (advances || difference === 0) ? incoming.status : saved.status,
    ...fields,
  } as LibraryItem;
  return merged;
}

export function mergeLibraryImport(state:DasiState,backup:any){
 const items=[...state.items],ids=new Map<string,string>();let added=0,updated=0,ignored=0;
 for(const raw of backup.items||[]){
  const item=normalizeLibraryItem(raw);if(!item){ignored++;continue;}
  const old=items.find(i=>compatible(i,item)&&(i.id===item.id||Object.keys(i.externalIds||{}).some(k=>item.externalIds?.[k]!==undefined&&String(i.externalIds![k])===String(item.externalIds[k]))||sameWork(i.title,item.title)));
  const originalId=item.id;
  if(old){
   ids.set(originalId,old.id);
   items[items.indexOf(old)] = mergeExistingItem(old, item, Number.isFinite(raw.progress));
   updated++;
  }else{
   let id=item.id;if(items.some(i=>i.id===id)){const base=id+'-'+item.type+(item.year?'-'+item.year:'');id=base;let n=2;while(items.some(i=>i.id===id))id=base+'-'+n++;}
   ids.set(originalId,id);items.push({...item,id});added++;
  }
 }
 const knownItemIds=new Set(items.map(item=>item.id));
 const lists=[...state.lists];
 for(const raw of backup.lists||[]){
  if(!raw||typeof raw.id!=='string'||!Array.isArray(raw.itemIds))continue;
  const itemIds=raw.itemIds.map((id:string)=>ids.get(id)||id).filter((id:string)=>knownItemIds.has(id));
  const old=lists.find(l=>l.id===raw.id);
  if(old)lists[lists.indexOf(old)]={...old,itemIds:[...new Set([...old.itemIds,...itemIds])]};
  else lists.push({...raw,name:raw.name||'List',color:raw.color||'#9B86DA',itemIds,createdAt:raw.createdAt||Date.now()});
 }
 const sites=[...state.sites];for(const raw of backup.sites||[])if(raw&&webUrl(raw.url)&&!sites.some(s=>s.url===raw.url))sites.push({...raw,id:raw.id||raw.url});
 return {state:{...state,items,lists,sites},added,updated,ignored,ids};
}
