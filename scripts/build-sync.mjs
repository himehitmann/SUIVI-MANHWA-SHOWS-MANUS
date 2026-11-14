import { build } from "esbuild";
await build({
  entryPoints: ["shared/extension-sync.ts"],
  bundle: true,
  format: "iife",
  globalName: "YomuSync",
  outfile: "sync-core.js",
  banner: {
    js: "// Generated from shared/extension-sync.ts by pnpm build:sync. Do not edit.",
  },
  target: "chrome109",
});
