# Optional sync + auth backend

Dasi works fully offline without this. Deploy it only to offer accounts and
cross-device sync (and, later, subscriptions). The apps default to local when
`VITE_SYNC_API_URL` is unset, so the backend is never a single point of failure.

## What it is

An Express API under `server/` (mounted at `/api`) with, by design, **no extra
dependencies** — passwords use Node `scrypt`, sessions are HMAC-signed tokens,
and storage is behind a `Store` interface.

Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/me`,
`GET /api/license`, `GET /api/sync`, `PUT /api/sync`.

## Run it

```bash
export SYNC_JWT_SECRET="$(openssl rand -hex 32)"
export SYNC_DB_FILE=./.data/dasi-sync.json   # dev/self-host; use Postgres in prod
pnpm build && pnpm start                     # serves the web app + /api
# or, API only during dev:
npx tsx server/index.ts
```

Point the web app at it by setting `VITE_SYNC_API_URL=https://your-host` before
`pnpm build`. Then Settings → Account shows a real sign-in/up form, and
**Sync now** pushes/pulls the library.

## Production storage: Postgres

A ready-to-use Postgres adapter ships in `server/lib/store-postgres.ts`. It
implements the same `Store` interface, so nothing else in the API changes.

1. Install the driver in your deploy (kept optional so the core stays
   dependency-free): `pnpm add pg`.
2. Set `DATABASE_URL` (and optionally `DATABASE_SSL=false` for a local/no-TLS
   database). When `DATABASE_URL` is present, `server/index.ts` builds a pool,
   runs `ensureSchema()` (creates `users` and `sync` tables if absent), and uses
   Postgres automatically; otherwise it falls back to the file store.

```bash
export DATABASE_URL="postgres://user:pass@host:5432/dasi"
export SYNC_JWT_SECRET="$(openssl rand -hex 32)"
pnpm add pg && pnpm build && pnpm start
```

The adapter takes any node-postgres-style client (`{ query(text, params) }`), so
you can inject a `pg.Pool`, a pooled/serverless client, or a D1-style shim by
calling `createApiRouter(createPostgresStore(client))` yourself.

## Subscriptions: Stripe / Paddle webhooks

Payments are made "real" by a provider webhook that writes `user.plan`;
`GET /api/license` then reports it. The webhook handlers live in `server/api.ts`
and the pure logic (signature verification, event→plan mapping, applying it) in
`server/lib/billing.ts` — all unit-tested and verified end-to-end.

Endpoints (each is inert — HTTP 503 — until its signing secret is set):

- `POST /api/webhooks/stripe` — verifies the `Stripe-Signature` header.
- `POST /api/webhooks/paddle` — verifies the `Paddle-Signature` header.

Environment:

```bash
# Stripe
export STRIPE_WEBHOOK_SECRET="whsec_…"
export STRIPE_PRICE_PRO_MONTH="price_…"   # $2.99/mo
export STRIPE_PRICE_PRO_YEAR="price_…"    # $24.99/yr
export STRIPE_PRICE_LIFETIME="price_…"    # $49 one-time
# Paddle (Billing)
export PADDLE_WEBHOOK_SECRET="pdl_ntfset_…"
export PADDLE_PRICE_PRO_MONTH="pri_…"
export PADDLE_PRICE_PRO_YEAR="pri_…"
export PADDLE_PRICE_LIFETIME="pri_…"
```

Linking the payment to the Dasi account (choose one, per event):

- **Stripe:** set the checkout's `client_reference_id` (or subscription
  `metadata.userId`) to the Dasi user id; `customer_email` is used as a fallback.
- **Paddle:** pass `custom_data.userId`; customer email is a fallback.

Behaviour: active subscription → `pro` (or the price's plan), one-time payment →
`lifetime`, cancellation/expiry → `free`. **Lifetime is permanent** — a later
subscription/cancel event never downgrades it.

> The **checkout link itself** (Stripe Checkout / Paddle overlay) is created in
> the client Pricing page with your publishable keys — that part needs your
> provider account and is the only piece not wired here; the webhook above is
> what actually grants the plan.

## Other production notes

- **Secret:** set a strong `SYNC_JWT_SECRET`. Tokens are invalid if it changes.
- **Merge:** item-level last-write-wins by `updatedAt` (`server/lib/merge.ts`),
  covered by unit tests.
