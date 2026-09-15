# Yomu — Continue Reading & Watching

Yomu is a **local-first**, premium browser extension (plus a companion web app)
that remembers where you stopped in anything you read or watch online — manga,
manhwa, webtoons, comics, novels, anime, series, films and videos. One click
saves your place; the library brings it back.

> **Vision:** _"I don't have to think about where I left off anymore. The extension handles it."_

The interface is English by default, with a language switcher next to the search
bar (French included; more languages are a data-only change). No account is
required to use it; cloud sync is an optional, non-critical upgrade.

## What's in the box

- **Universal detection** — a generic-first detector (JSON-LD → Open Graph → DOM
  → title → URL → heuristics) with isolated adapters for popular manga and
  streaming sites (Netflix, WEBTOON, Naver, Kakao, AsuraScans, Bato, MangaDex,
  Aniwatch, MyAsianTV, KissAsian, KissKh, Viki, Voiranime and more). Weak
  detections are flagged for review instead of being saved silently.
- **One-click save** from the popup, or `Ctrl+Shift+S`.
- **Add works manually** with an optional online title search (AniList — free, best-effort), so anything can be tracked even without visiting a page.
- **Import from other trackers** — MyAnimeList XML export, generic CSV, JSON, and Yomu backups, auto-detected.
- **Library** with continue queue, Reading/Watching/Favorites filters, search,
  favorites and delete.
- **Quick-access sites** — save your reading/streaming sites for one-click access.
- **Custom lists (Collections)** with a color picker, a dedicated **detail page**
  per list, and **drag-and-drop** reordering.
- **Notifications** for new chapters/episodes, with live "NEW" pulses in the library.
- **Learn the language** — a built-in Korean/Japanese/Chinese vocabulary trainer
  (character + reading + meaning + an emoji picture, click for definition,
  example and notes) with categories, spaced review, XP, levels and streaks.
- **Video tools** — playback speed and Picture-in-Picture, working across many players.
- **Internationalization** — English default, French included, easy to extend.
- **Privacy by design** — data stays on your device; minimal permissions; no remote code.
- **Standalone library page** shipped inside the extension, so it works with no backend at all.

## Repository layout

```
client/            Web app (library + companion page): React + Vite
  src/i18n/        English + French dictionaries and language context
  src/store/       Local-first persistent store (localStorage)
  src/pages/       Home, Collections, ListDetail, Pricing
  src/components/  Header, Notifications, LanguageSwitch, Loader, bits
Repository root    Manifest V3 extension files
  content.js       Generic-first detector + isolated site adapters
  background.js    On-demand injection, local merge policy, storage
  popup.*          One-click confirm/save + video tools
  library.html/js  Standalone library reading chrome.storage.local
shared/detect.ts   Pure, unit-tested detection heuristics (mirrored by content.js)
tests/             Vitest suite for the detection heuristics
docs/              ARCHITECTURE.md, PRICING.md
```

## Install and update the extension

See [INSTALL.md](INSTALL.md). Use the verified `yomu-extension.zip` from a
successful GitHub Actions run. The manifest is at the package root.
Existing unpacked installations must be updated in the same folder and reloaded
in Chrome; GitHub changes do not install themselves.

### Where your data is stored

Your library is kept in your browser (`chrome.storage`) and mirrored to
`chrome.storage.sync`, so a fresh install on another computer signed into the
same browser account restores it automatically (within the browser's sync
quota). Uninstalling clears storage — use **Export/Import backup** in the
library as an uninstall-proof backup.

## Develop the web app

```bash
pnpm install
pnpm dev      # start the dev server
pnpm check    # TypeScript typecheck
pnpm test     # Vitest unit tests (detection heuristics)
pnpm build    # production build
```

## Detection & fallback strategy

Detection is progressive and generic-first: site adapters are isolated and can
never break the baseline pipeline. If the precise layer fails, the next one
runs, down to a minimal user confirmation. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full pipeline, the merge
policy, video handling, the optional sync design and the permission
justification.

## Privacy & permissions

Data is local by default. The extension requests only `activeTab`, `scripting`,
`storage` and `tabs` — each justified in the architecture doc — and never
`cookies`, broad host permissions, or remote code. Detection runs only when you
act, never continuously in the background. Any future cloud sync is opt-in,
encrypted, and decoupled from the core so the product keeps working offline.

## Monetization

Free forever for local use. Optional **Pro** ($2.99/mo or $24.99/yr) adds
encrypted cross-device sync and update alerts; a **$49 Lifetime** option fits the
extension-buyer model. The full competitor survey and cost/margin analysis is in
[`docs/PRICING.md`](docs/PRICING.md).

## Docs

- [INSTALL.md](INSTALL.md) — install the extension + where data is stored.
- [docs/UPDATING.md](docs/UPDATING.md) — ship updates without losing user data or subscriptions.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — detection pipeline, storage, sync interface, permissions.
- [docs/PRICING.md](docs/PRICING.md) — competitor survey, cost model, tiers.
- [docs/BACKEND.md](docs/BACKEND.md) — optional sync + auth backend (deploy + env).
- [docs/QA.md](docs/QA.md) — verification record and how to reproduce it.

## Roadmap

Encrypted sync backend behind a swappable interface, a "find again" flow for dead
URLs, reading calendar/statistics, and additional site adapters and languages —
all kept off the critical path so the local-first core stays independent.

## Delivery status, reviewed 2026-09-14

Latest verified extension: **0.4.16**, branch `fix/yomu-p0-reliability`.
[Successful automated verification](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/34867367235).
The historical feature descriptions above are not a production readiness guarantee.

### Implemented and covered by automated checks

- Internal catalog previews, explicit list selection and already-saved recognition.
- Confirmed identity matching, conservative duplicate repair, season-aware selection.
- Persistent import enrichment queue and exact-ID metadata recovery.
- Tracked episode release dates, catch-up views and category discovery rows.
- Library format/unlisted filters and sorting.
- Extension packaging, persistent-profile upgrade, crop controls, list operations and video checks.

### Still incomplete or needing broader verification

- Recognition of legacy brand-only titles, unidentified records and ambiguous multilingual matches.
- Real user import samples: original watched history cannot be inferred from catalog episode totals.
- Coverage and reliability of covers, synopsis, authors, cast and embedded trailers across providers.
- Live image translation quality, difficult panels and provider failures; fixture OCR is not universal validation.
- Full visual/accessibility audit of every popup, bubble, drawer, error state and narrow viewport.
- Manga chapter release dates, upcoming calendar and richer per-episode/reading history.
- Recommendation quality, regional trends and sufficient catalog coverage; no exhaustive competitor parity.
- Web/extension feature parity and production account/sync/email/payment deployment verification.
- Personal Chrome installation/reload: local access is blocked; remote tests do not update that browser.
- Documentation cleanup: older architecture/backend descriptions may not match the current implementation.

Requested sources such as MangaUpdates, Nautiljon, Manga-news, Booknode, ComicWalker,
Fandom, TVTropes and Anime-Planet are not all integrated. A complete competitor
feature inventory remains to be established. No claim of full implementation or
measured overall completion percentage is made by this status record.
