import {useEffect,useState} from "react";
import {billingPortalCopy} from "@shared/billing-portal";
import {syncProvider,type SyncSession} from "@/lib/sync";

export function BillingManagement({session,lang}:{session:SyncSession|null;lang:string}) {
  const copy=billingPortalCopy(lang),key=session?.userId||"";
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<{key:string;status:"loading"|"ready"|"unavailable"|"error";url?:string}>({key:"",status:"loading"});
  useEffect(()=>{
    let current=true;
    if (!key) return;
    setState({key,status:"loading"});
    void syncProvider.billingPortal().then(url=>{
      if(current)setState({key,status:url?"ready":"unavailable",url:url||undefined});
    },()=>{if(current)setState({key,status:"error"});});
    return ()=>{current=false;};
  },[key,attempt]);
  if(!key)return null;
  const status=state.key===key?state.status:"loading";
  return <section className="billing-management" aria-label={copy.title} style={{marginTop:20,overflowWrap:"anywhere"}}>
    <h3>{copy.title}</h3>
    <p role="status" aria-live="polite">{status==="loading"?copy.loading:status==="error"?copy.error:status==="unavailable"?copy.unavailable:""}</p>
    {status==="ready"&&<a className="billing-portal-link" href={state.url} target="_blank" rel="noopener noreferrer">{copy.label}</a>}
    {status==="error"&&<button type="button" className="heart-button" onClick={()=>setAttempt(n=>n+1)}>{copy.retry}</button>}
    <p>{copy.help}</p>
    <p>{copy.deletion}</p>
  </section>;
}
