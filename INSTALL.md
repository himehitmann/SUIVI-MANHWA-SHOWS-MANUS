# Installing the Dasi extension

The extension lives in the **`extension/` subfolder** of this repository — the
`manifest.json` Chrome needs is inside `extension/`, not at the repository root.
That is why loading the top-level folder fails with _"Manifest file is missing
or unreadable"_.

## Easiest: download the packaged zip (recommended)

1. Open the repository's **Releases** page → the **"Dasi extension (latest)"** release.
2. Download **`dasi-extension.zip`**.
3. Unzip it. You get a folder that contains `manifest.json` directly.
4. Open `chrome://extensions` (or `edge://extensions`).
5. Turn on **Developer mode** (top-right).
6. Click **Load unpacked** and select the **unzipped folder**.

## From the repository "Download ZIP"

If you use the green **Code → Download ZIP** button on the whole repo instead:

1. Unzip the repository.
2. In `chrome://extensions`, Developer mode on, **Load unpacked**.
3. Select the inner **`extension`** folder — **not** the top
   `SUIVI-MANHWA-SHOWS-MANUS-...` folder. Chrome must be pointed at the folder
   that directly contains `manifest.json`.

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
