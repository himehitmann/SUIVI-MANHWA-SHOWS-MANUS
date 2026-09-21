import {useRef,useState} from 'react';
import {Upload} from 'lucide-react';
import {useStore} from '@/store/StoreContext';
import {useI18n} from '@/i18n/I18nContext';
declare global {interface Window {YomuImport?:{parseFiles(files:File[]):Promise<{items:unknown[];lists?:unknown[];sites?:unknown[];formats:string[];warnings:string[]}>};}}
let loaded:Promise<void>|undefined;
function loadParser(){return loaded||= (async()=>{for(const src of ['/assets/fflate.min.js','/assets/yomu-import.js'])await new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve();s.onerror=()=>reject(Error('parser_unavailable'));document.head.append(s);});})().catch(e=>{loaded=undefined;throw e;});}
export function LibraryImport(){
 const store=useStore(),{lang}=useI18n(),fr=lang==='fr',input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false),[report,setReport]=useState('');
 const run=async(files:File[])=>{
  if(!files.length)return;setBusy(true);setReport('');
  try{
   await loadParser();const parsed=await window.YomuImport!.parseFiles(files),result=store.importBackup(parsed);
   setReport((fr?result.added+' ajoutés, '+result.updated+' mis à jour, '+result.ignored+' ignorés.':result.added+' added, '+result.updated+' updated, '+result.ignored+' skipped.')+' '+parsed.formats.join(', ')+(parsed.warnings.length?' · '+parsed.warnings.join(' · '):''));
  }catch{setReport(fr?'Import impossible. Vérifie le fichier puis réessaie ; ta bibliothèque est conservée.':'Import failed. Check the file and try again; your library is unchanged.');}
  finally{setBusy(false);if(input.current)input.current.value='';}
 };
 return <div className="library-import"><button className="heart-button" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{busy?(fr?'Import en cours…':'Importing…'):(fr?'Importer une bibliothèque':'Import a library')}</button><input ref={input} hidden type="file" accept=".json,.csv,.tsv,.xml,.zip" multiple onChange={e=>run(Array.from(e.target.files||[]))}/><small>Yomu · Trakt · MyAnimeList · TV Time · IMDb · Letterboxd</small>{report&&<p role="status">{report}</p>}</div>;
}
