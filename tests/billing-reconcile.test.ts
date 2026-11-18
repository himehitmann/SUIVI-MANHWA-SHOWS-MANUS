import {describe,it,expect,vi,afterEach} from "vitest";
import {readCurrentSubscription} from "../server/lib/billing-reconcile";
const user={id:"buyer",email:"buyer@example.test",passwordHash:"x",plan:"pro" as const,createdAt:1};
const map={proMonth:"price_pro"};
const stripe=()=>({id:"sub_stripe",object:"subscription",status:"canceled",metadata:{userId:"buyer"},items:{has_more:false,data:[{price:{id:"price_pro"}}]}});
const paddle=()=>({id:"sub_"+"a".repeat(26),status:"active",custom_data:{userId:"buyer"},items:[{price:{id:"price_pro"}}]});
const receipt=(provider:"stripe"|"paddle")=>({provider,eventId:"evt_tie",resourceId:provider==="stripe"?"sub_stripe":paddle().id,occurredAt:1000});
describe("current provider subscription state",()=>{
  it("retrieves the exact Stripe subscription with bounded server-only credentials",async()=>{
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify(stripe())));
    expect(await readCurrentSubscription(receipt("stripe"),user,map,"key","live",request)).toBe("free");
    expect(request.mock.calls[0][0]).toBe("https://api.stripe.com/v1/subscriptions/sub_stripe");
    expect(request.mock.calls[0][1].redirect).toBe("error");
    expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("retrieves Paddle from the configured environment",async()=>{
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:paddle()})));
    expect(await readCurrentSubscription(receipt("paddle"),user,map,"key","sandbox",request)).toBe("pro");
    expect(request.mock.calls[0][0]).toBe("https://sandbox-api.paddle.com/subscriptions/"+paddle().id);
  });
  it("rejects a different resource, owner, unknown product or truncated item list",async()=>{
    for(const patch of [{id:"sub_other"},{metadata:{userId:"other"}},{metadata:{}},{status:"unknown"},{items:{data:[{price:{id:"unrelated"}}]}},{items:{has_more:true,data:[{price:{id:"price_pro"}}]}}]){
      await expect(readCurrentSubscription(receipt("stripe"),user,map,"key","live",vi.fn().mockResolvedValue(new Response(JSON.stringify({...stripe(),...patch}))))).rejects.toThrow("billing_lookup_unavailable");
    }
    await expect(readCurrentSubscription(receipt("paddle"),user,map,"key","sandbox",vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{...paddle(),custom_data:{userId:"other"}}}))))).rejects.toThrow();
  });
  it("does not follow webhook-supplied paths and fails closed on upstream outage",async()=>{
    const request=vi.fn();
    await expect(readCurrentSubscription({...receipt("stripe"),resourceId:"../private"},user,map,"key","live",request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await expect(readCurrentSubscription(receipt("stripe"),user,map,"key","live",vi.fn().mockResolvedValue(new Response("down",{status:503})))).rejects.toThrow();
  });
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
it.each(["stripe","paddle"] as const)("reconciles a signed %s tie through HTTP and retries a provider outage",async provider=>{
  vi.stubEnv("STRIPE_WEBHOOK_SECRET","signature-test");vi.stubEnv("PADDLE_WEBHOOK_SECRET","signature-test");
  vi.stubEnv("STRIPE_SECRET_KEY","api-test");vi.stubEnv("PADDLE_API_KEY","api-test");
  vi.stubEnv("STRIPE_PRICE_PRO_MONTH","price_pro");vi.stubEnv("PADDLE_PRICE_PRO_MONTH","price_pro");vi.stubEnv("PADDLE_ENVIRONMENT","sandbox");
  vi.resetModules();
  const [{createApiRouter},{createStore},{createHmac},{default:express}]=await Promise.all([import("../server/api"),import("../server/lib/store"),import("node:crypto"),import("express")]);
  const store=createStore();await store.createUser(user);
  await store.applyBillingEvent(user.id,"pro",{...receipt(provider),eventId:"initial"});
  const current=provider==="stripe"?stripe():{...paddle(),status:"canceled"};
  const raw=JSON.stringify(provider==="stripe"?{id:"evt_tie",created:1,type:"customer.subscription.updated",data:{object:current}}:{event_id:"evt_tie",occurred_at:"1970-01-01T00:00:01Z",event_type:"subscription.updated",data:current});
  const upstream=vi.fn().mockResolvedValueOnce(new Response("down",{status:503})).mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(provider==="stripe"?current:{data:current}))));
  const realFetch=globalThis.fetch;
  vi.stubGlobal("fetch",vi.fn((url:any,options:any)=>String(url).startsWith("https://")?upstream(url,options):realFetch(url,options)));
  const app=express();app.use("/api",createApiRouter(store));
  const server=await new Promise<any>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  try{
    const send=async()=>{
      const ts=Math.floor(Date.now()/1000),sig=createHmac("sha256","signature-test").update(ts+(provider==="stripe"?".":":")+raw).digest("hex");
      return realFetch("http://127.0.0.1:"+server.address().port+"/api/webhooks/"+provider,{method:"POST",headers:{"Content-Type":"application/json",...(provider==="stripe"?{"Stripe-Signature":"t="+ts+",v1="+sig}:{"Paddle-Signature":"ts="+ts+";h1="+sig})},body:raw});
    };
    expect((await send()).status).toBe(503);expect((await store.getUserById(user.id))?.plan).toBe("pro");
    expect((await send()).status).toBe(200);expect((await store.getUserById(user.id))?.plan).toBe("free");
    expect((await send()).status).toBe(200);expect(upstream).toHaveBeenCalledTimes(2);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
