import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyPlanIntent, planFromPaddleEvent, planFromStripeEvent, resolvePlan,
  verifyPaddleSignature, verifyStripeSignature, type PriceMap,
} from "../server/lib/billing";
import { createStore } from "../server/lib/store";

const MAP: PriceMap = { proMonth: "price_month", proYear: "price_year", lifetime: "price_life" };

const stripeHeader = (raw: string, secret: string, ts: number) =>
  `t=${ts},v1=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;
const paddleHeader = (raw: string, secret: string, ts: number) =>
  `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")}`;

describe("resolvePlan", () => {
  it("maps price ids to plans", () => {
    expect(resolvePlan("price_month", MAP)).toBe("pro");
    expect(resolvePlan("price_year", MAP)).toBe("pro");
    expect(resolvePlan("price_life", MAP)).toBe("lifetime");
    expect(resolvePlan("price_unknown", MAP)).toBeNull();
    expect(resolvePlan(undefined, MAP)).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  const raw = JSON.stringify({ hello: "world" });
  const secret = "whsec_test";
  const now = 1_700_000_000;
  it("accepts a valid, fresh signature", () => {
    expect(verifyStripeSignature(raw, stripeHeader(raw, secret, now), secret, { now })).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyStripeSignature(raw + "x", stripeHeader(raw, secret, now), secret, { now })).toBe(false);
  });
  it("rejects a wrong secret and a stale timestamp", () => {
    expect(verifyStripeSignature(raw, stripeHeader(raw, secret, now), "other", { now })).toBe(false);
    expect(verifyStripeSignature(raw, stripeHeader(raw, secret, now - 10_000), secret, { now })).toBe(false);
  });
  it("rejects malformed headers", () => {
    expect(verifyStripeSignature(raw, "", secret, { now })).toBe(false);
    expect(verifyStripeSignature(raw, "t=1", secret, { now })).toBe(false);
  });
});

describe("verifyPaddleSignature", () => {
  const raw = JSON.stringify({ event_type: "x" });
  const secret = "pdl_test";
  const now = 1_700_000_000;
  it("accepts a valid signature and rejects tampering", () => {
    expect(verifyPaddleSignature(raw, paddleHeader(raw, secret, now), secret, { now })).toBe(true);
    expect(verifyPaddleSignature(raw, paddleHeader(raw, secret, now), "no", { now })).toBe(false);
    expect(verifyPaddleSignature(raw, paddleHeader(raw, secret, now - 99999), secret, { now })).toBe(false);
  });
});

describe("planFromStripeEvent", () => {
  it("grants lifetime on a one-time checkout", () => {
    const e = { type: "checkout.session.completed", data: { object: { mode: "payment", payment_status: "paid", line_items: { data: [{ price: { id: "price_life" } }] }, client_reference_id: "u1" } } };
    expect(planFromStripeEvent(e, MAP)).toEqual({ userId: "u1", email: undefined, plan: "lifetime" });
  });
  it("grants pro on an active subscription and reads the price", () => {
    const e = {
      type: "customer.subscription.updated",
      data: { object: { status: "active", metadata: { userId: "u2" }, items: { data: [{ price: { id: "price_year" } }] } } },
    };
    expect(planFromStripeEvent(e, MAP)?.plan).toBe("pro");
  });
  it("downgrades to free on cancel/delete", () => {
    const e = { type: "customer.subscription.deleted", data: { object: { customer_email: "a@b.c", items: { data: [{ price: { id: "price_month" } }] } } } };
    expect(planFromStripeEvent(e, MAP)).toEqual({ userId: undefined, email: "a@b.c", plan: "free" });
  });
  it("ignores unrelated events", () => {
    expect(planFromStripeEvent({ type: "ping" }, MAP)).toBeNull();
  });
});

describe("planFromPaddleEvent", () => {
  it("maps transaction and cancellation", () => {
    const paid = { event_type: "transaction.completed", data: { status: "completed", custom_data: { userId: "u9" }, items: [{ price: { id: "price_life" } }] } };
    expect(planFromPaddleEvent(paid, MAP)).toEqual({ userId: "u9", email: undefined, plan: "lifetime" });
    const canceled = { event_type: "subscription.canceled", data: { custom_data: { userId: "u9" }, items: [{ price: { id: "price_month" } }] } };
    expect(planFromPaddleEvent(canceled, MAP)?.plan).toBe("free");
  });
});

describe("applyPlanIntent", () => {
  const mkUser = (plan: "free" | "pro" | "lifetime") => ({
    id: "u1", email: "u1@example.com", passwordHash: "x", plan, createdAt: 1,
  });

  it("upgrades a user by id", async () => {
    const store = createStore();
    await store.createUser(mkUser("free"));
    const r = await applyPlanIntent(store, { userId: "u1", plan: "pro" });
    expect(r).toEqual({ ok: true, plan: "pro" });
    expect((await store.getUserById("u1"))?.plan).toBe("pro");
  });

  it("resolves by email when no id is given", async () => {
    const store = createStore();
    await store.createUser(mkUser("free"));
    await applyPlanIntent(store, { email: "U1@Example.com", plan: "lifetime" });
    expect((await store.getUserById("u1"))?.plan).toBe("lifetime");
  });

  it("never downgrades a lifetime account", async () => {
    const store = createStore();
    await store.createUser(mkUser("lifetime"));
    const r = await applyPlanIntent(store, { userId: "u1", plan: "free" });
    expect(r.unchanged).toBe(true);
    expect((await store.getUserById("u1"))?.plan).toBe("lifetime");
  });

  it("reports missing users and empty intents", async () => {
    const store = createStore();
    expect((await applyPlanIntent(store, { userId: "nope", plan: "pro" })).reason).toBe("user_not_found");
    expect((await applyPlanIntent(store, null)).ok).toBe(false);
  });
});

describe("billing rejects unrecognized or incomplete purchases", () => {
  it.each([undefined, "unpaid"])("does not grant lifetime before payment (%s)", payment_status => {
    expect(planFromStripeEvent({type:"checkout.session.completed",data:{object:{mode:"payment",payment_status,line_items:{data:[{price:{id:"price_life"}}]}}}},MAP)).toBeNull();
  });
  it.each([undefined, [], [{price:{id:"unrelated"}}], [{price:{id:"price_life"}},{price:{id:"unrelated"}}]])("rejects missing, unknown and ambiguous Stripe line items", items => {
    expect(planFromStripeEvent({type:"checkout.session.completed",data:{object:{mode:"payment",payment_status:"paid",line_items:{data:items}}}},MAP)).toBeNull();
  });
  it("accepts delayed payment only for the configured lifetime product", () => {
    const event={type:"checkout.session.async_payment_succeeded",data:{object:{mode:"payment",payment_status:"paid",line_items:{data:[{price:{id:"price_life"}}]},metadata:{userId:"u1"}}}};
    expect(planFromStripeEvent(event,MAP)?.plan).toBe("lifetime");
    expect(planFromStripeEvent(event,{})).toBeNull();
  });
  it.each(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"])("ignores unrelated Stripe subscriptions (%s)",type=>{
    expect(planFromStripeEvent({type,data:{object:{status:"active",items:{data:[{price:{id:"other_product"}}]}}}},MAP)).toBeNull();
  });
  it("does not grant recurring access from checkout before subscription state",()=>{
    expect(planFromStripeEvent({type:"checkout.session.completed",data:{object:{mode:"subscription",payment_status:"paid",line_items:{data:[{price:{id:"price_month"}}]}}}},MAP)).toBeNull();
  });
  it.each(["transaction.completed","subscription.updated","subscription.canceled"])("ignores unrelated Paddle products (%s)",event_type=>{
    expect(planFromPaddleEvent({event_type,data:{status:"completed",items:[{price:{id:"other_product"}}]}},MAP)).toBeNull();
  });
  it("ignores incomplete Paddle transactions and unknown subscription states",()=>{
    expect(planFromPaddleEvent({event_type:"transaction.completed",data:{status:"ready",items:[{price:{id:"price_month"}}]}},MAP)).toBeNull();
    expect(planFromPaddleEvent({event_type:"subscription.updated",data:{status:"unknown",items:[{price:{id:"price_month"}}]}},MAP)).toBeNull();
  });
});
