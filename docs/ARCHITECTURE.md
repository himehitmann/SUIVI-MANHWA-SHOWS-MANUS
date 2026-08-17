# Dasi — Architecture

Dasi is a **local-first**, generic-first universal "Continue reading / continue
watching" tracker. Nothing in the core product depends on a remote service.

## Components

| Layer | Path | Responsibility | Critical dependency |
|---|---|---|---|
| Web app (library) | `client/` | The full library UI: continue, library, collections, list detail, pricing. Also the marketing/companion page. | None (static, localStorage) |
| i18n | `client/src/i18n/` | English-default dictionary + French mirror, language context. | None |
| Store | `client/src/store/` | Persistent state (items, lists, sites, notifications, plan) in `localStorage`. | None |
| Detector | `extension/content.js` + `shared/detect.ts` | Generic-first detection with isolated site adapters. | DOM APIs only |
| Service worker | `extension/background.js` | On-demand injection, local merge policy, storage. | `chrome.storage.local` |
| Popup | `extension/popup.*` | One-click confirm/save, video tools, save-site. | Service worker |
| Standalone library | `extension/library.html` + `library.js` | Extension-hosted library reading `chrome.storage.local`. | None (no backend) |

## Detection pipeline (generic-first)

Order, most precise first — each layer only fills fields left empty:

1. **Site adapter** (isolated in `ADAPTERS`) — precise per-site title/chapter/episode from DOM + URL.
2. **JSON-LD / Schema.org** — `name`, `episodeNumber`, `partOfSeason`.
3. **Open Graph / Twitter meta** — `og:title`.
4. **Visible DOM** — `h1`, reader headings.
5. **Document title.**
6. **URL** — chapter/episode numbers in path or query.
7. **Heuristics** — regex parsing of season/episode/chapter/volume.

The **confidence score** reflects how far down the chain the answer came from.
Below ~0.75 the popup flags the detection and asks the user to review before
saving — Dasi never silently saves a weak guess. Adapters are fully isolated: a
broken or removed adapter falls back to generic detection and can never break
the pipeline. URL/text heuristics live in `shared/detect.ts` and are unit-tested
(`tests/detect.test.ts`); `content.js` mirrors them and adds the DOM layer.

### Covered sites (adapters)

Netflix, WEBTOON, Naver Webtoon, Kakao Webtoon/Page, AsuraScans, Bato,
MangaDex, Mangago, Aniwatch/HiAnime, MyAsianTV, KissAsian, KissKh, Viki,
Voiranime/Voirdrama, plus a shared drama adapter for WeTV, iQiyi, Bilibili TV,
HiDrama, RidoMovies, OneTouchTV, Chia-Anime, DramaStore, VidBox and Yarrlist.
Every other site is handled by the generic pipeline.

## Storage & merge policy

One canonical item per work. The work key normalizes the title and strips
chapter/episode/volume markers so the same series across two mirror sites merges
into a single entry (`sources` keeps provenance). The **furthest progress wins**
by default; a lower incoming progress is surfaced as a conflict for the user to
resolve instead of silently overwriting.

## Resuming & dead URLs

Each item stores its last known URL, domain and normalized title. Resume opens
the saved URL directly. Because URLs rot, the normalized title + markers are
retained so a future "find again" flow (or the user) can relocate the work on
another source — the saved URL is never assumed to be eternally valid.

## Video, speed & Picture-in-Picture

The detector targets the largest visible HTML5 `<video>`. Progress is captured
on **pause** and **page unload** (not on every `timeupdate`) to avoid write
storms and bad saves. Playback speed is applied to all videos on the page.
Picture-in-Picture uses the native API and reports a clear reason
(`unsupported` / `denied`) when the browser or player refuses, instead of faking
success.

## Optional cloud sync (not built into the core)

Sync is designed as an **opt-in, non-critical** add-on (see `docs/PRICING.md`
for the business case). Design constraints:

- The extension talks to sync **through an interface**, so the provider
  (Supabase / Cloudflare) can be swapped without touching detection or storage.
- Only small JSON (items, lists, sites) is synced, **encrypted**; never browsing
  history or media.
- If sync is unavailable, disabled, or the user is signed out, everything keeps
  working locally. Sign-in exists to **recover** a library on a new device.

## Permissions (justified, minimal)

| Permission | Why | Avoided alternative |
|---|---|---|
| `activeTab` | Read the current page only when the user opens Dasi or presses the shortcut. | Broad `host_permissions` for all sites. |
| `scripting` | Inject the detector on demand into the active tab. | Persistent all-URLs content script. |
| `storage` | Local library persistence. | Remote database (kept optional). |
| `tabs` | Read the active tab's URL/title for save-site and detection. | — |

No `cookies`, no `webRequest`, no broad host permissions, no remote code (MV3
forbids it). Detection runs only on user action, never continuously in the
background.

## Testing

- `pnpm test` — Vitest unit tests for the detection heuristics on realistic
  URLs/titles from the supported sites.
- `pnpm check` — full TypeScript typecheck.
- `pnpm build` — production build of the web app.
- Manual: load `extension/` unpacked, open a chapter/episode/video, confirm the
  popup detection, save, and reopen the standalone library.
