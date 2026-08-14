/* Editorial Quiet / popup controller: only asks the active tab for a local detection. */
const chromeApi = globalThis.chrome;
const $ = selector => document.querySelector(selector);
const render = state => {
  const detection = state?.currentDetection;
  if (!detection) { $("#title").textContent = "Nothing detected yet"; $("#meta").textContent = "Open a readable page, then reopen Suivi."; $("#save").disabled = true; return; }
  $("#title").textContent = detection.title || "Untitled page";
  $("#type").textContent = detection.type || "Other";
  $("#meta").textContent = [detection.chapter && `Chapter ${detection.chapter}`, detection.season && `Season ${detection.season}`, detection.episode && `Episode ${detection.episode}`].filter(Boolean).join(" · ") || detection.domain;
  const ratio = detection.duration ? Math.round((detection.position / detection.duration) * 100) : 0;
  $(".bar i").style.width = `${ratio}%`;
  $("#position").textContent = detection.duration ? `${Math.floor(detection.position / 60)}:${String(Math.floor(detection.position % 60)).padStart(2, "0")} / ${Math.floor(detection.duration / 60)}:${String(Math.floor(detection.duration % 60)).padStart(2, "0")}` : `${Math.round(detection.confidence * 100)}% confidence · review before saving`;
  $("#save").disabled = false;
  $("#save").onclick = () => chromeApi.runtime.sendMessage({ type: "SAVE_PROGRESS", payload: detection }, () => { $("#save").textContent = "Saved locally"; });
};
chromeApi.runtime.sendMessage({ type: "GET_STATE" }, render);
$("#library").onclick = () => chromeApi.tabs.create({ url: chromeApi.runtime.getURL("popup.html#library") });
