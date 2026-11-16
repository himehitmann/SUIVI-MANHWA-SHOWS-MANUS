# Billing management entry point

Prepared 2026-11-16, extension 0.4.31. This change does not open sales or configure a real Stripe account.

## Behavior
Signed-in users can open the Stripe billing portal from website Settings, Pricing, extension Settings and the library account panel. Access does not depend on an active paid plan: expired subscribers and administrators retain access. A portal link does not grant a paid plan. Server-verified billing events still determine access.

Stripe authenticates the payer using the email used for payment. It may differ from the current Yomu account email. We do not append an email, a customer ID, a Yomu session or a return URL. Only the generic HTTPS login link on billing.stripe.com/p/login/ is accepted. Private customer-session URLs, query parameters, credentials, alternative hosts, encoded paths and fragments are rejected on server and clients.

The authenticated endpoint GET /api/billing/portal returns only the validated login URL. It is non-cacheable and limited to 30 requests per minute per account. The link itself is intentionally shareable; authorization of billing operations belongs to Stripe. Request arguments cannot select another customer or destination.

Missing/invalid configuration returns billing_portal_unavailable. Firebase personal backup does not support billing. The UI says management is unavailable instead of displaying a nonfunctional billing link. Transient errors offer retry; late results from a prior account/render are discarded.

Deleting a Yomu account does **not** cancel an external subscription. Account deletion controls and the web billing section explain this. Users should manage an active subscription before deleting their account.

## Activation before paid publication
1. Activate the no-code portal login link in the correct Stripe account and mode.
2. Configure the allowed operations (invoices, payment method updates, subscription cancellation) in Stripe. The link alone does not enable every operation.
3. Set the server environment variable STRIPE_PORTAL_LOGIN_URL to that exact generic login URL, without query parameters. Never use a customer session link. Restart the deployed service.
4. Verify the complete test-mode cycle: purchase, invoice, email login, cancellation, webhook delivery and subsequent access rights. Repeat the production checks with the actual product configuration before publishing.
5. Verify that the live seller account, support contact and advertised cancellation conditions match the portal. Stripe chooses the most recently created customer with an active subscription if multiple customers share the email; avoid duplicate customer records.

The no-code portal does not allow customers to change their email and does not support some Connect configurations. This implementation does not provide Paddle billing management. Do not advertise provider-independent cancellation until an equivalent Paddle flow is implemented.

## Evidence scope
Unit and HTTP tests exercise URL restrictions, authentication, expired/free/owner access, rate limits, account changes and failures. Browser tests cover Settings and Pricing, French mobile layout, retry and unavailable states. Extension worker tests use simulated backend replies. The shared extension DOM renderer is exercised in Chromium without contacting Stripe.

These tests do not prove that the deployed seller portal permits cancellation or that a real payment lifecycle succeeds. Those checks remain pending. Global release readiness stays 21/60 (35%).

## Primary reference
[Stripe: activate the no-code customer portal](https://docs.stripe.com/customer-management/activate-no-code-customer-portal).
