/**
 * Subscription/billing glue — turns a payment-provider webhook into a plan
 * change on the user account. Pure and dependency-free (Node crypto only), so
 * the signature checks and event→plan mapping are unit-tested without any live
 * provider. The API layer only verifies the signature, parses JSON, maps the
 * event, and applies it to the Store.
 *
 * Subscriptions live on the account (server-side), keyed to the user, so they
 * are independent of extension version and device. `GET /api/license` reports
 * the resulting plan.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Store, BillingReceipt } from "./store";

export type Plan = "free" | "pro" | "lifetime";

/** Provider price/plan ids mapped to Dasi plans (configure via env). */
export interface PriceMap {
  proMonth?: string;
  proYear?: string;
  lifetime?: string;
}

/** Who to change and to what. Resolve the user by id (preferred) or email. */
export interface PlanIntent {
  userId?: string;
  email?: string;
  plan: Plan;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Map a provider price id to a Dasi plan, or null if it isn't one we sell. */
export function resolvePlan(priceId: string | undefined, map: PriceMap): Plan | null {
  if (!priceId) return null;
  if (map.lifetime && priceId === map.lifetime) return "lifetime";
  if ((map.proMonth && priceId === map.proMonth) || (map.proYear && priceId === map.proYear)) return "pro";
  return null;
}

/**
 * Verify a Stripe `Stripe-Signature` header: `t=<ts>,v1=<hmac>` where the HMAC
 * is SHA-256 of `${t}.${rawBody}` keyed by the endpoint's signing secret.
 */
export function verifyStripeSignature(
  raw: string,
  header: string,
  secret: string,
  opts: { toleranceSec?: number; now?: number } = {},
): boolean {
  if (!header || !secret) return false;
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSec ?? 300;
  if (!Number.isFinite(Number(t)) || Math.abs(now - Number(t)) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return safeEqualHex(expected, v1);
}

/**
 * Verify a Paddle Billing `Paddle-Signature` header: `ts=<ts>;h1=<hmac>` where
 * the HMAC is SHA-256 of `${ts}:${rawBody}` keyed by the endpoint secret.
 */
export function verifyPaddleSignature(
  raw: string,
  header: string,
  secret: string,
  opts: { toleranceSec?: number; now?: number } = {},
): boolean {
  if (!header || !secret) return false;
  const parts: Record<string, string> = {};
  for (const kv of header.split(";")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSec ?? 300;
  if (!Number.isFinite(Number(ts)) || Math.abs(now - Number(ts)) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
  return safeEqualHex(expected, h1);
}

/** Extract a user reference from provider metadata/customer fields. */
function stripeRef(obj: Record<string, any>): { userId?: string; email?: string } {
  return {
    userId: obj?.metadata?.userId || obj?.client_reference_id || undefined,
    email: obj?.customer_email || obj?.customer_details?.email || undefined,
  };
}

/** Only a single, explicitly configured product may change account access.
 * Checkout payloads without expanded line items must be resolved by the caller
 * before fulfillment; missing details never imply a paid plan.
 */
function itemPlan(items: any, map: PriceMap): Plan | null {
  if (!Array.isArray(items) || items.length !== 1) return null;
  return resolvePlan(items[0]?.price?.id, map);
}

/** Map a verified Stripe event to a known product, never a default upgrade. */
export function planFromStripeEvent(event: any, map: PriceMap): PlanIntent | null {
  const obj = event?.data?.object ?? {};
  const ref = stripeRef(obj);
  switch (event?.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (obj.payment_status !== "paid" && obj.payment_status !== "no_payment_required") return null;
      if (obj?.line_items?.has_more === true) return null;
      const plan = itemPlan(obj?.line_items?.data, map);
      if (!plan) return null;
      if (obj.mode === "payment" && plan === "lifetime") return { ...ref, plan };
      // Subscription state is authoritative for recurring access.
      return null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const plan = itemPlan(obj?.items?.data, map);
      if (plan !== "pro") return null;
      if (event.type === "customer.subscription.deleted") return { ...ref, plan: "free" };
      if (obj.status === "active" || obj.status === "trialing") return { ...ref, plan };
      if (["canceled", "unpaid", "past_due", "paused", "incomplete", "incomplete_expired"].includes(obj.status)) return { ...ref, plan: "free" };
      return null;
    }
    default:
      return null;
  }
}

/** Map a verified Paddle event only when the product and status are known. */
export function planFromPaddleEvent(event: any, map: PriceMap): PlanIntent | null {
  const data = event?.data ?? {};
  const ref = {
    userId: data?.custom_data?.userId || undefined,
    email: data?.customer?.email || data?.billing_details?.email || undefined,
  };
  const plan = itemPlan(data?.items, map);
  if (!plan) return null;
  switch (event?.event_type) {
    case "transaction.completed":
      return data.status === "completed" ? { ...ref, plan } : null;
    case "subscription.created":
    case "subscription.updated":
      if (plan !== "pro") return null;
      if (data.status === "active" || data.status === "trialing") return { ...ref, plan };
      if (["canceled", "past_due", "paused"].includes(data.status)) return { ...ref, plan: "free" };
      return null;
    case "subscription.canceled":
      return plan === "pro" ? { ...ref, plan: "free" } : null;
    default:
      return null;
  }
}

export interface ApplyResult {
  ok: boolean;
  plan?: Plan;
  reason?: string;
  unchanged?: boolean;
}

/**
 * Apply a plan intent to the account. Lifetime is permanent — it is never
 * downgraded by a later subscription/cancel event. Resolves the user by id
 * first, then email.
 */
export async function applyPlanIntent(store: Store, intent: PlanIntent | null, receipt?: BillingReceipt): Promise<ApplyResult> {
  if (!intent) return { ok: false, reason: "no_intent" };
  const user = intent.userId
    ? await store.getUserById(intent.userId)
    : intent.email
      ? await store.getUserByEmail(intent.email)
      : null;
  if (!user) return { ok: false, reason: "user_not_found" };
  if (receipt) return store.applyBillingEvent(user.id, intent.plan, receipt);
  if (user.plan === "lifetime" && intent.plan !== "lifetime") return { ok: true, unchanged: true };
  if (user.plan === intent.plan) return { ok: true, unchanged: true };
  await store.updateUser({ ...user, plan: intent.plan });
  return { ok: true, plan: intent.plan };
}

/** Event identity is taken only from the signature-verified provider envelope. */
export function billingReceipt(provider: "stripe"|"paddle", event: any): BillingReceipt | null {
  const eventId=provider==="stripe"?event?.id:event?.event_id;
  const object=provider==="stripe"?event?.data?.object:event?.data;
  const resourceId=provider==="paddle"?(object?.subscription_id||object?.id):object?.id;
  const occurredAt=provider==="stripe"?(typeof event?.created==="number"?event.created*1000:NaN):
    (typeof event?.occurred_at==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(event.occurred_at)?Date.parse(event.occurred_at):NaN);
  const validId=(value:unknown)=>typeof value==="string"&&value.length<=255&&/^[A-Za-z0-9_-]+$/.test(value);
  if(!validId(eventId)||!validId(resourceId)||!Number.isSafeInteger(occurredAt)||occurredAt<0)return null;
  return {provider,eventId,resourceId,occurredAt};
}
