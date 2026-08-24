# Dasi — project guide & handoff for the next session

Paste-ready context: this file tells a fresh chat exactly where the project
stands, how it's built, and what is left to do. A new session starts from a
clean clone of the branch, so **only committed work exists** — everything below
is committed on the working branch.

## Working branch

Develop on **`claude/admiring-pasteur-dc5ce1`** (do NOT create new branches —
keep updating this one). Commit in English with a clear body and end every
commit with:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mv5LNa2FkJMnnavh7uxc6L
```

Push with `git push origin claude/admiring-pasteur-dc5ce1`. Do not open a PR
unless asked. User writes in French; reply in French, code/docs in English.

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
pnpm test     # vitest run --config vitest.config.ts (43 tests, must pass)
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
  lib/vocab.ts           learning dataset (KR/JP/ZH) + level/XP/streak helpers.
  lib/format.ts          markerLabel/relativeTime/timecode.
  components/            AppHeader, Notifications, LanguageSwitch, AddWork, ColorSwatches, Bits, DasiLogo.
  pages/                 Home, Collections, ListDetail, Pricing, Settings, Learn, NotFound.
extension/               MV3: content.js (generic-first detector + site adapters),
                         background.js (on-demand inject, merge, storage.local+sync mirror, onInstalled migration),
                         popup.*, library.html/js (standalone library), manifest.json.
shared/detect.ts         pure detection heuristics (mirrored by content.js), unit-tested.
server/                  optional Express sync+auth API (api.ts, lib/{crypto,store,merge}.ts).
tests/                   vitest: detect, backend, importers, vocab.
docs/                    ARCHITECTURE, PRICING, BACKEND, UPDATING, QA.
.github/workflows/extension-zip.yml  publishes dasi-extension.zip as the "dasi-latest" release.
```

Conventions: add a feature by (1) adding EN+FR strings, (2) a store action that
mutates persisted state (so it auto-syncs), (3) UI, (4) pure logic in `lib/*`
with a vitest in `tests/`. Keep everything typechecking and building.

## Status — DONE (all committed, tested)

- English-first UI + real i18n (EN/FR), language switch by the search bar.
- Persistent local store; Home (queue, filters, search, favorites, delete),
  favorite quick-access **sites**, **notifications** (new chapter/episode) with pulses.
- **Collections**: custom lists, color picker, list detail page, **drag-and-drop** reorder.
- **Pricing** page (Free / Pro $2.99·mo or $24.99·yr / Lifetime $49); **Settings** page.
- **Detection**: generic-first pipeline + isolated site adapters (Netflix, WEBTOON,
  Naver, Kakao, AsuraScans, Bato, MangaDex, Mangago, Aniwatch, MyAsianTV,
  KissAsian, KissKh, Viki, Voiranime, + shared drama adapter). Confidence gating.
- Extension: on-demand injection (activeTab), merge policy, **storage.local + sync**
  mirror (cross-device recovery), standalone library page, `onInstalled` migration
  hook, packaged-zip release workflow, INSTALL.md.
- **Export/Import** backups + "find again" for dead URLs.
- **Manual add** with optional online search; **import from other trackers**
  (MAL XML, CSV, JSON, Dasi backup).
- Optional **sync + auth backend** (Express, scrypt + HMAC tokens, swappable
  Store, item-level merge) + client HTTP provider + functional Settings sign-in.
  Verified live: signup→push→new-device login→recover.
- **Learn module**: KR/JP/ZH vocab by category, flashcards, word detail
  (definition/example/note), review session, XP/levels/streak, Pro-gated
  categories/languages. Synced.
- 43 unit tests; multiple real-browser functional passes; zero page errors.

## Status — NOT DONE / next steps

1. **Deploy the backend + payments (biggest remaining, operational):** swap the
   dev file store (`server/lib/store.ts`) for Postgres/D1; deploy; set
   `VITE_SYNC_API_URL` for the web build; wire Paddle/Stripe webhook to set
   `user.plan` so subscriptions are real. See `docs/BACKEND.md`, `docs/PRICING.md`.
2. **Wire the extension to the backend:** an options page to store API URL +
   token so the extension syncs like the web app (today only the web app does).
3. **Expand the Learn module** (user wants beginner→expert, "everything sticks"):
   - More words + categories (Colors, Time, Verbs, Travel, Body, Grammar points)
     for all three languages; keep translations accurate.
   - Real per-word images (only emoji today) — needs an asset pipeline or a
     free image source; keep it optional/offline-friendly.
   - Audio pronunciation (Web Speech `speechSynthesis` for ja/zh/ko, best-effort).
   - Quizzes / typing / multiple-choice, spaced-repetition scheduling (SM-2),
     daily goal, achievements — deepen the sense of accomplishment.
   - A stats/calendar page (also a Pro value): words learned over time, streak
     calendar, per-category mastery.
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
