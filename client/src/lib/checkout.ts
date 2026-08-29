/**
 * Client-side checkout links — the last unwired piece of the payment flow.
 *
 * The backend webhook already grants the plan (server/lib/billing.ts); all the
 * client needs is to send the buyer to a hosted checkout. We use provider
 * "payment links" (e.g. Stripe Payment Links) configured at build time via env,
 * so there is NO secret in the client and no extra backend code:
 *
 *   VITE_CHECKOUT_PRO_MONTH   → $2.99/mo link
 *   VITE_CHECKOUT_PRO_YEAR    → $24.99/yr link
 *   VITE_CHECKOUT_LIFETIME    → $49 one-time link
 *
 * We append `client_reference_id` (the Dasi user id) and `prefilled_email` so
 * the webhook can map the payment back to the account. When no link is
 * configured (dev, or the unlocked owner build), the Pricing page falls back to
 * a local plan toggle.
 */
import type { Plan } from "./types";

export interface CheckoutRef {
  userId?: string;
  email?: string;
}

/** Attach the account reference to a hosted checkout URL (pure, testable). */
export function buildCheckoutUrl(baseUrl: string, ref: CheckoutRef): string {
  const u = new URL(baseUrl);
  if (ref.userId) u.searchParams.set("client_reference_id", ref.userId);
  if (ref.email) u.searchParams.set("prefilled_email", ref.email);
  return u.toString();
}

const ENV = import.meta.env as unknown as Record<string, string | undefined>;

/** The configured base checkout URL for a plan + billing cadence, if any. */
export function checkoutBase(plan: Plan, yearly: boolean): string | undefined {
  if (plan === "lifetime") return ENV.VITE_CHECKOUT_LIFETIME;
  if (plan === "pro") return yearly ? ENV.VITE_CHECKOUT_PRO_YEAR : ENV.VITE_CHECKOUT_PRO_MONTH;
  return undefined;
}

/** Full checkout URL for a plan, or null when no link is configured. */
export function checkoutUrl(plan: Plan, yearly: boolean, ref: CheckoutRef): string | null {
  const base = checkoutBase(plan, yearly);
  return base ? buildCheckoutUrl(base, ref) : null;
}

/** True when at least one hosted checkout link is configured for this build. */
export const CHECKOUT_CONFIGURED = Boolean(
  ENV.VITE_CHECKOUT_PRO_MONTH || ENV.VITE_CHECKOUT_PRO_YEAR || ENV.VITE_CHECKOUT_LIFETIME,
);
