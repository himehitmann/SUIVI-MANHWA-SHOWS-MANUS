/*
 * Extension build edition — mirrors client/src/lib/edition.ts for the vanilla
 * extension pages. "private" = owner build, everything unlocked, no paywall.
 * scripts/publish-public.sh rewrites the literal below to "public" for the
 * Chrome-Web-Store mirror. Keep the literal on its own line (line-precise sed).
 */
const DASI_EDITION = "public";
const DASI_UNLOCK_ALL = DASI_EDITION === "private";
