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
export function mergeLibraryImport(state:DasiState,backup:any){
 const items=[...state.items],ids=new Map<string,string>();let added=0,updated=0,ignored=0;
 for(const raw of backup.items||[]){
  const item=normalizeLibraryItem(raw);if(!item){ignored++;continue;}
  const old=items.find(i=>compatible(i,item)&&(i.id===item.id||Object.keys(i.externalIds||{}).some(k=>item.externalIds?.[k]!==undefined&&String(i.externalIds![k])===String(item.externalIds[k]))||sameWork(i.title,item.title)));
  const originalId=item.id;
  if(old){
   ids.set(originalId,old.id);const sameSeason=(item.season||1)===(old.season||1);
   const ahead=item.type==='watching'?((item.season||1)>(old.season||1)||sameSeason&&(item.episode||0)>=(old.episode||0)):(item.chapter||item.page||item.progress||0)>=(old.chapter||old.page||old.progress||0);
   const merged={...old,...Object.fromEntries(Object.entries(item).filter(([,v])=>v!==undefined&&v!=='')),
    id:old.id,createdAt:old.createdAt,cover:old.cover||item.cover,favorite:old.favorite||item.favorite,
    sources:[...new Set([...old.sources,...item.sources])],
    ...(!ahead?{season:old.season,episode:old.episode,chapter:old.chapter,page:old.page,progress:old.progress,status:old.status,total:old.total}:{}),
    ...(ahead&&!sameSeason?{episode:item.episode,season:item.season,total:item.total}:{}),
   } as LibraryItem;
   items[items.indexOf(old)]=merged;updated++;
  }else{
   let id=item.id;if(items.some(i=>i.id===id)){const base=id+'-'+item.type+(item.year?'-'+item.year:'');id=base;let n=2;while(items.some(i=>i.id===id))id=base+'-'+n++;}
   ids.set(originalId,id);items.push({...item,id});added++;
  }
 }
 const lists=[...state.lists];
 for(const raw of backup.lists||[]){
  if(!raw||typeof raw.id!=='string'||!Array.isArray(raw.itemIds))continue;
  const itemIds=raw.itemIds.map((id:string)=>ids.get(id)||id).filter((id:string)=>items.some(i=>i.id===id));
  const old=lists.find(l=>l.id===raw.id);
  if(old)lists[lists.indexOf(old)]={...old,itemIds:[...new Set([...old.itemIds,...itemIds])]};
  else lists.push({...raw,name:raw.name||'List',color:raw.color||'#9B86DA',itemIds,createdAt:raw.createdAt||Date.now()});
 }
 const sites=[...state.sites];for(const raw of backup.sites||[])if(raw&&webUrl(raw.url)&&!sites.some(s=>s.url===raw.url))sites.push({...raw,id:raw.id||raw.url});
 return {state:{...state,items,lists,sites},added,updated,ignored,ids};
}
