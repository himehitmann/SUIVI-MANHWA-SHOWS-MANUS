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
  const site = {
    id: Math.random().toString(36).slice(2, 10),
    name: (activeTab?.title || domain).split(/[|\-–]/)[0].trim().slice(0, 30) || domain,
    url: `${new URL(url).protocol}//${new URL(url).host}`,
    domain,
    color: "#F0EAFF",
  };
  api.runtime.sendMessage({ type: "ADD_SITE", payload: site }, () => {
    $("#save-site").textContent = "✓ Site saved";
  });
};

const setSpeed = (delta) => {
  speed = Math.min(4, Math.max(0.25, Number((speed + delta).toFixed(2))));
  $("#speed").textContent = `${speed}×`;
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) api.tabs.sendMessage(tabs[0].id, { type: "SET_PLAYBACK_SPEED", speed });
  });
};
$("#slower").onclick = () => setSpeed(-0.25);
$("#faster").onclick = () => setSpeed(0.25);

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
$("#rate").onclick = () => openUrl(DASI_STORE_URL);
$("#sh-x").onclick = () => openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(DASI_SHARE_TEXT)}&url=${encodeURIComponent(DASI_STORE_URL)}`);
$("#sh-fb").onclick = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(DASI_STORE_URL)}`);
$("#sh-wa").onclick = () => openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(DASI_SHARE_TEXT + " " + DASI_STORE_URL)}`);
$("#sh-rd").onclick = () => openUrl(`https://www.reddit.com/submit?url=${encodeURIComponent(DASI_STORE_URL)}&title=${encodeURIComponent(DASI_SHARE_TEXT)}`);
$("#sh-cp").onclick = () => {
  try { navigator.clipboard?.writeText(DASI_STORE_URL); } catch {}
  $("#sh-cp").textContent = "✓";
  setTimeout(() => ($("#sh-cp").textContent = "🔗"), 1200);
};

// Sync is optional — footer link just opens the settings, never required.
$("#sync-link").onclick = () => api.runtime.openOptionsPage();
api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => {
  void api.runtime.lastError;
  if (s && s.configured) $("#sync-link").textContent = s.meta && s.meta.lastError ? "Sync needs attention" : "Synced ✓";
});
