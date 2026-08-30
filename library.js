/* Dasi standalone library — renders items stored locally by the extension. */
const api = globalThis.chrome;
let items = [];
let sites = [];
let notifications = [];
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

function coverHtml(i, big) {
  if (i.cover) return `<img src="${escapeHtml(i.cover)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`;
  return escapeHtml((i.title || "?")[0].toUpperCase());
}

function update(id, patch) {
  const it = items.find((x) => x.id === id);
  if (it) Object.assign(it, patch); // optimistic
  render();
  api.runtime.sendMessage({ type: "UPDATE_ITEM", id, patch }, (r) => {
    if (r?.items) { items = r.items; render(); }
  });
}

function renderHero() {
  const hero = document.getElementById("hero");
  const inProgress = items
    .filter((i) => (i.progress || 0) < 100)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (!inProgress) { hero.hidden = true; return; }
  const i = inProgress;
  hero.hidden = false;
  hero.innerHTML = `
    <div class="hero-cover" style="background:${i.accent || "#B9A4F0"}">${coverHtml(i, true)}</div>
    <div class="hero-body">
      <p class="hero-eyebrow">Continue ${i.type === "watching" ? "watching" : "reading"}</p>
      <h2 class="hero-title">${escapeHtml(i.title || "Untitled")}</h2>
      <p class="hero-marker">${escapeHtml(marker(i))} · ${relative(i.updatedAt)}</p>
      <div class="bar"><i style="width:${Math.min(100, i.progress || 0)}%;background:${accentFor(i.type)}"></i></div>
      <a class="resume" href="${escapeHtml(i.url || "#")}" target="_blank" rel="noreferrer">▶ Resume</a>
    </div>`;
}

function renderStats() {
  const wrap = document.getElementById("stats");
  const reading = items.filter((i) => i.type === "reading").length;
  const watching = items.filter((i) => i.type === "watching").length;
  const favs = items.filter((i) => i.favorite).length;
  const done = items.filter((i) => (i.progress || 0) >= 100).length;
  const chips = [
    [items.length, "Tracked"],
    [reading, "Reading"],
    [watching, "Watching"],
    [favs, "Favorites"],
    [done, "Finished"],
  ];
  wrap.innerHTML = chips.map(([n, l]) => `<div class="chip"><b>${n}</b><span>${l}</span></div>`).join("");
}

function cardHtml(i) {
  const cover = coverHtml(i);
  const rating = i.rating || 0;
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<span class="${n <= rating ? "on" : ""}" data-rate="${i.id}" data-v="${n}">★</span>`)
    .join("");
  const tagChips = (i.tags || [])
    .map((t) => `<span class="tag" data-untag="${i.id}" data-t="${escapeHtml(t)}" title="Remove tag">${escapeHtml(t)} ✕</span>`)
    .join("");
  const tags = `<div class="tags">${tagChips}<span class="tag add" data-addtag="${i.id}">+ tag</span></div>`;
  return `<article class="item">
    <button class="fav ${i.favorite ? "on" : ""}" data-fav="${i.id}" title="Favorite">★</button>
    <div class="cover" style="background:${i.accent || "#E4D9FA"}">${cover}</div>
    <div style="min-width:0;flex:1">
      <h3>${escapeHtml(i.title || "Untitled")}</h3>
      <p>${escapeHtml(marker(i))}</p>
      <div class="bar"><i style="width:${Math.min(100, i.progress || 0)}%;background:${accentFor(i.type)}"></i></div>
      <small>${i.progress || 0}% · ${relative(i.updatedAt)}</small>
      <div class="rate">${stars}</div>
      ${tags}
    </div>
    <div class="item-actions">
      <a class="open" href="${escapeHtml(i.url || "#")}" target="_blank" rel="noreferrer">Open</a>
      <button class="del" data-id="${i.id}">Remove</button>
    </div>
  </article>`;
}

function render() {
  renderHero();
  renderStats();
  const grid = document.getElementById("grid");
  const q = query.toLowerCase();
  const list = items.filter((i) => {
    if (filter === "favorites" && !i.favorite) return false;
    if ((filter === "reading" || filter === "watching") && i.type !== filter) return false;
    if (!q) return true;
    return `${i.title} ${marker(i)} ${(i.tags || []).join(" ")}`.toLowerCase().includes(q);
  });

  if (list.length === 0) {
    grid.innerHTML = `<p class="empty">Nothing saved yet. Open a chapter or an episode and hit save in the Dasi popup.</p>`;
  } else {
    const sorted = [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    grid.innerHTML = sorted.map(cardHtml).join("");
  }

  const wrap = document.getElementById("sites-wrap");
  if (sites.length) {
    wrap.hidden = false;
    document.getElementById("sites").innerHTML = sites
      .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(s.name)}</a>`)
      .join("");
  } else {
    wrap.hidden = true;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Clickable logo → back to the top / reset view (this page is the home).
document.getElementById("brand")?.addEventListener("click", () => {
  filter = "all";
  query = "";
  const q = document.getElementById("q");
  if (q) q.value = "";
  [...document.querySelectorAll("#tabs button")].forEach((b) => b.classList.toggle("active", b.dataset.f === "all"));
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("grid").addEventListener("click", (e) => {
  const del = e.target.closest(".del");
  if (del) {
    api.runtime.sendMessage({ type: "REMOVE_ITEM", id: del.dataset.id }, (r) => {
      items = r?.items || items.filter((i) => i.id !== del.dataset.id);
      render();
    });
    return;
  }
  const fav = e.target.closest(".fav");
  if (fav) {
    const it = items.find((x) => x.id === fav.dataset.fav);
    if (it) update(it.id, { favorite: !it.favorite });
    return;
  }
  const star = e.target.closest("[data-rate]");
  if (star) {
    const id = star.dataset.rate;
    const v = Number(star.dataset.v);
    const it = items.find((x) => x.id === id);
    update(id, { rating: it && it.rating === v ? 0 : v }); // click same star again clears
    return;
  }
  const addTag = e.target.closest("[data-addtag]");
  if (addTag) {
    const it = items.find((x) => x.id === addTag.dataset.addtag);
    const raw = prompt("Add a tag");
    const t = raw && raw.trim();
    if (it && t) update(it.id, { tags: [...new Set([...(it.tags || []), t])] });
    return;
  }
  const untag = e.target.closest("[data-untag]");
  if (untag) {
    const it = items.find((x) => x.id === untag.dataset.untag);
    if (it) update(it.id, { tags: (it.tags || []).filter((x) => x !== untag.dataset.t) });
  }
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

document.getElementById("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ version: 1, items, sites, notifications }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dasi-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import").addEventListener("click", () => document.getElementById("file").click());
document.getElementById("file").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  file.text().then((text) => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.items)) throw new Error("invalid");
      api.runtime.sendMessage({ type: "IMPORT_STATE", payload: parsed }, () => {
        items = parsed.items;
        sites = Array.isArray(parsed.sites) ? parsed.sites : sites;
        render();
      });
    } catch {
      alert("Invalid backup file");
    }
  });
  e.target.value = "";
});

api.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
  items = state?.items || [];
  sites = state?.sites || [];
  notifications = state?.notifications || [];
  render();
});
