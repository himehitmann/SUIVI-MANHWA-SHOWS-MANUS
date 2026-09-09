/* Yomu's bundled OCR host. Images remain on the device; only recognized text
 * is sent to the translation provider. Jobs are serialized to bound memory. */
/* global Tesseract */
let workerPromise = null,
  activeLanguage = "",
  jobQueue = Promise.resolve();
const url = p => chrome.runtime.getURL(p);
function deadline(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
const LANGS = new Set(["kor", "jpn", "jpn_vert", "chi_sim", "eng"]);
async function getWorker(lang) {
  lang = LANGS.has(lang) ? lang : "jpn";
  if (workerPromise && activeLanguage !== lang) {
    await (await workerPromise).terminate();
    workerPromise = null;
  }
  if (!workerPromise) {
    activeLanguage = lang;
    let failed = false,
      rejectInitialization;
    const error = new Promise((_, reject) => {
      rejectInitialization = reject;
    });
    const creation = Tesseract.createWorker(lang, 1, {
      workerPath: url("tesseract/worker.min.js"),
      corePath: url("tesseract/"),
      langPath: url("tesseract/tessdata"),
      workerBlobURL: false,
      gzip: true,
      errorHandler: rejectInitialization,
    });
    creation.then(
      worker => {
        if (failed) worker.terminate();
      },
      () => {}
    );
    workerPromise = deadline(
      Promise.race([creation, error]),
      45000,
      "ocr_initialization_timeout"
    ).catch(e => {
      failed = true;
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}
function textRegions(data) {
  const paragraphs = (data.blocks || []).flatMap(b => b.paragraphs || []);
  const regions = paragraphs.length ? paragraphs : data.lines || [];
  return regions
    .map(p => ({
      text: (p.text || (p.lines || []).map(l => l.text).join(" "))
        .replace(/\s+/g, " ")
        .trim(),
      bbox: p.bbox,
      confidence: p.confidence,
    }))
    .filter(
      p => p.text && p.bbox && p.bbox.x1 > p.bbox.x0 && p.bbox.y1 > p.bbox.y0
    );
}
async function recognizePanel(dataUrl, lang) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (blob.size > 25 * 1024 * 1024) throw new Error("image_too_large");
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 60_000_000)
      throw new Error("image_too_large");

    // Tile tall webtoons rather than shrinking an entire chapter to unreadable text.
    const scale = Math.min(1.5, 1400 / bitmap.width),
      width = Math.round(bitmap.width * scale),
      tileHeight = 1600,
      overlap = 160;
    const height = Math.round(bitmap.height * scale),
      regions = [];
    for(const pass of (lang==="jpn"?["jpn","jpn_vert"]:[lang])) {
    const worker=await getWorker(pass);
    await worker.setParameters({tessedit_pageseg_mode:pass==="jpn_vert"?"5":"11"});
    for (let top = 0; top < height; top += tileHeight - overlap) {
      const h = Math.min(tileHeight, height - top),
        canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = h;
      canvas
        .getContext("2d")
        .drawImage(
          bitmap,
          0,
          top / scale,
          bitmap.width,
          h / scale,
          0,
          0,
          width,
          h
        );
      let result;
      try {
        result = await deadline(
          worker.recognize(canvas, {}, { text: true, blocks: true }),
          45000,
          "ocr_timeout"
        );
      } catch (error) {
        await worker.terminate();
        workerPromise = null;
        throw error;
      }
      const { data } = result;
      for (const r of textRegions(data)) {
        r.orientation=pass==="jpn_vert"?"vertical":"horizontal";
        // Tesseract separates CJK glyphs as words; Japanese/Chinese prose does not.
        if(lang==='jpn'||lang==='jpn_vert'||lang==='chi_sim')r.text=r.text.replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,'');
        const bbox = {
          x0: r.bbox.x0 / scale,
          y0: (r.bbox.y0 + top) / scale,
          x1: r.bbox.x1 / scale,
          y1: (r.bbox.y1 + top) / scale,
        };
        if (
          regions.some(
            p =>
              p.text === r.text &&
              Math.abs(p.bbox.y0 - bbox.y0) < overlap / scale
          )
        )
          continue;
        if(pass==="jpn_vert"){
          const overlap=regions.filter(p=>{const a=p.bbox;const intersection=Math.max(0,Math.min(a.x1,bbox.x1)-Math.max(a.x0,bbox.x0))*Math.max(0,Math.min(a.y1,bbox.y1)-Math.max(a.y0,bbox.y0));return intersection>0.45*Math.min((a.x1-a.x0)*(a.y1-a.y0),(bbox.x1-bbox.x0)*(bbox.y1-bbox.y0));});
          if(overlap.some(p=>(p.confidence||0)>=(r.confidence||0)))continue;
          for(const old of overlap)regions.splice(regions.indexOf(old),1);
        }
        const context = canvas.getContext("2d");
        const sample = context.getImageData(
          Math.max(0, Math.min(width - 1, Math.round(r.bbox.x0) - 3)),
          Math.max(0, Math.min(h - 1, Math.round(r.bbox.y0) - 3)),
          1,
          1
        ).data;
        const light = sample[0] * 0.299 + sample[1] * 0.587 + sample[2] * 0.114;
        regions.push({
          ...r,
          bbox,
          background: light < 110 ? "#202026" : "#ffffff",
          foreground: light < 110 ? "#ffffff" : "#171923",
        });
      }
      canvas.width = canvas.height = 1;
      if (top + h >= height) break;
    }
    }
    return {
      blocks: regions,
      width: bitmap.width,
      height: bitmap.height,
      lines: regions.map(r => r.text),
    };
  } finally {
    bitmap.close();
  }
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type !== "OCR_OFFSCREEN" || sender.id !== chrome.runtime.id) return;
  const job = jobQueue.then(() => recognizePanel(msg.dataUrl, msg.lang));
  jobQueue = job.catch(() => {});
  job.then(
    data => respond({ ok: true, ...data }),
    e => respond({ ok: false, error: String(e.message || e) })
  );
  return true;
});
