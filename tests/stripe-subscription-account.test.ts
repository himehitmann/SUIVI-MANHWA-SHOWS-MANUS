import {describe,it,expect,vi,afterEach} from "vitest";
import {bindStripeSubscription} from "../server/lib/stripe-subscription-account";
import {readCurrentSubscription} from "../server/lib/billing-reconcile";
const subscription=()=>({id:"sub_link",object:"subscription",customer:"cus_buyer",status:"active",metadata:{},items:{has_more:false,data:[{price:{id:"price_month"}}]}});
const checkout=()=>({id:"cs_link",object:"checkout.session",mode:"subscription",status:"complete",subscription:"sub_link",customer:"cus_buyer",client_reference_id:"account-buyer",customer_details:{email:"different@example.test"},metadata:{}});
const list=(data:any[]= [checkout()],has_more=false)=>({object:"list",has_more,data});

describe("Stripe Payment Link account binding",()=>{
 it("resolves the Checkout reference using only the subscription filter",async()=>{
  const request=vi.fn().mockResolvedValue(Response.json(list()));
  const original=subscription(),resolved=await bindStripeSubscription(original,"test-key",request);
  expect(resolved.metadata.userId).toBe("account-buyer");expect(original.metadata).toEqual({});
  expect(request).toHaveBeenCalledOnce();
  const [url,init]=request.mock.calls[0];
  expect(url).toBe("https://api.stripe.com/v1/checkout/sessions?subscription=sub_link&limit=2");
  expect(init.headers.Authorization).toBe("Bearer test-key");
  expect(init.redirect).toBe("error");expect(init.signal).toBeInstanceOf(AbortSignal);
 });
 it("retains an explicit server subscription reference without a provider request",async()=>{
  const request=vi.fn(),original={...subscription(),metadata:{userId:"account-buyer"}};
  expect(await bindStripeSubscription(original,"",request)).toBe(original);
  expect(request).not.toHaveBeenCalled();
 });
 it("accepts expanded customer and subscription identities without using email",async()=>{
  const original={...subscription(),customer:{id:"cus_buyer"},customer_email:"other-account@example.test"};
  const response=list([{...checkout(),subscription:{id:"sub_link"},customer:{id:"cus_buyer"}}]);
  const resolved=await bindStripeSubscription(original,"key",vi.fn().mockResolvedValue(Response.json(response)));
  expect(resolved.metadata.userId).toBe("account-buyer");
 });
 it.each([null,12," ","../account","a".repeat(129)])("rejects an invalid explicit identity %s",async userId=>{
  const request=vi.fn();
  await expect(bindStripeSubscription({...subscription(),metadata:{userId}},"key",request)).rejects.toThrow("billing_lookup_unavailable");
  expect(request).not.toHaveBeenCalled();
 });
 it.each([
  {id:"sub_../../private"},{id:"https://evil.test/sub"},{customer:"cus_../../private"},{customer:null},
 ])("rejects invalid subscription identities before fetching %j",async patch=>{
  const request=vi.fn();
  await expect(bindStripeSubscription({...subscription(),...patch},"key",request)).rejects.toThrow("billing_lookup_unavailable");
  expect(request).not.toHaveBeenCalled();
 });
 it.each([
  {},{object:"list",data:[checkout()]},list([],false),list([checkout()],true),list([checkout(),checkout()]),
  list([{...checkout(),id:"wrong"}]),list([{...checkout(),object:"customer"}]),
  list([{...checkout(),mode:"payment"}]),list([{...checkout(),status:"open"}]),
  list([{...checkout(),subscription:"sub_other"}]),list([{...checkout(),customer:"cus_other"}]),
  list([{...checkout(),client_reference_id:null}]),list([{...checkout(),client_reference_id:"../user"}]),
  list([{...checkout(),metadata:{userId:"another"}}]),
 ])("refuses missing, partial or inconsistent ownership evidence %j",async body=>{
  await expect(bindStripeSubscription(subscription(),"key",vi.fn().mockResolvedValue(Response.json(body)))).rejects.toThrow("billing_lookup_unavailable");
 });
 it("requires a backend credential and never follows redirects",async()=>{
  const request=vi.fn();
  await expect(bindStripeSubscription(subscription(),"",request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  await expect(bindStripeSubscription(subscription(),"key",vi.fn().mockResolvedValue(new Response("",{status:302,headers:{Location:"https://evil.test"}})))).rejects.toThrow();
 });
 it("fails closed on timeout, non-JSON and oversized responses",async()=>{
  for(const request of [
   vi.fn().mockRejectedValue(new Error("timeout")),
   vi.fn().mockResolvedValue(new Response("not JSON")),
   vi.fn().mockResolvedValue(new Response("x".repeat(65537))),
  ])await expect(bindStripeSubscription(subscription(),"key",request)).rejects.toThrow();
 });
 it("reconciles the current subscription using the same Checkout identity",async()=>{
  const user={id:"account-buyer",email:"new@example.test",passwordHash:"unused",plan:"pro" as const,createdAt:1};
  const receipt={provider:"stripe" as const,eventId:"evt_tie",resourceId:"sub_link",occurredAt:1000};
  const request=vi.fn().mockResolvedValueOnce(Response.json({...subscription(),status:"canceled"})).mockResolvedValueOnce(Response.json(list()));
  expect(await readCurrentSubscription(receipt,user,{proMonth:"price_month"},"key","live",request)).toBe("free");
  expect(request).toHaveBeenCalledTimes(2);
  const foreign=vi.fn().mockResolvedValueOnce(Response.json(subscription())).mockResolvedValueOnce(Response.json(list([{...checkout(),client_reference_id:"other"}])));
  await expect(readCurrentSubscription(receipt,user,{proMonth:"price_month"},"key","live",foreign)).rejects.toThrow("billing_lookup_unavailable");
 });
});

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});

