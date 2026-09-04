# Yomu — Go-live guide: payments + Chrome Web Store

Everything below is **operational** (no code changes needed — the code is
already wired). Follow it in order. Budget ~2–3 hours the first time.

Currency note: prices shown are USD as configured in the app
(Pro **$3.99/mo**, **$29.99/yr**, Lifetime **$59**). Stripe settles to your bank
in your local currency.

---

## 0. What you'll end up with
- A tiny always-on **backend** (accounts + encrypted sync + Stripe webhook).
- **Stripe** products + **Payment Links** for the three plans.
- The **web build** and the **extension** pointed at your backend.
- The extension **published** on the Chrome Web Store, monetized.

Data flow when someone pays:
1. User clicks a plan in Yomu → opens your **Stripe Payment Link** (we attach
   their account id as `client_reference_id`).
2. Stripe processes the card, then calls your **webhook**
   (`POST /api/webhooks/stripe`).
3. `server/lib/billing.ts` maps the event → plan and stores it on the user.
4. The app reads `/license` → unlocks Pro. Done, hands-off.

---

## 1. Create the Stripe products (15 min)
1. Create a Stripe account → **switch to Live mode** later; do all of this in
   **Test mode** first (toggle top-right).
2. **Products → Add product**, create three prices:
   - **Yomu Pro — Monthly**: recurring, **$3.99/month**.
   - **Yomu Pro — Yearly**: recurring, **$29.99/year**.
   - **Yomu Lifetime**: **one-time**, **$59**.
3. Copy each **Price ID** (looks like `price_1AbC…`). You'll need them twice
   (server env + Payment Links).
4. **Payment Links** (Products → Payment links → New): make one link per price.
   - For each link, under **After payment**, enable **"Don't show confirmation
     page"** or redirect back to your site — optional.
   - Under **Options → "Save these fields"**, nothing special is required; Yomu
     appends `client_reference_id` and `prefilled_email` to the URL itself.
   - Copy the three link URLs (look like `https://buy.stripe.com/xxx`).

## 2. Get the webhook signing secret (5 min)
1. **Developers → Webhooks → Add endpoint.**
2. Endpoint URL: `https://YOUR_BACKEND/api/webhooks/stripe` (fill in after §3;
   you can add it now with a placeholder and edit later).
3. Events to send: at minimum
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_…`).

## 3. Deploy the backend (30–45 min)
The server is `server/index.ts` (Express). It needs Postgres. Easiest hosts:
**Render**, **Railway**, or **Fly.io** (all have a free/cheap tier + managed
Postgres). Example with **Render**:

1. Push this repo (the **public** `main` branch is fine — it contains the server
   code; only business docs are stripped).
2. Render → **New → Web Service** → connect the repo.
   - **Build command:** `pnpm install && pnpm build`
   - **Start command:** `node dist/index.js`
3. Render → **New → Postgres** → create a DB → copy its **Internal Database
   URL**.
4. Set the web service **Environment variables**:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Postgres URL from step 3 |
   | `SYNC_JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
   | `STRIPE_WEBHOOK_SECRET` | the `whsec_…` from §2 |
   | `STRIPE_PRICE_PRO_MONTH` | the monthly Price ID |
   | `STRIPE_PRICE_PRO_YEAR` | the yearly Price ID |
   | `STRIPE_PRICE_LIFETIME` | the lifetime Price ID |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` (Render sets this automatically; leave as is) |

   > `DATABASE_SSL=false` only if your host's Postgres doesn't use SSL. On
   > Render/Railway leave it unset (SSL on).

5. Deploy. Note the public URL, e.g. `https://yomu-api.onrender.com`.
6. Go back to the Stripe webhook (§2) and set the endpoint URL to
   `https://yomu-api.onrender.com/api/webhooks/stripe`.

Quick check: `curl https://yomu-api.onrender.com/api/license` should return
`401 unauthorized` (that means the API is up).

## 4. Point the web build + extension at the backend (15 min)
The **Pricing** page opens the Stripe link; the extension **syncs** to the API.

