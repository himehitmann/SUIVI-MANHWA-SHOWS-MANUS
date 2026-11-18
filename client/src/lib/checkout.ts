/** Hosted Stripe Payment Links. Prices and products must match the configured checkout. */
import type { Plan } from "./types";
export interface CheckoutRef { userId?: string; email?: string; }
export function validCheckoutBase(value: string): boolean {
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "buy.stripe.com" && !u.port && !u.username && !u.password && !u.hash && /^\/[a-zA-Z0-9_]+$/.test(u.pathname); } catch { return false; }
}
/** The account reference is required so a verified webhook can grant the purchase. */
export function buildCheckoutUrl(baseUrl: string, ref: CheckoutRef): string {
  if (!validCheckoutBase(baseUrl)) throw new Error("Invalid hosted checkout destination");
  if (!ref.userId || !/^[a-zA-Z0-9_-]{1,128}$/.test(ref.userId)) throw new Error("Sign in before checkout");
  const u = new URL(baseUrl);
  u.searchParams.set("client_reference_id", ref.userId);
  u.searchParams.delete("prefilled_email");
  if (ref.email) u.searchParams.set("prefilled_email", ref.email);
  return u.toString();
}
const ENV = import.meta.env as unknown as Record<string, string | undefined>;
export function checkoutBase(plan: Plan, yearly: boolean): string | undefined {
  const value = plan === "lifetime" ? ENV.VITE_CHECKOUT_LIFETIME : plan === "pro" ? (yearly ? ENV.VITE_CHECKOUT_PRO_YEAR : ENV.VITE_CHECKOUT_PRO_MONTH) : undefined;
  return value && validCheckoutBase(value) ? value : undefined;
}
export function checkoutUrl(plan: Plan, yearly: boolean, ref: CheckoutRef): string | null {
  const base = checkoutBase(plan, yearly);
  return base && ref.userId ? buildCheckoutUrl(base, ref) : null;
}
export const CHECKOUT_CONFIGURED = Boolean(checkoutBase("pro", false) || checkoutBase("pro", true) || checkoutBase("lifetime", false));

