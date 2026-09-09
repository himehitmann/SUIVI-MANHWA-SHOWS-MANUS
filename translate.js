/* One-click translation in place. OCR runs in the bundled offscreen worker.
 * Originals and page layout are preserved; Stop cancels pending UI updates. */
(() => {
  if (window.__yomuTranslationInstalled) return;
  window.__yomuTranslationInstalled = true;
  let run = 0,
    pill = null,
    retryFailed = null,
    observer = null,
    mutation = null,
    resize = null,
    frame = 0;
  const originals = new Map(),
    overlays = new Map(),
    processed = new WeakMap();
  const SKIP =
    "script,style,noscript,iframe,code,pre,textarea,input,select,svg,canvas,button,[contenteditable],#yomu-translation-status,[data-yomu-overlay]";
  const isFrench = () =>
    document.documentElement.lang.startsWith("fr") ||
    (navigator.language || "").startsWith("fr");
  const wording = (fr, en) => (isFrench() ? fr : en);
  const request = message =>
    new Promise((resolve, reject) =>
      chrome.runtime.sendMessage(message, result => {
        const error = chrome.runtime.lastError;
        if (error || !result || result.ok === false)
          reject(
            new Error(result?.error || error?.message || "translation_failed")
          );
        else resolve(result);
      })
    );
  function status(message) {
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "yomu-translation-status";
      pill.setAttribute("role", "status");
      pill.style.cssText =
        "position:fixed;z-index:2147483647;bottom:18px;right:18px;max-width:min(520px,90vw);display:flex;gap:16px;align-items:center;background:#241f33;color:white;border-radius:14px;padding:14px 18px;font:500 14px/1.45 system-ui;box-shadow:0 8px 32px #0004";
      const text = document.createElement("span");
      text.id = "yomu-translation-message";
      pill.append(text);
      const stop = document.createElement("button");
      stop.textContent = wording("Restaurer", "Restore");
      stop.style.cssText =
        "border:0;border-radius:8px;padding:9px;background:#efe9ff;color:#352859;cursor:pointer;font:600 13px system-ui";
      stop.onclick = restore;
      pill.append(stop);
      const retry = stop.cloneNode(true);
      retry.id = "yomu-translation-retry";
      retry.textContent = wording("Réessayer", "Retry");
      retry.hidden = true;
      retry.onclick = () => retryFailed?.();
      pill.append(retry);
      document.documentElement.append(pill);
    }
    pill.querySelector("span").textContent = message;
  }
  function restore() {
    ++run;
    retryFailed = null;
    observer?.disconnect();
    mutation?.disconnect();
    resize?.disconnect();
    observer = mutation = resize = null;
    originals.forEach((text, node) => {
      if (node.isConnected) node.nodeValue = text;
    });
    originals.clear();
    overlays.forEach(({ el }) => el.remove());
    overlays.clear();
    pill?.remove();
    pill = null;
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
  }
  function sourceLanguage(override) {
    if (override) return override;
    const lang = (document.documentElement.lang || "").toLowerCase();
    if(lang.startsWith("fr")||/webtoons\.com$/.test(location.hostname)&&location.pathname.startsWith("/fr/"))return "fra";
    if (lang.startsWith("ko")) return "kor";
    if (lang.startsWith("ja")) return "jpn";
    if (lang.startsWith("zh")) return "chi_sim";
    if (/naver|kakao|lezhin|bomtoon/.test(location.hostname)) return "kor";
    if (/bilibili|kuaikan|qq\.com/.test(location.hostname)) return "chi_sim";
    if(/shonenjump|comic-walker|mangaplus/.test(location.hostname))return "jpn";
    return "eng";
  }
  function imageSource(im) {
    const lazy = im.dataset.src || im.dataset.original || im.dataset.lazySrc || im.dataset.url;
    const current = im.currentSrc || im.src;
    if (
      lazy &&
      (!im.naturalWidth ||
        /placeholder|blank|spacer|^data:image\/gif/i.test(current))
    )
      return new URL(lazy, location.href).href;
    return current || (lazy ? new URL(lazy, location.href).href : "");
  }
  function isPanel(im) {
    if (im.closest("header,nav,footer,[data-yomu-overlay]")) return false;
    const r = im.getBoundingClientRect();
    return r.width >= 180 && (r.height >= 200 || im.naturalHeight >= 260);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      overlays.forEach(({ el, width, height }, im) => {
        if (!im.isConnected) {
          el.remove();
          overlays.delete(im);
          return;
        }
        const r = im.getBoundingClientRect();
        el.style.left = r.left + "px";
        el.style.top = r.top + "px";
        el.style.width = width + "px";
        el.style.height = height + "px";
        el.style.transform = `scale(${r.width / width},${r.height / height})`;
        el.style.visibility =
          r.bottom < 0 || r.top > innerHeight ? "hidden" : "visible";
      });
    });
  }
  function applyRegions(im, result, target) {
    overlays.get(im)?.el.remove();
    const el = document.createElement("div");
    el.dataset.yomuOverlay = "";
    el.lang = target;
    el.style.cssText =
      "position:fixed;z-index:2147483000;pointer-events:none;transform-origin:0 0;overflow:hidden";
    for (const region of result.blocks || []) {
      if (
        !region.translation ||
        region.translation.trim() === region.text.trim()
      )
        continue;
      const b = region.renderBox || region.bbox,
        padding = region.renderBox ? 0 : 3,
        w = Math.max(12, b.x1 - b.x0 + padding * 2),
        h = Math.max(12, b.y1 - b.y0 + padding * 2);
      const box = document.createElement("div");
      box.setAttribute("aria-label", region.translation);
      box.dir = "auto";
      box.style.cssText = `position:absolute;left:${Math.max(0, b.x0 - padding)}px;top:${Math.max(0, b.y0 - padding)}px;width:${w}px;height:${h}px;box-sizing:border-box;background:${region.background || "#fff"};color:${region.foreground || "#171923"};padding:2px;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;white-space:normal;overflow-wrap:anywhere;font-family:system-ui,sans-serif;font-weight:600;line-height:1.08;`;
      const tx = document.createElement("span");
      tx.textContent = region.translation;
      tx.style.cssText="display:block;min-width:0;max-width:100%;width:100%;margin:0;padding:0;font:inherit;color:inherit;white-space:normal;overflow-wrap:anywhere;";
      box.append(tx);
      el.append(box);
      let font = Math.min(
        36,
        Math.max(
          8,
          Math.sqrt(((w * h) / Math.max(1, region.translation.length)) * 1.5)
        )
      );
      box.style.fontSize = font + "px";
    }
    document.documentElement.append(el);
    // Fit after insertion, using measured line wrapping rather than character guesses.
    for (const box of el.children) {
      let size = parseFloat(box.style.fontSize);
      while (
        size > 6 &&
        (box.firstChild.scrollHeight > box.clientHeight - 3 ||
          box.firstChild.scrollWidth > box.clientWidth - 3)
      ) {
        size -= 0.5;
        box.style.fontSize = size + "px";
      }
    }
    overlays.set(im, {
      el,
      width: result.width || im.naturalWidth,
      height: result.height || im.naturalHeight,
    });
    resize.observe(im);
    schedule();
  }
  async function translate(target, override) {
    restore();
    const token = run,
      src = sourceLanguage(override);
    let done = 0,
      failed = 0,
      empty = 0,
      lastError = "",
      active = 0;
    const queue = [];
    const failures = new Set();
    retryFailed = () => {
      if (run !== token || active) return;
      const pending = [...failures]; failures.clear(); failed = 0; lastError = "";
      for (const im of pending) { processed.delete(im); if (im.isConnected) enqueue(im); }
      progress();
    };
    status(wording("Yomu — traduction en cours…", "Yomu — translating…"));
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const p = node.parentElement;
          return p &&
            !p.closest(SKIP) &&
            (node.nodeValue || "").trim().length > 2 &&
            p.getClientRects().length
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );
    const nodes = [];
    while (walker.nextNode() && nodes.length < 300)
      nodes.push(walker.currentNode);
    // DOM translation and image OCR progress independently. A slow menu never blocks a panel.
    if (nodes.length)
      request({ type: "DASI_MT", texts: nodes.map(n => n.nodeValue), target })
        .then(r => {
          if (run !== token) return;
          r.translations.forEach((text, i) => {
            if (text && nodes[i]?.isConnected) {
              originals.set(nodes[i], nodes[i].nodeValue);
              nodes[i].nodeValue = text;
            }
          });
        })
        .catch(() => {
          if (run === token && !done)
            status(
              wording(
                "Traduction du texte indisponible. Les images sont traitées séparément.",
                "Text translation unavailable. Image translation continues."
              )
            );
        });
    resize = new ResizeObserver(schedule);
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    function progress() {
      if (run !== token) return;
      const retry = document.getElementById("yomu-translation-retry");
      if (retry) {retry.hidden = !failures.size; retry.disabled = !!active;}
      status(
        active
          ? wording(
              "Yomu — lecture et traduction des bulles…",
              "Yomu — reading and translating speech bubbles…"
            )
          : failed
            ? wording(
                `${done} image(s) traduite(s). ${failed} échec(s) (${lastError}) : réessaie les images échouées.`,
                `${done} image(s) translated. ${failed} failed (${lastError}): retry the failed images.`
              )
            : done
              ? wording(
                  `${done} image(s) traduite(s) — poursuis ta lecture.`,
                  `${done} image(s) translated — keep reading.`
                )
              : wording(
                  "Aucun texte lisible détecté pour le moment.",
                  "No readable text detected yet."
                )
      );
    }
    async function drain() {
      if (active || run !== token) return;
      active = 1;
      while (queue.length && run === token) {
        const im = queue.shift();
        progress();
        try {
          const source = imageSource(im);
          if (!source) continue;
          const result = await request({
            type: "TRANSLATE_IMAGE_TEXT",
            url: source,
            target,
            src,
          });
          if (run !== token) return;
          if (imageSource(im) !== source) continue;
          failures.delete(im); failed = failures.size;
          if (result.blocks?.length) {
            applyRegions(im, result, target);
            done++;
          } else empty++;
        } catch (e) {
          if (run === token) {failures.add(im);failed=failures.size;lastError=String(e.message||e).slice(0,120);}
        }
      }
      active = 0;
      progress();
    }
    function enqueue(im) {
      const key = `${token}:${imageSource(im)}`;
      if (processed.get(im) === key) return;
      overlays.get(im)?.el.remove(); overlays.delete(im);
      processed.set(im, key);
      queue.push(im);
      drain();
    }
    observer = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) enqueue(e.target);
        }),
      { rootMargin: "250px 0px" }
    );
    function scan() {
      if (run !== token) return;
      for (const im of document.images) if (isPanel(im)) observer.observe(im);
    }
    mutation = new MutationObserver(records => {
      if (
        records.some(
          r =>
            !r.target.closest?.("[data-yomu-overlay],#yomu-translation-status")
        )
      ) {
        scan();
        for (const record of records) {
          const im = record.target;
          if (record.type !== "attributes" || !(im instanceof HTMLImageElement) || !isPanel(im)) continue;
          const r = im.getBoundingClientRect();
          if (r.bottom >= -250 && r.top <= innerHeight + 250) enqueue(im);
        }
      }
    });
    mutation.observe(document.body, { childList: true, subtree: true, attributes:true, attributeFilter:["src","srcset","data-src","data-original","data-lazy-src","data-url"] });
    scan();
    if (![...document.images].some(isPanel))
      status(
        wording(
          "Yomu — traduction du texte. Aucune image de lecture détectée.",
          "Yomu — translating text. No reading images detected."
        )
      );
  }
  chrome.runtime.onMessage.addListener((m, _sender, respond) => {
    if (m?.type === "DASI_TRANSLATE") {
      translate(m.lang || "en", m.src || "").catch(() =>
        status(
          wording(
            "Traduction impossible. Restaure puis réessaie.",
            "Translation failed. Restore and try again."
          )
        )
      );
      respond({ ok: true, started: true });
    }
    if (m?.type === "DASI_TRANSLATE_REVERT") {
      restore();
      respond({ ok: true });
    }
  });
})();
