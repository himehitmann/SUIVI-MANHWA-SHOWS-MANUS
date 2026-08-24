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
import type { Store } from "./store";

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

/** Map a Stripe event to a plan change, or null if it isn't billing-relevant. */
export function planFromStripeEvent(event: any, map: PriceMap): PlanIntent | null {
  const obj = event?.data?.object ?? {};
  const ref = stripeRef(obj);
  switch (event?.type) {
    case "checkout.session.completed": {
      if (obj.mode === "payment") return { ...ref, plan: "lifetime" };
      if (obj.mode === "subscription") {
        const priceId = obj?.line_items?.data?.[0]?.price?.id;
        return { ...ref, plan: resolvePlan(priceId, map) ?? "pro" };
      }
      return null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const priceId = obj?.items?.data?.[0]?.price?.id;
      const active = obj?.status === "active" || obj?.status === "trialing";
      return active ? { ...ref, plan: resolvePlan(priceId, map) ?? "pro" } : { ...ref, plan: "free" };
    }
    case "customer.subscription.deleted":
      return { ...ref, plan: "free" };
    default:
      return null;
  }
}

/** Map a Paddle Billing event to a plan change, or null if not relevant. */
export function planFromPaddleEvent(event: any, map: PriceMap): PlanIntent | null {
  const data = event?.data ?? {};
  const ref = {
    userId: data?.custom_data?.userId || undefined,
    email: data?.customer?.email || data?.billing_details?.email || undefined,
  };
  const priceId = data?.items?.[0]?.price?.id;
  switch (event?.event_type) {
    case "transaction.completed":
      return { ...ref, plan: resolvePlan(priceId, map) ?? "pro" };
    case "subscription.created":
    case "subscription.updated": {
      const active = data?.status === "active" || data?.status === "trialing";
      return active ? { ...ref, plan: resolvePlan(priceId, map) ?? "pro" } : { ...ref, plan: "free" };
    }
    case "subscription.canceled":
      return { ...ref, plan: "free" };
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
export async function applyPlanIntent(store: Store, intent: PlanIntent | null): Promise<ApplyResult> {
  if (!intent) return { ok: false, reason: "no_intent" };
  const user = intent.userId
    ? await store.getUserById(intent.userId)
    : intent.email
      ? await store.getUserByEmail(intent.email)
      : null;
  if (!user) return { ok: false, reason: "user_not_found" };
  if (user.plan === "lifetime" && intent.plan !== "lifetime") return { ok: true, unchanged: true };
  if (user.plan === intent.plan) return { ok: true, unchanged: true };
  await store.updateUser({ ...user, plan: intent.plan });
  return { ok: true, plan: intent.plan };
}
