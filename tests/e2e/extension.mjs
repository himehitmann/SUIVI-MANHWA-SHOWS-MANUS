import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const root = process.env.YOMU_EXTENSION_DIR || process.cwd(),
  profile = await fs.mkdtemp(path.join(os.tmpdir(), "yomu-e2e-"));
const artifactDir = path.resolve("test-results");
await fs.mkdir(artifactDir, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
  viewport: { width: 1440, height: 1000 },
});
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host,
    base = `chrome-extension://${id}/`;
  assert(await worker.evaluate(async()=>Boolean(await chrome.alarms.get("yomu-sync-retry"))),"Durable sync alarm missing");
  const image = await context.newPage();
  await image.setViewportSize({ width: 720, height: 1000 });
  await image.setContent(
    '<body style="margin:0;background:#dde1e9"><div style="margin:180px 100px;border:3px solid black;border-radius:50%;background:white;height:240px;display:flex;align-items:center;justify-content:center;font:38px Arial;text-align:center">HELLO WORLD<br>WELCOME HOME</div></body>'
  );
  const png = await image.screenshot();
  const dataUrl = "data:image/png;base64," + png.toString("base64");
  await image.close();
  await worker.evaluate(async cover => {
    await chrome.storage.local.set({
      "dasi.schema": 2,
      "dasi.settings": { lang: "fr", profile: { name: "Test Reader" } },
      "dasi.items": [
        {
          id: "alchemy-of-souls",
          title: "Alchemy of Souls",
          type: "watching",
          episode: 1,
          total: 20,
          enrichedAt: 1,
          cover,
          updatedAt: 1,
        },
      ],
      "dasi.lists": [
        { id: "favorites", name: "À découvrir", itemIds: ["alchemy-of-souls"] },
      ],
    });
    globalThis.testCover = cover;
    catalogSearchAll = async query => {
      await new Promise(r => setTimeout(r, query === "old" ? 900 : 30));
      return [
        {
          title: query === "old" ? "Old result" : "Aniimo",
          type: "game",
          cover: globalThis.testCover,
          url: "https://store.steampowered.com/app/4126040/Aniimo/",
          genres: ["RPG"],
          synopsis: "Catalog fixture.",
        },
      ];
    };
    getDiscover = async () => ({
      manga: [],
      anime: [],
      manhwa: [],
      manhua: [],
      series: [],
      gamesHot: [],
      gamesSoon: [],
    });
  }, dataUrl);
  // Official non-Steam pages use their own media metadata; no invented release date.
  for (const [url, title] of [
    ["https://www.aniimo.com/fr", "Aniimo"],
    ["https://chronoodyssey.kakaogames.com/", "Chrono Odyssey"],
  ]) {
    const game = await context.newPage();
    await game.route("**/*", r =>
      r.fulfill({
        contentType: "text/html",
        body:
          "<title>" +
          title +
          ' | Official</title><meta property="og:title" content="' +
          title +
          ' | Official"><h1>' +
          title +
          "</h1>",
      })
    );
    await game.goto(url);
    // Exercise the real DOM detector with a transport stub: automated pages do
    // not receive Chrome's user-gesture activeTab grant.
    await game.evaluate(() => {
      globalThis.chrome = {
        runtime: {
          sendMessage: m => {
            if (m.type === "DETECTION_UPDATED")
              globalThis.testDetection = m.payload;
          },
          onMessage: { addListener() {} },
        },
      };
    });
    await game.addScriptTag({ path: path.join(root, "content.js") });
    await game.waitForFunction(() => globalThis.testDetection);
    const detected = await game.evaluate(() => globalThis.testDetection);
    assert.equal(detected.title, title);
    assert.equal(detected.type, "game");
    assert(!detected.releaseDate);
    await game.close();
  }
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base + "library.html");
  await page.locator("#avatar").waitFor();
  await page.locator("#q").fill("old");
  await page.waitForTimeout(350);
  await page.locator("#q").fill("Aniimo");
  await page.locator("[data-preview]").waitFor();
  await page.waitForTimeout(1000);
  assert(
    !(await page.locator("#search-results").innerText()).includes("Old result")
  );
  await page.locator("[data-preview]").click();
  await page.locator("#preview-add").waitFor();
  assert.equal(
    await page.locator("#drawer .drawer-title").innerText(),
    "Aniimo"
  );
  await page.locator("#preview-list").selectOption("favorites");
  await page.locator("#preview-add").click();
  await page.locator("#dr-close").waitFor();
  const saved = await worker.evaluate(() =>
    chrome.storage.local.get(["dasi.items", "dasi.lists"])
  );
  assert(saved["dasi.items"].some(i => i.title === "Aniimo"));
  assert(saved["dasi.lists"][0].itemIds.includes("aniimo"));
  await page.locator("#dr-close").click();
  await page.locator('[data-v="home"]').click();
  await page.locator('[data-v="library"]').click();
  assert.equal(await page.locator("#search-results").innerText(), "");
  await page.locator('#grid [data-open="alchemy-of-souls"]').first().click();
  await page.locator("#dr-num").fill("847");
  await page.locator("#dr-num").press("Tab");
  await page.waitForTimeout(250);
  assert.equal(await page.locator("#dr-num").inputValue(), "20");
  await page.locator("#dr-close").click();
  await page.screenshot({
    path: path.join(artifactDir, "library-desktop.png"),
  });
  const boxes = await page
    .locator("img.cov")
    .evaluateAll(ims =>
      ims.map(im => ({
        width: im.clientWidth,
        height: im.clientHeight,
        parent: im.offsetParent?.className,
      }))
    );
  assert(
    boxes.every(b => b.width <= 350 && b.height <= 500),
    "Cover escaped its frame"
  );
  await page.locator("#avatar").click();
  assert(
    await page
      .locator("#view-settings")
      .evaluate(el => el.classList.contains("active"))
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  );
  await page.screenshot({
    path: path.join(artifactDir, "settings-mobile.png"),
  });
  await worker.evaluate(() => {
    detectTab = async () => ({
      title: "Alchemy of Souls",
      type: "watching",
      season: 1,
      episode: 2,
      confidence: 0.6,
      hasVideo: true,
      duration: 3600,
      position: 900,
      domain: "a-long-streaming-site.example",
      enrichedAt: 1,
    });
  });
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 400, height: 600 });
  await popup.goto(base + "popup.html");
  await popup.waitForTimeout(600);
  await popup.locator("#save:not([disabled])").waitFor();
  await popup.locator("#list-sel").selectOption("__new__");
  await popup.locator("#list-new").fill("New list");
  await popup
    .locator("#title")
    .evaluate(
      el =>
        (el.textContent =
          "A very long series title that wraps onto two lines in the popup header for this regression")
    );
  let bounds = await popup.evaluate(() => ({
    body: document.body.scrollHeight,
    page: document.documentElement.scrollHeight,
  }));
  assert(bounds.body <= 600, JSON.stringify(bounds));
  await popup.screenshot({ path: path.join(artifactDir, "popup.png") });
  // Real bundled OCR; only the network translation response is deterministic in CI.
  const ocr = await worker.evaluate(async d => {
    await ensureOffscreen();
    return await ocrViaTesseract(d, "eng");
  }, dataUrl);
  assert(ocr.blocks.some(b => b.text.includes("HELLO WORLD")));
  assert(
    ocr.blocks.every(b => b.bbox.x1 <= ocr.width && b.bbox.y1 <= ocr.height)
  );
  const tall = await context.newPage();
  await tall.setViewportSize({ width: 720, height: 2800 });
  await tall.setContent(
    '<body style="margin:0;background:white;font:44px Arial"><p style="position:absolute;top:150px;left:150px">HELLO WORLD</p><p style="position:absolute;top:2400px;left:150px">WELCOME HOME</p></body>'
  );
  const tallData =
    "data:image/png;base64," + (await tall.screenshot()).toString("base64");
  const tallOcr = await worker.evaluate(
    async d => ocrViaTesseract(d, "eng"),
    tallData
  );
  assert(
    tallOcr.blocks.some(
      b => b.text.includes("WELCOME HOME") && b.bbox.y0 > 2300
    ),
    "Tall image lost its bottom text"
  );
  await tall.setViewportSize({ width: 720, height: 1000 });
  await tall.setContent(
    '<body style="margin:0;background:white"><p style="position:absolute;top:200px;left:80px;font:48px sans-serif">こんにちは 世界</p></body>'
  );
  const japanese =
    "data:image/png;base64," + (await tall.screenshot()).toString("base64");
  await fs.writeFile(path.join(artifactDir,"japanese-fixture.png"),Buffer.from(japanese.split(",")[1],"base64"));
  await tall.close();
  const japaneseOcr = await worker.evaluate(
    async d => ocrViaTesseract(d, "jpn"),
    japanese
  );
  console.log("Japanese OCR:",JSON.stringify(japaneseOcr.lines));
  assert(
    japaneseOcr.lines.join(" ").includes("世界"),
    "Japanese model did not recognize the sample"
  );
  await worker.evaluate(() => {
    translateTexts = async texts =>
      texts.map(t =>
        t.includes("HELLO") ? "BONJOUR LE MONDE" : "BIENVENUE À LA MAISON"
      );
  });
  const reader = await context.newPage();
  reader.on("pageerror", e => errors.push(e.message));
  await reader.goto(base + "tests/fixtures/reader.html");
  await reader.locator("#panel").evaluate((im, src) => {
    im.src = src;
  }, dataUrl);
  await reader.waitForFunction(
    () => document.querySelector("#panel").naturalWidth > 0
  );
  await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "DASI_TRANSLATE",
      lang: "fr",
      src: "eng",
    })
  );
  await reader.locator("[data-yomu-overlay]").waitFor({ timeout: 45000 });
  assert(
    (await reader.locator("[data-yomu-overlay]").innerText()).includes(
      "BONJOUR"
    )
  );
  await reader.screenshot({
    path: path.join(artifactDir, "translation-in-place.png"),
  });
  await reader.locator("#yomu-translation-status button").click();
  assert.equal(await reader.locator("[data-yomu-overlay]").count(), 0);
  assert.equal(await reader.locator("#panel").getAttribute("src"), dataUrl);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        ok: true,
        journeys: [
          "search race",
          "preview before save",
          "save to list",
          "navigation reset",
          "bounded progress",
          "profile",
          "mobile width",
          "popup <=600px",
          "real OCR",
          "tall image OCR",
          "Japanese OCR",
          "in-place translation",
          "restore",
        ],
        popup: bounds,
        covers: boxes.length,
        ocr: ocr.lines,
        japanese: japaneseOcr.lines,
      },
      null,
      2
    )
  );
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
