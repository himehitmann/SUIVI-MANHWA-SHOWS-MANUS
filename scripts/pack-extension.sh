#!/usr/bin/env bash
#
# Package the extension into a ready-to-load zip whose ROOT is manifest.json,
# so "Load unpacked" (or a Chrome Web Store upload) works without hunting for the
# manifest inside the repo. Output: dasi-extension.zip at the repo root.
#
# Usage:  bash scripts/pack-extension.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dasi-extension.zip"

rm -f "$OUT"
cd "$ROOT/extension"
zip -r "$OUT" . -x '*.DS_Store' >/dev/null
echo "Built: $OUT"
unzip -l "$OUT" | tail -n +2 | head -20
echo
echo "Load it: unzip dasi-extension.zip, then chrome://extensions → Developer mode"
echo "→ Load unpacked → select the unzipped folder (the one with manifest.json)."
