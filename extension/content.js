/*
 * Dasi content detector — generic-first, local-first, no network calls.
 *
 * Pipeline (most precise first): site adapter → JSON-LD → Open Graph →
 * visible DOM → document title → URL → heuristics. Each layer only fills in
 * fields the previous layers left empty, and the confidence score reflects how
 * far down the chain the answer came from so the popup can ask for confirmation
 * on weak detections instead of silently saving the wrong thing.
 *
 * Site adapters are isolated in ADAPTERS: adding, editing or removing one can
 * never break generic detection, which always runs as the baseline.
 */
(() => {
  if (window.__dasiInjected) {
    // Already running on this page: just refresh and report, do not re-bind.
    try {
      window.__dasiDetectAndSend && window.__dasiDetectAndSend();
    } catch (e) {
      /* noop */
    }
    return;
  }
  window.__dasiInjected = true;

  const clean = (v) => (v || "").replace(/\s+/g, " ").trim();
  const num = (v) => {
    const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const qtext = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return "";
    return clean(el.getAttribute("content") || el.textContent || "");
  };
  const metaFirst = (selectors) => selectors.map(qtext).find(Boolean) || "";

  /** Turn a URL slug ("solo-leveling") into a display title ("Solo Leveling"). */
  const titleCase = (slug) =>
    clean(String(slug).replace(/[-_]+/g, " "))
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");

  /** Strip common site suffixes and reader boilerplate from a title. */
  const cleanTitle = (raw) => {
    let t = clean(raw);
    // Drop everything after a separator that usually introduces the site name.
    t = t.replace(/\s*[|–—·\-]\s*(read|watch|manga|manhwa|webtoon|anime|online|free|english|sub|subbed|dub|episode list|chapter list|[A-Za-z0-9]+scans?|mangadex|webtoons?|kissasian|myasiantv|aniwatch|hianime|crunchyroll|netflix|bato|mangago|naver|kakao|viki|wetv|iq|bilibili).*$/i, "");
    // Remove trailing chapter/episode markers to keep the work name.
    t = t.replace(/[\s\-:_#]*(?:chapter|chap|ch|episode|ep|season|s|vol(?:ume)?|part)\.?\s*\d+.*$/i, "");
    // Remove trailing years and quality tags.
    t = t.replace(/\s*\(?(19|20)\d{2}\)?\s*$/, "");
    return clean(t) || clean(raw);
  };

  const parseSeasonEpisode = (text) => {
    let m = text.match(/(?:season|s)\s*(\d{1,2})\D{0,10}(?:episode|ep|e)\s*(\d{1,4})/i);
    if (m) return { season: num(m[1]), episode: num(m[2]) };
    m = text.match(/\bS(\d{1,2})[\s._-]?E(\d{1,4})\b/i);
    if (m) return { season: num(m[1]), episode: num(m[2]) };
    m = text.match(/(?:episode|ep)\.?\s*[-#:]?\s*(\d{1,4})/i);
    if (m) return { episode: num(m[1]) };
    return null;
  };

  const parseChapter = (text) => {
    let m = text.match(/(?:chapter|chap|ch)\.?\s*[-#:]?\s*(\d{1,5}(?:\.\d)?)/i);
    if (m) return { chapter: num(m[1]) };
    return null;
  };

  const parseVolume = (text) => {
    const m = text.match(/\bvol(?:ume)?\.?\s*(\d{1,4})/i);
    return m ? { volume: num(m[1]) } : null;
  };

  const urlParam = (name) => {
    try {
      return new URL(location.href).searchParams.get(name);
    } catch {
      return null;
    }
  };

  /* ---- Isolated, site-specific adapters. Each returns a partial detection. ---- */
  const ADAPTERS = [
    {
      id: "netflix",
      match: /(^|\.)netflix\.com$/,
      parse() {
        const title = clean(document.querySelector("[data-uia='video-title'] h4")?.textContent) ||
          cleanTitle(metaFirst(["meta[property='og:title']"]));
        const detail = clean(document.querySelector("[data-uia='video-title'] span")?.textContent);
        const se = detail ? parseSeasonEpisode(detail) : null;
        return { title, type: "watching", ...(se || {}), episodeTitle: detail || "" };
      },
    },
    {
      id: "webtoons",
      match: /(^|\.)webtoons\.com$/,
      parse() {
        const title = cleanTitle(metaFirst(["meta[property='og:title']", "h1", ".subj"]));
        const ep = num(urlParam("episode_no"));
        return { title, type: "reading", chapter: ep };
      },
    },
    {
      id: "naver",
      match: /(^|\.)comic\.naver\.com$/,
      parse() {
        const title = cleanTitle(metaFirst(["meta[property='og:title']", ".EpisodeListInfo__title--mYLjC", "h2"]));
        const no = num(urlParam("no"));
        return { title, type: "reading", chapter: no };
      },
    },
    {
      id: "kakao",
      match: /(^|\.)webtoon\.kakao\.com$|(^|\.)page\.kakao\.com$/,
      parse() {
        return { title: cleanTitle(metaFirst(["meta[property='og:title']", "h1", "h2"])), type: "reading" };
      },
    },
    {
      id: "asura",
      match: /asura(comic|scans|toon)?\.[a-z.]+$/,
      parse() {
        const m = location.pathname.match(/chapter-(\d+(?:\.\d)?)/i);
        const title = cleanTitle(qtext("h1") || qtext(".entry-title") || metaFirst(["meta[property='og:title']"]));
        return { title, type: "reading", chapter: m ? num(m[1]) : undefined };
      },
    },
    {
      id: "bato",
      match: /(^|\.)bato\.(to|onl|si|ing)$|(^|\.)mto\.to$|(^|\.)batotoo\.com$/,
      parse() {
        const title = cleanTitle(qtext(".nav-title") || metaFirst(["meta[property='og:title']", "h3 a"]));
        const chap = parseChapter(document.title + " " + location.pathname);
        return { title, type: "reading", ...(chap || {}) };
      },
    },
    {
      id: "mangadex",
      match: /(^|\.)mangadex\.org$/,
      parse() {
        const title = cleanTitle(qtext(".title") || metaFirst(["meta[property='og:title']"]));
        const chap = parseChapter(qtext(".chapter-title") || document.title);
        return { title, type: "reading", ...(chap || {}) };
      },
    },
    {
      id: "mangago",
      match: /(^|\.)mangago\.[a-z]+$/,
      parse() {
        const m = location.pathname.match(/\/(?:chapter|c)(\d+)/i) || document.title.match(/ch\.?\s*(\d+)/i);
        return { title: cleanTitle(metaFirst(["meta[property='og:title']", "h1"])), type: "reading", chapter: m ? num(m[1]) : undefined };
      },
    },
    {
      id: "aniwatch",
      match: /aniwatch|hianime|(^|\.)zoro\.|(^|\.)9animetv/,
      parse() {
        const title = cleanTitle(qtext(".film-name a") || qtext(".film-name") || metaFirst(["meta[property='og:title']"]));
        const active = clean(document.querySelector(".ssl-item.ep-item.active, .ss-list a.active")?.getAttribute("title"));
        const se = parseSeasonEpisode(active || document.title) || { episode: num(urlParam("ep")) };
        return { title, type: "watching", ...(se || {}) };
      },
    },
    {
      id: "myasiantv",
      match: /myasiantv/,
      parse() {
        const m = location.pathname.match(/([a-z0-9-]+)-episode-(\d+)/i);
        const title = m ? titleCase(m[1]) : cleanTitle(qtext("h1") || metaFirst(["meta[property='og:title']"]));
        return { title, type: "watching", episode: m ? num(m[2]) : undefined };
      },
    },
    {
      id: "kissasian",
      match: /kissasian|kiss-asian/,
      parse() {
        const m = location.pathname.match(/\/([^/]+)\/Episode-(\d+)/i);
        const title = m ? titleCase(m[1]) : cleanTitle(qtext("h1"));
        return { title, type: "watching", episode: m ? num(m[2]) : undefined };
      },
    },
    {
      id: "kisskh",
      match: /kisskh/,
      parse() {
        const title = cleanTitle(qtext("h1") || metaFirst(["meta[property='og:title']"]));
        const ep = num(urlParam("ep")) ?? (document.title.match(/episode\s*(\d+)/i)?.[1] && num(document.title.match(/episode\s*(\d+)/i)[1]));
        return { title, type: "watching", episode: ep };
      },
    },
    {
      id: "viki",
      match: /(^|\.)viki\.com$/,
      parse() {
        const title = cleanTitle(metaFirst(["meta[property='og:title']", ".video-meta h1", "h1"]));
        const se = parseSeasonEpisode(document.title);
        return { title, type: "watching", ...(se || {}) };
      },
    },
    {
      id: "voir",
      match: /voiranime|voirdrama|voir-?anime/,
      parse() {
        const m = location.pathname.match(/-(\d+)-(?:vostfr|vf|vf-hd|episode)/i) || location.pathname.match(/episode-(\d+)/i);
        return { title: cleanTitle(qtext("h1") || metaFirst(["meta[property='og:title']"])), type: "watching", episode: m ? num(m[1]) : undefined };
      },
    },
    {
      id: "generic-drama",
      match: /wetv\.vip|iq\.com|bilibili\.tv|hidrama|ridomovies|onetouchtv|chia-anime|dramastore|vidbox|yarrlist/,
      parse() {
        const title = cleanTitle(metaFirst(["meta[property='og:title']", "h1"]));
        const se = parseSeasonEpisode(document.title);
        return { title, type: "watching", ...(se || {}) };
      },
    },
  ];

  const runAdapter = () => {
    const host = location.hostname;
    for (const a of ADAPTERS) {
      if (a.match.test(host) || a.match.test(location.href)) {
        try {
          const r = a.parse() || {};
          return { ...r, adapter: a.id };
        } catch {
          /* an adapter failing must never break detection */
        }
      }
    }
    return null;
  };

  const readJsonLd = () => {
    const nodes = [...document.querySelectorAll('script[type="application/ld+json"]')];
    const values = nodes.flatMap((n) => {
      try {
        const v = JSON.parse(n.textContent || "{}");
        return Array.isArray(v) ? v : [v];
      } catch {
        return [];
      }
    });
    return values.find((v) => v && (v.name || v.headline || v.partOfSeries || v.episodeNumber));
  };

  const largestVideo = () =>
    [...document.querySelectorAll("video")]
      .filter((v) => v.clientWidth > 120 && v.clientHeight > 80)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || null;

  const detect = () => {
    const adapter = runAdapter();
    const structured = readJsonLd();
    const ogTitle = metaFirst(["meta[property='og:title']", "meta[name='twitter:title']"]);
    const domHeading = qtext("h1");

    const rawTitle = adapter?.title || structured?.name || structured?.headline || cleanTitle(ogTitle) || cleanTitle(domHeading) || cleanTitle(document.title) || location.hostname;
    const title = clean(rawTitle) || location.hostname;

    const context = clean([document.title, ogTitle, domHeading, decodeURIComponent(location.pathname)].join(" "));

    const media = largestVideo();
    const se = parseSeasonEpisode(context);
    const chap = parseChapter(context);
    const vol = parseVolume(context);

    const chapter = adapter?.chapter ?? chap?.chapter;
    const season = adapter?.season ?? se?.season ?? (structured?.partOfSeason?.seasonNumber ? num(structured.partOfSeason.seasonNumber) : undefined);
    const episode = adapter?.episode ?? se?.episode ?? (structured?.episodeNumber ? num(structured.episodeNumber) : undefined);
    const volume = adapter?.volume ?? vol?.volume;

    let type = adapter?.type;
    if (!type) type = media ? "watching" : chapter ? "reading" : episode || season ? "watching" : "reading";

    // Confidence: highest when a dedicated adapter or structured data agreed.
    let confidence = 0.5;
    if (adapter && (adapter.chapter || adapter.episode || adapter.title)) confidence = 0.94;
    else if (structured) confidence = 0.9;
    else if (chapter || episode || season) confidence = 0.8;
    else if (media) confidence = 0.72;
    else if (ogTitle || domHeading) confidence = 0.6;

    return {
      title,
      type,
      chapter,
      volume,
      season,
      episode,
      episodeTitle: adapter?.episodeTitle || structured?.name || "",
      url: location.href,
      domain: location.hostname.replace(/^www\./, ""),
      duration: media?.duration || 0,
      position: media?.currentTime || 0,
      hasVideo: Boolean(media),
      source: adapter?.adapter || (structured ? "jsonld" : ogTitle ? "opengraph" : domHeading ? "dom" : "url"),
      confidence,
      detectedAt: Date.now(),
    };
  };

  const send = () => {
    try {
      chrome.runtime.sendMessage({ type: "DETECTION_UPDATED", payload: detect() });
    } catch {
      /* extension context may be gone */
    }
  };
  window.__dasiDetectAndSend = send;

  // Watch SPA navigation (URL change without reload).
  let lastUrl = location.href;
  const onNav = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(send, 400); // let the new view render first
    }
  };
  new MutationObserver(onNav).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", onNav);
  setInterval(onNav, 1500);

  // Video lifecycle: report on play, autosave on pause / navigation away.
  const reportVideo = (video) => {
    if (!video || video.currentTime < 3) return;
    try {
      chrome.runtime.sendMessage({ type: "VIDEO_PROGRESS", payload: { ...detect(), position: video.currentTime, duration: video.duration } });
    } catch {
      /* noop */
    }
  };
  document.addEventListener("play", (e) => e.target instanceof HTMLVideoElement && send(), true);
  document.addEventListener("pause", (e) => e.target instanceof HTMLVideoElement && reportVideo(e.target), true);
  window.addEventListener("beforeunload", () => reportVideo(largestVideo()));

  // Popup / background requests.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const video = largestVideo();
    if (message.type === "REQUEST_DETECTION") {
      const payload = detect();
      send();
      sendResponse(payload);
      return true;
    }
    if (message.type === "SET_PLAYBACK_SPEED") {
      [...document.querySelectorAll("video")].forEach((v) => (v.playbackRate = message.speed));
      sendResponse({ ok: Boolean(video), speed: message.speed });
      return true;
    }
    if (message.type === "REQUEST_PIP") {
      if (video && document.pictureInPictureEnabled && video.requestPictureInPicture) {
        const p = document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture();
        Promise.resolve(p).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false, reason: "denied" }));
      } else {
        sendResponse({ ok: false, reason: "unsupported" });
      }
      return true;
    }
    return false;
  });

  setTimeout(send, 250);
})();