Web app build (set these before `pnpm build`, e.g. in Render/host env for the
web deploy, or a local `.env`):

| Key | Value |
|---|---|
| `VITE_SYNC_API_URL` | `https://yomu-api.onrender.com/api` |
| `VITE_CHECKOUT_PRO_MONTH` | the monthly Payment Link URL |
| `VITE_CHECKOUT_PRO_YEAR` | the yearly Payment Link URL |
| `VITE_CHECKOUT_LIFETIME` | the lifetime Payment Link URL |

Extension: users set the sync URL themselves in **Options → Cloud sync**
(sign-up/in), or you can bake a default. To bake a default, set the API base in
the extension Options once and it's stored per-device; there's nothing secret to
ship. (Sync/pay is optional for users — the tracker works fully offline.)

## 5. Test the whole flow in Stripe **Test mode** (15 min)
1. In the web app Pricing page, click **Go Pro** → you land on the Stripe link.
2. Pay with the Stripe test card **`4242 4242 4242 4242`**, any future date, any
   CVC/zip.
3. Stripe fires the webhook → your server sets the plan.
4. Reload Yomu → the plan shows as **Pro/Lifetime**, Pro features unlock
   (sync, unlimited translation, alerts).
   - Verify server-side: `GET /api/license` with the user's token returns
     `{ "plan": "pro" }`.
5. When it all works, **switch Stripe to Live mode**, recreate the 3 prices +
   links + webhook **in Live**, and update the env values to the live ones.

## 6. Publish on the Chrome Web Store (30–60 min + review wait)
1. Pay the **one-time $5** Chrome Web Store developer fee.
2. Build the store package from the **public** build:
   `git checkout main && bash scripts/pack-extension.sh` → `yomu-extension.zip`.
   (The public build has the paywall ON — `edition.js` = `public`.)
3. Web Store **Developer Dashboard → New item → upload the zip.**
4. Listing:
   - **Name:** Yomu — Continue Reading & Watching.
   - **Short + full description:** lead with the problem ("never lose your spot
     in any manga, webtoon, anime, series or game") and the paid perks.
   - **Screenshots** (1280×800): the Home, a saved library with covers, the
     popup saving, the translate pill on a page, the Plans page.
   - **Category:** Productivity.
5. **Privacy tab** (required):
   - Single purpose: "Save and resume your reading/watching progress across
     sites, and optionally translate pages."
   - Permission justifications:
     - `activeTab` + `scripting`: detect the title/chapter on the page **only
       when you click** Yomu.
     - `storage`: save your library locally.
     - `tabs`: open your library / resume links.
     - `notifications`, `alarms`: new-episode / release alerts.
     - Host `translate.googleapis.com`, `graphql.anilist.co`,
       `store.steampowered.com`, `openlibrary.org`, `api.tvmaze.com`,
       `api.cotrans.touhou.ai`: title search + page/panel translation.
     - **Optional** `<all_urls>`: requested **only** when you press Translate,
       to fetch the manga panels for OCR translation. Not used otherwise.
   - Data usage: "We don't sell data. Library is local; optional account sync is
     end-to-end and used only to sync your own devices."
6. Submit for review. First review is typically **a few days**. The `<all_urls>`
   optional permission is fine because it's optional + justified.

---

## 7. Money math (see docs/PRICING.md §9 for the full model)
Net per sale after ~3%+$0.30 fees ≈ €3.05/mo, €25.8/yr, €51 lifetime.
**To reach €20,000:** a realistic blend ≈ **580 paying customers**
(150 lifetime + 300 yearly + 130 monthly held a year). At a **3% blended
conversion**, that's ~**35–45k installs** — reachable by ranking for
"manga tracker / continue reading / webtoon translate" and keeping the free tier
delightful so it spreads.

## 8. Ongoing
- Watch Stripe **Dashboard → Payments** and **Webhooks → recent deliveries**
  (retry any that failed).
- Bump the extension **version** in `manifest.json` for each store update, then
  re-upload the zip.
- Keep `private` as your working branch; `bash scripts/publish-public.sh`
  regenerates `main` (paywall on) for the store.
