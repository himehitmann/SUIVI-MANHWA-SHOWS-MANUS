import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const root = process.env.YOMU_EXTENSION_DIR;
if (!root) throw Error("Run through pnpm test:package");
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "yomu-upgrade-"));
const originals = {};
for (const name of ["manifest.json", "background.js"])
  originals[name] = await fs.readFile(path.join(root, name));
const baseline = "5967171dd7e4cccbee579c34923a31f2c7110106";
let browser;
async function launch() {
  browser = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root],
  });
  return (
    browser.serviceWorkers()[0] || (await browser.waitForEvent("serviceworker"))
  );
}
try {
  for (const name of Object.keys(originals))
    await fs.writeFile(
      path.join(root, name),
      execFileSync("git", ["show", baseline + ":" + name])
    );
  let worker = await launch();
  assert.equal(
    await worker.evaluate(() => chrome.runtime.getManifest().version),
    "0.3.1"
  );
  await worker.evaluate(async () => {
    await serializeLibrary(async()=>{await chrome.storage.local.set({
      "dasi.items": [
        {
          id: "miraculous",
          title: "Miraculous",
          type: "watching",
          season: 2,
          episode: 3,
          updatedAt: 30,
        },
      ],
      "dasi.lists": [
        { id: "my-list", name: "My shows", itemIds: ["miraculous"] },
      ],
      "dasi.settings": { lang: "fr", profile: { name: "Upgrade Reader" } },
      "dasi.sync.config": {
        token: "upgrade-fixture",
        email: "upgrade@example.test",
        apiUrl: "https://sync.example.test/api",
      },
      "dasi.schema": 3,
    });});
  });
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get("dasi.items")))["dasi.items"][0].episode,3);
  const extensionId = new URL(worker.url()).host;
  await browser.close();
  browser = null;
  for (const [name, bytes] of Object.entries(originals))
    await fs.writeFile(path.join(root, name), bytes);
  worker = await launch();
  assert.equal(new URL(worker.url()).host, extensionId);
  const result = await worker.evaluate(async () => ({
    version: chrome.runtime.getManifest().version,
    data: await chrome.storage.local.get(null),
  }));
  assert.equal(result.version, "0.4.3");
  assert.equal(result.data["dasi.items"][0].episode, 3);
  assert.deepEqual(result.data["dasi.lists"][0].itemIds, ["miraculous"]);
  assert.equal(result.data["dasi.settings"].profile.name, "Upgrade Reader");
  assert.equal(result.data["dasi.sync.config"].token, "upgrade-fixture");
  assert.equal(result.data["dasi.migrationError"], undefined);
  console.log(
    "Persistent Chrome profile upgrade verified: 0.3.1 -> 0.4.3; account, progress, lists and profile retained."
  );
} finally {
  if (browser) await browser.close();
  for (const [name, bytes] of Object.entries(originals))
    await fs.writeFile(path.join(root, name), bytes);
  await fs.rm(profile, { recursive: true, force: true });
}
