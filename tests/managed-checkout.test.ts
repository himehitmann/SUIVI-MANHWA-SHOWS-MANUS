import {describe,it,expect} from "vitest";
import {createManagedCheckout,checkoutConfig} from "../server/lib/managed-checkout";
import {createMemoryCheckoutStore} from "../server/lib/checkout-store";
import {checkoutSessionUrl} from "../shared/checkout-session";
import {checkoutProvider} from "./fixtures/checkout-provider";
const config={enabled:true,key:"synthetic-fixture",origin:"https://yomu.example",month:"price_month",year:"price_year"};
const user={id:"reader",email:"reader@example.test"};
const setup=()=>{const store=createMemoryCheckoutStore(),provider=checkoutProvider();return {store,provider,service:createManagedCheckout(store,config,provider.request)};};
describe("persistent managed checkout",()=>{
 it("shares one attempt across concurrent devices and restarted services",async()=>{
  const {store,provider,service}=setup(),other=createManagedCheckout(store,config,provider.request);
  const replies=await Promise.all(Array.from({length:20},(_,i)=>(i%2?service:other).begin(user,"month")));
  expect(new Set(replies.map(r=>r.url)).size).toBe(1);expect(provider.sessions.size).toBe(1);
  expect(new Set(provider.posts.map(p=>p.key)).size).toBe(1);
  const body=new URLSearchParams(provider.posts[0].body);
  expect(body.get("client_reference_id")).toBe(user.id);expect(body.get("subscription_data[metadata][userId]")).toBe(user.id);
  expect(body.get("adaptive_pricing[enabled]")).toBe("false");
  expect(body.get("success_url")).toBe(config.origin+"/billing/return");
  expect(await createManagedCheckout(store,config,provider.request).begin(user,"month")).toEqual(replies[0]);
 });
 it("reuses the immutable request after a lost response, even when the email changes",async()=>{
  const {store,provider,service}=setup();provider.loseNext();
  await expect(service.begin(user,"month")).rejects.toThrow("response lost");
  await createManagedCheckout(store,config,provider.request).begin({...user,email:"new@example.test"},"month");
  expect(provider.sessions.size).toBe(1);expect(provider.posts[1]).toEqual(provider.posts[0]);
 });
 it("recovers after session persistence fails without creating a second provider session",async()=>{
  const {store,provider,service}=setup(),attach=store.attach;store.attach=async()=>{throw Error("database unavailable");};
  await expect(service.begin(user,"month")).rejects.toThrow("database unavailable");store.attach=attach;
  await service.begin(user,"month");expect(provider.sessions.size).toBe(1);
 });
 it("does not change the offer of an existing attempt",async()=>{
  const {service,provider}=setup();await service.begin(user,"month");
  await expect(service.begin(user,"year")).rejects.toThrow("checkout_pending");expect(provider.sessions.size).toBe(1);
 });
 it("keeps separate accounts isolated",async()=>{
  const {service,provider}=setup();await service.begin(user,"month");await service.begin({id:"other",email:"other@example.test"},"year");
  expect(provider.sessions.size).toBe(2);expect([...provider.sessions.values()][1].client_reference_id).toBe("other");
 });
 it("never retries an unknown creation beyond the idempotency safety window",async()=>{
  const {store,provider,service}=setup();provider.loseNext();await expect(service.begin(user,"month")).rejects.toThrow();
  const attempt=(await store.read(user.id))!;
  await expect(createManagedCheckout(store,config,provider.request,()=>attempt.createdAt+23*3600000).begin(user,"month")).rejects.toThrow("checkout_review_required");
  await expect(createManagedCheckout(store,config,provider.request,()=>attempt.createdAt-1).expire(user.id)).rejects.toThrow("checkout_review_required");
  expect(provider.posts.length).toBe(1);
 });
 it("requires review after a credential change on an existing attempt",async()=>{
  const {store,provider,service}=setup();await service.begin(user,"month");
  await expect(createManagedCheckout(store,{...config,key:"rotated-fixture"},provider.request).begin(user,"month")).rejects.toThrow("checkout_review_required");
 });
 it.each([{unit_amount:1},{currency:"eur"},{active:false},{type:"one_time"},{recurring:{interval:"year",interval_count:1}},{recurring:{interval:"month",interval_count:2}}])("rejects a mismatched price before reserving or creating a session: %j",async patch=>{
  const {store,provider,service}=setup();provider.patchPrice(patch);
  await expect(service.begin(user,"month")).rejects.toThrow("checkout_price_mismatch");
  expect(await store.read(user.id)).toBeNull();expect(provider.posts).toHaveLength(0);
 });
 it.each(["active","past_due","incomplete","unpaid","trialing","paused"])("blocks a second purchase when a completed session has a %s subscription",async status=>{
  const {service,provider}=setup();await service.begin(user,"month");[...provider.sessions.values()][0].status="complete";provider.subscription(status);
  await expect(service.begin(user,"year")).rejects.toThrow("checkout_pending");expect(provider.sessions.size).toBe(1);
  await expect(service.expire(user.id)).rejects.toThrow("checkout_pending");
 });
 it.each(["canceled","incomplete_expired"])("requires an explicit retry after terminal subscription %s",async status=>{
  const {service,provider,store}=setup();await service.begin(user,"month");[...provider.sessions.values()][0].status="complete";provider.subscription(status);
  await expect(service.begin(user,"year")).rejects.toThrow("checkout_expired");expect(await store.read(user.id)).toBeNull();
  await service.begin(user,"year");expect(provider.sessions.size).toBe(2);
 });
 it("expires the unpaid provider session before releasing the account slot",async()=>{
  const {service,provider,store}=setup();await service.begin(user,"month");await service.expire(user.id);
  expect([...provider.sessions.values()][0].status).toBe("expired");expect(await store.read(user.id)).toBeNull();
  await service.begin(user,"year");expect(provider.sessions.size).toBe(2);
 });
 it("does not let a stale request clear or attach to a replacement attempt",async()=>{
  const {service,store}=setup();await service.begin(user,"month");const old=(await store.read(user.id))!;
  await service.expire(user.id);await service.begin(user,"year");const next=await store.read(user.id);
  expect(await store.clear(user.id,old.id)).toBe(false);expect(await store.attach(user.id,old.id,"cs_stale")).toBe(false);
  expect(await store.read(user.id)).toEqual(next);
 });
 it.each([{client_reference_id:"other"},{metadata:{userId:"other"}},{id:"cs_other"},{url:"https://evil.test"},{url:"https://checkout.stripe.com/c/pay/cs_other"},{mode:"payment"}])("rejects mismatched or unsafe provider responses: %j",async patch=>{
  const {service,provider}=setup();await service.begin(user,"month");provider.patchResponse(patch);
  await expect(service.begin(user,"month")).rejects.toThrow();
 });
 it("retains the guard on malformed provider replies",async()=>{
  const {store,provider,service}=setup();await service.begin(user,"month");
  for(const response of [new Response("bad"),new Response("{}",{status:503}),new Response("x".repeat(65537))]){
   await expect(createManagedCheckout(store,config,async()=>response).begin(user,"month")).rejects.toThrow();
   expect(await store.read(user.id)).not.toBeNull();
  }
 });
});
describe("checkout destination and configuration",()=>{
 it.each(["https://evil.test/c/pay/cs_a","http://checkout.stripe.com/c/pay/cs_a","https://user@checkout.stripe.com/c/pay/cs_a","https://checkout.stripe.com:444/c/pay/cs_a","https://checkout.stripe.com/c/pay/cs_a?next=evil","https://checkout.stripe.com\\evil","javascript:alert(1)",null])("rejects unsafe destination %s",v=>expect(checkoutSessionUrl(v)).toBeNull());
 it("accepts the hosted session hash",()=>expect(checkoutSessionUrl("https://checkout.stripe.com/c/pay/cs_test_a#hash")).toContain("#hash"));
 it.each(["", "http://yomu.example", "https://user@yomu.example", "https://yomu.example/path","https://yomu.example/?next=x"])("closes sales for invalid public origin %s",origin=>expect(checkoutConfig({YOMU_PUBLIC_URL:origin,STRIPE_SECRET_KEY:"fixture",STRIPE_WEBHOOK_SECRET:"synthetic-webhook",STRIPE_PRICE_PRO_MONTH:"price_month"})).toBeNull());
 it("requires valid prices and a server key",()=>{
  expect(checkoutConfig({YOMU_PUBLIC_URL:config.origin})).toBeNull();
  expect(checkoutConfig({YOMU_PUBLIC_URL:config.origin,STRIPE_SECRET_KEY:"fixture",STRIPE_PRICE_PRO_MONTH:"price_month"})).toBeNull();
  expect(checkoutConfig({YOMU_PUBLIC_URL:config.origin,STRIPE_SECRET_KEY:"fixture",STRIPE_WEBHOOK_SECRET:"synthetic-webhook",STRIPE_PRICE_PRO_MONTH:"price_same",STRIPE_PRICE_PRO_YEAR:"price_same"})).toBeNull();
  expect(checkoutConfig({YOMU_PUBLIC_URL:config.origin,STRIPE_SECRET_KEY:"fixture",STRIPE_WEBHOOK_SECRET:"synthetic-webhook",STRIPE_PRICE_PRO_MONTH:"price_month"})).toMatchObject({month:"price_month",origin:config.origin});
 });
});

