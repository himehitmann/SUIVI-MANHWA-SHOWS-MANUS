# Dasi — Monetization & Pricing Analysis

_Prepared as the product's finance/pricing owner. Figures are planning estimates in USD; validate against live vendor quotes before launch._

## 1. Objective

Dasi must be able to fund an **optional** cloud-sync backend and still return a
profit, without ever making the core product depend on that backend. The free
tier must remain fully usable offline (local-first). Paid tiers exist only to
fund and unlock cross-device sync and convenience features.

## 2. Competitor & comparable pricing survey

| Product | Category | Free tier | Paid | Model |
|---|---|---|---|---|
| **Trakt** | TV/movie tracker | Yes | VIP **$2.50/mo** or **$30/yr** | Subscription |
| **Simkl** | Anime/TV/movie tracker | Yes | Pro ~**$3/mo**, ~**$25/yr** | Subscription |
| **MyAnimeList** | Anime/manga | Yes | Supporter **$2.99/mo** | Subscription |
| **AniList / Kamilist** | Anime/manga | Yes (ad-free asks) | Donation | Free + donation |
| **Serializd** | TV tracker | Yes | Pro ~**$4/mo** | Subscription |
| **Showly** | TV tracker (app) | Yes | One-time unlock | Lifetime |
| **Simple Manga Tracker** | Manga (extension) | Yes | Pro (calendar/ranking) | Freemium |
| **MochiTranslate** | Manga tool (extension) | — | **$19 lifetime** | Lifetime |
| **MangaUpdates / Bato** | Manga catalog | Yes | — | Free/ads |

**Takeaways**

- The tracker market anchors subscriptions at **$2.5–$4/mo** and **$25–$30/yr**.
- Extensions sell well as **one-time lifetime** purchases (~$15–$50).
- Free tiers are table stakes; users resist paywalling basic tracking.

Dasi's differentiation (universal detection across manga **and** streaming, one
click save, local-first privacy) supports pricing at the **lower-middle** of the
band to win installs, with a lifetime option that fits extension buyer habits.

## 3. Cost model (per paying user, sync backend)

Sync stores small JSON records (library items, lists, sites). No media is
stored. A managed Postgres + auth backend (e.g. Supabase, Cloudflare D1 +
Workers, or Neon + a thin Worker API) covers this cheaply.

| Cost item | Estimate / paying user / month |
|---|---|
| Database + row storage (tiny JSON) | $0.02–$0.06 |
| Auth (managed) | $0.00–$0.03 |
| API compute (edge functions, low RPS) | $0.02–$0.05 |
| Egress (small syncs) | ~$0.01 |
| **Infra subtotal** | **≈ $0.05–$0.15** |
| Payment processing (Paddle/Stripe, ~5–8% + $0.30–$0.50) | ~$0.45–$0.70 on a $2.99 charge |

**Fixed / one-time:** Chrome Web Store developer registration **$5 one-time**.
Firefox AMO is free. Optional custom domain ~$12/yr.

Even at a pessimistic **$0.15/user/mo** of infra, one Pro subscriber at
**$2.99/mo** leaves roughly **$2.10–$2.40 net** after processing fees — a healthy
margin, and infra cost per user falls as volume rises.

## 4. Recommended tiers

| Tier | Price | What it funds / unlocks |
|---|---|---|
| **Free** | $0 | Full local tracking, universal detection, custom lists, drag-and-drop, video speed & PiP, JSON export/import. No account required. |
| **Pro** | **$2.99/mo** or **$24.99/yr** (2 months free) | Encrypted cross-device sync, automatic update checks & alerts, reading calendar & statistics, priority support. |
| **Lifetime** | **$49 one-time** | Everything in Pro, forever, all future updates, no subscription to manage, founder badge. |

Rationale:
- **$24.99/yr** sits just under Trakt/Simkl, signalling value while covering costs.
- **$49 lifetime** matches the extension-buyer mental model (compare MochiTranslate $19, Showly-style unlocks) and front-loads cash to fund the backend. Break-even vs. yearly is ~2 years, which is fair to both sides.
- Monthly exists for trialists but is deliberately not the cheapest annualized path, nudging yearly/lifetime.

## 5. Break-even illustration

Assume infra + fixed overhead of ~**$40/mo** at small scale (managed DB minimum, domain amortized, misc).

- Break-even ≈ **19 Pro yearly subscribers** ($24.99/yr ≈ $2.08/mo net ~$1.7 after fees) **or ~25 monthly Pro** users, **or ~1 lifetime sale per ~$47 net** covering >1 month of overhead.
- At **200 paying users** (blended ~$2/mo net): ≈ **$400/mo** revenue vs. ≈ $70/mo infra → **~$330/mo profit**, scaling roughly linearly.

