/* Dasi standalone library — renders items stored locally by the extension. */
const api = globalThis.chrome;
let items = [];
let sites = [];
let filter = "all";
let query = "";

const accentFor = (t) => (t === "watching" ? "#8EA8E7" : "#6CBE9E");

function marker(i) {
  const parts = [
    i.volume && `Vol. ${i.volume}`,
    i.chapter && `Chapter ${i.chapter}`,
    i.season && `Season ${i.season}`,
    i.episode && `Episode ${i.episode}`,
    i.page && `Page ${i.page}`,
  ].filter(Boolean);
  return parts.join(" · ") || i.domain || "";
}

function relative(ts) {
  if (!ts) return "";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function render() {
  const grid = document.getElementById("grid");
  const q = query.toLowerCase();
  const list = items.filter((i) => {
    if (filter === "favorites" && !i.favorite) return false;
    if ((filter === "reading" || filter === "watching") && i.type !== filter) return false;
    if (!q) return true;
    return `${i.title} ${marker(i)}`.toLowerCase().includes(q);
  });

  if (list.length === 0) {
    grid.innerHTML = `<p class="empty">Nothing saved yet. Open a chapter or an episode and hit save in the Dasi popup.</p>`;
  } else {
    grid.innerHTML = list
      .map((i) => {
        const cover = i.cover ? `<img src="${i.cover}" alt="">` : (i.title || "?")[0];
        return `<article class="item">
          <div class="cover" style="background:${i.accent || "#E4D9FA"}">${cover}</div>
          <div style="min-width:0;flex:1">
            <h3>${escapeHtml(i.title || "Untitled")}</h3>
            <p>${escapeHtml(marker(i))}</p>
            <div class="bar"><i style="width:${Math.min(100, i.progress || 0)}%;background:${accentFor(i.type)}"></i></div>
            <small>${i.progress || 0}% · ${relative(i.updatedAt)}</small>
          </div>
          <div class="item-actions">
            <a class="open" href="${i.url}" target="_blank" rel="noreferrer">Open</a>
            <button class="del" data-id="${i.id}">Remove</button>
          </div>
        </article>`;
      })
      .join("");
  }

  const wrap = document.getElementById("sites-wrap");
  if (sites.length) {
    wrap.hidden = false;
    document.getElementById("sites").innerHTML = sites
      .map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${escapeHtml(s.name)}</a>`)
      .join("");
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.getElementById("grid").addEventListener("click", (e) => {
  const btn = e.target.closest(".del");
  if (!btn) return;
  api.runtime.sendMessage({ type: "REMOVE_ITEM", id: btn.dataset.id }, (r) => {
    items = r?.items || items.filter((i) => i.id !== btn.dataset.id);
    render();
  });
});

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  filter = btn.dataset.f;
  [...document.querySelectorAll("#tabs button")].forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

document.getElementById("q").addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

api.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
  items = state?.items || [];
  sites = state?.sites || [];
  render();
});
