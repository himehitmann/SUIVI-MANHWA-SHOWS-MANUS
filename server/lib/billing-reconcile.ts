import {planFromStripeEvent,planFromPaddleEvent,type PriceMap} from "./billing";
import type {BillingReceipt,UserRecord} from "./store";
import {readStripeJson} from "./stripe-checkout";
import {readPaddleJson} from "./paddle-refund";

/** Used only for conflicting subscription states at the same provider timestamp. */
export async function readCurrentSubscription(receipt:BillingReceipt,user:UserRecord,map:PriceMap,key:string,environment="live",request:typeof fetch=fetch):Promise<"free"|"pro">{
  const resource=receipt.resourceId||"";
  const valid=receipt.provider==="stripe"?/^sub_[A-Za-z0-9_]{1,200}$/.test(resource):/^sub_[a-z0-9]{26}$/.test(resource);
  if(!valid)throw new Error("billing_lookup_unavailable");
  const object=receipt.provider==="stripe"
    ?await readStripeJson("subscriptions/"+resource,key,request)
    :await readPaddleJson("subscriptions/"+resource,key,environment,request);
  if(object?.id!==resource||(receipt.provider==="stripe"&&(object.object!=="subscription"||object.items?.has_more===true)))throw new Error("billing_lookup_unavailable");
  const intent=receipt.provider==="stripe"
    ?planFromStripeEvent({type:"customer.subscription.updated",data:{object}},map)
    :planFromPaddleEvent({event_type:"subscription.updated",data:object},map);
  const sameUser=intent?.userId?intent.userId===user.id:
    typeof intent?.email==="string"&&intent.email.trim().toLowerCase()===user.email.trim().toLowerCase();
  if(!sameUser||(intent?.plan!=="free"&&intent?.plan!=="pro"))throw new Error("billing_lookup_unavailable");
  return intent.plan;
}
