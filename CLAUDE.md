# Dasi — project guide & handoff for the next session

Paste-ready context: this file tells a fresh chat exactly where the project
stands, how it's built, and what is left to do. A new session starts from a
clean clone of the branch, so **only committed work exists** — everything below
is committed on the working branch.

## Working branch

Develop on **`private`** (do NOT create new branches —
keep updating this one). Commit in English with a clear body and end every
commit with:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mv5LNa2FkJMnnavh7uxc6L
```

Push with `git push origin private`. Do not open a PR
unless asked. User writes in French; reply in French, code/docs in English.

### The two branches (there are ONLY two — keep them separated)

- **`private`** — the OWNER's build. Develop here. Everything unlocked, **no
  payment** (`EDITION="private"` → `UNLOCK_ALL`), and it keeps the internal-only
  files: this `CLAUDE.md` handoff, `docs/PRICING.md`, `ideas.md`, `todo.md`,
  `reference-notes.md`, `template.json`.
- **`main`** — the **PUBLIC / Chrome-Web-Store** build (repo default branch). A
  **generated mirror** of `private` with the paywall ON (`EDITION="public"` →
  normal free/Pro gating) and the internal files stripped. Never commit to it by
  hand.
- After every change: commit to `private`, push it, then run
  `bash scripts/publish-public.sh` — it regenerates `main` from `private`
  (strips internal files, flips EDITION to "public") and force-pushes it. Update
  `PRIVATE_PATHS` in that script if a new internal-only file is added.
- Only these two branches should exist. Both build (`pnpm install && pnpm
  build`); a fresh clone needs `pnpm install` first.

## What Dasi is

A **local-first, premium** browser extension + companion web app: a universal
"Continue reading / continue watching" tracker for manga, manhwa, webtoons,
anime, series, films, etc. — plus a built-in **language-learning** module
(KR/JP/ZH). Name is **Dasi** (keep it), pastel Korean-platform aesthetic
(Kakao/Crepe inspired), shine-animated wordmark, English by default with a
language switch next to the search bar. Independence is a core principle: the
core never depends on an external service; sync/accounts/payments are optional
and isolated behind interfaces.

## Commands

```bash
pnpm install
pnpm dev      # web app, http://localhost:3000
pnpm check    # tsc --noEmit (must pass)
pnpm test     # vitest run --config vitest.config.ts (99 tests, must pass)
pnpm build    # vite build + esbuild server
```

Real-browser checks use the **pre-installed** Chromium via the globally
installed Playwright (there is no local playwright dep):

```js
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] })
```

Load the MV3 extension unpacked from `extension/` (manifest is there, **not** at
repo root). On-demand injection needs the `activeTab` user gesture, so headless
direct injection is denied by design — test `content.js` by injecting it into a
page with a `window.chrome` shim (see prior QA in `docs/QA.md`).

## Repository map

```
client/src/
  i18n/strings.ts        EN source + full FR mirror. ALL UI text lives here — never inline.
  i18n/I18nContext.tsx   useI18n() -> { t, lang, setLang }; English default.
  store/StoreContext.tsx useStore(): persistent state (localStorage) + all actions.
  lib/types.ts           DasiState (items, lists, sites, notifications, plan, learn).
  lib/seed.ts            first-run demo data.
  lib/item.ts            createItem()/workId() (manual add + importers).
  lib/importers.ts       parse MAL XML / CSV / JSON / Dasi backup (auto-detect).
  lib/catalog.ts         optional AniList online title search (best-effort).
  lib/sync.ts            SyncProvider interface; local (default) + HTTP provider (VITE_SYNC_API_URL).
  lib/checkout.ts        hosted checkout-link builder (Stripe Payment Links via env), unit-tested.
  lib/vocab.ts           learning dataset (KR/JP/ZH, 8 categories) + level/XP/streak helpers.
  lib/srs.ts             SM-2 spaced-repetition scheduling (pure, unit-tested).
  lib/quiz.ts            quiz generation (MC + typing) + answer normalization (seeded RNG).
  lib/achievements.ts    daily-goal + achievements helpers (pure, unit-tested).
  lib/speak.ts           best-effort pronunciation via Web Speech (speechSynthesis).
  lib/stats.ts           learning-stats helpers: history, forecast, calendar, mastery (pure).
  lib/format.ts          markerLabel/relativeTime/timecode.
  components/            AppHeader, Notifications, LanguageSwitch, AddWork, ColorSwatches, Bits, DasiLogo.
  pages/                 Home, Collections, ListDetail, Pricing, Settings, Learn, LearnStats, NotFound.
