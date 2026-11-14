import {billingReceipt,planFromStripeEvent,type PriceMap} from "./billing";
import {completeStripeCheckout,readStripeJson} from "./stripe-checkout";

const id=(value:any)=>typeof value==="string"?value:value?.id;
const fail=():never=>{throw new Error("billing_lookup_unavailable");};
function list(value:any):any[]{
  if(value?.object!=="list"||value.has_more!==false||!Array.isArray(value.data))return fail();
  return value.data;
}

/** Call only after signature verification. Partial/pending refunds never revoke access. */
export async function resolveStripeRefund(event:any,map:PriceMap,secretKey:string,request:typeof fetch=fetch){
  if(!map.lifetime||!["charge.refunded","refund.created","refund.updated"].includes(event?.type))return null;
  const object=event?.data?.object;
  if(event.type!=="charge.refunded"&&object?.status!=="succeeded")return null;
  const chargeId=event.type==="charge.refunded"?object?.id:id(object?.charge);
  if(!/^ch_[A-Za-z0-9_]{1,200}$/.test(chargeId||""))return fail();
  // Read current state: a delayed event must not confuse pending/failed refunds with money returned.
  const charge=await readStripeJson("charges/"+encodeURIComponent(chargeId),secretKey,request);
  if(charge?.id!==chargeId||charge.object!=="charge")return fail();
  if(charge.refunded!==true)return null;
  if(!Number.isSafeInteger(charge.amount)||charge.amount<=0||charge.amount_refunded!==charge.amount)return fail();
  const paymentId=id(charge.payment_intent);
  if(!/^pi_[A-Za-z0-9_]{1,200}$/.test(paymentId||""))return null;
  const refunds=list(await readStripeJson("refunds?charge="+encodeURIComponent(chargeId)+"&limit=100",secretKey,request));
  let returned=0;const seen=new Set<string>();
  for(const refund of refunds){
    if(typeof refund?.id!=="string"||seen.has(refund.id)||id(refund.charge)!==chargeId||
       refund.currency!==charge.currency||!Number.isSafeInteger(refund.amount)||refund.amount<=0)return fail();
    seen.add(refund.id);
    if(refund.status==="succeeded")returned+=refund.amount;
  }
  if(returned!==charge.amount)return null;
  const sessions=list(await readStripeJson("checkout/sessions?payment_intent="+encodeURIComponent(paymentId)+"&limit=2",secretKey,request));
  if(sessions.length===0)return null; // A non-Checkout payment is outside this integration.
  if(sessions.length!==1)return fail();
  const session=sessions[0];
  if(!/^cs_[A-Za-z0-9_]{1,200}$/.test(session?.id||"")||id(session.payment_intent)!==paymentId)return fail();
  if(session.mode!=="payment")return null; // Refunds do not implicitly cancel recurring subscriptions.
  const checkout=await completeStripeCheckout({type:"checkout.session.completed",data:{object:session}},secretKey,request);
  const purchase=planFromStripeEvent(checkout,map);
  if(purchase?.plan!=="lifetime")return null;
  const receipt=billingReceipt("stripe",{...event,data:{object:{id:session.id}}});
  if(!receipt)throw new Error("invalid_billing_event");
  return {intent:{...purchase,plan:"free" as const},receipt:{...receipt,revokeLifetime:true}};
}
