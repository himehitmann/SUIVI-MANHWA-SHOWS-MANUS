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
import type { Store, BillingReceipt, UserRecord } from "./store";

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

interface SignatureOptions { toleranceSec?: number; now?: number; }
interface SignatureFormat {
  delimiter: "," | ";";
  timestampKey: "t" | "ts";
  signatureKey: "v1" | "h1";
  separator: "." | ":";
  toleranceSec: number;
}

/** Both providers can send several signatures while an endpoint key rotates.
 * Keep all supported signatures; unknown diagnostic/version fields are ignored.
 * A duplicated timestamp is ambiguous and must never select a different payload.
 */
function verifyWebhookSignature(
  raw: string, header: string, secret: string,
  format: SignatureFormat, opts: SignatureOptions,
): boolean {
  if (typeof raw !== "string" || typeof header !== "string" ||
      !header || header.length > 8192 || typeof secret !== "string" || !secret) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(format.delimiter)) {
    const split = part.indexOf("=");
    if (split < 1) continue;
    const key = part.slice(0, split).trim(), value = part.slice(split + 1).trim();
    if (key === format.timestampKey) {
      if (timestamp !== undefined) return false;
      timestamp = value;
    } else if (key === format.signatureKey && /^[a-f0-9]{64}$/i.test(value)) {
      signatures.push(value);
    }
  }
  if (!timestamp || !/^\d{1,16}$/.test(timestamp) || !signatures.length) return false;
  const time = Number(timestamp), now = opts.now ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSec ?? format.toleranceSec;
  if (!Number.isSafeInteger(time) || time < 0 || !Number.isFinite(now) || now < 0 ||
      !Number.isFinite(tolerance) || tolerance < 0 || Math.abs(now - time) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(timestamp + format.separator + raw).digest();
  return signatures.some(signature => timingSafeEqual(expected, Buffer.from(signature, "hex")));
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
  raw: string, header: string, secret: string, opts: SignatureOptions = {},
): boolean {
  return verifyWebhookSignature(raw, header, secret, {
    delimiter: ",", timestampKey: "t", signatureKey: "v1", separator: ".", toleranceSec: 300,
  }, opts);
}

/** Paddle uses ts:rawBody and may include multiple h1 signatures.
 * Match its SDK's five-second default window; the server clock must be synced.
 */
export function verifyPaddleSignature(
  raw: string, header: string, secret: string, opts: SignatureOptions = {},
): boolean {
  return verifyWebhookSignature(raw, header, secret, {
    delimiter: ";", timestampKey: "ts", signatureKey: "h1", separator: ":", toleranceSec: 5,
  }, opts);
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
      if (obj?.items?.has_more === true) return null;
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
      // Recurring access follows subscription state, not a late transaction receipt.
      return data.status === "completed" && plan === "lifetime" ? { ...ref, plan } : null;
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
export async function applyPlanIntent(store: Store, intent: PlanIntent | null, receipt?: BillingReceipt, resolveAmbiguity?: (user:UserRecord)=>Promise<Plan>): Promise<ApplyResult> {
  if (!intent) return { ok: false, reason: "no_intent" };
  const user = intent.userId
    ? await store.getUserById(intent.userId)
    : intent.email
      ? await store.getUserByEmail(intent.email)
      : null;
  if (!user) return { ok: false, reason: "user_not_found" };
  if (receipt) return store.applyBillingEvent(user.id, intent.plan, receipt, resolveAmbiguity);
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
