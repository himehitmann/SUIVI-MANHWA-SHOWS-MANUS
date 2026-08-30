/*
 * Dasi popup — fast confirm flow. On open it asks the background to detect the
 * active tab (injecting the content script on demand), shows what was found —
 * cover, title, marker and (for video) the current timecode — and whether the
 * work is already saved, so you consciously overwrite the previous position.
 */
const api = globalThis.chrome;
const $ = (s) => document.querySelector(s);
let speed = 1;
let detection = null;
let activeTab = null;
let existing = null;

const timecode = (s) => {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

function markerText(d) {
  if (!d) return "";
  const parts = [];
  if (d.volume) parts.push(`Vol. ${d.volume}`);
  if (d.chapter) parts.push(`Chapter ${d.chapter}`);
  if (d.season) parts.push(`Season ${d.season}`);
  if (d.episode) parts.push(`Episode ${d.episode}`);
  return parts.join(" · ");
}

function setCover(url, initial) {
  const holder = $("#cover");
  holder.querySelector("img")?.remove();
  $("#coverInitial").style.display = "";
  $("#coverInitial").textContent = (initial || "D").slice(0, 1).toUpperCase();
  if (url) {
    const img = document.createElement("img");
    img.referrerPolicy = "no-referrer";
    img.onload = () => ($("#coverInitial").style.display = "none");
    img.onerror = () => img.remove();
    img.src = url;
    holder.appendChild(img);
  }
}

function render() {
  if (!detection) {
    $("#kindLabel").textContent = "Nothing detected";
    $("#title").textContent = "Nothing detected yet";
    $("#marker").textContent = "Open a readable page or a video, then reopen Dasi.";
    $("#save").disabled = true;
    return;
  }
  const d = detection;
  const watching = d.type === "watching";
  $("#kind").className = `kind ${watching ? "watching" : ""}`;
  $("#kindLabel").textContent = watching ? "Watching" : "Reading";
  $("#title").textContent = d.title || "Untitled page";
  setCover(d.cover, d.title);

  const marker = markerText(d);
  $("#marker").textContent = marker || d.domain;

  if (watching && d.duration) {
    $("#time").style.display = "";
    $("#time").textContent = `⏱ ${timecode(d.position)} / ${timecode(d.duration)}`;
  } else if (watching && d.position) {
    $("#time").style.display = "";
    $("#time").textContent = `⏱ ${timecode(d.position)}`;
  } else {
    $("#time").style.display = "none";
  }

  if (d.confidence < 0.75) {
    $("#conf").textContent = `${Math.round(d.confidence * 100)}% confidence — check before saving.`;
    $("#conf").classList.add("show");
  } else {
    $("#conf").classList.remove("show");
  }

  // Previous save awareness (works across sites — matched by title).
  const prevMarker = markerText(existing);
  const differs = existing && (prevMarker !== marker || (existing.domain && existing.domain !== d.domain));
  if (existing && differs) {
    const bits = [prevMarker || "saved", existing.domain].filter(Boolean).join(" · ");
    $("#prevText").textContent = `${bits}. Saving replaces it with your current spot.`;
    $("#prev").classList.add("show");
    $("#save").textContent = "Overwrite save";
    $("#save").classList.add("warn");
  } else {
    $("#prev").classList.remove("show");
    $("#save").textContent = existing ? "Update my position" : "Save my position";
    $("#save").classList.remove("warn");
  }
  $("#save").disabled = false;
  $("#pip").disabled = !d.hasVideo;
}

// Kick off detection, then check for an existing save (cross-site, by title).
api.runtime.sendMessage({ type: "DETECT_ACTIVE_TAB" }, (resp) => {
  detection = resp?.detection || null;
  activeTab = resp?.tab || null;
  if (detection) {
    api.runtime.sendMessage({ type: "CHECK_EXISTING", payload: detection }, (r) => {
      existing = r?.existing || null;
      render();
    });
  } else {
    render();
  }
});

$("#save").onclick = () => {
  if (!detection) return;
  api.runtime.sendMessage({ type: "SAVE_PROGRESS", payload: detection }, (r) => {
    $("#save").textContent = r?.conflict && r.kept === "existing" ? "Kept furthest ✓" : "Saved ✓";
    $("#save").disabled = true;
    $("#prev").classList.remove("show");
  });
};

const openApp = () => api.tabs.create({ url: api.runtime.getURL("library.html") });
$("#open").onclick = openApp;
$("#brand").onclick = openApp;

$("#save-site").onclick = () => {
  const url = activeTab?.url || detection?.url;
  if (!url) return;
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = url;
  }
  // Name the favourite by the SITE (domain), never the current episode title.
  const site = {
    id: Math.random().toString(36).slice(2, 10),
    name: domain,
    url: `${new URL(url).protocol}//${new URL(url).host}`,
    domain,
    color: "#F0EAFF",
  };
  api.runtime.sendMessage({ type: "ADD_SITE", payload: site }, () => {
    $("#save-site").textContent = "✓ Site saved";
  });
};

