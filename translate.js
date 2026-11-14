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
    frame = 0,
    textTimer = 0;
  const originals = new Map(),
    overlays = new Map(),
    processed = new WeakMap();
  const SKIP =
    "script,style,noscript,iframe,code,pre,textarea,input,select,svg,canvas,button,[contenteditable],[hidden],[aria-hidden=\"true\"],[inert],#yomu-translation-status,[data-yomu-overlay]";
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
  async function requestPanel(im,source,target,src) {
    try {return await request({type:"TRANSLATE_IMAGE_TEXT",url:source,target,src});}
    catch(error) {
      // Some image CDNs require the normal page referrer. A content-script fetch
      // uses that referrer and still obeys the CDN's CORS policy.
      if(!["img_403","image_access_required"].includes(error.message) || !/^https?:/.test(source))throw error;
      // Reuse an already decoded panel only when the browser permits reading
      // its pixels. A tainted canvas is never bypassed.
      try {
        if(imageSource(im)===source && im.complete && im.naturalWidth>0 && im.naturalHeight>0 &&
          im.naturalWidth*im.naturalHeight<=16000000 && Math.max(im.naturalWidth,im.naturalHeight)<=16000) {
          const canvas=document.createElement("canvas");
          canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;
          canvas.getContext("2d").drawImage(im,0,0);
          const local=canvas.toDataURL("image/png");
          if(local.length<=35*1024*1024)return request({type:"TRANSLATE_IMAGE_TEXT",url:local,target,src});
        }
      }catch{} // Cross-origin pixels require the normal, scoped image access.
      let response;
      try {response=await fetch(source,{credentials:"omit",signal:AbortSignal.timeout(15000)});}
      catch {throw new Error("image_access_required");}
      if(!response.ok)throw new Error("img_"+response.status);
      const blob=await response.blob();
      if(blob.size>25*1024*1024)throw new Error("image_too_large");
      if(!blob.type.startsWith("image/"))throw new Error("not_an_image");
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("image_read_failed"));reader.readAsDataURL(blob);});
      return request({type:"TRANSLATE_IMAGE_TEXT",url:dataUrl,target,src});
    }
  }
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
    originals.forEach(({original,translated}, node) => {
      // A site may update a live node while translation is enabled. Restore only
      // the value Yomu still owns; never replace newer chapter or status text.
      if (node.isConnected && node.nodeValue === translated) node.nodeValue = original;
    });
    originals.clear();
    overlays.forEach(({ el }) => el.remove());
    overlays.clear();
    pill?.remove();
    pill = null;
    cancelAnimationFrame(frame);
    clearTimeout(textTimer);textTimer=0;
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
        /placeholder|blank|spacer|bg_transparency|^data:image\/gif/i.test(current))
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
          resize?.unobserve(im);
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
  // One message stays well below the worker's 10k-per-text / 60k-total
  // limits. Keep word separators and never split a UTF-16 surrogate pair.
  function splitNodeText(text) {
    const parts=[];
    let start=0;
    while(start<text.length) {
      let end=Math.min(start+8000,text.length),separator="";
      if(end<text.length) {
        const last=text.charCodeAt(end-1);
        if(last>=0xd800 && last<=0xdbff)end--;
        const candidate=text.slice(start,end);
        const boundary=[...candidate.matchAll(/\s+/g)].filter(match=>match.index>=candidate.length/2).pop();
        if(boundary){end=start+boundary.index;separator=boundary[0];}
      }
      parts.push({text:text.slice(start,end),separator});
      start=end+separator.length;
    }
    return parts;
  }
  async function translate(target, override) {
    restore();
    const token = run,
      src = sourceLanguage(override);
    let done = 0,
      failed = 0,
      empty = 0,
      lastError = "",
      active = 0,
      textActive = false,
      textDone = 0,
      textError = "",
      textCursor = 0;
    const textJobs = [];
    const textEntries = new WeakMap(), dirtyTextRoots = new Set();
    const queue = [];
    const failures = new Set();
    retryFailed = () => {
      if (run !== token || active || textActive) return;
      if(textError){textError="";drainText();}
      const pending = [...failures]; failures.clear(); failed = 0; lastError = "";
      for (const im of pending) { processed.delete(im); if (im.isConnected) enqueue(im); }
      progress();
    };
    status(wording("Yomu — traduction en cours…", "Yomu — translating…"));
    function eligibleText(node) {
      const parent=node.parentElement;
      return node.isConnected && parent && !parent.closest(SKIP) &&
        (node.nodeValue || "").trim().length>2 && parent.getClientRects().length &&
        getComputedStyle(parent).visibility==="visible";
    }
    function enqueueText(node) {
      const source=node.nodeValue,owned=originals.get(node),previous=textEntries.get(node);
      // A mutation caused by our own result (or moving the same translated node)
      // is not a new source text and must never be sent back to the provider.
      if(owned && source===owned.translated)return;
      if(previous && !previous.skipped && previous.remaining>0 && previous.source===source && eligibleText(node))return;
      if(previous)previous.skipped=true;
      originals.delete(node);textEntries.delete(node);
      if(!eligibleText(node))return;
      const parts=splitNodeText(source);
      const entry={node,source,remaining:parts.length,translated:[],skipped:false};
      textEntries.set(node,entry);
      parts.forEach((part,index)=>textJobs.push({entry,index,...part}));
    }
    function collectText(root) {
      if(run!==token || !root.isConnected)return;
      if(root.nodeType===Node.TEXT_NODE){enqueueText(root);return;}
      if(root.closest?.(SKIP))return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())enqueueText(walker.currentNode);
    }
    function forgetRemovedText(root) {
      if(root.isConnected)return; // Moving a node is not deleting its original.
      const forget=node=>{
        originals.delete(node);
        const entry=textEntries.get(node);if(entry)entry.skipped=true;
        textEntries.delete(node);dirtyTextRoots.delete(node);
      };
      if(root.nodeType===Node.TEXT_NODE){forget(root);return;}
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())forget(walker.currentNode);
      dirtyTextRoots.delete(root);
    }
    function queueTextRoot(root) {
      const element=root.nodeType===Node.TEXT_NODE?root.parentElement:root;
      if(run!==token || !root.isConnected || element?.closest?.(SKIP))return;
      if(root.nodeType===Node.TEXT_NODE && originals.get(root)?.translated===root.nodeValue)return;
      dirtyTextRoots.add(root);
      if(textTimer)return;
      textTimer=setTimeout(()=>{
        textTimer=0;
        if(run!==token)return;
        const roots=new Set(dirtyTextRoots);dirtyTextRoots.clear();
        for(const current of roots) {
          let parent=current.parentNode;
          while(parent && !roots.has(parent))parent=parent.parentNode;
          if(!parent)collectText(current);
        }
        // A changing site must not turn a service failure into automatic retries.
        if(!textError)drainText();
      },120);
    }
    collectText(document.body);
    // Text batches and image OCR run independently. A failure leaves completed
    // nodes in place and the cursor on the failed batch for an explicit retry.
    async function drainText() {
      if(textActive || textError || run!==token || textCursor>=textJobs.length)return;
      textActive=true;progress();
      try {
        while(textCursor<textJobs.length && run===token) {
          const batch=[];
          let cursor=textCursor,size=0;
          while(cursor<textJobs.length && batch.length<20) {
            const job=textJobs[cursor],entry=job.entry;
            if(entry.skipped || !eligibleText(entry.node) || entry.node.nodeValue!==entry.source) {
              entry.skipped=true;cursor++;continue;
            }
            if(batch.length && size+job.text.length>40000)break;
            batch.push(job);size+=job.text.length;cursor++;
          }
          if(!batch.length){textCursor=cursor;continue;}
          const result=await request({type:"DASI_MT",texts:batch.map(job=>job.text),target});
          if(run!==token)return;
          if(!Array.isArray(result.translations) || result.translations.length!==batch.length ||
            result.translations.some((text,index)=>typeof text!=="string" || batch[index].text.trim()&&!text.trim())) {
            throw new Error("translation_response_invalid");
          }
          for(let i=0;i<batch.length;i++) {
            const job=batch[i],entry=job.entry;
            if(entry.skipped || !eligibleText(entry.node) || entry.node.nodeValue!==entry.source){entry.skipped=true;continue;}
            entry.translated[job.index]=result.translations[i]+job.separator;
            if(--entry.remaining===0) {
              const translated=entry.translated.join("");
              originals.set(entry.node,{original:entry.source,translated});
              entry.node.nodeValue=translated;
              entry.translated=[];textDone++;
            }
          }
          textCursor=cursor;progress();
        }
        if(run===token && textCursor===textJobs.length){textJobs.length=0;textCursor=0;}
      }catch(error){
        if(run===token)textError=error.message==="translation_rate_limited"
          ?wording("service temporairement limité, patiente au moins une minute","service temporarily rate-limited, wait at least one minute")
          :wording("traduction du texte interrompue, réessaie pour poursuivre","text translation interrupted, retry to continue");
      }finally{
        if(run===token){textActive=false;progress();}
      }
    }
    drainText();
    resize = new ResizeObserver(schedule);
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    function progress() {
      if (run !== token) return;
      const retry = document.getElementById("yomu-translation-retry");
      if (retry) {retry.hidden = !failures.size && !textError; retry.disabled = !!active || textActive;}
      const completed=wording(
        `${textDone} passage(s) de texte et ${done} image(s) traduits.`,
        `${textDone} text passage(s) and ${done} image(s) translated.`
      );
      if(active || textActive)status(wording("Yomu — traduction en cours… ","Yomu — translating… ")+completed);
      else if(textError || failed)status(completed+" "+[
        textError,
        failed?wording(`${failed} image(s) en échec (${lastError}).`,`${failed} image(s) failed (${lastError}).`):""
      ].filter(Boolean).join(" "));
      else if(textDone || done)status(completed+" "+wording("Poursuis ta lecture.","Keep reading."));
      else status(wording("Aucun texte lisible détecté pour le moment.","No readable text detected yet."));
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
          const result = await requestPanel(im,source,target,src);
          if (run !== token) return;
          if (imageSource(im) !== source) continue;
          failures.delete(im); failed = failures.size;
          if (result.blocks?.length) {
            applyRegions(im, result, target);
            done++;
          } else empty++;
        } catch (e) {
          if (run === token) {failures.add(im);failed=failures.size;lastError=e.message==="translation_rate_limited"?wording("service temporairement limité, patiente au moins une minute","service temporarily rate-limited, wait at least one minute"):e.message==="image_access_required"?wording("ouvre Yomu puis « Image access and privacy » pour autoriser le domaine des images","open Yomu, then Image access and privacy to allow the image domain"):String(e.message||e).slice(0,120);}
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
      if(run!==token)return;
      let imagesChanged=false;
      for(const record of records) {
        const element=record.target.nodeType===Node.TEXT_NODE?record.target.parentElement:record.target;
        if(element?.closest?.("[data-yomu-overlay],#yomu-translation-status"))continue;
        if(record.type==="characterData"){queueTextRoot(record.target);continue;}
        if(record.type==="childList") {
          record.removedNodes.forEach(forgetRemovedText);
          for(const node of record.addedNodes) {
            if(node.nodeType===Node.ELEMENT_NODE && node.matches("[data-yomu-overlay],#yomu-translation-status"))continue;
            queueTextRoot(node);imagesChanged=true;
          }
          if(record.removedNodes.length)imagesChanged=true;
          continue;
        }
        queueTextRoot(record.target);
        imagesChanged=true;
        const im=record.target;
        if(!(im instanceof HTMLImageElement) || !isPanel(im))continue;
        const rect=im.getBoundingClientRect();
        if(rect.bottom>=-250 && rect.top<=innerHeight+250)enqueue(im);
      }
      if(imagesChanged){scan();schedule();}
    });
    // Watching the document root also survives a site's replacement of <body>.
    mutation.observe(document.documentElement, {
      childList:true,subtree:true,characterData:true,attributes:true,
      attributeFilter:["src","srcset","data-src","data-original","data-lazy-src","data-url","hidden","aria-hidden","class","style","open","contenteditable"]
    });
    scan();
    progress();
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
