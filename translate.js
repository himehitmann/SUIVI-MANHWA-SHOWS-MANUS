/*
 * Yomu in-page translator — injected on demand (activeTab) when you press
 * "Translate" in the popup. It collects the visible text on the current page
 * (manga/webtoon reader, novel, drama page, store page…), asks the background
 * to translate it into your chosen language, and swaps it in place with a
 * floating "translated / revert" pill. Fully optional and local-first: nothing
 * runs unless you ask, and one click restores the original text.
 *
 * Text-based pages (real characters in the DOM — many Japanese/Korean/Chinese
 * webtoons and novels) translate directly. Image-only scanlations have no text
 * to read, so the pill says so; picture translation would need the optional
 * Yomu translation server (OCR) and is out of scope for the local path.
 */
(() => {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "SVG", "CANVAS", "BUTTON"]);
  const originals = new Map(); // textNode -> original string
  const imgOriginals = new Map(); // img element -> original src
  let pill = null;
  let imgServer = "";
  let cancelled = false;

  // 2-letter UI language → manga-image-translator target code.
  const MIT_LANG = { en: "ENG", fr: "FRA", es: "ESP", de: "DEU", it: "ITA", pt: "PTB", ru: "RUS", uk: "UKR", pl: "PLK", tr: "TRK", ar: "ARA", vi: "VIN", th: "THA", id: "IND", ja: "JPN", ko: "KOR", "zh-CN": "CHS", "zh-TW": "CHT", nl: "NLD", hu: "HUN", cs: "CSY", ro: "ROM" };

  const hasLetters = (s) => /[^\s\d\p{P}\p{S}]/u.test(s);

  function collect() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const s = (n.nodeValue || "").trim();
        if (s.length < 2 || !hasLetters(s)) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || SKIP.has(p.tagName) || p.closest("#dasi-tr-pill")) return NodeFilter.FILTER_REJECT;
        if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
        const st = window.getComputedStyle(p);
        if (st.display === "none" || st.visibility === "hidden") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes.slice(0, 500);
  }

  function ensurePill() {
    if (pill) return;
    pill = document.createElement("div");
    pill.id = "dasi-tr-pill";
    pill.style.cssText =
      "position:fixed;z-index:2147483647;bottom:18px;right:18px;background:#241F33;color:#fff;" +
      "font:600 13px/1.2 system-ui,-apple-system,sans-serif;padding:11px 15px;border-radius:13px;" +
      "box-shadow:0 12px 34px rgba(0,0,0,.4);display:flex;gap:12px;align-items:center;max-width:80vw";
    document.documentElement.appendChild(pill);
  }
  function setPill(html) { ensurePill(); pill.innerHTML = html; }
  function link(id, label) { return `<a href="#" id="${id}" style="color:#8AD3C0;text-decoration:none;font-weight:700">${label}</a>`; }
  function removePill() { if (pill) { pill.remove(); pill = null; } }

  function revert() {
    cancelled = true;
    originals.forEach((txt, node) => { try { node.nodeValue = txt; } catch (e) {} });
    originals.clear();
    imgOriginals.forEach((src, im) => { try { im.src = src; } catch (e) {} });
    imgOriginals.clear();
    // Clear ALL panel markers (incl. ones that failed) so a fresh run re-attempts.
    document.querySelectorAll("img[data-dasi-tr]").forEach((im) => im.removeAttribute("data-dasi-tr"));
    if (sideObs) { try { sideObs.disconnect(); } catch (e) {} sideObs = null; }
    if (sideEl) { sideEl.remove(); sideEl = null; }
    sideCount = 0; sideOk = 0;
    removePill();
  }

  /*
   * Manga / webtoon IMAGE translation. When the page is image-based (nothing
   * translatable as text) and an image-translation server is configured
   * (Settings → Integrations: a manga-image-translator instance, self-hosted or
   * shared), Yomu sends each large panel's URL to it and swaps in the translated
   * image the server returns. Mirrors how manga-image-translator / cotrans work,
   * but driven from the extension. Requires the server to allow CORS.
   */
  // Source language for OCR. The user can force it from the popup (srcOverride);
  // otherwise we guess from the host.
  let srcOverride = "";
  function srcGuess() {
    if (srcOverride) return srcOverride;
    const h = (location.host + location.pathname).toLowerCase();
    if (/naver|kakao|webtoon|manhwa|lezhin|bomtoon|kr[.\/]/.test(h)) return "kor";
    if (/bilibili|manhua|qq\.com|dongman|kuaikan|ac\.qq|zh[-.]/.test(h)) return "chs";
    return "jpn";
  }
  const askImage = (url, code, target) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "TRANSLATE_IMAGE", url, code, target, src: srcGuess() }, (r) => { void chrome.runtime.lastError; resolve(r || { ok: false }); });
  });

  // Resolve the real source of a (possibly lazy-loaded) panel image.
  function realSrc(im) {
    const cand = im.currentSrc || im.src || im.dataset.src || im.dataset.original || im.dataset.lazySrc || im.getAttribute("data-srcset") || "";
    if (cand && !/^data:image\/(gif|svg)/i.test(cand) && !/1x1|spacer|blank|placeholder/i.test(cand)) return cand;
    // fall back to the largest entry in srcset
    const ss = im.getAttribute("srcset") || im.dataset.srcset || "";
    if (ss) { const last = ss.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).pop(); if (last) return last; }
    return im.src || "";
  }
  // A "panel" is a content image big enough to hold speech bubbles. We check the
  // natural size when known, else the rendered box (covers lazy images whose
  // natural size is 0 until scrolled into view).
  function isPanel(im) {
    if (im.dataset.dasiTr) return false;
    const nw = im.naturalWidth || 0, nh = im.naturalHeight || 0;
    if (nw && nh) return nw >= 200 && nh >= 260 && !(nw < 120 || nh < 120);
    const r = im.getBoundingClientRect();
    return r.width >= 180 && r.height >= 240;
  }
  const largePanels = () => {
    const seen = new Set();
    return [...document.images]
      .filter(isPanel)
      .filter((im) => { const s = realSrc(im); if (!s || seen.has(s)) return false; seen.add(s); return true; })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  };

  // Nudge lazy readers to load their images, then wait briefly for natural sizes.
  async function warmPanels() {
    const before = document.images.length;
    document.querySelectorAll("img[loading='lazy'],img[data-src],img[data-original]").forEach((im) => {
      try { im.loading = "eager"; if (!im.src && im.dataset.src) im.src = im.dataset.src; } catch (e) {}
    });
    window.scrollTo(0, Math.min(document.body.scrollHeight, window.scrollY + window.innerHeight * 3));
    await new Promise((r) => setTimeout(r, 600));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
    void before;
  }

  // Ask the background for the OCR'd + translated LINES of one panel image.
  const askImageText = (url, target) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "TRANSLATE_IMAGE_TEXT", url, target, src: srcGuess() }, (r) => { void chrome.runtime.lastError; resolve(r || { ok: false }); });
  });

  // Side-panel reader: as you scroll, each manga/webtoon panel is OCR'd and its
  // translation appears in a panel on the right — one-click, nothing to install.
  let sideEl = null, sideObs = null, sideCount = 0, sideOk = 0;
  function openSide(lang) {
    if (sideEl) return;
    sideEl = document.createElement("div");
    sideEl.id = "dasi-tr-side";
    sideEl.style.cssText =
      "position:fixed;z-index:2147483646;top:64px;right:14px;width:330px;max-height:80vh;overflow-y:auto;" +
      "background:#1E1A2B;color:#EFEAF8;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.5);" +
      "font:13px/1.5 system-ui,-apple-system,sans-serif;padding:0;";
    sideEl.innerHTML =
      `<div style="position:sticky;top:0;background:#17131f;padding:12px 14px;display:flex;align-items:center;gap:8px;border-radius:16px 16px 0 0;border-bottom:1px solid #2c2640">
        <b style="font-size:13px;flex:1">Yomu — ${String(lang || "EN").toUpperCase()}</b>
        <a href="#" id="dasi-side-close" style="color:#9f8cf0;text-decoration:none;font-weight:700;font-size:12px">close</a>
       </div><div id="dasi-side-body" style="padding:10px 12px 14px"></div>`;
    document.documentElement.appendChild(sideEl);
    const c = sideEl.querySelector("#dasi-side-close");
    if (c) c.onclick = (e) => { e.preventDefault(); revert(); };
  }
  function sideStatus(msg) {
    const body = sideEl && sideEl.querySelector("#dasi-side-body");
    if (!body) return;
    let s = body.querySelector("#dasi-side-status");
    if (!s) { s = document.createElement("div"); s.id = "dasi-side-status"; s.style.cssText = "color:#9990ad;font-size:11.5px;padding:6px 2px"; body.appendChild(s); }
    s.textContent = msg;
  }
  function addSideEntry(n, lines) {
    const body = sideEl && sideEl.querySelector("#dasi-side-body");
    if (!body) return;
    const status = body.querySelector("#dasi-side-status");
    const e = document.createElement("div");
    e.style.cssText = "padding:10px 0;border-top:1px solid #2c2640";
    e.innerHTML = `<div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#7d7396;text-transform:uppercase;margin-bottom:4px">#${n}</div>` +
      lines.map((l) => `<div style="margin-bottom:7px"><div style="font-weight:600">${escHtml(l.tr)}</div><div style="font-size:11px;color:#8f86a6">${escHtml(l.src)}</div></div>`).join("");
    if (status) body.insertBefore(e, status); else body.appendChild(e);
  }
  function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  async function translateImages(lang, textCount) {
    textCount = textCount || 0;
    setPill(`<span>Yomu — reading panels…</span> ${link("dasi-tr-x", "stop")}`); bindStop();
    await warmPanels();
    if (cancelled) return;
    const imgs = largePanels();
    if (!imgs.length) { donePill(textCount, 0, lang); return; }
    openSide(lang);
    sideStatus("Translating on your device — the first panel can take a few seconds…");
    setPill(`<span>Yomu — translations appear on the right as you scroll →</span> ${link("dasi-tr-revert", "revert")}`);
    const rb = document.getElementById("dasi-tr-revert"); if (rb) rb.onclick = (e) => { e.preventDefault(); revert(); };
    let n = 0, active = 0, miss = 0;
    const target = String(lang || "en").slice(0, 5);
    const processed = new WeakSet();
    function status() {
      if (cancelled) return;
      if (active > 0) sideStatus(`Reading panel ${sideCount}…`);
      else if (sideOk) sideStatus("Scroll down to translate the next panels →");
      else sideStatus("No readable text found yet — keep scrolling through the chapter.");
    }
    async function handle(im) {
      if (processed.has(im) || cancelled) return;
      processed.add(im); im.dataset.dasiTr = "1";
      active++; sideCount++;
      const my = sideCount;
      status();
      const r = await askImageText(realSrc(im), target);
      active--;
      if (r && r.ok && r.lines && r.lines.length) { sideOk++; addSideEntry(my, r.lines); }
      else miss++;
      status();
    }
    // Observe panels; translate each as it scrolls into view (progressive).
    sideObs = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) handle(en.target);
    }, { rootMargin: "200px 0px" });
    imgs.forEach((im) => sideObs.observe(im));
    // Kick off the ones already on screen right away.
    imgs.filter((im) => { const r = im.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).slice(0, 4).forEach(handle);
    void active; void n;
  }

  function bindStop() { const x = document.getElementById("dasi-tr-x"); if (x) x.onclick = (e) => { e.preventDefault(); cancelled = true; }; }
  function closePill() { const x = document.getElementById("dasi-tr-x"); if (x) x.onclick = (e) => { e.preventDefault(); removePill(); }; }
  // Explain WHY image translation produced nothing, and how to make it reliable.
  // If page TEXT was translated, keep a revert link and note it, but never hide
  // that the manga panels themselves could not be translated.
  function imageFailPill(err, textCount, lang) {
    const busy = /429|rate|limit|timeout|ocr_/i.test(err || "");
    const why = busy
      ? "the translation service is busy — try again in a moment"
      : "couldn't read the text in these panels";
    const prefix = textCount ? `translated ${textCount} text, but ` : "";
    const revert = textCount ? ` ${link("dasi-tr-revert", "revert")}` : ` ${link("dasi-tr-x", "close")}`;
    setPill(`<span>Yomu — ${prefix}${why}.</span>${revert}`);
    if (textCount) { const r = document.getElementById("dasi-tr-revert"); if (r) r.onclick = (e) => { e.preventDefault(); revert(); }; }
    else closePill();
    void lang;
  }
  function donePill(textCount, panelCount, lang) {
    const parts = [];
    if (textCount) parts.push(`${textCount} text`);
    if (panelCount) parts.push(`${panelCount} panels`);
    if (!parts.length) { setPill(`<span>Yomu — nothing translatable found (try scrolling so panels load, then retry).</span> ${link("dasi-tr-x", "close")}`); closePill(); return; }
    setPill(`<span>Yomu · translated ${parts.join(" + ")} → ${String(lang).toUpperCase()}</span> ${link("dasi-tr-revert", "revert")}`);
    document.getElementById("dasi-tr-revert").onclick = (e) => { e.preventDefault(); revert(); };
  }

  // Are there any images that COULD be panels (loaded or lazy)? Cheap pre-check
  // so pure-text pages skip the panel-warming delay.
  function hasPanelCandidates() {
    if (largePanels().length) return true;
    return !!document.querySelector("img[loading='lazy'],img[data-src],img[data-original],img[data-lazy-src]");
  }
  function translate(lang) {
    cancelled = false;
    const nodes = collect();
    const mayHavePanels = hasPanelCandidates();
    // Manga/webtoon pages are mostly IMAGES; a bit of site-chrome text is not the
    // content. So we translate BOTH: the DOM text, then the image panels (OCR).
    const doPanels = (textCount) => {
      if (!mayHavePanels) { donePill(textCount, 0, lang); return; }
      translateImages(lang, textCount);
    };
    if (!nodes.length) { doPanels(0); return; }
    setPill(`<span>Yomu — translating text…</span>`);
    const texts = nodes.map((n) => n.nodeValue);
    chrome.runtime.sendMessage({ type: "DASI_MT", texts, target: lang }, (res) => {
      void chrome.runtime.lastError;
      let changed = 0;
      if (res && res.ok) {
        res.translations.forEach((tx, i) => {
          const node = nodes[i];
          if (tx && node && tx !== node.nodeValue) {
            if (!originals.has(node)) originals.set(node, node.nodeValue);
            try { node.nodeValue = tx; changed++; } catch (e) {}
          }
        });
      }
      doPanels(changed);
    });
  }

  window.__dasiTranslate = translate;
  if (!window.__dasiTranslateBound) {
    window.__dasiTranslateBound = true;
    chrome.runtime.onMessage.addListener((m, _s, resp) => {
      if (m.type === "DASI_TRANSLATE") { imgServer = m.imgServer || ""; srcOverride = m.src || ""; translate(m.lang); resp && resp({ ok: true }); return true; }
      if (m.type === "DASI_TRANSLATE_REVERT") { revert(); resp && resp({ ok: true }); return true; }
      return false;
    });
  }
})();
