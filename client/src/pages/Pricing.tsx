import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check } from "lucide-react";
import { BillingManagement } from "@/components/BillingManagement";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/i18n/I18nContext";
import { UNLOCK_ALL } from "@/lib/edition";
import { syncProvider, currentAccountScope, type SyncSession } from "@/lib/sync";
import {checkoutPending,rememberCheckout,forgetCheckout,hasProAccess,checkoutFollowupCopy} from "@/lib/checkout-followup";
import { OFFERS, annualSaving, money, pricingCopy, type OfferId } from "@shared/pricing";

export default function Pricing() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const copy=pricingCopy(lang),followup=checkoutFollowupCopy(lang);
  const [offers,setOffers]=useState<OfferId[]>([]);
  const [account,setAccount]=useState<SyncSession|null>(null);
  const [status,setStatus]=useState<"checking"|"ready"|"error">("checking");
  const busy=useRef(false),mounted=useRef(true);
  const covered=UNLOCK_ALL || hasProAccess(account);
  const pending=Boolean(account)&&checkoutPending(currentAccountScope());
  const configured=offers.length>0;
  const checkAccount=async()=>{
    if(busy.current)return;
    busy.current=true;setStatus("checking");
    try {
      const available=await syncProvider.checkoutOffers();
      const next=syncProvider.getSession()?await syncProvider.refreshSession():null;
      if(mounted.current)setOffers(available);
      if(mounted.current){if(hasProAccess(next))forgetCheckout(currentAccountScope());setAccount(next);setStatus("ready");}
    } catch {if(mounted.current){setAccount(null);setStatus("error");}}
    finally{busy.current=false;}
  };
  useEffect(()=>{
    mounted.current=true;void checkAccount();
    const recheck=()=>{if(document.visibilityState!=="hidden")void checkAccount();};
    window.addEventListener("pageshow",recheck);
    window.addEventListener("focus",recheck);
    document.addEventListener("visibilitychange",recheck);
    return ()=>{mounted.current=false;window.removeEventListener("pageshow",recheck);window.removeEventListener("focus",recheck);document.removeEventListener("visibilitychange",recheck);};
  },[]);
  const subscribe=async(id:OfferId)=>{
    if(busy.current || covered || !offers.includes(id))return;
    if(!syncProvider.getSession()){navigate("/settings");return;}
    if(checkoutPending(currentAccountScope())){navigate("/billing/return");return;}
    busy.current=true;setStatus("checking");
    try {
      // Read current server rights again at the moment of purchase. Cached plans
      // may predate a gift, an administrator role or another completed purchase.
      const fresh=await syncProvider.refreshSession();
      if(!mounted.current)return;
      setAccount(fresh);
      if(hasProAccess(fresh)){forgetCheckout(currentAccountScope());setStatus("ready");return;}
      rememberCheckout(currentAccountScope());
      const url=await syncProvider.beginCheckout(id);
      if(!mounted.current)return;
      window.location.assign(url);
    } catch(error){
      if(!mounted.current)return;
      const code=error instanceof Error?error.message:"";
      if(code==="access_already_active"){forgetCheckout(currentAccountScope());navigate("/billing/return");return;}
      if(code==="checkout_expired"){forgetCheckout(currentAccountScope());setStatus("error");return;}
      if(code==="checkout_pending"){navigate("/billing/return");return;}
      setStatus("error");
    }
    finally {busy.current=false;}
  };
  return <div className="dasi-app">
    <AppHeader />
    <main className="dasi-main paid-pricing">
      <header className="pricing-head"><h1>{copy.title}</h1><p>{copy.subtitle}</p></header>
      <div className="pricing-status" role={status==="error"?"alert":"status"} aria-live="polite">
        {status==="checking"?copy.checking:status==="error"?(pending?followup.failed:copy.checkFailed):covered?copy.active:configured?copy.available:copy.unavailable}
        {status==="error"&&<button className="heart-button" onClick={()=>void checkAccount()}>{copy.retry}</button>}
      </div>
      {pending&&!covered&&<section aria-label={followup.review}>
        <p role="status">{followup.inProgress}</p>
        <Link href="/billing/return" className="heart-button">{followup.review}</Link>
      </section>}
      <div className="pricing-grid">
        {OFFERS.map(offer=><section className="pricing-card" key={offer.id} aria-labelledby={"offer-"+offer.id}>
          <h2 id={"offer-"+offer.id}>Pro {copy[offer.id]}</h2>
          <div className="pricing-price"><strong>{money(offer.amount,lang)}</strong><span>{offer.id==="year"?copy.perYear:copy.perMonth}</span></div>
          <p>{offer.id==="year"?copy.yearlyCharge:copy.monthlyCharge}</p>
          <p className="pricing-saving">{offer.id==="year"?copy.saving.replace("{amount}",money(annualSaving(),lang)):""}</p>
          <button className="primary-cta full" disabled={status!=="ready"||covered||pending||!offers.includes(offer.id)} onClick={()=>void subscribe(offer.id)}>
            {covered?copy.current:!offers.includes(offer.id)?copy.closed:account?copy.subscribe:copy.signIn}
          </button>
        </section>)}
      </div>
      <p className="pricing-currency">{copy.currency}</p>
      <section className="pricing-benefits" aria-labelledby="pricing-benefits-title">
        <h2 id="pricing-benefits-title">{copy.benefits}</h2>
        <ul>{copy.features.map(feature=><li key={feature}><Check size={18} aria-hidden="true"/><span>{feature}</span></li>)}</ul>
        <p>{copy.limits}</p>
      </section>
      <BillingManagement session={syncProvider.getSession()} lang={lang} />
      <nav className="pricing-actions" aria-label={copy.settings}>
        <button className="heart-button" onClick={()=>navigate("/settings")}>{copy.settings}</button>
        <button className="heart-button" onClick={()=>navigate("/collections")}>{copy.library}</button>
      </nav>
    </main>
  </div>;
}
