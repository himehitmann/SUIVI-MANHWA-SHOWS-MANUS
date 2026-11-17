import {createHash,randomUUID} from "node:crypto";
import {OFFERS,type OfferId} from "../../shared/pricing";
import {checkoutSessionUrl} from "../../shared/checkout-session";
import type {CheckoutAttempt,CheckoutStore} from "./checkout-store";
import {readStripeJson} from "./stripe-checkout";

export class CheckoutError extends Error {}
export interface CheckoutConfig {enabled:boolean;key:string;origin:string;month?:string;year?:string;}
export function checkoutConfig(env:Record<string,string|undefined>=process.env):CheckoutConfig|null{
 try{
  const u=new URL(env.YOMU_PUBLIC_URL||"");
  if(u.username||u.password||u.search||u.hash||u.pathname!=="/"||
   !(u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname))))return null;
  const key=env.STRIPE_SECRET_KEY||"";
  if(!key||!env.STRIPE_WEBHOOK_SECRET)return null;
  const price=(value:string|undefined)=>value&&/^price_[A-Za-z0-9_]+$/.test(value)?value:undefined;
  const month=price(env.STRIPE_PRICE_PRO_MONTH),year=price(env.STRIPE_PRICE_PRO_YEAR);
  if(!month&&!year||month&&month===year)return null;
  return {enabled:env.YOMU_CHECKOUT_ENABLED==="true",key,origin:u.origin,month,year};
 }catch{return null;}
}
export function createManagedCheckout(store:CheckoutStore,config:CheckoutConfig,request:typeof fetch=fetch,now=()=>Date.now()){
 const keyHash=createHash("sha256").update(config.key).digest("hex");
 const fail=(code="checkout_unavailable"):never=>{throw new CheckoutError(code);};
 const post=async(path:string,body:string,id:string)=>{
  const response=await request("https://api.stripe.com/v1/"+path,{
   method:"POST",headers:{Authorization:"Bearer "+config.key,"Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":"yomu-checkout-"+id},
   body,signal:AbortSignal.timeout(5000),redirect:"error",
  });
  // Use the same bounded reader for the POST response without another HTTP call.
  return readStripeJson("unused",config.key,async()=>response);
 };
 const validate=(session:any,attempt:CheckoutAttempt)=>{
  if(session?.object!=="checkout.session"||!/^cs_[A-Za-z0-9_]{1,200}$/.test(session.id||"")||
   session.mode!=="subscription"||session.client_reference_id!==attempt.userId||
   session.metadata?.userId!==attempt.userId||
   (attempt.sessionId&&session.id!==attempt.sessionId))fail();
  return session;
 };
 const current=async(attempt:CheckoutAttempt)=>{
  if(attempt.keyHash!==keyHash)fail("checkout_review_required");
  let id=attempt.sessionId;
  if(!id){
   // Stripe may discard idempotency keys after 24 hours. Never retry an unknown
   // creation past that guarantee with a key that might create a second session.
   if(now()-attempt.createdAt>=23*3600000||now()<attempt.createdAt)fail("checkout_review_required");
   const created=validate(await post("checkout/sessions",attempt.body,attempt.id),attempt);
   id=created.id;
   if(!await store.attach(attempt.userId,attempt.id,id!))fail("checkout_pending");
  }
  return validate(await readStripeJson("checkout/sessions/"+id,config.key,request),{...attempt,sessionId:id});
 };
 return {
  offers:()=>config.enabled===true?OFFERS.filter(o=>config[o.id]).map(o=>o.id):[],
  async begin(user:{id:string;email:string},offer:OfferId){
   // Closing new sales must not disable existing account, webhook or expiry routes.
   if(config.enabled!==true)return fail("checkout_closed");
   const priceId=config[offer],advertised=OFFERS.find(o=>o.id===offer);
   if(!priceId||!advertised)return fail();
   let attempt=await store.read(user.id);
   if(!attempt){
    const price=await readStripeJson("prices/"+priceId,config.key,request);
    if(price?.id!==priceId||price.object!=="price"||price.active!==true||price.currency!=="usd"||
     price.unit_amount!==advertised.amount||price.type!=="recurring"||
     price.recurring?.interval!==offer||price.recurring?.interval_count!==1)fail("checkout_price_mismatch");
    const body=new URLSearchParams({
     mode:"subscription","adaptive_pricing[enabled]":"false","line_items[0][price]":priceId,"line_items[0][quantity]":"1",
     client_reference_id:user.id,customer_email:user.email,
     "metadata[userId]":user.id,"subscription_data[metadata][userId]":user.id,
     success_url:config.origin+"/billing/return",cancel_url:config.origin+"/billing/return",
    }).toString();
    attempt=await store.reserve({id:randomUUID(),userId:user.id,offer,priceId,createdAt:now(),body,keyHash});
   }
   const session=await current(attempt);
   if(session.status==="expired"){
    await store.clear(user.id,attempt.id);fail("checkout_expired");
   }
   if(session.status==="complete"){
    // A canceled, terminal subscription permits a future renewal. Pending,
    // past-due and active subscriptions must use billing management instead.
    const id=typeof session.subscription==="string"?session.subscription:session.subscription?.id;
    if(!/^sub_[A-Za-z0-9_]{1,200}$/.test(id||""))fail("checkout_pending");
    const subscription=await readStripeJson("subscriptions/"+id,config.key,request);
    if(subscription?.id!==id||subscription.object!=="subscription"||subscription.metadata?.userId!==user.id)fail("checkout_review_required");
    if(["canceled","incomplete_expired"].includes(subscription.status)){
     await store.clear(user.id,attempt.id);fail("checkout_expired");
    }
    fail("checkout_pending");
   }
   if(session.status!=="open")fail();
   if(attempt.offer!==offer)fail("checkout_pending");
   const url=checkoutSessionUrl(session.url);
   if(!url||new URL(url).pathname!=="/c/pay/"+session.id)return fail();
   return {url,offer:attempt.offer};
  },
  async expire(userId:string){
   const attempt=await store.read(userId);if(!attempt)return;
   let session=await current(attempt);
   if(session.status==="open")session=validate(await post("checkout/sessions/"+session.id+"/expire","",attempt.id+"-expire"),{...attempt,sessionId:session.id});
   if(session.status!=="expired")fail("checkout_pending");
   if(!await store.clear(userId,attempt.id))fail("checkout_pending");
  },
 };
}
export type ManagedCheckout=ReturnType<typeof createManagedCheckout>;
