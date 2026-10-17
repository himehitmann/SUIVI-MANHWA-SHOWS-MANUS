import {useState} from 'react';
import {Link,useParams} from 'wouter';
import {ArrowLeft,ExternalLink,Heart} from 'lucide-react';
import {toast} from 'sonner';
import {AppHeader} from '@/components/AppHeader';
import {Cover} from '@/components/Bits';
import {useStore} from '@/store/StoreContext';
import {useI18n} from '@/i18n/I18nContext';
import type {ItemStatus} from '@/lib/types';
import NotFound from './NotFound';
export default function WorkDetail(){
 const store=useStore(),{lang,t}=useI18n(),fr=lang==='fr',params=useParams();
 const item=store.items.find(i=>i.id===params.id||encodeURIComponent(i.id)===params.id);
 const [number,setNumber]=useState(item?.episode||item?.chapter||item?.progress||0),[season,setSeason]=useState(item?.season||1);
 const [status,setStatus]=useState<ItemStatus>(item?.status||'in_progress'),[notes,setNotes]=useState(item?.notes||''),[rating,setRating]=useState(item?.rating||0);
 if(!item)return <NotFound/>;
 const unit=item.type==='game'?(fr?'Progression (%)':'Progress (%)'):item.type==='watching'?(fr?'Épisode':'Episode'):(fr?'Chapitre':'Chapter');
 const total=item.type==='game'?100:item.type==='watching'&&season!==(item.season||1)?undefined:item.total;
 const save=()=>{const n=status==='completed'&&total?total:number;store.updateItem(item.id,{status,notes,rating,...(total?{progress:Math.round(100*n/total)}:{}),...(item.type==='game'?{progress:n}:item.type==='watching'?{episode:n,season,total}:{chapter:n})});toast.success(fr?'Progression enregistrée.':'Progress saved.');};
 return <div className="dasi-app"><AppHeader/><main className="dasi-main work-detail">
  <Link href="/" className="back-link"><ArrowLeft size={16}/>{t('nav.library')}</Link>
  <section className="work-heading"><Cover item={item} className="work-poster"/><div><span className="eyebrow">{item.format||t(`type.${item.type}`)}</span><h1>{item.title}</h1><p>{[item.year,item.country,item.platform,item.releaseDate].filter(Boolean).join(' · ')}</p>
   <div className="work-tags">{(item.tags||item.genres||[]).map(tag=><span key={tag}>{tag}</span>)}</div>
   <div className="settings-actions">{item.url&&<a className="primary-cta" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{fr?'Ouvrir la source':'Open source'}</a>}<button className="heart-button" aria-pressed={item.favorite} onClick={()=>store.toggleFavorite(item.id)}><Heart size={16} fill={item.favorite?'currentColor':'none'}/>{fr?'Favori':'Favorite'}</button></div>
   {item.synopsis&&<details className="work-synopsis" open><summary>Synopsis</summary><p>{item.synopsis}</p></details>}
  </div></section>
  <div className="work-columns"><section className="settings-card"><h2>{fr?'Ma progression':'My progress'}</h2><div className="work-fields">
   {item.type==='watching'&&<label>{fr?'Saison':'Season'}<input type="number" min={1} value={season} onChange={e=>setSeason(Math.max(1,Number(e.target.value)||1))}/></label>}
   <label>{unit}{total?' / '+total:''}<input type="number" min={0} max={total} value={number} onChange={e=>setNumber(Math.max(0,Math.min(total||Infinity,Number(e.target.value)||0)))}/></label>
   <label>{fr?'Statut':'Status'}<select value={status} onChange={e=>setStatus(e.target.value as ItemStatus)}>{(['planned','in_progress','completed','on_hold','dropped'] as const).map((s,i)=><option key={s} value={s}>{(fr?['À commencer','En cours','Terminé','En pause','Abandonné']:['Planned','In progress','Completed','On hold','Dropped'])[i]}</option>)}</select></label>
   <label>{fr?'Ma note / 10':'My rating / 10'}<input type="number" min={0} max={10} step={0.5} value={rating} onChange={e=>setRating(Math.max(0,Math.min(10,Number(e.target.value)||0)))}/></label>
  </div><label>{fr?'Notes personnelles':'Personal notes'}<textarea rows={5} maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="primary-cta" onClick={save}>{t('action.save')}</button></section>
  <section className="settings-card"><h2>{fr?'Mes listes':'My lists'}</h2>{store.lists.length?store.lists.map(list=><label className="work-membership" key={list.id}><input type="checkbox" checked={list.itemIds.includes(item.id)} onChange={e=>e.target.checked?store.addItemToList(list.id,item.id):store.removeItemFromList(list.id,item.id)}/>{list.name}</label>):<p>{fr?'Crée une liste pour organiser cette œuvre.':'Create a list to organize this work.'}</p>}<Link href="/collections" className="back-link">{fr?'Gérer mes listes':'Manage lists'}</Link><h3>{fr?'Sources enregistrées':'Saved sources'}</h3>{item.sources.map(source=><p key={source}>{source}</p>)}</section></div>
 </main></div>;
}
