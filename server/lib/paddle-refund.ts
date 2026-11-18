import {billingReceipt,planFromPaddleEvent,type PriceMap} from "./billing";

const fail=():never=>{throw new Error("billing_lookup_unavailable");};
const providerId=(value:unknown,prefix:string)=>typeof value==="string"&&new RegExp("^"+prefix+"_[a-z0-9]{26}$").test(value);

/** Signature-verified adjustments only; Paddle's approved refund state is final. */
export async function resolvePaddleRefund(event:any,map:PriceMap,key:string,environment="live",request:typeof fetch=fetch){
  if(!map.lifetime||!["adjustment.created","adjustment.updated"].includes(event?.event_type))return null;
  const adjustment=event?.data;
  if(adjustment?.action!=="refund"||adjustment.status!=="approved"||!["full","partial"].includes(adjustment.type))return null;
  if(adjustment.subscription_id!=null)return null; // A refund is not subscription cancellation.
  if(!providerId(adjustment.id,"adj")||!providerId(adjustment.transaction_id,"txn")||
     !providerId(adjustment.customer_id,"ctm")||!key||!["live","sandbox"].includes(environment))return fail();
  const transaction=await readPaddleJson("transactions/"+adjustment.transaction_id,key,environment,request);
  if(transaction?.id!==adjustment.transaction_id||transaction.customer_id!==adjustment.customer_id)return fail();
  if(transaction.subscription_id!=null)return null;
  const purchase=planFromPaddleEvent({event_type:"transaction.completed",data:transaction},map);
  if(purchase?.plan!=="lifetime")return null;
  const total=transaction.details?.totals?.grand_total,refunded=adjustment.totals?.total;
  const amount=(value:any)=>typeof value==="string"&&/^\d{1,16}$/.test(value)&&BigInt(value)>0n;
  if(!amount(total)||!amount(refunded)||typeof transaction.currency_code!=="string"||
     transaction.currency_code!==adjustment.currency_code)return fail();
  if(adjustment.type==="full"){
    if(BigInt(refunded)!==BigInt(total))return fail();
  }else{
    const page=await readPaddleJson("adjustments?transaction_id="+transaction.id+"&per_page=100",key,environment,request,true);
    if(!Array.isArray(page?.data)||page.data.length>100||page.meta?.pagination?.has_more!==false)return fail();
    let sum=0n,found=false;const seen=new Set<string>();
    for(const entry of page.data){
      if(!providerId(entry?.id,"adj")||seen.has(entry.id)||entry.transaction_id!==transaction.id||
         entry.customer_id!==transaction.customer_id||entry.currency_code!==transaction.currency_code||entry.subscription_id!=null)return fail();
      seen.add(entry.id);
      if(entry.id===adjustment.id){
        if(entry.action!=="refund"||entry.status!=="approved"||entry.type!==adjustment.type||entry.totals?.total!==refunded)return fail();
        found=true;
      }
      if(entry.action!=="refund"||entry.status!=="approved")continue;
      if(!["full","partial"].includes(entry.type)||!amount(entry.totals?.total))return fail();
      sum+=BigInt(entry.totals.total);
    }
    // A lagging or incomplete provider response must be retried, not acknowledged as final.
    if(!found||sum>BigInt(total))return fail();
    if(sum<BigInt(total))return null;
  }
  const receipt=billingReceipt("paddle",{...event,data:{id:transaction.id}});
  if(!receipt)throw new Error("invalid_billing_event");
  return {intent:{...purchase,plan:"free" as const},receipt:{...receipt,revokeLifetime:true}};
}

/** Bounded server-side API read. Paths must be built from validated identifiers. */
export async function readPaddleJson(path:string,key:string,environment="live",request:typeof fetch=fetch,envelope=false):Promise<any>{
  if(!key||!["live","sandbox"].includes(environment))return fail();
  const host=environment==="sandbox"?"https://sandbox-api.paddle.com":"https://api.paddle.com";
  const response=await request(host+"/"+path,{
    headers:{Authorization:"Bearer "+key,"Paddle-Version":"1"},signal:AbortSignal.timeout(5000),redirect:"error",
  });
  if(!response.ok||!response.body)return fail();
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){const result=await reader.read();if(result.done)break;
      size+=result.value.byteLength;if(size>65536)return fail();chunks.push(result.value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  let value:any;
  try{value=JSON.parse(Buffer.concat(chunks).toString("utf8"));}
  catch{return fail();}
  return envelope?value:value?.data;
}
