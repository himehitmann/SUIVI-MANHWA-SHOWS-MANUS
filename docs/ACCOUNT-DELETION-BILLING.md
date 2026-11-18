# Account deletion and managed billing

This change is a release prerequisite, not publication or a live payment operation. The user will publish only after the necessary release checks are complete.

The API verifies the password before any provider lookup and protects the configured owner account. A raw Pro subscription blocks deletion; gifts and administrative access are not automatically mistaken for a subscription. With managed checkout, a read-only provider check must find no attempt, an expired session or a completed session with a terminal canceled/incomplete_expired subscription. Active, trialing, incomplete, past-due, paused or unpaid subscriptions, open sessions, unknown creation outcomes, key mismatch, foreign metadata and provider outages retain the account. A deletion check never creates a checkout, expires it or cancels a subscription.

Settings explain the refusal in French and English with links to billing or the payment-attempt check. A provider refusal keeps the session and library. An uncertain database deletion outcome is reported as unconfirmed rather than claiming that data definitely remains. Late password/email/logout/delete responses cannot clear or overwrite a different account signed in meanwhile.

## Checkout/delete coordination
Production PostgreSQL routes for checkout creation, unpaid expiry and account deletion run under the same per-account advisory session lock on one dedicated connection. All reads and writes inside use that connection; even a pool of one connection can run them without nested acquisition. The account and rights are reread after acquiring the lock, so a request authorized before deletion cannot create a checkout afterward.

There is deliberately no wrapping transaction: each reservation is committed before Stripe creation. A provider timeout cannot roll back the persistent idempotency evidence. Locks are explicitly released; an errored connection is discarded. Use a direct PostgreSQL connection or a session-preserving pool, not transaction-mode PgBouncer. All application workers must use this coordinated version before enabling sales.

See [PostgreSQL advisory-lock documentation](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

## Scope and remaining release work
The coordinated guarantee covers the managed Stripe purchase route. Legacy/direct external purchases and Paddle records are not reconciled by this read-only managed-checkout check. Deactivate legacy purchase links and reconcile existing subscriptions before launch. A paid cancellation scheduled for the future is still active until it actually ends; deletion remains blocked meanwhile. An operator support/recovery process is needed for unmatched billing evidence and data-erasure requests. No legal compliance certification is claimed.

The actual merchant, hosting, account recovery, cancellation/refund lifecycle and publication remain unconfigured or unverified. The sales switch remains closed by default. Global readiness stays 21/60 (35%).

## Tests
Unit and HTTP tests cover subscription statuses, expired/open/unknown sessions, provider failure, password validation, retained account data and changed-account response isolation. The isolated PostgreSQL probe races two HTTP workers with one database connection each in both orders, checks that reservations are committed while the provider response is pending, and proves that provider failure does not erase them. Chromium checks billing-specific deletion guidance and retention of the current account. Verified code: 1e49a2b36550a0808db6058e15fe3e4d3f055d7b. [Push run](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/44247068834) and [PR run](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/44247076350) passed 1,085 tests (32 new), browser journeys, packaging, concurrency and isolated recovery. The overall verify jobs remain failed because the mandatory dependency audit reports GHSA-fc5q-39xc-vjpf in picomatch 4.0.7. No audit exemption or fictitious dependency upgrade was applied. See PUBLICATION-GATES.md; this is not release approval.

## Atomic final authentication check — 18 November 2026
Code 5b930222080d1b6617eebf745228bd836c096b1e adds a transaction immediately before deletion, after the provider check. It locks the user and session, compares the password hash actually verified by the request, checks session expiry/revocation and refuses a recurring Pro plan activated meanwhile. The shared checkout connection is passed as a query-only facade so the transaction does not reconnect an already connected PostgreSQL client. The existing session advisory lock still spans the provider check; checkout reservations remain committed before any provider request.

The real PostgreSQL deletion probe now pauses the provider read, rotates the password from another HTTP worker and confirms deletion returns 401 with the library retained. A late subscription activation likewise prevents deletion. See [ACCOUNT-CREDENTIAL-SAFETY.md](ACCOUNT-CREDENTIAL-SAFETY.md) for the complete evidence and the still-blocking dependency audit.
