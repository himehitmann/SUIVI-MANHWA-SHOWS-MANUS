# Managed web checkout — 17 November 2026

Implementation prepared on fix/yomu-p0-reliability. This does not activate sales, provision infrastructure, charge a card or publish the extension. G20 remains partial; global accepted progress stays 21/60 (35%).

## Purchase path
The web pricing page gets offer identifiers from GET /api/billing/offers and sends only month/year to authenticated POST /api/billing/checkout. The server checks current effective account rights. Owners, administrators, gifts, Pro and lifetime accounts do not need another purchase.

Production checkout is available only with PostgreSQL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, valid STRIPE_PRICE_PRO_MONTH and/or STRIPE_PRICE_PRO_YEAR, and a canonical root YOMU_PUBLIC_URL. Missing configuration leaves sales closed. No secret or price ID is supplied by the browser. Before reserving a new attempt, Stripe's active recurring USD price must match the displayed $3.49/month or $29.99/year with interval_count=1. Adaptive Pricing is disabled so that checkout does not silently change the advertised currency. Tax configuration and the real merchant checkout still require verification before launch.

The server creates hosted Checkout Sessions with an immutable account reference in both session and subscription metadata, plus configured return URLs. Return-page query parameters never activate access. Signed billing events and authenticated current account rights remain authoritative.

## Persistent concurrency and recovery
checkout_attempts has one row per account, with a unique UUID, selected offer, immutable creation body, credential fingerprint and eventually Stripe session ID. Atomic reserve and conditional attach/delete prevent two application workers from replacing one another's attempt. Provider calls occur outside database transactions.

Concurrent devices reuse the same idempotency key/body. If creation succeeds but its response or database attachment fails, retries reuse that request. An unknown creation older than 23 hours is blocked for manual review: Stripe can prune idempotency keys after 24 hours. A key change also blocks an existing attempt rather than silently reusing it against another Stripe account. Do not manually clear unknown attempts until checking the provider.

An open session is reused only for its original offer. An expired session frees the slot and asks for an explicit retry. A complete session with an active, trialing, incomplete, past-due, paused or unpaid subscription blocks another purchase, including while the billing webhook is delayed. Only confirmed terminal canceled/incomplete_expired subscriptions allow a subsequent new attempt.

Returning to the offers after abandoning payment calls POST /api/billing/checkout/expire. It expires an unpaid Stripe session before removing the server attempt and tab marker. A completed session cannot be canceled by this action. Billing management is the separate route for existing subscriptions.

## Data and scope
This table does not modify saved works, progression, lists or profiles. Its payload contains the immutable customer email required for request replay; restrict database access and include the table in backup/restore. Account deletion cascades the row. Existing account-deletion/billing handling must still be verified with a real merchant configuration before launch.

The guarantee is per Yomu account using this managed purchase path. It does not prevent purchases made under separate Yomu accounts, direct legacy Payment Links, external/manual Stripe subscriptions, or an administrator granting a gift concurrently with a payment already open at Stripe. Deactivate legacy Payment Links before enabling sales and reconcile any existing subscriptions. Old public VITE payment links no longer power this web page. The extension's existing closed-sales policy remains unchanged.

## Provider permissions and release checks
The server key needs price, Checkout Session and subscription reads, plus Checkout Session create/expire. Keep it server-side. Configure the signed webhook, exact prices, portal actions, public origin and persistent PostgreSQL storage together. Verify real Stripe test-mode purchase, webhook delay/replay, expiry, renewal, cancellation and refund before enabling live prices. No such merchant test or deployment is claimed here.

References: [Stripe session creation](https://docs.stripe.com/api/checkout/sessions/create), [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests).

## Verification
The added tests use synthetic provider responses; no Stripe requests or charges. They cover concurrency, lost creation responses, store failure, stale conditional writes, wrong amounts/currencies/intervals, malformed and foreign provider replies, unknown-attempt expiry, current account rights, request tampering and account changes. A separate CI probe uses real isolated PostgreSQL and two connection pools, including reconnects and preserved saved progress. Chromium checks the web purchase entry, navigation guard and explicit expiry failure/success.
CI results are recorded in GLOBAL-PROGRESS.md after execution.
