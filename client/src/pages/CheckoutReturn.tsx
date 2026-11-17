import {useEffect,useRef,useState} from "react";
import {Link,useLocation} from "wouter";
import {AppHeader} from "@/components/AppHeader";
import {BillingManagement} from "@/components/BillingManagement";
import {useI18n} from "@/i18n/I18nContext";
import {useStore} from "@/store/StoreContext";
import {syncProvider,currentAccountScope,type SyncSession} from "@/lib/sync";
import {CHECKOUT_CHECK_DELAYS,checkoutFollowupCopy,forgetCheckout,hasProAccess} from "@/lib/checkout-followup";

type Status="checking"|"active"|"pending"|"failed"|"changed"|"unavailable"|"signIn";
export default function CheckoutReturn(){
 const {lang}=useI18n(),copy=checkoutFollowupCopy(lang),store=useStore();
 const [,navigate]=useLocation();
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 const [closing,setClosing]=useState(false);
 const [attempt,setAttempt]=useState(0),[status,setStatus]=useState<Status>("checking");
 const [account,setAccount]=useState<SyncSession|null>(syncProvider.getSession());
 const setPlan=store.setPlan;
 useEffect(()=>{
  let live=true,timer:ReturnType<typeof setTimeout>|undefined,waiting:(()=>void)|undefined;
  const scope=currentAccountScope();
  setAccount(syncProvider.getSession());setStatus("checking");
  if(!syncProvider.isConfigured()){setStatus("unavailable");return;}
  if(!scope){setStatus("signIn");return;}
  const visible=()=>new Promise<void>(resolve=>{
   if(document.visibilityState!=="hidden"){resolve();return;}
   waiting=()=>{if(document.visibilityState!=="hidden"){document.removeEventListener("visibilitychange",waiting!);waiting=undefined;resolve();}};
   document.addEventListener("visibilitychange",waiting);
  });
  const check=async(index:number)=>{
   await visible();
   if(!live)return;
   if(currentAccountScope()!==scope){setAccount(null);setStatus("changed");return;}
   try{
    const fresh=await syncProvider.refreshSession();
    if(!live)return;
    if(currentAccountScope()!==scope){setAccount(null);setStatus("changed");return;}
    setAccount(fresh);
    if(hasProAccess(fresh)){
     forgetCheckout(scope);setPlan(fresh.plan==="lifetime"?"lifetime":"pro");setStatus("active");return;
    }
    if(index+1<CHECKOUT_CHECK_DELAYS.length){
     timer=setTimeout(()=>{void check(index+1);},CHECKOUT_CHECK_DELAYS[index+1]);
    }else setStatus("pending");
   }catch{
    if(live){
     const changed=currentAccountScope()!==scope;
     if(changed)setAccount(null);
     setStatus(changed?"changed":"failed");
    }
   }
  };
  void check(0);
  return ()=>{live=false;clearTimeout(timer);if(waiting)document.removeEventListener("visibilitychange",waiting);};
 },[attempt,setPlan]);
 const restart=async()=>{
  if(closing||!window.confirm(copy.confirm))return;
  setClosing(true);
  try{
   await syncProvider.expireCheckout();
   if(!mounted.current)return;
   forgetCheckout(currentAccountScope());navigate("/pricing");
  }catch{if(mounted.current)setStatus("failed");}
  finally{if(mounted.current)setClosing(false);}
 };
 return <div className="dasi-app">
  <AppHeader/>
  <main className="dasi-main" style={{maxWidth:720,paddingBottom:48,overflowWrap:"anywhere"}}>
   <h1>{copy.title}</h1>
   {account&&<p>{account.email}</p>}
   <p role={status==="failed"||status==="changed"?"alert":"status"} aria-live="polite">{copy[status]}</p>
   <p>{copy.detail}</p>
   <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:24}}>
    {status==="active"&&<Link href="/collections" className="primary-cta">{copy.library}</Link>}
    {["pending","failed","changed"].includes(status)&&<button className="heart-button" onClick={()=>setAttempt(n=>n+1)}>{copy.retry}</button>}
    <Link href="/settings" className="heart-button">{copy.settings}</Link>
   </div>
   <BillingManagement session={account} lang={lang}/>
   {["pending","failed"].includes(status)&&<button className="ghost" disabled={closing} style={{marginTop:24}} onClick={()=>void restart()}>{copy.stop}</button>}
  </main>
 </div>;
}