// Playback speed: 0.25×–3×, adjustable with −/+ or by typing the number.
const applySpeed = (v) => {
  speed = Math.min(3, Math.max(0.25, Math.round(Number(v) * 100) / 100 || 1));
  const inp = $("#speed-input");
  if (inp) inp.value = String(speed);
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) api.tabs.sendMessage(tabs[0].id, { type: "SET_PLAYBACK_SPEED", speed });
  });
};
$("#slower").onclick = () => applySpeed(speed - 0.25);
$("#faster").onclick = () => applySpeed(speed + 0.25);
$("#speed-input").addEventListener("change", (e) => applySpeed(e.target.value));

$("#pip").onclick = () =>
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    api.tabs.sendMessage(tabs[0].id, { type: "REQUEST_PIP" }, (r) => {
      void api.runtime.lastError;
      $("#pip").textContent = r?.ok ? "Picture-in-Picture on" : r?.reason === "unsupported" ? "Not available here" : "Player refused PiP";
    });
  });

// Rate + share. Store URL is a single constant to swap once the listing is live.
const DASI_STORE_URL = "https://chromewebstore.google.com/detail/dasi";
const DASI_SHARE_TEXT = "Dasi — never lose your spot in any manga, webtoon, anime or series. Save & resume in one click.";
const openUrl = (u) => api.tabs.create({ url: u });
// Animated 5-star rating → opens the Chrome Web Store review page.
const stars = [...document.querySelectorAll("#stars span")];
const paintStars = (n) => stars.forEach((s, i) => s.classList.toggle("on", i < n));
stars.forEach((s) => s.addEventListener("mouseenter", () => paintStars(Number(s.dataset.v))));
$("#stars").addEventListener("mouseleave", () => paintStars(0));
$("#stars").addEventListener("click", () => {
  paintStars(5);
  stars.forEach((s, i) => setTimeout(() => { s.classList.add("pop"); setTimeout(() => s.classList.remove("pop"), 160); }, i * 60));
  setTimeout(() => openUrl(DASI_STORE_URL), 400);
});
$("#sh-x").onclick = () => openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(DASI_SHARE_TEXT)}&url=${encodeURIComponent(DASI_STORE_URL)}`);
$("#sh-fb").onclick = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(DASI_STORE_URL)}`);
$("#sh-wa").onclick = () => openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(DASI_SHARE_TEXT + " " + DASI_STORE_URL)}`);
$("#sh-rd").onclick = () => openUrl(`https://www.reddit.com/submit?url=${encodeURIComponent(DASI_STORE_URL)}&title=${encodeURIComponent(DASI_SHARE_TEXT)}`);
$("#sh-cp").onclick = () => {
  try { navigator.clipboard?.writeText(DASI_STORE_URL); } catch {}
  $("#sh-cp").textContent = "✓";
  setTimeout(() => ($("#sh-cp").textContent = "🔗"), 1200);
};

