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
// Compare page numbers within their chapter and playback times within their episode.
function positionOf(item: LibraryItem): [number, number, number] {
  const n = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  if (item.type === "watching") return [n(item.season) || 1, n(item.episode), n(item.position)];
  if (item.type === "reading") return [n(item.volume) || 1, n(item.chapter), n(item.page)];
  return [1, n(item.progress), 0];
}

function mergeExistingItem(saved: LibraryItem, incoming: LibraryItem, suppliedProgress: boolean): LibraryItem {
  const previous = positionOf(saved);
  const next = positionOf(incoming);
  const sameScope = next[0] === previous[0];
  const sameUnit = sameScope && next[1] === previous[1];
  const difference = next[0] - previous[0] || next[1] - previous[1] || next[2] - previous[2];
  // A season number on its own does not establish a new viewing position.
  const advances = difference > 0 && (sameScope || next[1] > 0);
  const winner = advances ? incoming : saved;
  const other = advances ? saved : incoming;
  const total = sameScope ? Math.max(saved.total || 0, incoming.total || 0) || undefined : winner.total;
  const validTotal = total && total >= positionOf(winner)[1] ? total : undefined;
  let progress = winner.progress;
  if (difference === 0) progress = Math.max(saved.progress, incoming.progress);
  else if (advances && !suppliedProgress && validTotal) progress = Math.round(100 * next[1] / validTotal);
  else if (advances && !suppliedProgress && sameScope) progress = saved.progress;

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
    progress, total: validTotal,
  } as LibraryItem;
  if (saved.type === "reading") Object.assign(merged, {
    volume: winner.volume ?? (sameScope ? other.volume : undefined), chapter: winner.chapter,
    page: winner.page ?? (sameUnit ? other.page : undefined),
    totalPages: winner.totalPages ?? (sameUnit ? other.totalPages : undefined),
  });
  if (saved.type === "watching") Object.assign(merged, {
    season: winner.season ?? (sameScope ? other.season : undefined), episode: winner.episode,
    position: winner.position ?? (sameUnit ? other.position : undefined),
    duration: winner.duration ?? (sameUnit ? other.duration : undefined),
    episodeTitle: winner.episodeTitle || (sameUnit ? other.episodeTitle : undefined),
  });
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