## 6. Guardrails (non-negotiable)

1. **Sync is optional and non-critical.** If the backend is down, removed, or the
   user never signs in, Dasi still tracks and reads locally. Payments unlock a
   convenience, never the core.
2. **No lock-in.** Free JSON export/import means users can always leave with their data.
3. **Privacy priced in.** We store the minimum (small JSON, encrypted), never browsing history or media.
4. **Admin account** (owner) has full access for support/moderation; this is an internal role, not a paid tier.

## 7. Open decisions for the owner

- **Processor:** Paddle (merchant-of-record, handles global VAT/tax) vs. Stripe
  (lower fee, but you handle tax). Recommendation: **Paddle** for a solo seller to
  avoid tax overhead, accepting the slightly higher fee already budgeted above.
- **Sync backend:** Supabase (fastest to ship) vs. Cloudflare Workers + D1
  (cheapest at scale). Recommendation: **start on Supabase**, keep the sync API
  behind an interface so it can be swapped without touching the extension.

---

## Competitor survey & positioning (2026 refresh — planning estimates, verify before launch)

| Product | Type | Free | Paid | Model | Gap Dasi exploits |
| --- | --- | --- | --- | --- | --- |
| **Simkl** | Anime/TV/film tracker | Yes | ~$3/mo, ~$25/yr (VIP) | Sub | Manual tracking; no in-page one-click save, no language learning |
| **MyAnimeList** | Anime/manga | Yes | $2.99/mo supporter | Sub | Catalog-first, heavy manual entry |
| **Trakt** | TV/film | Yes | ~$30/yr VIP | Sub | Needs player integrations; nothing for manga/webtoon |
| **Kamilist / Serializd / Anime-Planet / Kurozora / Kuroiru / Taiga / Seanime** | Trackers/clients | Yes | Free/donation/one-time | Mixed | List managers, not "save my exact spot on any site" |
| **Showly** | TV (app) | Yes | One-time unlock | Lifetime | Mobile app, not a browser saver |
| **Simple Manga Tracker** | Manga (extension) | Yes | Pro (calendar/ranking/alt-source) | Freemium | Right-click manual save; no auto video timecode, no learning |
| **MochiTranslate** | Manga tool (extension) | — | **$19 lifetime** | Lifetime | Proves extension buyers pay one-time ~$15–20 |

**Positioning.** Dasi is the only *generic-first, one-click, cross-media* saver that also (a) captures the exact video timecode across sites, and (b) bundles a KR/JP/ZH learning module tied to what you read. That learning module is the premium wedge no tracker competitor has.

### What is free vs paid (final)

- **Free (acquisition engine):** unlimited local library, universal detection, one-click save, manual add + online title search, imports (MAL/CSV/JSON/backup), custom lists + drag-drop, video speed + PiP, export/import, Korean **basics + numbers**. Everything that makes the core promise work must be free so reviews and word-of-mouth compound.
- **Pro — $2.99/mo or $24.99/yr:** encrypted cross-device sync, new chapter/episode alerts, full KR/JP/ZH course + spaced repetition + quizzes + stats, reading calendar, unlimited devices, priority support. These are recurring-value features (server + ongoing content) → fair to gate behind a sub.
- **Lifetime — $49:** everything in Pro forever + founder badge. Front-loads cash to fund the backend; matches extension-buyer habits (cf. MochiTranslate $19, Showly-style unlocks). Positioned above the ~$19 tools because Dasi does more (sync + full learning).

### Unit economics (per paying user, conservative)

- Infra/user/mo: sync is tiny JSON blobs — realistically **$0.05–$0.15/user/mo** on managed Postgres + a small node host at scale.
- Processing: Stripe ~2.9% + $0.30 (or Paddle MoR ~5% + $0.50 incl. tax handling).
- **Pro monthly $2.99** → after ~$0.39 fees ≈ **$2.60 gross**, minus ~$0.10 infra ≈ **~$2.50 net**.
- **Pro yearly $24.99** → after ~$1.02 fees ≈ **$23.97**, ≈ **$2.00/mo** net after infra — the value anchor.
- **Lifetime $49** → ≈ **$47 net** once; at $0.10/mo infra it self-funds ~39 years of that user's sync.
- **Break-even:** ~**25 monthly** or ~**19 yearly** Pro subscribers, **or ~1 lifetime per ~$47 of monthly overhead**. At 200 blended payers (~$2/mo net) ≈ **$400/mo** vs ~$70/mo infra → **~$330/mo profit**, scaling roughly linearly.

> Recommendation: lead with **yearly** (badge "2 months free") and **Lifetime** to front-load cash and minimise churn/processing drag; keep monthly as a low-friction trial path.
