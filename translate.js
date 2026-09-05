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
  const askImage = (url, code) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "TRANSLATE_IMAGE", url, code }, (r) => { void chrome.runtime.lastError; resolve(r || { ok: false }); });
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

  // Translate panels with a small concurrency pool so a full chapter finishes in
  // reasonable time without hammering the service.
  async function translateImages(lang, textCount) {
    textCount = textCount || 0;
    const code = MIT_LANG[lang] || MIT_LANG[String(lang || "").slice(0, 2)] || "ENG";
    setPill(`<span>Yomu — finding panels…</span> ${link("dasi-tr-x", "stop")}`); bindStop();
    await warmPanels();
    if (cancelled) return;
    const imgs = largePanels().slice(0, 60);
    if (!imgs.length) { donePill(textCount, 0, lang); return; }
    let done = 0, ok = 0, lastErr = "";
    const total = imgs.length;
    const tick = () => setPill(`<span>Yomu — translating panels ${done}/${total}… (${ok} done)</span> ${link("dasi-tr-x", "stop")}`);
    tick(); bindStop();
    const POOL = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < imgs.length && !cancelled) {
        const im = imgs[cursor++];
        im.dataset.dasiTr = "1";
        const r = await askImage(realSrc(im), code);
        if (r && r.ok && r.dataUrl) {
          if (!imgOriginals.has(im)) imgOriginals.set(im, im.src);
          try { im.removeAttribute("srcset"); im.src = r.dataUrl; ok++; } catch (e) {}
        } else if (r && r.error) { lastErr = r.error; }
        done++; tick(); bindStop();
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL, imgs.length) }, worker));
    if (cancelled) { donePill(textCount, ok, lang); return; }
    if (ok) { donePill(textCount, ok, lang); return; }
    // Panels were found but NONE translated. Surface this even if page text was
    // translated, so the user is never told "done" while bubbles stay untranslated.
    imageFailPill(lastErr, textCount, lang);
  }

  function bindStop() { const x = document.getElementById("dasi-tr-x"); if (x) x.onclick = (e) => { e.preventDefault(); cancelled = true; }; }
  function closePill() { const x = document.getElementById("dasi-tr-x"); if (x) x.onclick = (e) => { e.preventDefault(); removePill(); }; }
  // Explain WHY image translation produced nothing, and how to make it reliable.
  // If page TEXT was translated, keep a revert link and note it, but never hide
  // that the manga panels themselves could not be translated.
  function imageFailPill(err, textCount, lang) {
    const down = !imgServer; // no server configured → public service (often offline)
    const why = down
      ? "manga panels need the OCR server — enable it in Settings → Manga image translation (free, ~2 min)"
      : `the translation server didn't respond${err ? " (" + err + ")" : ""} — check the URL in Settings`;
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
      if (m.type === "DASI_TRANSLATE") { imgServer = m.imgServer || ""; translate(m.lang); resp && resp({ ok: true }); return true; }
      if (m.type === "DASI_TRANSLATE_REVERT") { revert(); resp && resp({ ok: true }); return true; }
      return false;
    });
  }
})();
