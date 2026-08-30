# Installing the Dasi extension

`manifest.json` sits at the **repository root**, so the downloaded project folder
loads directly as an unpacked extension — no subfolder to hunt for.

## From the repository "Download ZIP"

1. On GitHub, **Code → Download ZIP** (or download the branch) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the **unzipped project folder** — the one
   that directly contains `manifest.json` (e.g.
   `SUIVI-MANHWA-SHOWS-MANUS-main/`). The other folders (`client/`, `server/`,
   `docs/`, …) are ignored by Chrome.

## Prefer a clean zip (for the Chrome Web Store, or a tidy load)

Run `bash scripts/pack-extension.sh` to build **`dasi-extension.zip`** — just the
extension files, `manifest.json` at the zip root. The GitHub Actions workflow
also publishes it as the **"Dasi extension (latest)"** release. Unzip and **Load
unpacked** the unzipped folder, or upload the zip straight to the Web Store.

## Where is my data stored? Is it kept?

- Your library is stored **in your browser** via `chrome.storage`. It survives
  browser restarts.
- Dasi now also mirrors it to **`chrome.storage.sync`**, so if you install the
  extension on **another computer signed into the same browser account**, your
  library comes back automatically (subject to the browser's sync quota).
- **Uninstalling** the extension clears its storage. To be safe against
  accidental removal or a brand-new machine/account, use **Export backup** in the
  library (and **Import backup** to restore). Keep that JSON file somewhere safe.
- A future optional **account + cloud sync** (see `docs/PRICING.md`) will make
  cross-device recovery automatic without relying on browser sync.

## Optional: cloud sync across devices (same account as the web app)

If you run the Dasi backend (see `docs/BACKEND.md`), the extension can sync to
the **same account** as the web app so both share one library:

1. Right-click the Dasi toolbar icon → **Options** (or click **Set up sync →**
   in the popup footer). The **Cloud sync** settings tab opens.
2. Enter your **Backend URL** (the API base, e.g. `https://your-host/api`), your
   **email** and **password**, then **Sign in** — or **Create account** for a
   new one. The same credentials work in the web app's Settings page.
3. That's it. The extension pulls your existing library, merges it with what's
   on this device, and keeps syncing after each save (best-effort). Use **Sync
   now** to force a round-trip.

Notes:
- Your credentials/token are stored **only on this device** (`chrome.storage.local`)
  and are **never** mirrored to browser sync.
- Sync is entirely optional — with it off, everything keeps working locally.
- The extension only owns items/sites/notifications; your web-app lists, learning
  progress and plan are preserved on the server and never overwritten by a push.
