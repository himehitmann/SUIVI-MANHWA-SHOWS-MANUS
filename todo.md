# Dasi v0.3 — English-first product

## Done
- [x] Keep the **Dasi** name; apply the shine animation to the wordmark (web + popup).
- [x] Add a conic-gradient Dasi loader in the brand pastels.
- [x] Make the web app **English by default** with a language switcher next to search.
- [x] Real i18n architecture (English source + full French mirror, no inline text).
- [x] Persistent local-first store (items, lists, sites, notifications, plan).
- [x] Rebuild the extension detector: generic-first + isolated site adapters.
- [x] Cover the listed manga/streaming sites with adapters; unit-test the heuristics.
- [x] On-demand injection via activeTab + scripting (no persistent all-URLs script).
- [x] Quick-access favorite sites (save links).
- [x] Notifications (new chapter/episode) with live NEW pulses.
- [x] Custom lists with color picker + detail page + drag-and-drop reordering.
- [x] Pricing page (Free / Pro / Lifetime) + monetization research (docs/PRICING.md).
- [x] Standalone extension library page (works with no backend).
- [x] Graceful cover fallback for dead image URLs.
- [x] Docs: README (English), ARCHITECTURE.md, PRICING.md; ideas.md updated.
- [x] Verify: typecheck, build, Vitest suite, real browser screenshots (desktop + mobile, EN + FR).

## Next (kept off the critical path)
- [ ] Encrypted cloud sync backend behind a swappable interface + auth.
- [ ] "Find again" flow to relocate a work when a saved URL dies.
- [ ] Reading calendar & statistics (Pro).
- [ ] Additional site adapters and languages as demand appears.
- [ ] Playwright end-to-end tests against HTML fixtures for each adapter.
