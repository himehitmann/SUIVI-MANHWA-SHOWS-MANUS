# Web parity and catalog verification — 2026-09-09

Overall specification completion is estimated at 42%; this is not a test pass percentage. The full product remains in development.

Implemented: additive web imports using the extension JSON/CSV/XML/ZIP parser; preservation of game metadata; detailed work page with bounded progress, personal notes and list membership; per-provider identity matching without conflating conflicting IDs; empty new libraries; same-origin API discovery; separate search page with type/country/year/genre filters, preview, destination list, cancellation and visible failure states. Removed inactive video controls and misleading always-up-to-date label.

Verification: 165 automated tests passed, TypeScript and lint passed. A built production server and Chromium tested actual account creation, import, progress bounds, persisted notes, real API sync, sign-out isolation, sign-in restoration, mobile layout, catalog failure/recovery and preview-to-list addition. Catalog UI fixtures are explicitly synthetic; live sources are checked separately by scripts/check-catalog-live.ts.

Live observations: Steam returns Aniimo app 4126040. TVmaze returns Colony (US series, 2016). AniList responds HTTP 403 stating its API is temporarily disabled due to stability issues. Jikan and Open Library did not respond successfully in the latest local checks; their availability is not claimed. Search displays partial-source failures. The expanded Wikipedia search also returned Colony (2026 film), distinct from the US television series. Country enrichment relies on source description/intro when available.

Sources for continuing catalog work:
- Jikan official service: https://jikan.moe/
- Korean Film Council confirms Colony (2026), South Korea: https://www.koreanfilm.or.kr/eng/films/index/filmsView.jsp?movieCd=20252402
- TVmaze API: https://www.tvmaze.com/api

Remaining: reliable broader discovery and catalog coverage; chapter/episode history; richer personalization and list management; real source update scheduling; managed translation quality on complex manga; production hosting and operational setup; complete pricing/research deliverables. The extension 0.4.0 manifest/package was validated in the previous lot; the current commit also fixes safe membership-map construction in its shared sync bundle.
