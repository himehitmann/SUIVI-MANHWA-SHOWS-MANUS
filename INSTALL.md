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
