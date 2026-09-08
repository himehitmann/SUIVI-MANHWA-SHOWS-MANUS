import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "yomu-package-"));
const context = vm.createContext({
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Int32Array,
  TextEncoder,
  TextDecoder,
});
vm.runInContext(fs.readFileSync("vendor/fflate.min.js", "utf8"), context);
const files = context.fflate.unzipSync(
  new Uint8Array(fs.readFileSync("yomu-extension.zip"))
);
try {
  for (const [name, bytes] of Object.entries(files)) {
    const file = path.resolve(folder, name);
    if (!file.startsWith(folder + path.sep)) throw Error("Unsafe archive path");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(folder, "manifest.json"), "utf8")
  );
  if (manifest.manifest_version !== 3)
    throw Error("Manifest V3 missing at archive root");
  // Add a test document to the temporary harness only. No distributed resource is changed.
  fs.mkdirSync(path.join(folder, "tests/fixtures"), { recursive: true });
  fs.copyFileSync(
    "tests/fixtures/reader.html",
    path.join(folder, "tests/fixtures/reader.html")
  );
  const test = process.argv.includes("--upgrade-only")?{status:0}:spawnSync(process.execPath, ["tests/e2e/extension.mjs"], {
    stdio: "inherit",
    env: { ...process.env, YOMU_EXTENSION_DIR: folder },
  });
  if (test.status !== 0) throw Error("Unpacked extension verification failed");
  const upgrade = spawnSync(process.execPath, ["tests/e2e/upgrade.mjs"], {
    stdio: "inherit",
    env: { ...process.env, YOMU_EXTENSION_DIR: folder },
  });
  if (upgrade.status !== 0) throw Error("Upgrade verification failed");
  console.log("Unpacked Chrome extension verified: " + manifest.version);
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}
