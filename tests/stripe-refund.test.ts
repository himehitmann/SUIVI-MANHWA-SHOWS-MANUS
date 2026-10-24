import {describe,it,expect,vi,afterEach} from "vitest";
import {resolveStripeRefund} from "../server/lib/stripe-refund";
const map={lifetime:"price_life"};
const event=(type="charge.refunded")=>({id:"evt_refund",created:100,type,data:{object:type==="charge.refunded"?{id:"ch_paid"}:{id:"re_one",charge:"ch_paid",status:"succeeded"}}});
const charge=()=>({object:"charge",id:"ch_paid",refunded:true,amount:5000,amount_refunded:5000,currency:"eur",payment_intent:"pi_paid"});
const refund=()=>({id:"re_one",charge:"ch_paid",currency:"eur",amount:5000,status:"succeeded"});
const session=()=>({id:"cs_paid",mode:"payment",payment_status:"paid",payment_intent:"pi_paid",client_reference_id:"buyer"});
const list=(data:any[])=>({object:"list",has_more:false,data});
const requestFor=(c:any=charge(),refunds:any=list([refund()]),sessions:any=list([session()]),items:any=list([{price:{id:"price_life"}}]))=>
  vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(c)))
  .mockResolvedValueOnce(new Response(JSON.stringify(refunds)))
  .mockResolvedValueOnce(new Response(JSON.stringify(sessions)))
  .mockResolvedValueOnce(new Response(JSON.stringify(items)));
describe("verified Stripe lifetime refunds",()=>{
  it.each(["charge.refunded","refund.created","refund.updated"])("resolves %s to the exact purchased resource",async type=>{
    const request=requestFor(),result=await resolveStripeRefund(event(type),map,"server-secret",request);
    expect(result).toEqual({intent:{userId:"buyer",email:undefined,plan:"free"},receipt:{provider:"stripe",eventId:"evt_refund",resourceId:"cs_paid",occurredAt:100000,revokeLifetime:true}});
    expect(request.mock.calls.map(c=>c[0])).toEqual([
      "https://api.stripe.com/v1/charges/ch_paid",
      "https://api.stripe.com/v1/refunds?charge=ch_paid&limit=100",
      "https://api.stripe.com/v1/checkout/sessions?payment_intent=pi_paid&limit=2",
      "https://api.stripe.com/v1/checkout/sessions/cs_paid/line_items?limit=2",
    ]);
  });
  it("requires all of the purchase amount to have successfully returned",async()=>{
    for(const status of ["pending","failed","canceled","requires_action"]){
      expect(await resolveStripeRefund(event(),map,"key",requestFor(charge(),list([{...refund(),status}])))).toBeNull();
    }
    expect(await resolveStripeRefund(event(),map,"key",requestFor({...charge(),refunded:false,amount_refunded:2500}))).toBeNull();
    expect(await resolveStripeRefund(event(),map,"key",requestFor(charge(),list([{...refund(),amount:2500}])))).toBeNull();
    expect(await resolveStripeRefund(event(),map,"key",requestFor(charge(),list([{...refund(),amount:2500},{...refund(),id:"re_two",amount:2500}])))).not.toBeNull();
  });
  it("never revokes an unrelated or recurring product",async()=>{
    for(const items of [list([{price:{id:"other"}}]),list([{price:{id:"price_life"}},{price:{id:"other"}}])])
      expect(await resolveStripeRefund(event(),map,"key",requestFor(charge(),list([refund()]),list([session()]),items))).toBeNull();
    expect(await resolveStripeRefund(event(),map,"key",requestFor(charge(),list([refund()]),list([{...session(),mode:"subscription"}])))).toBeNull();
  });
  it("rejects ambiguous, truncated or mismatched provider evidence for retry",async()=>{
    const bad=[
      requestFor({...charge(),id:"ch_other"}),
      requestFor(charge(),{...list([refund()]),has_more:true}),
      requestFor(charge(),list([refund(),refund()])),
      requestFor(charge(),list([{...refund(),charge:"ch_other"}])),
      requestFor(charge(),list([{...refund(),currency:"usd"}])),
      requestFor(charge(),list([refund()]),list([session(),session()])),
      requestFor(charge(),list([refund()]),list([{...session(),payment_intent:"pi_other"}])),
      vi.fn().mockResolvedValue(new Response("down",{status:503})),
      vi.fn().mockResolvedValue(new Response("x".repeat(65537))),
    ];
    for(const request of bad)await expect(resolveStripeRefund(event(),map,"key",request)).rejects.toThrow("billing_lookup_unavailable");
  });
  it("does no lookup for pending refund events or unrelated events",async()=>{
    const request=vi.fn(),pending=event("refund.updated");pending.data.object.status="pending";
    expect(await resolveStripeRefund(pending,map,"key",request)).toBeNull();
    expect(await resolveStripeRefund(event("ping"),map,"key",request)).toBeNull();
    expect(await resolveStripeRefund(event(),{},"key",request)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
  it("does not let a charge identifier choose the remote host",async()=>{
    const bad=event();bad.data.object.id="https://attacker.test";
    const request=vi.fn();
    await expect(resolveStripeRefund(bad,map,"key",request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
it("handles signed refund HTTP delivery, retries failures and ignores invalid signatures",async()=>{
  vi.stubEnv("STRIPE_WEBHOOK_SECRET","synthetic-webhook-secret");
  vi.stubEnv("STRIPE_SECRET_KEY","synthetic-api-secret");
  vi.stubEnv("STRIPE_PRICE_LIFETIME","price_life");
  vi.resetModules();
  const [{createApiRouter},{createStore},{createHmac},{default:express}]=await Promise.all([
    import("../server/api"),import("../server/lib/store"),import("node:crypto"),import("express"),
  ]);
  const store=createStore();await store.createUser({id:"buyer",email:"buyer@example.test",passwordHash:"x",plan:"free",createdAt:1});
  await store.applyBillingEvent("buyer","lifetime",{provider:"stripe",resourceId:"cs_paid",eventId:"evt_purchase",occurredAt:1});
  const realFetch=globalThis.fetch,upstream=requestFor();
  vi.stubGlobal("fetch",vi.fn((url:any,options:any)=>String(url).startsWith("https://api.stripe.com/")?upstream(url,options):realFetch(url,options)));
  const app=express();app.use("/api",createApiRouter(store));
  const server=await new Promise<any>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  try{
    const send=async(valid=true)=>{
      const payload=JSON.stringify({...event(),created:Math.floor(Date.now()/1000)}),ts=Math.floor(Date.now()/1000);
      const signature=createHmac("sha256","synthetic-webhook-secret").update(ts+"."+payload).digest("hex");
      return realFetch("http://127.0.0.1:"+server.address().port+"/api/webhooks/stripe",{method:"POST",headers:{"Content-Type":"application/json","Stripe-Signature":"t="+ts+",v1="+(valid?signature:"invalid")},body:payload});
    };
    expect((await send(false)).status).toBe(400);expect(upstream).not.toHaveBeenCalled();
    const result=await send();expect(result.status).toBe(200);
    expect((await result.json()).applied).toBe(true);
    expect((await store.getUserById("buyer"))?.plan).toBe("free");
    upstream.mockResolvedValueOnce(new Response("unavailable",{status:503}));
    expect((await send()).status).toBe(503);
    expect((await store.getUserById("buyer"))?.plan).toBe("free");
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
