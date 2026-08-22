# Publishing updates without losing user data or subscriptions

Short answer: **yes**. You can keep improving the extension and ship updates,
and existing users keep their libraries and their subscriptions — as long as you
follow the rules below.

## How extension updates work

- You raise the `version` in `extension/manifest.json` (e.g. `0.3.0` → `0.4.0`)
  and upload the new package to the Chrome Web Store (and/or Firefox AMO).
- Chrome **auto-updates** installed extensions in the background. Users don't
  reinstall.
- **An update does NOT clear `chrome.storage`.** Local and synced data survive
  updates. Storage is only wiped by a **full uninstall** (or the user clearing
  it). So progress, lists, favorites and saved sites are preserved across
  updates automatically.

## Rules to never lose data on update

1. **Never rename or delete storage keys** in a breaking way. Dasi uses stable
   keys: `dasi.items`, `dasi.sites`, `dasi.notifications`.
2. **Migrate, don't reset.** `background.js` has a `runtime.onInstalled` hook and
   a `SCHEMA_VERSION`. If a future version changes the data shape, add a
   migration branch there that transforms old data into the new shape — it runs
   once on update. The library store also carries a `version` field for the same
   reason.
3. **Keep reads backward-compatible.** New optional fields are fine; old items
   without them must still load (they do — every field is optional except id).
4. **Test the update path before publishing:** load the old version, create
   data, then load the new version over the same profile and confirm the data is
   intact.

## Subscriptions survive updates too

Subscriptions are **not stored in the extension package**, so shipping new code
can't erase them:

- Payments live in your **payment provider** (Paddle or Stripe) and, once built,
  your **sync/licensing backend** — both independent of the extension version.
- On launch the extension will check licence/subscription status from that
  backend (behind the `SyncProvider` interface in `client/src/lib/sync.ts`), so
  an updated extension simply re-checks and sees the same active subscription.
- **Rule:** never change the licence-check contract in a breaking way without a
  fallback. Treat "backend unreachable" as "keep last known state / stay in local
  mode", never as "downgrade to free and wipe data".

> Today there is no live payment backend, so "plan" is local demo state. When you
> add the backend (see `docs/PRICING.md`), keep subscription state server-side
> and keyed to the user's account — then it is fully decoupled from extension
> updates and from the device.

## Recommended release checklist

1. Bump `manifest.json` `version`.
2. If the data shape changed, add a migration in the `onInstalled` hook.
3. Run `pnpm check`, `pnpm test`, `pnpm build`.
4. Load unpacked over an existing profile with real data → confirm data intact.
5. Zip `extension/` (the CI workflow does this) and upload to the store.
6. Bump `docs`/changelog and tag the release.
