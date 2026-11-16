# Paid offers and checkout readiness

The public commercial offer is Pro, with monthly and yearly billing. There is no
free trial or free offer card. Existing local libraries and the internal `free`
account state are retained: this presentation change does not delete data or
claim that every offline feature is now payment-enforced.

## Single catalogue

`shared/pricing.ts` is the source for both React and the extension.
`pnpm build:sync` generates `pricing-catalog.js`, included by the library page
and the extension packager. Eight extension languages are covered; the website
currently supports English and French.

Existing proposed prices are preserved: **USD 3.49/month** or **USD 29.99/year**.
Annual billing is one yearly charge, not monthly installments. The difference
against twelve monthly charges is **USD 11.89**. Currency formatting is localized;
the currency itself is not converted. No margin or tax-inclusive price is claimed.

Both periods include the same tools. Provider availability, translation limits
and the distinction between local storage and configured account sync are stated.
An uninstall cannot be recovered from a local copy alone.

## Purchase controls

- The website reads authenticated `GET /api/me` on entry and again immediately
  before checkout. It does not rely on a cached plan for this decision.
- Pro, Lifetime, owner and administrator accounts are not offered another
  subscription purchase. An active gift appears as Pro via the server.
- A failed, malformed, foreign-account or stale response blocks navigation.
  Retrying is possible. Signing out or changing accounts invalidates an old read.
- A missing payment link disables that period. An anonymous visitor with a valid
  configured link is directed to account settings to sign in first.
- The extension has no configured checkout flow yet. Its purchase controls say
  that sales are not open; account settings and library navigation remain usable.
- The browser check reduces accidental duplicate purchases. It does not replace
  signed webhooks, server authorization or provider-side duplicate-subscription
  controls, and cannot prevent a separate direct payment-link visit.

## Remaining release requirements

These prices are not proof that the payment provider has matching active products.
Before opening sales, verify the actual checkout currency, amounts, cadence,
tax presentation, receipts, cancellation and entitlement delivery in a deployed
test environment. [Billing management](BILLING-PORTAL.md) is available through a
configured Stripe portal login link in Settings, Pricing and the extension.
Actual cancellation and plan-change operations depend on the seller’s Stripe
portal settings; no real seller portal has been activated by this change.
The pricing page does not sell a second subscription to an active account.

The managed HTTP synchronization server now defaults to paid writes in production,
while preserving backup retrieval after expiry; see [COMMERCIAL-ACCESS.md](COMMERCIAL-ACCESS.md).
The internal free state and remaining local, catalog, translation and personal
Firebase paths still need their commercial policy before release. The offer page
is not a complete commercial access gate. Live provider configuration, deployed backup recovery, operating
costs, legal/operator information and Store publication remain separate work.
No payment, new service subscription or deployment was performed for this change.