async function fixture(){
 vi.stubEnv("STRIPE_WEBHOOK_SECRET","signature-test");vi.stubEnv("STRIPE_SECRET_KEY","api-test");
 vi.stubEnv("STRIPE_PRICE_PRO_MONTH","price_month");vi.resetModules();
 const [{createApiRouter},{createStore},{createHmac},{default:express}]=await Promise.all([import("../server/api"),import("../server/lib/store"),import("node:crypto"),import("express")]);
 const store=createStore();
 for(const id of ["account-buyer","other-account"])await store.createUser({id,email:id+"@example.test",passwordHash:"unused",plan:"free",createdAt:1});
 await store.setSync("account-buyer",{blob:{items:[{id:"saved-work",chapter:17.5}],updatedAt:1},updatedAt:1});
 const saved=await store.getSync("account-buyer"),realFetch=globalThis.fetch;
 const upstream=vi.fn(async(url:string)=>Response.json(url.includes("/subscriptions/")?{...subscription(),status:"canceled"}:list()));
 vi.stubGlobal("fetch",vi.fn((url:any,options:any)=>String(url).startsWith("https:")?upstream(String(url),options):realFetch(url,options)));
 const app=express();app.use("/api",createApiRouter(store));
 const server=await new Promise<any>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
 const send=async(id:string,status="active",created=100,object:any={},signature=true)=>{
  const event={id,created,type:status==="canceled"?"customer.subscription.deleted":"customer.subscription.updated",data:{object:{...subscription(),customer_email:"other-account@example.test",status,...object}}};
  const raw=JSON.stringify(event),time=Math.floor(Date.now()/1000);
  const sig=createHmac("sha256",signature?"signature-test":"wrong-key").update(time+"."+raw).digest("hex");
  return realFetch("http://127.0.0.1:"+server.address().port+"/api/webhooks/stripe",{method:"POST",headers:{"Content-Type":"application/json","Stripe-Signature":"t="+time+",v1="+sig},body:raw});
 };
 return {store,saved,upstream,send,close:()=>new Promise<void>(resolve=>server.close(()=>resolve()))};
}
describe("signed recurring Payment Link delivery",()=>{
 it("grants the referenced account, cancels it and ignores an old activation without changing saved data",async()=>{
  const f=await fixture();try{
   expect((await f.send("evt_active")).status).toBe(200);
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("pro");
   expect((await f.store.getUserById("other-account"))?.plan).toBe("free");
   // The account email can change independently from the payer's email.
   await f.store.updateUser({...await f.store.getUserById("account-buyer")!,email:"new@example.test"});
   expect((await f.send("evt_cancel","canceled",101)).status).toBe(200);
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("free");
   expect((await f.send("evt_active")).status).toBe(200);
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("free");
   expect(await f.store.getSync("account-buyer")).toEqual(f.saved);
  }finally{await f.close();}
 });
 it("retries missing Checkout evidence without consuming the event or granting to the payer email",async()=>{
  const f=await fixture();try{
   f.upstream.mockResolvedValueOnce(Response.json(list([])));
   expect((await f.send("evt_retry")).status).toBe(503);
   for(const id of ["account-buyer","other-account"])expect((await f.store.getUserById(id))?.plan).toBe("free");
   expect((await f.send("evt_retry")).status).toBe(200);
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("pro");
  }finally{await f.close();}
 });
 it("does not read Stripe for forged events, unrelated products or explicit account references",async()=>{
  const f=await fixture();try{
   expect((await f.send("evt_forged","active",100,{},false)).status).toBe(400);
   expect((await f.send("evt_unknown","active",100,{items:{data:[{price:{id:"price_unknown"}}]}})).status).toBe(200);
   expect((await f.send("evt_explicit","active",100,{metadata:{userId:"account-buyer"}})).status).toBe(200);
   expect(f.upstream).not.toHaveBeenCalled();
  }finally{await f.close();}
 });
 it("refuses rebinding an existing subscription to a different account",async()=>{
  const f=await fixture();try{
   expect((await f.send("evt_initial")).status).toBe(200);
   f.upstream.mockResolvedValueOnce(Response.json(list([{...checkout(),client_reference_id:"other-account"}])));
   const response=await f.send("evt_foreign","active",101);
   expect(response.status).toBe(503);expect(await response.json()).toEqual({error:"billing_resource_conflict"});
   expect((await f.store.getUserById("other-account"))?.plan).toBe("free");
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("pro");
  }finally{await f.close();}
 });
 it("uses current provider state to resolve two opposing events with the same timestamp",async()=>{
  const f=await fixture();try{
   expect((await f.send("evt_initial")).status).toBe(200);
   expect((await f.send("evt_same_time_cancel","canceled",100)).status).toBe(200);
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("free");
   expect((await f.send("evt_late_active","active",100)).status).toBe(200);
   expect((await f.store.getUserById("account-buyer"))?.plan).toBe("free");
   expect(await f.store.getSync("account-buyer")).toEqual(f.saved);
  }finally{await f.close();}
 });
});
