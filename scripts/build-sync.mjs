import { build } from "esbuild";
await build({
  entryPoints: ["shared/sync-core.ts"],
  bundle: true,
  format: "iife",
  globalName: "YomuSync",
  outfile: "sync-core.js",
  banner: {
    js: "// Generated from shared/sync-core.ts by pnpm build:sync. Do not edit.",
  },
  target: "chrome109",
});
