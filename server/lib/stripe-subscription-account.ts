import {readStripeJson} from "./stripe-checkout";

const accountId=(value:unknown):value is string=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const stripeId=(value:unknown,prefix:string):string|null=>{
  const id=typeof value==="string"?value:(value as {id?:unknown}|null)?.id;
  return typeof id==="string"&&new RegExp("^"+prefix+"_[A-Za-z0-9_]{1,200}$").test(id)?id:null;
};

/**
 * Called only for a signature-verified, recognized subscription event, or an
 * authenticated Stripe subscription read during ordering reconciliation.
 * Payment Links put client_reference_id on Checkout, not on the Subscription.
 * Never infer ownership from the payer's email address.
 */
export async function bindStripeSubscription(
  subscription:any,secretKey:string,request:typeof fetch=fetch
):Promise<any>{
  const explicit=subscription?.metadata?.userId;
  if(explicit!==undefined&&explicit!==""){
    if(!accountId(explicit))throw new Error("billing_lookup_unavailable");
    return subscription;
  }
  const id=stripeId(subscription?.id,"sub"),customer=stripeId(subscription?.customer,"cus");
  if(!id||!customer)throw new Error("billing_lookup_unavailable");
  const sessions=await readStripeJson(
    "checkout/sessions?subscription="+encodeURIComponent(id)+"&limit=2",secretKey,request
  );
  if(sessions?.object!=="list"||sessions.has_more!==false||
     !Array.isArray(sessions.data)||sessions.data.length!==1)throw new Error("billing_lookup_unavailable");
  const checkout=sessions.data[0],reference=checkout?.client_reference_id;
  if(checkout?.object!=="checkout.session"||!stripeId(checkout.id,"cs")||
     checkout.mode!=="subscription"||checkout.status!=="complete"||
     stripeId(checkout.subscription,"sub")!==id||stripeId(checkout.customer,"cus")!==customer||
     !accountId(reference))throw new Error("billing_lookup_unavailable");
  // A configured static metadata value must not override the per-buyer reference.
  const metadataRef=checkout.metadata?.userId;
  if(metadataRef!==undefined&&metadataRef!==""&&metadataRef!==reference)throw new Error("billing_lookup_unavailable");
  return {...subscription,metadata:{...subscription.metadata,userId:reference}};
}
