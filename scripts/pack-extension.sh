#!/usr/bin/env bash
#
# Package the extension into a ready-to-load / store-ready zip whose ROOT is
# manifest.json. The extension files live at the repository root (so the repo
# folder itself loads directly as an unpacked extension); this script bundles
# just those files, leaving the web app / server / docs out.
#
# Usage:  bash scripts/pack-extension.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/yomu-extension.zip"

# The files that make up the extension (see manifest.json).
FILES=(
  manifest.json background.js content.js edition.js translate.js
  popup.html popup.js options.html options.js library.html library.js
  offscreen.html offscreen.js import-parse.js icon.png
)

cd "$ROOT"
rm -f "$OUT"
zip "$OUT" "${FILES[@]}" >/dev/null
# Bundled offline OCR engine (Tesseract.js: wasm core + worker + CJK models).
zip -r "$OUT" tesseract >/dev/null
# Vendored libs (fflate for ZIP import).
zip -r "$OUT" vendor >/dev/null
echo "Built: $OUT"
unzip -l "$OUT" | tail -n +2 | head -20
echo
echo "Load it: unzip yomu-extension.zip, then chrome://extensions → Developer mode"
echo "→ Load unpacked → select the unzipped folder (the one with manifest.json)."
