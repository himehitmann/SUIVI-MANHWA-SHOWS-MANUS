# Dasi — Continue Reading & Watching

Dasi is a **local-first**, premium browser extension (plus a companion web app)
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
- **Library** with continue queue, Reading/Watching/Favorites filters, search,
  favorites and delete.
- **Quick-access sites** — save your reading/streaming sites for one-click access.
- **Custom lists (Collections)** with a color picker, a dedicated **detail page**
  per list, and **drag-and-drop** reordering.
- **Notifications** for new chapters/episodes, with live "NEW" pulses in the library.
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
extension/         Manifest V3 extension
  content.js       Generic-first detector + isolated site adapters
  background.js    On-demand injection, local merge policy, storage
  popup.*          One-click confirm/save + video tools
  library.html/js  Standalone library reading chrome.storage.local
shared/detect.ts   Pure, unit-tested detection heuristics (mirrored by content.js)
tests/             Vitest suite for the detection heuristics
docs/              ARCHITECTURE.md, PRICING.md
```

## Install the extension (development)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** and select the `extension/` folder.
3. Open a chapter, episode or video, click the Dasi icon, review the detection,
   and hit **Save my position**. Shortcut: `Ctrl+Shift+S` (`MacCtrl+Shift+S` on macOS).

`extension/icon.png` must be present for a full load.

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

## Roadmap

Encrypted sync backend behind a swappable interface, a "find again" flow for dead
URLs, reading calendar/statistics, and additional site adapters and languages —
all kept off the critical path so the local-first core stays independent.
