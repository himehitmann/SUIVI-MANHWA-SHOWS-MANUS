#!/usr/bin/env bash
#
# Regenerate the PUBLIC branch as a filtered mirror of the PRIVATE working
# branch, with internal/business-only files stripped out.
#
#   private branch  = full project, for the owner's use (handoff notes, pricing
#                     strategy, internal planning). This is where you develop.
#   public branch   = the shareable product (app + extension + backend code +
#                     technical docs), safe to open up or turn into a PR.
#
# The public branch is a GENERATED MIRROR — never commit to it by hand; run this
# script to refresh it. It force-pushes because it is fully derived from private.
#
# Usage:  bash scripts/publish-public.sh
set -euo pipefail

# The PUBLIC branch is `main` (the repo default): the Chrome-Web-Store build with
# the paywall on. The PRIVATE branch is the owner's unlocked build.
PRIVATE_BRANCH="private"
PUBLIC_BRANCH="main"

# Files that must NEVER reach the public branch.
PRIVATE_PATHS=(
  CLAUDE.md            # session handoff (contains internal roadmap + session URL)
  docs/PRICING.md      # pricing strategy, competitor survey, margin math
  docs/DEPLOY-PAYMENTS.md # operational go-live + payments guide (owner only)
  ideas.md             # internal product/design brainstorming
  todo.md              # internal task notes
  reference-notes.md   # internal research notes
  template.json        # scaffolding/tooling artifact, not product code
)

git rev-parse --verify "$PRIVATE_BRANCH" >/dev/null 2>&1 || {
  echo "Private branch $PRIVATE_BRANCH not found." >&2; exit 1;
}

START="$(git rev-parse --abbrev-ref HEAD)"
git checkout "$PRIVATE_BRANCH"
SOURCE_SHA="$(git rev-parse --short HEAD)"

# Recreate the public branch from the current private HEAD.
git checkout -B "$PUBLIC_BRANCH"

# Strip private files from the tree and index (ignore any that are absent).
for p in "${PRIVATE_PATHS[@]}"; do
  git rm -q -f --ignore-unmatch "$p" >/dev/null 2>&1 || true
done

# Flip the build edition to the gated Chrome-Web-Store build. This is the ONLY
# code difference between the branches: on private every Pro feature is unlocked;
# on public the normal free/Pro paywall applies.
EDITION_FILE="client/src/lib/edition.ts"
if [ -f "$EDITION_FILE" ]; then
  sed -i 's/^export const EDITION: "private" | "public" = "private";/export const EDITION: "private" | "public" = "public";/' "$EDITION_FILE"
  git add "$EDITION_FILE"
fi

# Same edition flip for the vanilla extension pages (Plans paywall).
EXT_EDITION_FILE="edition.js"
if [ -f "$EXT_EDITION_FILE" ]; then
  sed -i 's/^const DASI_EDITION = "private";/const DASI_EDITION = "public";/' "$EXT_EDITION_FILE"
  git add "$EXT_EDITION_FILE"
fi

git commit -q -m "chore(public): mirror ${SOURCE_SHA} (store edition, internal files stripped)" || {
  echo "Nothing to change (already clean)."; }

git push -f -u origin "$PUBLIC_BRANCH"

# Return to where we started.
git checkout "$START" >/dev/null 2>&1 || git checkout "$PRIVATE_BRANCH"
echo "Public branch '$PUBLIC_BRANCH' refreshed from '$PRIVATE_BRANCH' ($SOURCE_SHA)."
