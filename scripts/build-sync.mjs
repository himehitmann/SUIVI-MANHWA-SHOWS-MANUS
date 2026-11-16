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

await build({
  entryPoints:["shared/pricing.ts"],bundle:true,format:"iife",
  globalName:"YomuPricing",outfile:"pricing-catalog.js",target:"chrome109",
  banner:{js:"// Generated from shared/pricing.ts by pnpm build:sync. Do not edit."},
});

await build({
  entryPoints:["shared/billing-portal.ts"],bundle:true,format:"iife",
  globalName:"YomuBilling",outfile:"billing-portal.js",target:"chrome109",
  banner:{js:"// Generated from shared/billing-portal.ts by pnpm build:sync. Do not edit."},
});
