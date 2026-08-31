/*
 * Dasi in-page translator — injected on demand (activeTab) when you press
 * "Translate" in the popup. It collects the visible text on the current page
 * (manga/webtoon reader, novel, drama page, store page…), asks the background
 * to translate it into your chosen language, and swaps it in place with a
 * floating "translated / revert" pill. Fully optional and local-first: nothing
 * runs unless you ask, and one click restores the original text.
 *
 * Text-based pages (real characters in the DOM — many Japanese/Korean/Chinese
 * webtoons and novels) translate directly. Image-only scanlations have no text
 * to read, so the pill says so; picture translation would need the optional
 * Dasi translation server (OCR) and is out of scope for the local path.
 */
(() => {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "SVG", "CANVAS", "BUTTON"]);
  const originals = new Map(); // textNode -> original string
  const imgOriginals = new Map(); // img element -> original src
  let pill = null;
  let imgServer = "";

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
    originals.forEach((txt, node) => { try { node.nodeValue = txt; } catch (e) {} });
    originals.clear();
    imgOriginals.forEach((src, im) => { try { im.src = src; im.removeAttribute("data-dasi-tr"); } catch (e) {} });
    imgOriginals.clear();
    removePill();
  }

  /*
   * Manga / webtoon IMAGE translation. When the page is image-based (nothing
   * translatable as text) and an image-translation server is configured
   * (Settings → Integrations: a manga-image-translator instance, self-hosted or
   * shared), Dasi sends each large panel's URL to it and swaps in the translated
   * image the server returns. Mirrors how manga-image-translator / cotrans work,
   * but driven from the extension. Requires the server to allow CORS.
   */
  async function translateImages(lang) {
    const code = MIT_LANG[lang] || MIT_LANG[String(lang || "").slice(0, 2)] || "ENG";
    const base = imgServer.replace(/\/+$/, "");
    const imgs = [...document.images].filter((im) => im.naturalWidth > 240 && im.naturalHeight > 240 && !im.dataset.dasiTr);
    if (!imgs.length) {
      setPill(`<span>Dasi — no manga panels found on this page.</span> ${link("dasi-tr-x", "close")}`);
      const x = document.getElementById("dasi-tr-x"); if (x) x.onclick = (e) => { e.preventDefault(); removePill(); };
      return;
    }
    let done = 0, ok = 0;
    setPill(`<span>Dasi — translating ${imgs.length} panels…</span>`);
    for (const im of imgs) {
      im.dataset.dasiTr = "1";
      try {
        const res = await fetch(`${base}/translate/with-url/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: im.currentSrc || im.src, config: { translator: { translator: "google", target_lang: code } } }),
        });
        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.type.indexOf("image") === 0) {
            if (!imgOriginals.has(im)) imgOriginals.set(im, im.src);
            im.srcset = "";
            im.src = URL.createObjectURL(blob);
            ok++;
          }
        }
      } catch (e) { /* server unreachable / CORS */ }
      done++;
      setPill(`<span>Dasi — translating panels ${done}/${imgs.length}…</span>`);
    }
    if (ok) {
      setPill(`<span>Dasi · ${ok} panels translated → ${String(lang).toUpperCase()}</span> ${link("dasi-tr-revert", "revert")}`);
      document.getElementById("dasi-tr-revert").onclick = (e) => { e.preventDefault(); revert(); };
    } else {
      setPill(`<span>Dasi — image translation failed. Check the server URL &amp; that it allows CORS.</span> ${link("dasi-tr-x", "close")}`);
      const x = document.getElementById("dasi-tr-x"); if (x) x.onclick = (e) => { e.preventDefault(); removePill(); };
    }
  }

  function translate(lang) {
    const nodes = collect();
    if (!nodes.length) {
      // No readable text → image-based. Fall back to image translation if a
      // server is configured; otherwise say so.
      if (imgServer) { translateImages(lang); return; }
      setPill(`<span>Dasi — image-based page. Add a manga-image-translator server in Settings to translate panels.</span> ${link("dasi-tr-x", "close")}`);
      document.getElementById("dasi-tr-x").onclick = (e) => { e.preventDefault(); removePill(); };
      return;
    }
    setPill(`<span>Dasi — translating ${nodes.length} blocks…</span>`);
    const texts = nodes.map((n) => n.nodeValue);
    chrome.runtime.sendMessage({ type: "DASI_MT", texts, target: lang }, (res) => {
      void chrome.runtime.lastError;
      if (!res || !res.ok) {
        setPill(`<span>Dasi — translation unavailable.</span> ${link("dasi-tr-x", "close")}`);
        const x = document.getElementById("dasi-tr-x");
        if (x) x.onclick = (e) => { e.preventDefault(); removePill(); };
        return;
      }
      let changed = 0;
      res.translations.forEach((tx, i) => {
        const node = nodes[i];
        if (tx && node && tx !== node.nodeValue) {
          if (!originals.has(node)) originals.set(node, node.nodeValue);
          try { node.nodeValue = tx; changed++; } catch (e) {}
        }
      });
      if (!changed) {
        // Text came back unchanged → likely the real content is in images.
        // Translate panels if a server is configured.
        if (imgServer) { translateImages(lang); return; }
        setPill(`<span>Dasi — couldn't translate this page (it looks image-based).</span> ${link("dasi-tr-x", "close")}`);
        const x = document.getElementById("dasi-tr-x");
        if (x) x.onclick = (e) => { e.preventDefault(); removePill(); };
        return;
      }
      setPill(`<span>Dasi · translated ${changed} → ${String(lang).toUpperCase()}</span> ${link("dasi-tr-revert", "revert")}`);
      document.getElementById("dasi-tr-revert").onclick = (e) => { e.preventDefault(); revert(); };
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
