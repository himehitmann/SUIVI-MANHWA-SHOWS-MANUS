/*
 * Dasi popup — fast confirm flow. On open it asks the background to detect the
 * active tab (injecting the content script on demand), then shows what was
 * found so the user can save in one click. Weak detections are flagged so a
 * wrong guess is never saved silently.
 */
const api = globalThis.chrome;
const $ = (s) => document.querySelector(s);
let speed = 1;
let detection = null;
let activeTab = null;

const timecode = (s) => {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

function render() {
  if (!detection) {
    $("#type").textContent = "Nothing detected";
    $("#title").textContent = "Nothing detected yet";
    $("#meta").textContent = "Open a readable page or a video, then reopen Dasi.";
    $("#save").disabled = true;
    return;
  }
  const d = detection;
  $("#type").textContent = d.type === "watching" ? "Watching" : "Reading";
  $("#title").textContent = d.title || "Untitled page";

  const parts = [
    d.volume && `Vol. ${d.volume}`,
    d.chapter && `Chapter ${d.chapter}`,
    d.season && `Season ${d.season}`,
    d.episode && `Episode ${d.episode}`,
  ].filter(Boolean);
  $("#meta").textContent = parts.join(" · ") || d.domain;

  const ratio = d.duration ? Math.round((d.position / d.duration) * 100) : 0;
  $("#fill").style.width = `${ratio}%`;
  $("#pos").textContent = d.duration ? `${timecode(d.position)} / ${timecode(d.duration)}` : d.domain;

  if (d.confidence < 0.75) {
    $("#conf").textContent = `${Math.round(d.confidence * 100)}% confidence — please review before saving.`;
    $("#conf").classList.add("show");
  } else {
    $("#conf").classList.remove("show");
  }
  $("#save").disabled = false;
}

// Kick off detection.
api.runtime.sendMessage({ type: "DETECT_ACTIVE_TAB" }, (resp) => {
  detection = resp?.detection || null;
  activeTab = resp?.tab || null;
  render();
});

$("#save").onclick = () => {
  if (!detection) return;
  api.runtime.sendMessage({ type: "SAVE_PROGRESS", payload: detection }, (r) => {
    $("#save").textContent = r?.conflict && r.kept === "existing" ? "Kept furthest" : "Saved locally";
  });
};

$("#library").onclick = () => api.tabs.create({ url: api.runtime.getURL("library.html") });

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
    $("#save-site").textContent = "✓ Saved";
  });
};

$("#tools-toggle").onclick = () => $("#tools").classList.toggle("open");

const setSpeed = (delta) => {
  speed = Math.min(3, Math.max(0.25, Number((speed + delta).toFixed(2))));
  $("#speed").textContent = `${speed}×`;
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) api.tabs.sendMessage(tabs[0].id, { type: "SET_PLAYBACK_SPEED", speed });
  });
};
$("#slower").onclick = () => setSpeed(-0.25);
$("#faster").onclick = () => setSpeed(0.25);

// Sync status footer: reflect whether cloud sync is configured; click to manage.
const syncLink = $("#sync-link");
if (syncLink) {
  syncLink.onclick = () => api.runtime.openOptionsPage();
  api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => {
    void api.runtime.lastError;
    if (s && s.configured) syncLink.textContent = s.meta && s.meta.lastError ? "Sync needs attention →" : "Synced ✓";
  });
}

$("#pip").onclick = () =>
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    api.tabs.sendMessage(tabs[0].id, { type: "REQUEST_PIP" }, (r) => {
      void api.runtime.lastError;
      $("#pip").textContent = r?.ok ? "Picture-in-Picture on" : r?.reason === "unsupported" ? "Not available here" : "Player refused PiP";
    });
  });
