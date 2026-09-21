import {useEffect,useState} from 'react';
import {AppHeader} from '@/components/AppHeader';
import {AddWork} from '@/components/AddWork';
import {searchCatalog,type CatalogResult} from '@/lib/catalog';
import {useI18n} from '@/i18n/I18nContext';
export default function SearchPage(){
 const {lang,t}=useI18n(),fr=lang==='fr';
 const [query,setQuery]=useState(''),[results,setResults]=useState<CatalogResult[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0),[picked,setPicked]=useState<CatalogResult>();
 const [sources,setSources]=useState<{name:string;ok:boolean}[]>([]);
 const [type,setType]=useState(''),[country,setCountry]=useState(''),[year,setYear]=useState(''),[genre,setGenre]=useState('');
 useEffect(()=>{const controller=new AbortController();setResults([]);setSources([]);setError(false);setBusy(query.trim().length>=2);if(query.trim().length<2)return ()=>controller.abort();const timer=setTimeout(async()=>{try{const found=await searchCatalog(query,controller.signal,s=>{if(!controller.signal.aborted)setSources(s);});if(!controller.signal.aborted)setResults(found);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setBusy(false);}},300);return ()=>{clearTimeout(timer);controller.abort();};},[query,retry]);
 const filtered=results.filter(r=>(!type||r.type===type)&&(!country||r.country===country)&&(!year||String(r.year)===year)&&(!genre||r.genres?.includes(genre)));
 return <div className="dasi-app"><AppHeader/><main className="dasi-main"><h1>{fr?'Rechercher une œuvre':'Search for a work'}</h1><p>{fr?'Mangas, séries, films, livres et jeux. Ouvrez une fiche avant de l’ajouter.':'Manga, shows, films, books and games. Review a work before adding it.'}</p>
 <input className="catalog-query" aria-label={fr?'Titre à rechercher':'Search title'} placeholder={fr?'Titre, par exemple Aniimo…':'Title, for example Aniimo…'} value={query} onChange={e=>setQuery(e.target.value)} autoFocus/>
 <div className="catalog-filters"><label>{fr?'Type':'Type'}<select value={type} onChange={e=>setType(e.target.value)}><option value="">{fr?'Tous':'All'}</option>{(['reading','watching','game'] as const).map(v=><option key={v} value={v}>{t(`type.${v}`)}</option>)}</select></label>{([['country',fr?'Pays':'Country',country,setCountry],['year',fr?'Année':'Year',year,setYear],['genres',fr?'Genre':'Genre',genre,setGenre]] as const).map(([key,label,value,set])=><label key={key}>{label}<select value={value} onChange={e=>set(e.target.value)}><option value="">{fr?'Tous':'All'}</option>{[...new Set(results.flatMap(r=>key==='genres'?r.genres||[]:r[key]?[String(r[key])]:[]))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}</div>
 {busy?<p role="status">{fr?'Recherche en cours…':'Searching…'}</p>:error?<div role="alert"><p>{fr?'La recherche est indisponible.':'Search is unavailable.'}</p><button onClick={()=>setRetry(v=>v+1)}>{fr?'Réessayer':'Retry'}</button></div>:query.trim().length>=2?<p role="status">{filtered.length} {fr?'résultats':'results'}</p>:<p>{fr?'Saisissez au moins deux caractères.':'Enter at least two characters.'}</p>}
 {sources.some(s=>!s.ok)&&<p role="status">{fr?"Résultats partiels — sources indisponibles : ":"Partial results — unavailable sources: "}{sources.filter(s=>!s.ok).map(s=>s.name).join(", ")}</p>}
 <div className="catalog-grid">{filtered.map((r,i)=><button className="catalog-card" key={r.id||i} onClick={()=>setPicked(r)}>{r.cover?<img loading="lazy" src={r.cover} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:<span className="catalog-placeholder">{r.title[0]}</span>}<strong>{r.title}</strong><small>{[r.format||t(`type.${r.type}`),r.year,r.country].filter(Boolean).join(' · ')}</small><small>{r.source}</small></button>)}</div>
 {picked&&<AddWork initial={picked} onClose={()=>setPicked(undefined)}/>}</main></div>;
}
