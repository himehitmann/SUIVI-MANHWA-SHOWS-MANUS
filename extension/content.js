/* Editorial Quiet / detector layer: generic-first, local-first, no network calls, confidence must be explicit. */
(() => {
  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const first = selectors => selectors.map(s => document.querySelector(s)?.content || document.querySelector(s)?.textContent).map(clean).find(Boolean) || "";
  const parseEpisode = text => {
    const match = text.match(/(?:season|s)\s*(\d{1,2})[^\d]{0,8}(?:episode|ep|e)\s*(\d{1,4})/i);
    return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
  };
  const parseChapter = text => {
    const match = text.match(/(?:chapter|chap|ch\.?|episode|ep\.?)\s*[-#: ]?\s*(\d{1,5})/i);
    return match ? { chapter: Number(match[1]) } : null;
  };
  const detect = () => {
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(node => { try { const value = JSON.parse(node.textContent || "{}"); return Array.isArray(value) ? value : [value]; } catch { return []; } });
    const structured = jsonLd.find(value => value.name || value.headline || value.partOfSeries);
    const title = clean(structured?.name || structured?.headline || first(['meta[property="og:title"]', 'meta[name="twitter:title"]', 'h1', 'title'])) || location.hostname;
    const context = clean([document.title, title, location.pathname].join(" "));
    const media = [...document.querySelectorAll("video")].sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
    const episode = parseEpisode(context);
    const chapter = parseChapter(context);
    const type = media ? "Watching" : (chapter ? "Reading" : (episode ? "Watching" : "Other"));
    const confidence = structured ? 0.96 : (chapter || episode ? 0.82 : (media ? 0.74 : 0.48));
    return { title, type, chapter: chapter?.chapter, season: episode?.season, episode: episode?.episode, episodeTitle: structured?.partOfEpisode?.name || "", url: location.href, domain: location.hostname, duration: media?.duration || 0, position: media?.currentTime || 0, confidence, detectedAt: Date.now() };
  };
  const send = () => chrome.runtime.sendMessage({ type: "DETECTION_UPDATED", payload: detect() });
  let lastUrl = location.href;
  const observer = new MutationObserver(() => { if (location.href !== lastUrl) { lastUrl = location.href; send(); } });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(send, 250);
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; send(); } }, 1200);
  document.addEventListener("play", event => { if (event.target instanceof HTMLVideoElement) send(); }, true);
  document.addEventListener("pause", event => { if (event.target instanceof HTMLVideoElement) chrome.runtime.sendMessage({ type: "VIDEO_PROGRESS", payload: { ...detect(), position: event.target.currentTime, duration: event.target.duration } }); }, true);
  window.addEventListener("beforeunload", () => { const media = document.querySelector("video"); if (media && media.currentTime > 5) chrome.runtime.sendMessage({ type: "VIDEO_PROGRESS", payload: { ...detect(), position: media.currentTime, duration: media.duration } }); });
})();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const videos = [...document.querySelectorAll("video")].sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
    const video = videos[0];
    if (message.type === "SET_PLAYBACK_SPEED" && video) { video.playbackRate = message.speed; sendResponse({ ok: true, speed: video.playbackRate }); }
    if (message.type === "REQUEST_PIP" && video && document.pictureInPictureEnabled && video.requestPictureInPicture) { video.requestPictureInPicture().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false })); return true; }
    if (message.type === "REQUEST_DETECTION") send();
  });
