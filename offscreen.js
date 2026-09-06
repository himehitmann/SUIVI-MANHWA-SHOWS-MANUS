/*
 * Yomu offscreen OCR host. The MV3 service worker can't create Web Workers or
 * run WASM, so the bundled Tesseract.js engine lives here in an offscreen
 * document. The background sends a panel image (data URL) + source language;
 * we OCR it fully offline (no key, no server, no CDN — the wasm core and the
 * CJK language models are bundled with the extension) and return the text
 * lines. One Tesseract worker is kept warm per language.
 */
/* global Tesseract */
const workers = {}; // lang -> Promise<Worker>
const url = (p) => chrome.runtime.getURL(p);

function getWorker(lang) {
  if (workers[lang]) return workers[lang];
  workers[lang] = Tesseract.createWorker(lang, 1, {
    workerPath: url("tesseract/worker.min.js"),
    corePath: url("tesseract/"), // folder holding tesseract-core-simd.wasm(.js)
    langPath: url("tesseract/tessdata"), // bundled <lang>.traineddata.gz
    workerBlobURL: false, // load the worker from its extension URL (CSP-safe)
    gzip: true,
  }).catch((e) => { delete workers[lang]; throw e; });
  return workers[lang];
}

// Split OCR output into bubble-sized lines. Tesseract's paragraph/line split is
// noisy for vertical CJK, so we fall back to the raw text split on newlines.
function toLines(data) {
  const fromLines = (data.lines || []).map((l) => (l.text || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (fromLines.length) return fromLines;
  return String(data.text || "").split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length >= 1);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "OCR_OFFSCREEN") return;
  (async () => {
    try {
      const lang = msg.lang || "kor";
      const worker = await getWorker(lang);
      const { data } = await worker.recognize(msg.dataUrl);
      sendResponse({ ok: true, lines: toLines(data) });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // async response
});
