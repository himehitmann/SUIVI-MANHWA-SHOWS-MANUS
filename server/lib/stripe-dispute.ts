import {billingReceipt,planFromStripeEvent,type PriceMap} from "./billing";
import {completeStripeCheckout,readStripeJson} from "./stripe-checkout";
import type {BillingReceipt,UserRecord} from "./store";

const id=(value:any)=>typeof value==="string"?value:value?.id;
const valid=(value:unknown,prefix:string)=>typeof value==="string"&&new RegExp("^"+prefix+"_[A-Za-z0-9_]{1,200}$").test(value);
const fail=():never=>{throw new Error("billing_lookup_unavailable");};
function list(value:any):any[]{
  if(value?.object!=="list"||value.has_more!==false||!Array.isArray(value.data))return fail();
  return value.data;
}
const events=new Set(["charge.dispute.created","charge.dispute.updated","charge.dispute.closed","charge.dispute.funds_withdrawn","charge.dispute.funds_reinstated"]);

/** Signature-verified envelope only. Resolve the purchased resource and account;
 * the current entitlement is read again under the store's account/resource lock.
 */
export async function resolveStripeDispute(event:any,map:PriceMap,key:string,request:typeof fetch=fetch){
  if(!map.lifetime||!events.has(event?.type))return null;
  const object=event?.data?.object,chargeId=id(object?.charge),disputeId=object?.id;
  if(!valid(disputeId,"du")||!valid(chargeId,"ch"))return fail();
  const charge=await readStripeJson("charges/"+chargeId,key,request);
  if(charge?.object!=="charge"||charge.id!==chargeId)return fail();
  const paymentId=id(charge.payment_intent);
  if(!valid(paymentId,"pi"))return null; // Legacy/non-Checkout payments are not managed here.
  const sessions=list(await readStripeJson("checkout/sessions?payment_intent="+paymentId+"&limit=2",key,request));
  if(!sessions.length)return null;
  if(sessions.length!==1)return fail();
  const session=sessions[0];
  if(!valid(session?.id,"cs")||id(session.payment_intent)!==paymentId)return fail();
  if(session.mode!=="payment")return null;
  const checkout=await completeStripeCheckout({type:"checkout.session.completed",data:{object:session}},key,request);
  const intent=planFromStripeEvent(checkout,map);
  if(intent?.plan!=="lifetime")return null;
  const receipt=billingReceipt("stripe",{...event,data:{object:{id:session.id}}});
  if(!receipt)throw new Error("invalid_billing_event");
  return {intent,receipt:{...receipt,reconcileLifetime:true},disputeId,chargeId};
}

/** Re-evaluate only a tracked Stripe lifetime purchase. A lost full dispute
 * removes this purchase's entitlement; a later win can restore it. Pending
 * disputes and partial losses do not remove lifetime access on their own.
 * A full refund always keeps access removed, even after a dispute is won.
 */
export async function readCurrentStripeLifetime(
  receipt:BillingReceipt,user:UserRecord,map:PriceMap,key:string,
  request:typeof fetch=fetch,expected?:{disputeId:string;chargeId:string},
):Promise<"free"|"lifetime">{
  const resource=receipt.resourceId;
  if(receipt.provider!=="stripe"||!valid(resource,"cs"))return fail();
  const session=await readStripeJson("checkout/sessions/"+resource+"?expand[]=payment_intent.latest_charge",key,request);
  if(session?.object!=="checkout.session"||session.id!==resource||session.mode!=="payment"||session.payment_status!=="paid")return fail();
  const checkout=await completeStripeCheckout({type:"checkout.session.completed",data:{object:session}},key,request);
  const purchase=planFromStripeEvent(checkout,map);
  const sameUser=purchase?.userId?purchase.userId===user.id:
    typeof purchase?.email==="string"&&purchase.email.trim().toLowerCase()===user.email.trim().toLowerCase();
  if(purchase?.plan!=="lifetime"||!sameUser)return fail();
  const payment=session.payment_intent,charge=payment?.latest_charge;
  if(payment?.object!=="payment_intent"||!valid(payment.id,"pi")||charge?.object!=="charge"||!valid(charge.id,"ch")||
     id(charge.payment_intent)!==payment.id||charge.paid!==true||charge.captured!==true||
     !Number.isSafeInteger(charge.amount)||charge.amount<=0||charge.amount_captured!==charge.amount||
     session.amount_total!==charge.amount||session.currency!==charge.currency||
     typeof charge.currency!=="string"||!/^[a-z]{3}$/.test(charge.currency)||
     !Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<0||charge.amount_refunded>charge.amount||
     typeof charge.refunded!=="boolean"||charge.refunded!==(charge.amount_refunded===charge.amount)||
     (expected&&charge.id!==expected.chargeId))return fail();
  if(charge.refunded)return "free";
  const disputes=list(await readStripeJson("disputes?charge="+charge.id+"&limit=100",key,request));
  // A purchase enters this path only after a dispute. A missing/truncated
  // history must not silently restore access after a transient API inconsistency.
  if(!disputes.length)return fail();
  const seen=new Set<string>();let lost=false;
  for(const dispute of disputes){
    if(dispute?.object!=="dispute"||!valid(dispute.id,"du")||seen.has(dispute.id)||
       id(dispute.charge)!==charge.id||dispute.currency!==charge.currency||
       (dispute.payment_intent!=null&&id(dispute.payment_intent)!==payment.id)||
       !Number.isSafeInteger(dispute.amount)||dispute.amount<=0||dispute.amount>charge.amount||
       !["lost","won","needs_response","under_review","warning_needs_response","warning_under_review","warning_closed"].includes(dispute.status))return fail();
    seen.add(dispute.id);
    if(dispute.status==="lost"&&dispute.amount===charge.amount)lost=true;
  }
  if(expected&&!seen.has(expected.disputeId))return fail();
  return lost?"free":"lifetime";
}