extension/               MV3: content.js (generic-first detector + site adapters),
                         background.js (on-demand inject, merge, storage.local+sync mirror,
                         onInstalled migration, optional cloud-sync module mirroring lib/sync.ts),
                         options.html/js (cloud-sync settings), popup.*, library.html/js, manifest.json.
shared/detect.ts         pure detection heuristics (mirrored by content.js), unit-tested.
server/                  optional Express sync+auth+billing API (api.ts, lib/{crypto,store,
                         store-postgres,merge,billing}.ts). Postgres store + Stripe/Paddle webhooks.
tests/                   vitest: detect, backend, importers, vocab, srs, quiz, achievements,
                         stats, billing, store-postgres, checkout.
docs/                    ARCHITECTURE, PRICING, BACKEND, UPDATING, QA.
.github/workflows/extension-zip.yml  publishes dasi-extension.zip as the "dasi-latest" release.
```

Conventions: add a feature by (1) adding EN+FR strings, (2) a store action that
mutates persisted state (so it auto-syncs), (3) UI, (4) pure logic in `lib/*`
with a vitest in `tests/`. Keep everything typechecking and building.

### Codebase knowledge graph (graphify)

`graphify` (PyPI `graphifyy`, `uv tool install graphifyy`) builds a local
tree-sitter knowledge graph of the repo — useful for "what connects X to Y",
impact analysis, and finding architectural hubs. The Claude skill is installed
(`graphify install --platform claude`), so `/graphify .` works in-session.
Build/refresh the graph with `graphify update .`; then `graphify god-nodes`,
`graphify query "…"`, `graphify explain "Symbol"`, `graphify affected "Symbol"`.
Output lands in `graphify-out/` — **git-ignored** (large, and its report embeds
the internal-only docs), so it never reaches the public branch. Regenerate
locally whenever needed.

## Status — DONE (all committed, tested)

- English-first UI + real i18n (EN/FR), language switch by the search bar.
- Persistent local store; Home (queue, filters, search, favorites, delete),
  favorite quick-access **sites**, **notifications** (new chapter/episode) with pulses.
- **Collections**: custom lists, color picker, list detail page, **drag-and-drop** reorder.
- **Pricing** page (Free / Pro $2.99·mo or $24.99·yr / Lifetime $49); **Settings** page.
- **Detection**: generic-first pipeline + isolated site adapters (Netflix, WEBTOON,
  Naver, Kakao, AsuraScans, Bato, MangaDex, Mangago, Manganato, Mangakakalot,
  Aniwatch, MyAsianTV, KissAsian, KissKh, Viki, Voiranime, Crunchyroll, + shared
  drama adapter). URL-only adapters mirrored & unit-tested in `shared/detect.ts`.
  Confidence gating.
- Extension: on-demand injection (activeTab), merge policy, **storage.local + sync**
  mirror (cross-device recovery), standalone library page, `onInstalled` migration
  hook, packaged-zip release workflow, INSTALL.md.
- Extension **cloud sync** (optional): Options page signs into the same backend as
  the web app; `background.js` pulls → merges → pushes to `/sync` (auto-sync after
  saves). Work ids aligned to the web `workId()` (+ v2 re-key migration) so both
  surfaces converge on one library; web-only slices (lists/learn/plan) preserved.
  Verified E2E against the live API.
- **Export/Import** backups + "find again" for dead URLs.
- **Manual add** with optional online search; **import from other trackers**
  (MAL XML, CSV, JSON, Dasi backup).
- Optional **sync + auth backend** (Express, scrypt + HMAC tokens, swappable
  Store, item-level merge) + client HTTP provider + functional Settings sign-in.
  Verified live: signup→push→new-device login→recover.
- **Production backend building blocks**: Postgres `Store` adapter
  (`store-postgres.ts`, injected client + `ensureSchema`), env-based store
  selection in `index.ts` (DATABASE_URL → Postgres via optional `pg`), and
  **Stripe/Paddle webhooks** (`/api/webhooks/*`) with pure tested billing logic
  (`billing.ts`: signature verify, event→plan, apply; lifetime permanent).
  Verified E2E against the live API.
- **Learn module**: KR/JP/ZH vocab across **8 categories** (Basics, Numbers,
  Family, Food, Colors, Time, Verbs, Body), flashcards, word detail
  (definition/example/note), XP/levels/streak, Pro-gated categories/languages.
  Synced. Now also:
  - **SM-2 spaced repetition** — review pulls *due* cards, three grades
    (Again/Good/Easy) with next-interval previews; per-word `srs` state synced.
  - **Quizzes** — multiple-choice (meaning/reading) and typing, 10 questions,
    scored, perfect-run detection.
  - **Audio pronunciation** — tap-to-hear via `speechSynthesis` (best-effort,
    hidden when unsupported).
  - **Daily goal** (10/20/30/50) with progress + **achievements** (11 badges,
    sticky). Toasts on unlock.
  - **Stats/calendar page** (`/learn/stats`, `pages/LearnStats.tsx`): summary
    tiles, 14-day activity chart, 7-day review forecast, 13-week study-calendar
    heatmap, per-category mastery bars. Pure view over `learn.daily/srs/mastery`.
- 99 unit tests; multiple real-browser functional passes (Learn + Stats QA
  re-verified: quiz, SRS grades, audio, goal, achievements, charts, EN/FR);
  zero code page errors.

## Status — NOT DONE / next steps

1. **Deploy the backend + payments — CODE DONE, deploy pending (operational):**
   - Postgres `Store` adapter (`server/lib/store-postgres.ts`, injected client,
     `ensureSchema`) + env-based selection in `server/index.ts` (DATABASE_URL →
     Postgres via lazy `pg` import, else file store). `pg` stays optional.
   - Stripe/Paddle webhooks (`POST /api/webhooks/{stripe,paddle}`) with pure,
     tested billing logic (`server/lib/billing.ts`): signature verification,
     event→plan mapping, apply-to-store; lifetime is permanent. Verified E2E
     against the live API (signup→webhook→/license reflects pro/lifetime).
   - Client **checkout links WIRED** (`client/src/lib/checkout.ts`): the Pricing
     CTA redirects to a hosted payment link (Stripe Payment Links) from env
     (`VITE_CHECKOUT_PRO_MONTH/PRO_YEAR/LIFETIME`), tagging `client_reference_id`
     + `prefilled_email` so the webhook grants the plan; local toggle fallback
     when unset. Unit-tested.
   - STILL TODO (needs your accounts/credentials): actually deploy Postgres + set
     env (DATABASE_URL, SYNC_JWT_SECRET, STRIPE_*/PADDLE_* secrets + price ids),
     set `VITE_SYNC_API_URL` + the `VITE_CHECKOUT_*` payment-link URLs for the
     web build. All code is in place; see `docs/BACKEND.md`.
