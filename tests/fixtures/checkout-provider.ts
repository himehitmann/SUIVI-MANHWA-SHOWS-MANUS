/** Synthetic provider only: no network or real Stripe credentials. */
export function checkoutProvider(){
 const sessions=new Map<string,any>(),keys=new Map<string,{body:string;id:string}>();
 const posts:{body:string;key:string}[]=[];
 let lost=false,pricePatch:Record<string,unknown>={},subscriptionStatus="active",responsePatch:Record<string,unknown>={};
 const request:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));if(url.origin!=="https://api.stripe.com")throw Error("unexpected destination");
  const p=url.pathname.replace("/v1/",""),headers=new Headers(init?.headers);
  if(init?.redirect!=="error"||!init.signal)throw Error("missing request bounds");
  const json=(data:unknown)=>Promise.resolve(new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}}));
  if(p.startsWith("prices/")){const id=p.slice(7),year=id==="price_year";return json({id,object:"price",active:true,currency:"usd",type:"recurring",unit_amount:year?2999:349,recurring:{interval:year?"year":"month",interval_count:1},...pricePatch});}
  if(p==="checkout/sessions"&&init?.method==="POST"){
   const body=String(init.body),params=new URLSearchParams(body),key=headers.get("Idempotency-Key")!;
   posts.push({body,key});let entry=keys.get(key);
   if(entry&&entry.body!==body)throw Error("idempotency body mismatch");
   if(!entry){
    const id="cs_test_"+(sessions.size+1);entry={body,id};keys.set(key,entry);
    sessions.set(id,{id,object:"checkout.session",mode:"subscription",status:"open",client_reference_id:params.get("client_reference_id"),metadata:{userId:params.get("metadata[userId]")},url:"https://checkout.stripe.com/c/pay/"+id+"#synthetic",subscription:"sub_test"});
   }
   if(lost){lost=false;throw Error("response lost after provider creation");}
   return json({...sessions.get(entry.id),...responsePatch});
  }
  if(p.startsWith("subscriptions/"))return json({id:p.slice(14),object:"subscription",status:subscriptionStatus,metadata:{userId:[...sessions.values()][0]?.metadata.userId}});
  const match=/^checkout\/sessions\/(cs_[A-Za-z0-9_]+)(\/expire)?$/.exec(p);
  if(match){
   const session=sessions.get(match[1]);if(!session)throw Error("unknown session");
   if(match[2]){if(session.status!=="open")return new Response("conflict",{status:409});session.status="expired";}
   return json({...session,...responsePatch});
  }
  throw Error("unexpected synthetic request "+p);
 };
 return {request,sessions,posts,keys,loseNext(){lost=true;},patchPrice(value:Record<string,unknown>){pricePatch=value;},patchResponse(value:Record<string,unknown>){responsePatch=value;},subscription(status:string){subscriptionStatus=status;}};
}