describe("server-controlled sale closure",()=>{
 const env={YOMU_PUBLIC_URL:config.origin,STRIPE_SECRET_KEY:"fixture",STRIPE_WEBHOOK_SECRET:"synthetic-webhook",STRIPE_PRICE_PRO_MONTH:"price_month"};
 it.each([undefined,"","false","TRUE","1"," true "])("defaults to closed for switch %s",value=>{
  const parsed=checkoutConfig({...env,YOMU_CHECKOUT_ENABLED:value})!;
  expect(parsed.enabled).toBe(false);
  const provider=checkoutProvider(),service=createManagedCheckout(createMemoryCheckoutStore(),parsed,provider.request);
  expect(service.offers()).toEqual([]);
 });
 it("requires explicit true even when all provider configuration exists",()=>{
  expect(checkoutConfig({...env,YOMU_CHECKOUT_ENABLED:"true"})?.enabled).toBe(true);
 });
 it("rejects direct purchase attempts before database or provider access",async()=>{
  const store=createMemoryCheckoutStore(),provider=checkoutProvider();
  store.read=async()=>{throw Error("must not read attempts");};
  const service=createManagedCheckout(store,{...config,enabled:false},provider.request);
  await expect(service.begin(user,"month")).rejects.toThrow("checkout_closed");
  expect(provider.posts).toHaveLength(0);
 });
 it("allows expiry while sales are closed and retains completed attempts",async()=>{
  const {store,provider,service}=setup();await service.begin(user,"month");
  const closed=createManagedCheckout(store,{...config,enabled:false},provider.request);
  expect(closed.offers()).toEqual([]);
  await closed.expire(user.id);expect(await store.read(user.id)).toBeNull();
  await service.begin(user,"month");[...provider.sessions.values()][1].status="complete";
  await expect(closed.expire(user.id)).rejects.toThrow("checkout_pending");
  expect(await store.read(user.id)).not.toBeNull();
  await expect(closed.begin(user,"month")).rejects.toThrow("checkout_closed");
 });
});

