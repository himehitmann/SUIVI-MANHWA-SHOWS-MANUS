#!/usr/bin/env bash
# Compatibility entry point: use the same verified packager as local builds/CI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node scripts/build-sync.mjs
node scripts/pack-extension.mjs
