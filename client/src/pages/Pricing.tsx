import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Check } from "lucide-react";
import { BillingManagement } from "@/components/BillingManagement";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/i18n/I18nContext";
import { UNLOCK_ALL } from "@/lib/edition";
import { checkoutBase, checkoutUrl } from "@/lib/checkout";
import { syncProvider, type SyncSession } from "@/lib/sync";
import { OFFERS, annualSaving, money, pricingCopy, type OfferId } from "@shared/pricing";

export default function Pricing() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const copy=pricingCopy(lang);
  const [account,setAccount]=useState<SyncSession|null>(null);
  const [status,setStatus]=useState<"checking"|"ready"|"error">("checking");
  const busy=useRef(false),mounted=useRef(true);
  const covered=UNLOCK_ALL || account?.role==="owner" || account?.role==="admin" || account?.plan==="pro" || account?.plan==="lifetime";
  const configured=OFFERS.some(offer=>Boolean(checkoutBase("pro",offer.id==="year")));
  const checkAccount=async()=>{
    if(busy.current)return;
    busy.current=true;setStatus("checking");
    try {
      const next=syncProvider.getSession()?await syncProvider.refreshSession():null;
      if(mounted.current){setAccount(next);setStatus("ready");}
    } catch {if(mounted.current){setAccount(null);setStatus("error");}}
    finally{busy.current=false;}
  };
  useEffect(()=>{
    mounted.current=true;void checkAccount();
    return ()=>{mounted.current=false;};
  },[]);
  const subscribe=async(id:OfferId)=>{
    if(busy.current || covered || !checkoutBase("pro",id==="year"))return;
    if(!syncProvider.getSession()){navigate("/settings");return;}
    busy.current=true;setStatus("checking");
    try {
      // Read current server rights again at the moment of purchase. Cached plans
      // may predate a gift, an administrator role or another completed purchase.
      const fresh=await syncProvider.refreshSession();
      if(!mounted.current)return;
      setAccount(fresh);
      if(fresh.role==="owner"||fresh.role==="admin"||fresh.plan!=="free"){setStatus("ready");return;}
      const url=checkoutUrl("pro",id==="year",fresh);
      if(!url)throw new Error("checkout_unavailable");
      window.location.assign(url);
    } catch {if(mounted.current)setStatus("error");}
    finally {busy.current=false;}
  };
  return <div className="dasi-app">
    <AppHeader />
    <main className="dasi-main paid-pricing">
      <header className="pricing-head"><h1>{copy.title}</h1><p>{copy.subtitle}</p></header>
      <div className="pricing-status" role={status==="error"?"alert":"status"} aria-live="polite">
        {status==="checking"?copy.checking:status==="error"?copy.checkFailed:covered?copy.active:configured?copy.available:copy.unavailable}
        {status==="error"&&<button className="heart-button" onClick={()=>void checkAccount()}>{copy.retry}</button>}
      </div>
      <div className="pricing-grid">
        {OFFERS.map(offer=><section className="pricing-card" key={offer.id} aria-labelledby={"offer-"+offer.id}>
          <h2 id={"offer-"+offer.id}>Pro {copy[offer.id]}</h2>
          <div className="pricing-price"><strong>{money(offer.amount,lang)}</strong><span>{offer.id==="year"?copy.perYear:copy.perMonth}</span></div>
          <p>{offer.id==="year"?copy.yearlyCharge:copy.monthlyCharge}</p>
          <p className="pricing-saving">{offer.id==="year"?copy.saving.replace("{amount}",money(annualSaving(),lang)):""}</p>
          <button className="primary-cta full" disabled={status!=="ready"||covered||!checkoutBase("pro",offer.id==="year")} onClick={()=>void subscribe(offer.id)}>
            {covered?copy.current:!checkoutBase("pro",offer.id==="year")?copy.closed:account?copy.subscribe:copy.signIn}
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
