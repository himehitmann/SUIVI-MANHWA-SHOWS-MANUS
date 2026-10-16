import {billingReceipt,planFromPaddleEvent,type PriceMap} from "./billing";

const fail=():never=>{throw new Error("billing_lookup_unavailable");};
const providerId=(value:unknown,prefix:string)=>typeof value==="string"&&new RegExp("^"+prefix+"_[a-z0-9]{26}$").test(value);

/** Signature-verified adjustments only; Paddle's approved refund state is final. */
export async function resolvePaddleRefund(event:any,map:PriceMap,key:string,environment="live",request:typeof fetch=fetch){
  if(!map.lifetime||!["adjustment.created","adjustment.updated"].includes(event?.event_type))return null;
  const adjustment=event?.data;
  if(adjustment?.action!=="refund"||adjustment.status!=="approved"||adjustment.type!=="full")return null;
  if(adjustment.subscription_id!=null)return null; // A refund is not subscription cancellation.
  if(!providerId(adjustment.id,"adj")||!providerId(adjustment.transaction_id,"txn")||
     !providerId(adjustment.customer_id,"ctm")||!key||!["live","sandbox"].includes(environment))return fail();
  const host=environment==="sandbox"?"https://sandbox-api.paddle.com":"https://api.paddle.com";
  const response=await request(host+"/transactions/"+adjustment.transaction_id,{
    headers:{Authorization:"Bearer "+key,"Paddle-Version":"1"},signal:AbortSignal.timeout(5000),redirect:"error",
  });
  if(!response.ok||!response.body)return fail();
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){const result=await reader.read();if(result.done)break;
      size+=result.value.byteLength;if(size>65536)return fail();chunks.push(result.value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  let transaction:any;
  try{transaction=JSON.parse(Buffer.concat(chunks).toString("utf8"))?.data;}
  catch{return fail();}
  if(transaction?.id!==adjustment.transaction_id||transaction.customer_id!==adjustment.customer_id)return fail();
  if(transaction.subscription_id!=null)return null;
  const purchase=planFromPaddleEvent({event_type:"transaction.completed",data:transaction},map);
  if(purchase?.plan!=="lifetime")return null;
  const total=transaction.details?.totals?.grand_total,refunded=adjustment.totals?.total;
  if(typeof total!=="string"||!/^\d{1,16}$/.test(total)||BigInt(total)<=0n||
     typeof refunded!=="string"||!/^\d{1,16}$/.test(refunded)||BigInt(refunded)!==BigInt(total)||
     typeof transaction.currency_code!=="string"||transaction.currency_code!==adjustment.currency_code)return fail();
  const receipt=billingReceipt("paddle",{...event,data:{id:transaction.id}});
  if(!receipt)throw new Error("invalid_billing_event");
  return {intent:{...purchase,plan:"free" as const},receipt:{...receipt,revokeLifetime:true}};
}
