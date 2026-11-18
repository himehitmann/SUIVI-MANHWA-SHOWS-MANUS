import {describe,it,expect,vi,afterEach} from "vitest";
import {resolveStripeDispute,readCurrentStripeLifetime} from "../server/lib/stripe-dispute";
const map={lifetime:"price_life"},user={id:"buyer",email:"buyer@example.test",passwordHash:"x",createdAt:1,plan:"lifetime" as const};
const event=(type="charge.dispute.closed")=>({id:"evt_dispute",type,created:100,data:{object:{id:"du_one",charge:"ch_paid",status:"lost"}}});
const charge=()=>({object:"charge",id:"ch_paid",paid:true,captured:true,amount:5000,amount_captured:5000,amount_refunded:0,refunded:false,currency:"eur",payment_intent:"pi_paid"});
const session=()=>({object:"checkout.session",id:"cs_paid",mode:"payment",payment_status:"paid",client_reference_id:"buyer",payment_intent:"pi_paid",amount_total:5000,currency:"eur"});
const dispute=(status="lost")=>({object:"dispute",id:"du_one",charge:"ch_paid",payment_intent:"pi_paid",amount:5000,currency:"eur",status});
const list=(data:any[])=>({object:"list",has_more:false,data});
const items=()=>list([{price:{id:"price_life"}}]);
const expanded=()=>({...session(),payment_intent:{object:"payment_intent",id:"pi_paid",latest_charge:charge()}});
const receipt={provider:"stripe" as const,eventId:"evt_one",resourceId:"cs_paid",occurredAt:100000,reconcileLifetime:true};
const requestFor=(...values:any[])=>{
  const request=vi.fn();for(const value of values)request.mockResolvedValueOnce(new Response(JSON.stringify(value)));return request;
};
describe("Stripe dispute purchase resolution",()=>{
  it.each(["charge.dispute.created","charge.dispute.updated","charge.dispute.closed","charge.dispute.funds_withdrawn","charge.dispute.funds_reinstated"])("resolves %s without trusting event status",async type=>{
    const request=requestFor(charge(),list([session()]),items());
    const result=await resolveStripeDispute(event(type),map,"key",request);
    expect(result).toMatchObject({intent:{userId:"buyer",plan:"lifetime"},receipt:{resourceId:"cs_paid",reconcileLifetime:true},disputeId:"du_one",chargeId:"ch_paid"});
    expect(request.mock.calls.map(call=>call[0])).toEqual(["https://api.stripe.com/v1/charges/ch_paid","https://api.stripe.com/v1/checkout/sessions?payment_intent=pi_paid&limit=2","https://api.stripe.com/v1/checkout/sessions/cs_paid/line_items?limit=2"]);
  });
  it("ignores non-dispute, unconfigured, recurring and unrelated purchases",async()=>{
    const request=vi.fn();
    expect(await resolveStripeDispute(event("ping"),map,"key",request)).toBeNull();
    expect(await resolveStripeDispute(event(),{},"key",request)).toBeNull();expect(request).not.toHaveBeenCalled();
    expect(await resolveStripeDispute(event(),map,"key",requestFor(charge(),list([{...session(),mode:"subscription"}])))).toBeNull();
    expect(await resolveStripeDispute(event(),map,"key",requestFor(charge(),list([session()]),list([{price:{id:"unrelated"}}])))).toBeNull();
  });
  it("rejects malformed, mismatched and truncated lookup evidence",async()=>{
    const bad=[requestFor({...charge(),id:"ch_other"}),requestFor(charge(),{...list([session()]),has_more:true}),requestFor(charge(),list([session(),session()])),requestFor(charge(),list([{...session(),payment_intent:"pi_other"}]))];
    for(const request of bad)await expect(resolveStripeDispute(event(),map,"key",request)).rejects.toThrow("billing_lookup_unavailable");
    for(const patch of [{id:"https://attacker.test"},{charge:"ch_/../other"}]){
      const input=event();Object.assign(input.data.object,patch);
      await expect(resolveStripeDispute(input,map,"key",vi.fn())).rejects.toThrow("billing_lookup_unavailable");
    }
  });
});
describe("current lifetime dispute entitlement",()=>{
  it.each(["lost","won","needs_response","under_review","warning_needs_response","warning_under_review","warning_closed"])("reads current %s independently of envelope status",async status=>{
    const request=requestFor(expanded(),items(),list([dispute(status)]));
    expect(await readCurrentStripeLifetime(receipt,user,map,"key",request,{disputeId:"du_one",chargeId:"ch_paid"})).toBe(status==="lost"?"free":"lifetime");
    expect(request.mock.calls[0][0]).toBe("https://api.stripe.com/v1/checkout/sessions/cs_paid?expand[]=payment_intent.latest_charge");
    expect(request.mock.calls[2][0]).toBe("https://api.stripe.com/v1/disputes?charge=ch_paid&limit=100");
  });
  it("does not revoke for a partial loss or let one win override another full loss",async()=>{
    expect(await readCurrentStripeLifetime(receipt,user,map,"key",requestFor(expanded(),items(),list([{...dispute(),amount:2500}])))).toBe("lifetime");
    expect(await readCurrentStripeLifetime(receipt,user,map,"key",requestFor(expanded(),items(),list([dispute("won"),{...dispute(),id:"du_second"}])))).toBe("free");
  });
  it("does not restore a fully refunded purchase",async()=>{
    const value=expanded();Object.assign(value.payment_intent.latest_charge,{refunded:true,amount_refunded:5000});
    const request=requestFor(value,items());
    expect(await readCurrentStripeLifetime(receipt,user,map,"key",request)).toBe("free");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("requires the same account and a complete configured product",async()=>{
    for(const value of [{...expanded(),client_reference_id:"other"},{...expanded(),id:"cs_other"},{...expanded(),payment_status:"unpaid"}])
      await expect(readCurrentStripeLifetime(receipt,user,map,"key",requestFor(value,items()))).rejects.toThrow("billing_lookup_unavailable");
    for(const value of [{...items(),has_more:true},list([{price:{id:"other"}}])])
      await expect(readCurrentStripeLifetime(receipt,user,map,"key",requestFor(expanded(),value))).rejects.toThrow("billing_lookup_unavailable");
  });
  it("rejects charge/amount/currency inconsistencies",async()=>{
    for(const patch of [{payment_intent:"pi_other"},{paid:false},{captured:false},{amount_captured:2500},{amount_refunded:5001},{refunded:true},{currency:"usd"}]){
      const value=expanded();Object.assign(value.payment_intent.latest_charge,patch);
      await expect(readCurrentStripeLifetime(receipt,user,map,"key",requestFor(value,items()))).rejects.toThrow("billing_lookup_unavailable");
    }
  });
  it("fails closed for missing, duplicated, foreign or unknown dispute state",async()=>{
    for(const value of [list([]),{...list([dispute()]),has_more:true},list([dispute(),dispute()]),list([{...dispute(),charge:"ch_other"}]),list([{...dispute(),payment_intent:"pi_other"}]),list([{...dispute(),currency:"usd"}]),list([{...dispute(),amount:9000}]),list([dispute("new_unknown_state")])])
      await expect(readCurrentStripeLifetime(receipt,user,map,"key",requestFor(expanded(),items(),value))).rejects.toThrow("billing_lookup_unavailable");
    await expect(readCurrentStripeLifetime(receipt,user,map,"key",requestFor(expanded(),items(),list([dispute()])),{disputeId:"du_absent",chargeId:"ch_paid"})).rejects.toThrow("billing_lookup_unavailable");
  });
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});

it("uses signed HTTP deliveries, retries lookup failure, follows current state and keeps saved data",async()=>{
  const {createHmac}=await import("node:crypto"),{default:express}=await import("express"),{createStore}=await import("../server/lib/store");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET","synthetic-dispute-secret");vi.stubEnv("STRIPE_SECRET_KEY","synthetic-server-key");vi.stubEnv("STRIPE_PRICE_LIFETIME","price_life");
  vi.resetModules();const {createApiRouter}=await import("../server/api");
  const store=createStore();await store.createUser({...user,plan:"free"});
  await store.setSync("buyer",{blob:{items:[{id:"kept",chapter:9,updatedAt:1}],updatedAt:1},updatedAt:1});
  await store.applyBillingEvent("buyer","pro",{provider:"stripe",eventId:"buy-pro",resourceId:"sub_other",occurredAt:1});
  await store.applyBillingEvent("buyer","lifetime",{provider:"stripe",eventId:"buy-life",resourceId:"cs_paid",occurredAt:1});
  let status="lost",failLookup=true;const realFetch=globalThis.fetch;
  const upstream=vi.fn(async(url:any)=>{
    const path=String(url).replace("https://api.stripe.com/v1/","");
    if(failLookup)return new Response("unavailable",{status:503});
    let body:any;
    if(path==="charges/ch_paid")body=charge();
    else if(path==="checkout/sessions?payment_intent=pi_paid&limit=2")body=list([session()]);
    else if(path==="checkout/sessions/cs_paid/line_items?limit=2")body=items();
    else if(path==="checkout/sessions/cs_paid?expand[]=payment_intent.latest_charge")body=expanded();
    else if(path==="disputes?charge=ch_paid&limit=100")body=list([dispute(status)]);
    else throw Error("Unexpected provider URL "+path);
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal("fetch",vi.fn((url:any,options:any)=>String(url).startsWith("https://api.stripe.com/")?upstream(url):realFetch(url,options)));
  const app=express();app.use("/api",createApiRouter(store));
  const server=await new Promise<any>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  try{
    const send=async(payload:any,valid=true)=>{
      const raw=JSON.stringify(payload),time=Math.floor(Date.now()/1000);
      const signature=createHmac("sha256","synthetic-dispute-secret").update(time+"."+raw).digest("hex");
      return realFetch("http://127.0.0.1:"+server.address().port+"/api/webhooks/stripe",{method:"POST",headers:{"Content-Type":"application/json","Stripe-Signature":"t="+time+",v1="+(valid?signature:"invalid")},body:raw});
    };
    expect((await send(event(),false)).status).toBe(400);expect(upstream).not.toHaveBeenCalled();
    expect((await send(event())).status).toBe(503);expect((await store.getUserById("buyer"))?.plan).toBe("lifetime");
    failLookup=false;
    expect((await send(event())).status).toBe(200);expect((await store.getUserById("buyer"))?.plan).toBe("pro");
    expect((await send({id:"evt_checkout_late",created:200,type:"checkout.session.completed",data:{object:{...session(),line_items:items()}}})).status).toBe(200);
    expect((await store.getUserById("buyer"))?.plan).toBe("pro");
    status="won";
    expect((await send({...event("charge.dispute.funds_reinstated"),id:"evt_won",created:50})).status).toBe(200);
    expect((await store.getUserById("buyer"))?.plan).toBe("lifetime");
    expect((await send({...event(),id:"evt_old_loss",created:150})).status).toBe(200);
    expect((await store.getUserById("buyer"))?.plan).toBe("lifetime");
    await store.applyBillingEvent("buyer","free",{provider:"stripe",eventId:"evt_actual_refund",resourceId:"cs_paid",occurredAt:300000,revokeLifetime:true});
    expect((await send({...event("charge.dispute.funds_reinstated"),id:"evt_won_after_refund",created:400})).status).toBe(200);
    expect((await store.getUserById("buyer"))?.plan).toBe("pro");
    expect((await store.getSync("buyer"))?.blob.items).toEqual([{id:"kept",chapter:9,updatedAt:1}]);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