/*
 * One-click page translation. Pick a target language and Dasi translates the
 * current page's text in place (optional, best-effort; revert from the on-page
 * pill). Free plan is metered to 5 pages/day; Pro/Lifetime and the owner build
 * are unlimited.
 */
const TR_LANGS = [
  ["en", "English"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"],
  ["pt", "Português"], ["nl", "Nederlands"], ["ru", "Русский"], ["uk", "Українська"], ["pl", "Polski"],
  ["tr", "Türkçe"], ["ar", "العربية"], ["fa", "فارسی"], ["hi", "हिन्दी"], ["id", "Indonesia"],
  ["vi", "Tiếng Việt"], ["th", "ไทย"], ["ja", "日本語"], ["ko", "한국어"], ["zh-CN", "中文 (简)"],
  ["zh-TW", "中文 (繁)"], ["fil", "Filipino"], ["ms", "Melayu"], ["sv", "Svenska"], ["no", "Norsk"],
  ["da", "Dansk"], ["fi", "Suomi"], ["cs", "Čeština"], ["el", "Ελληνικά"], ["he", "עברית"],
  ["ro", "Română"], ["hu", "Magyar"], ["bg", "Български"], ["sr", "Српски"], ["hr", "Hrvatski"],
];
const UNLOCK = typeof DASI_UNLOCK_ALL !== "undefined" ? DASI_UNLOCK_ALL : true;
const FREE_TR_LIMIT = 5;
let popupSettings = { translateLang: "en" };
let popupPlan = null;

const trSel = $("#tr-lang");
TR_LANGS.forEach(([code, name]) => { const o = document.createElement("option"); o.value = code; o.textContent = name; trSel.appendChild(o); });

api.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
  void api.runtime.lastError;
  popupSettings = { translateLang: (state && state.settings && state.settings.translateLang) || (navigator.language || "en").slice(0, 2), ...(state && state.settings) };
  trSel.value = [...trSel.options].some((o) => o.value === popupSettings.translateLang) ? popupSettings.translateLang : "en";
});

trSel.onchange = () => api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { translateLang: trSel.value } }, () => void api.runtime.lastError);

const isProPopup = () => UNLOCK || popupPlan === "pro" || popupPlan === "lifetime";
function trUsageToday() {
  const today = new Date().toISOString().slice(0, 10);
  const u = popupSettings.trUsage || {};
  return u.date === today ? u.count || 0 : 0;
}
function bumpTrUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const count = trUsageToday() + 1;
  popupSettings.trUsage = { date: today, count };
  api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { trUsage: popupSettings.trUsage } }, () => void api.runtime.lastError);
}

$("#tr-go").onclick = () => {
  if (!isProPopup() && trUsageToday() >= FREE_TR_LIMIT) {
    const s = $("#tr-status");
    s.textContent = `Free limit reached (${FREE_TR_LIMIT}/day). Go Pro for unlimited translation.`;
    s.classList.add("up");
    return;
  }
  const lang = trSel.value;
  $("#tr-status").classList.remove("up");
  $("#tr-status").textContent = "Translating the page…";
  $("#tr-go").disabled = true;
  api.runtime.sendMessage({ type: "TRANSLATE_PAGE", lang }, (r) => {
    void api.runtime.lastError;
    $("#tr-go").disabled = false;
    if (r && r.ok) { $("#tr-status").textContent = "Done — see the pill on the page (revert there)."; bumpTrUsage(); }
    else $("#tr-status").textContent = r && r.error === "restricted_page" ? "Can't translate this page." : "Translation unavailable here.";
  });
};

// Sync is optional — footer link just opens the settings, never required.
$("#sync-link").onclick = () => api.runtime.openOptionsPage();
api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => {
  void api.runtime.lastError;
  popupPlan = (s && s.plan) || null;
  if (s && s.configured) $("#sync-link").textContent = s.meta && s.meta.lastError ? "Sync needs attention" : "Synced ✓";
});
