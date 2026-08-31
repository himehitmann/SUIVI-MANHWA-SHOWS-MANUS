/**
 * Build edition — the single switch that separates the two branches.
 *
 *   "private" — the owner's personal build: every Pro feature unlocked, no
 *               payment. This is the value on the private working branch.
 *   "public"  — the Chrome-Web-Store build: normal free/Pro gating and the
 *               paywall. `scripts/publish-public.sh` rewrites the line below to
 *               "public" when it regenerates the public mirror branch.
 *
 * Keep this the ONLY place the edition is declared, and keep the literal on its
 * own line (the publish script does a line-precise replacement).
 */
export const EDITION: "private" | "public" = "public";

/** When true, all Pro-gated features are unlocked regardless of plan. */
export const UNLOCK_ALL = EDITION === "private";
