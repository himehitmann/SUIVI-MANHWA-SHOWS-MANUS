# QA verification record

Automated + real-browser checks run against this build.

## Static / unit

- `pnpm check` — TypeScript typecheck: **pass**.
- `pnpm test` — Vitest, 17 tests on the detection heuristics (`shared/detect.ts`):
  **pass** (title cleaning, season/episode/chapter/volume parsing, and URL
  adapters for AsuraScans, WEBTOON, MyAsianTV, KissAsian, Voiranime, Naver).
- `pnpm build` — production build: **pass**.

## Extension, loaded in Chromium (real browser)

Loaded `extension/` unpacked; MV3 service worker started (valid manifest).

- **Manga page (JSON-LD):** detected `Test Manga`, chapter `42`, type reading,
  confidence 0.90.
- **Episode page (Open Graph + video):** detected `Cool Show`, season 3 episode
  7, type watching, video present, confidence 0.80.
- **Playback speed** message reached the `<video>` → `playbackRate = 1.75`.
- **Standalone library page** rendered the stored item and saved site.
- **Popup** rendered.
- **Zero page errors** across content script and extension pages.
- On-demand injection is correctly gated by `activeTab`: direct injection
  without the user gesture is denied, confirming the minimal-permission model.

## Web app, real browser

- Language switch → French, and it **persists across reload** (localStorage).
- Add favorite site → **persists across reload**.
- Delete a library item → count drops and **persists across reload**.
- Create a collection → **persists across reload**.
- List detail renders drag-to-reorder rows.
- **Zero page errors**; responsive desktop and mobile layouts verified.

## How to reproduce the extension check

1. `chrome://extensions` → Developer mode → Load unpacked → `extension/`.
2. Open any chapter/episode/video page, click the Dasi icon, review, Save.
3. Open the library from the popup; confirm the item, then reload and confirm it
   persists.
