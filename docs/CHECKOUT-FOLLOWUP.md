# Checkout follow-up

Prepared 2026-11-17. Website change; extension remains 0.4.31.

The /billing/return route checks the signed-in account using authenticated GET /api/me. It never treats a query string, a redirect, a browser marker or a cached plan as proof of payment. Its success message confirms current Pro access only: that access may also come from an administrator role, a gift or a prior purchase. This page is not a receipt.

The page checks at most four times per visit/manual attempt, with delays of 0, 2, 4 and 8 seconds between reads. Requests retain the provider's timeout, redirect restrictions, response validation and account-change checks. The next automatic check waits while the document is hidden. Leaving the page removes scheduled checks and ignores late results.

An inactive account gets an honest waiting message, with advice not to pay again. A network failure is distinguished from a rejected payment. Users can retry or open account/billing settings. Anonymous users are directed to sign in to the account used for purchase. A returned Pro state updates the local display only; server-side entitlement rules remain authoritative.

Before requesting a managed Checkout Session, Pricing stores an account/service-scoped sessionStorage marker. A pending marker blocks another purchase from that page in the same tab and provides a link to verify access. Returning focus/visibility to Pricing rechecks current rights. If the guard cannot be retained, checkout navigation fails. The guard has no automatic expiration: elapsed time is not proof that a charge failed.

When access becomes active the guard is removed. A user who did not complete payment can return to offers after an explicit acknowledgement. The server first expires an unpaid managed Stripe session and clears its persistent attempt. A completed session cannot be canceled this way; failure retains the browser guard. It does not cancel a completed payment or subscription.

## Configure before sales
Set the canonical deployed `YOMU_PUBLIC_URL` on the server. Managed Checkout sets both success and cancellation returns to that origin followed by /billing/return. No account ID, email, secret or session ID is required in this return URL. Yomu checks the authenticated account; webhook delivery still controls access.

Verify the deployed flow with Stripe test mode, including delayed notification, failed network, cancellation and the same account in extension and website. Keep sales closed until actual configuration, amounts and entitlement delivery are validated.

## Limits
The browser marker remains a same-tab UX safeguard. [Managed Checkout](MANAGED-CHECKOUT.md) now adds persistent per-account protection across devices: its database reservation and provider idempotency survive browser storage loss. Legacy direct Payment Links and purchases from separate Yomu accounts remain outside that protection; deactivate those links before enabling sales. An unconfigured backend cannot create managed payments.

Tests use a real local Yomu server and mocked account responses for delayed activation and failures; no real charge is performed. Existing account, backup, package and recovery checks continue to run. Global readiness remains 21/60 (35%); this does not complete G20.

Primary reference: [Stripe Payment Link confirmation behavior](https://docs.stripe.com/payment-links/post-payment).