describe("read-only deletion eligibility",()=>{
 it("allows an account with no purchase attempt",async()=>{const {service,provider}=setup();await service.assertDeletable(user.id);expect(provider.posts).toHaveLength(0);});
 it("refuses open checkout and never expires it as a deletion side effect",async()=>{
  const {service,provider,store}=setup();await service.begin(user,"month");const before=await store.read(user.id),count=provider.posts.length;
  await expect(service.assertDeletable(user.id)).rejects.toThrow("billing_checkout_pending");
  expect(provider.posts.length).toBe(count);expect(await store.read(user.id)).toEqual(before);expect([...provider.sessions.values()][0].status).toBe("open");
 });
 it("refuses unknown creation without retrying it",async()=>{
  const {service,provider}=setup();provider.loseNext();await expect(service.begin(user,"month")).rejects.toThrow();
  const count=provider.posts.length;await expect(service.assertDeletable(user.id)).rejects.toThrow("billing_review_required");expect(provider.posts.length).toBe(count);
 });
 it.each(["active","trialing","past_due","unpaid","incomplete","paused"])("retains the account for subscription status %s",async status=>{
  const {service,provider}=setup();await service.begin(user,"month");[...provider.sessions.values()][0].status="complete";provider.subscription(status);
  await expect(service.assertDeletable(user.id)).rejects.toThrow("billing_subscription_active");
 });
 it.each(["canceled","incomplete_expired"])("accepts only terminal subscription status %s without deleting its evidence",async status=>{
  const {service,provider,store}=setup();await service.begin(user,"month");[...provider.sessions.values()][0].status="complete";provider.subscription(status);
  await service.assertDeletable(user.id);expect(await store.read(user.id)).not.toBeNull();
 });
 it("accepts a provider-expired session without discarding evidence before the account delete",async()=>{
  const {service,provider,store}=setup();await service.begin(user,"month");[...provider.sessions.values()][0].status="expired";
  await service.assertDeletable(user.id);expect(await store.read(user.id)).not.toBeNull();
 });
 it("rejects provider outages and key changes",async()=>{
  const {service,provider,store}=setup();await service.begin(user,"month");
  await expect(createManagedCheckout(store,config,async()=>new Response("",{status:503})).assertDeletable(user.id)).rejects.toThrow();
  await expect(createManagedCheckout(store,{...config,key:"changed"},provider.request).assertDeletable(user.id)).rejects.toThrow("billing_review_required");
 });
});
