# Restore accounts and checkout safely

This is an operator runbook for a future deployed service. No production database, Stripe account, charges or infrastructure were changed by the implementation. Global acceptance remains 21/60 (35%).

## Close new sales independently
Set YOMU_CHECKOUT_ENABLED=false on every API worker and restart/redeploy all workers before a restore or billing investigation. Only the exact value true enables the managed purchase path; absent or misspelled values close it. Other Stripe configuration can remain in place for authenticated expiry, billing verification and signed webhook processing.

GET /api/billing/offers must return an empty list. Authenticated POST /api/billing/checkout must return 503 checkout_closed without reserving an attempt or contacting Stripe. The website closes the offers if a purchase is refused for this reason, including a tab that previously displayed enabled offers. This switch does not cancel subscriptions, expire all already-open Stripe sessions or prevent external/legacy Payment Link purchases. Deactivate those separate purchase paths as needed.

Account sign-in, existing backup retrieval and billing management are independent of the new-sales switch. Existing paid rights still govern writes. An authenticated user can expire their unpaid Checkout Session while new sales are closed; a completed session is not cancelable through that action.

## Restore and reconcile before reopening
1. Record the recovery point and stop application traffic while replacing/restoring data. The sale switch alone does not stop sync writes or webhook deliveries. Keep the source and archive until recovery is verified; restore to a separate database first.
2. Restore the entire database, including users, sessions, sync, access grants/audit, billing events/heads and checkout_attempts. The latter contains immutable request bodies, timestamps, credential fingerprints and Stripe session IDs. Treat archives as sensitive account data.
3. Resume in closed-sales mode. Confirm fresh login, another-account isolation, saved progress, lists, sites, profiles and deletion tombstones. Verify provider configuration and key identity; a different key blocks pending attempts for review.
4. Compare the restored state with all relevant provider activity since the backup, including payments that completed afterward, refunds, cancellations and subscription changes. Replay verified signed notifications or reconcile through an audited operator process. No payment is inferred merely from an email or success URL.
5. Keep unknown creation attempts older than 23 hours blocked. Do not delete their records to make a button work: Stripe may have pruned the original idempotency key. Review both the account and provider evidence before any manual repair. A repeated request must retain the original immutable body and key.
6. Verify a deployed provider test-mode lifecycle, recovery checks and account security before setting YOMU_CHECKOUT_ENABLED=true on every worker. This step is an explicit deployment decision; the application does not reopen sales automatically.

## Limits of a snapshot
A backup cannot contain changes that occurred after its recovery point. A checkout attempt or account created after the backup may be absent entirely. The per-account reservation cannot protect an absent record: keep sales closed until that gap is reconciled. Current provider lookup protects restored known sessions but cannot discover all missing transactions by itself.

Account/security changes after the backup also require review: restoring old roles, gifts, passwords or session rows must not silently reverse subsequent security decisions. Invalidate old sessions and recover affected accounts through the operator's verified process before exposing the restored service. A real deployment needs a recovery-point target and backups appropriate to it; no zero-data-loss guarantee is made.

## Automated drill
scripts/verify-recovery.mjs is restricted to CI, loopback PostgreSQL and randomly named isolated databases. It creates known, response-lost and old-unknown checkout attempts; performs real pg_dump/pg_restore; removes the synthetic source; and verifies the restored copy. Provider traffic is injected and simulated; external HTTP is forbidden.

It checks closed-sales requests, unchanged backup contents, a provider payment completing after the snapshot while the restored plan remains free, immutable replay within the safety window, refusal beyond that window, unpaid expiry during closure and refusal to expire completed payments. Existing library isolation, fresh-login recovery and empty-client merge checks remain in the same drill. This validates the fixture scenarios, not an unconfigured production deployment.