2. **Wire the extension to the backend — DONE:** `extension/options.html/js`
   (Options UI) signs into the same backend as the web app; `background.js` has a
   cloud-sync module (pull → merge → push against `/sync`, best-effort auto-sync
   after each save). Work ids were aligned to the web app's `workId()` (+ an
   onInstalled v2 re-key migration) so the same work merges across surfaces, and
   an extension push preserves web-only slices (lists/learn/plan). Verified E2E
   against the live API (signup → push → new-device pull → cross-surface merge).
   TODO (optional): surface sync errors/last-sync more richly; add token refresh.
3. **Expand the Learn module** (user wants beginner→expert, "everything sticks"):
   - DONE: audio pronunciation; quizzes (MC + typing); SM-2 spaced repetition;
     daily goal + achievements; +4 categories (Colors, Time, Verbs, Body).
   - TODO: still more words + categories (Travel, Grammar points, Weather,
     Places…) for all three languages; keep translations accurate.
   - TODO: real per-word images (only emoji today) — needs an asset pipeline or
     a free image source; keep it optional/offline-friendly.
   - DONE: **stats/calendar page** (`/learn/stats`) — activity, review forecast,
     streak heatmap, per-category mastery, over `learn.daily/srs/mastery`.
   - TODO: richer stats (per-language totals, best-streak record, XP trend),
     and optionally gate the page behind Pro per `docs/PRICING.md`.
4. **More site adapters + Playwright fixtures** per site (see `wotaku.wiki`,
   `anime-skip.com` for ideas like intro-skip timestamps).
5. **More languages** (data-only in `strings.ts` + `vocab.ts`).
6. Optional: video auto-progress polish, PiP edge cases, a11y audit pass.

## Pricing model (current)

Free = full local tracking + manual add + imports + Korean basics/numbers.
Pro ($2.99/mo, $24.99/yr) = encrypted multi-device sync, update alerts, full
KR/JP/ZH learning + reviews, stats, unlimited devices. Lifetime ($49) = all,
forever, founder badge. Competitor survey + cost/margin math in `docs/PRICING.md`.

## Guardrails

- Never break the local-first core for a cloud feature; sync/accounts/payments
  stay optional and behind interfaces (`lib/sync.ts`, `server/lib/store.ts`).
- Keep storage keys stable (`dasi.items/sites/notifications`, store `version`)
  and migrate rather than reset, so updates never wipe user data or subscriptions
  (see `docs/UPDATING.md`).
- Every user-facing string in EN + FR; keep `pnpm check`, `pnpm test`, `pnpm build` green.
