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

## Production notes

- **Storage:** implement the `Store` interface (`server/lib/store.ts`) over
  Postgres/D1 and pass it to `createApiRouter(store)`. Nothing else changes. The
  bundled file/in-memory store is for development and self-hosting only.
- **Secret:** set a strong `SYNC_JWT_SECRET`. Tokens are invalid if it changes.
- **Subscriptions:** wire your payment provider's webhook (Paddle/Stripe) to set
  `user.plan`; `GET /api/license` then reports it. Subscriptions live here, keyed
  to the account, so they are independent of extension version and device.
- **Merge:** item-level last-write-wins by `updatedAt` (`server/lib/merge.ts`),
  covered by unit tests.
