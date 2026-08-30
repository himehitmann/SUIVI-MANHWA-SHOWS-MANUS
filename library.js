/* Dasi standalone library — a local-first home for everything you saved. */
const api = globalThis.chrome;

let items = [];
let sites = [];
let notifications = [];
let lists = [];
let settings = { notifyNew: true };
let filter = "all";
let query = "";
let currentListId = null;
let view = "home";

const NEW_WINDOW = 14 * 24 * 3600 * 1000; // 2 weeks
const DASI_STORE_URL = "https://chromewebstore.google.com/detail/dasi";
const SHARE_TEXT = "Dasi — never lose your spot in any manga, webtoon, anime or series. Save & resume in one click.";

/* ---- inline SVG icons (no emoji anywhere) -------------------------------- */
const I = {
  star: '<svg class="ic fill" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  close: '<svg class="ic" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  open: '<svg class="ic" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>',
  play: '<svg class="ic fill" viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  trash: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
  grip: '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4" class="fill"/><circle cx="9" cy="12" r="1.4" class="fill"/><circle cx="9" cy="18" r="1.4" class="fill"/><circle cx="15" cy="6" r="1.4" class="fill"/><circle cx="15" cy="12" r="1.4" class="fill"/><circle cx="15" cy="18" r="1.4" class="fill"/></svg>',
  back: '<svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  image: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 4l16 16M20 4 4 20"/></svg>',
  fb: '<svg class="ic" viewBox="0 0 24 24"><path d="M14 8h2V5h-2c-2 0-3 1.3-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8.5c0-.3.2-.5.5-.5z" fill="currentColor" stroke="none"/></svg>',
  wa: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M8.5 8.5c-.3 0-.6.1-.8.5s-.7 1-.7 1.8 1 2.2 1.2 2.4 1.9 3 4.6 4c2.2.8 2.2.5 2.6.5s1.3-.5 1.5-1 .2-1 .1-1.1l-1.6-.8c-.2-.1-.5-.2-.7.1l-.7.8c-.1.2-.3.2-.5.1a5.6 5.6 0 0 1-2.8-2.6c-.1-.3 0-.4.1-.6l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.1-.3-.3-.3-.5-.3z" fill="currentColor" stroke="none"/></svg>',
  rd: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><circle cx="9" cy="13" r="1" class="fill"/><circle cx="15" cy="13" r="1" class="fill"/><path d="M9 16.5c1.7 1 4.3 1 6 0"/><path d="M16 6.5 15 11"/><circle cx="16.5" cy="6" r="1.2" class="fill"/></svg>',
  link: '<svg class="ic" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
};

const accentFor = (t) => (t === "watching" ? "#7E9BE6" : "#5FB79A");
const coverUrl = (i) => i.coverOverride || i.cover || "";
const isNew = (i) => Date.now() - (i.updatedAt || 0) < NEW_WINDOW && (i.progress || 0) < 100;

function marker(i) {
  const parts =
    i.type === "watching"
      ? [i.season && `Season ${i.season}`, i.episode && `Episode ${i.episode}`]
      : [i.volume && `Vol. ${i.volume}`, i.chapter && `Chapter ${i.chapter}`, i.page && `Page ${i.page}`];
  return parts.filter(Boolean).join(" · ") || i.domain || "";
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

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function coverInner(i, fontSize) {
  const u = coverUrl(i);
  return u
    ? `<img src="${esc(u)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`
    : `<span${fontSize ? ` style="font-size:${fontSize}px"` : ""}>${esc((i.title || "?")[0].toUpperCase())}</span>`;
}

let toastT;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---- optimistic mutations ------------------------------------------------ */
function update(id, patch) {
  const it = items.find((x) => x.id === id);
  if (it) Object.assign(it, patch);
  renderAll();
  api.runtime.sendMessage({ type: "UPDATE_ITEM", id, patch }, (r) => {
    if (r?.items) { items = r.items; renderAll(); }
  });
}

/* ---- HOME ---------------------------------------------------------------- */
function renderHero() {
  const hero = document.getElementById("hero");
  const i = items.filter((x) => (x.progress || 0) < 100).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (!i) { hero.hidden = true; return; }
  hero.hidden = false;
  hero.innerHTML = `
    <div class="hero-cover" style="background:${i.accent || "#B7A2F2"}">${coverInner(i, 30)}</div>
    <div class="hero-body">
      <p class="eyebrow">Continue ${i.type === "watching" ? "watching" : "reading"}</p>
      <h2 class="hero-title">${esc(i.title || "Untitled")}</h2>
      <p class="hero-marker">${esc(marker(i))} · ${relative(i.updatedAt)}</p>
      ${(i.progress || 0) > 0 ? `<div class="bar"><i style="width:${Math.min(100, i.progress)}%;background:${accentFor(i.type)}"></i></div>` : ""}
      <a class="resume" href="${esc(i.url || "#")}" target="_blank" rel="noreferrer" data-stop>${I.play} Resume</a>
    </div>`;
  hero.onclick = (e) => { if (!e.target.closest("[data-stop]")) openDrawer(i.id); };
}

function renderStats() {
  const s = [
    [items.length, "Tracked"],
    [items.filter((i) => i.type === "reading").length, "Reading"],
    [items.filter((i) => i.type === "watching").length, "Watching"],
    [items.filter((i) => i.favorite).length, "Favorites"],
    [items.filter((i) => (i.progress || 0) >= 100).length, "Finished"],
  ];
  document.getElementById("stats").innerHTML = s.map(([n, l]) => `<div class="chip"><b>${n}</b><span>${l}</span></div>`).join("");
}

function cardHtml(i) {
  const rating = i.rating || 0;
  const tags = (i.tags || []).slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `<article class="card" data-open="${i.id}">
    <button class="fav ${i.favorite ? "on" : ""}" data-fav="${i.id}" title="Favorite">${I.star}</button>
    <div class="cover" style="background:${i.accent || "#E4D9FA"}">${coverInner(i)}${isNew(i) ? '<span class="new-flag">NEW</span>' : ""}</div>
    <div class="card-body">
      <h3>${esc(i.title || "Untitled")}</h3>
      <p>${esc(marker(i))}</p>
      ${(i.progress || 0) > 0 ? `<div class="bar"><i style="width:${Math.min(100, i.progress)}%;background:${accentFor(i.type)}"></i></div>` : ""}
      <small>${relative(i.updatedAt)}</small>
      <div class="rate">${[1, 2, 3, 4, 5].map((n) => `<span data-rate="${i.id}" data-v="${n}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= rating ? "on" : ""}"`)}</span>`).join("")}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
    </div>
  </article>`;
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const q = query.toLowerCase();
  const list = items.filter((i) => {
    if (filter === "favorites" && !i.favorite) return false;
    if ((filter === "reading" || filter === "watching") && i.type !== filter) return false;
    if (!q) return true;
    return `${i.title} ${marker(i)} ${(i.tags || []).join(" ")}`.toLowerCase().includes(q);
  });
  if (!list.length) {
    grid.innerHTML = `<p class="empty">Nothing here yet. Open a chapter or an episode and hit save in the Dasi popup.</p>`;
    return;
  }
  grid.innerHTML = [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(cardHtml).join("");
}

/* ---- LISTS --------------------------------------------------------------- */
function listCover(l) {
  if (l.cover && /^https?:|^data:/.test(l.cover)) return `background-image:url('${esc(l.cover)}')`;
  return `background:${esc(l.cover || "#EDE6FF")}`;
}
function renderLists() {
  const grid = document.getElementById("list-grid");
  const cards = lists
    .map(
      (l) => `<div class="list-card" data-list="${l.id}">
        <div class="list-cover" style="${listCover(l)}">${l.cover && /^https?:|^data:/.test(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}</div>
        <div class="list-meta"><b>${esc(l.name)}</b><span>${(l.itemIds || []).length} work${(l.itemIds || []).length === 1 ? "" : "s"}</span></div>
      </div>`,
    )
    .join("");
  grid.innerHTML = cards + `<button class="list-card new-list" id="new-list">${I.plus}<span>New list</span></button>`;
}

function openList(id) {
  currentListId = id;
  document.getElementById("lists-index").hidden = true;
  const wrap = document.getElementById("list-detail");
  wrap.hidden = false;
  renderListDetail();
}

function renderListDetail() {
  const l = lists.find((x) => x.id === currentListId);
  const wrap = document.getElementById("list-detail");
  if (!l) { backToLists(); return; }
  const members = (l.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const notIn = items.filter((i) => !(l.itemIds || []).includes(i.id));
  wrap.innerHTML = `
    <button class="back-btn" id="back-lists">${I.back} All lists</button>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px">
      <div class="list-cover" style="width:64px;height:64px;border-radius:14px;font-size:24px;${listCover(l)}">${l.cover && /^https?:|^data:/.test(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}</div>
      <div style="flex:1;min-width:180px">
        <input id="list-name" value="${esc(l.name)}" style="font-size:24px;font-weight:800;letter-spacing:-.03em;border:0;border-bottom:2px solid transparent;background:none;width:100%;outline:none;padding:2px 0" />
        <small style="color:var(--muted)">${members.length} work${members.length === 1 ? "" : "s"} · drag to reorder</small>
      </div>
      <button class="btn" id="list-cover-btn">${I.image} Cover</button>
      <button class="btn danger" id="list-del">${I.trash} Delete</button>
    </div>
    <div class="section-t">In this list</div>
    <div id="list-items">${
      members.length
        ? members
            .map(
              (i) => `<div class="li-row" draggable="true" data-id="${i.id}">
        <span class="grip">${I.grip}</span>
        <div class="li-cover" style="background:${i.accent || "#E4D9FA"}">${coverInner(i)}</div>
        <div style="flex:1;min-width:0"><b>${esc(i.title)}</b><small>${esc(marker(i))}</small></div>
        <button class="btn danger" data-remove="${i.id}">Remove</button>
      </div>`,
            )
            .join("")
        : `<p class="empty" style="padding:24px 0">Empty — add works below.</p>`
    }</div>
    ${
      notIn.length
        ? `<div class="section-t">Add works</div><div class="chips-wrap" id="list-add">${notIn
            .map((i) => `<button class="chip-toggle" data-add="${i.id}">${I.plus} ${esc(i.title)}</button>`)
            .join("")}</div>`
        : ""
    }`;
  wireListDetail(l);
}

function wireListDetail(l) {
  document.getElementById("back-lists").onclick = backToLists;
  const name = document.getElementById("list-name");
  name.onchange = () => listMsg("LIST_UPDATE", { id: l.id, patch: { name: name.value.trim() || "Untitled" } });
  document.getElementById("list-cover-btn").onclick = () => changeCover((val) => listMsg("LIST_UPDATE", { id: l.id, patch: { cover: val } }));
  document.getElementById("list-del").onclick = () => {
    if (confirm(`Delete "${l.name}"? Works stay in your library.`)) listMsg("LIST_DELETE", { id: l.id }, backToLists);
  };
  document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => setListItems(l.id, [...(l.itemIds || []), b.dataset.add])));
  document.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => setListItems(l.id, (l.itemIds || []).filter((x) => x !== b.dataset.remove))));
  enableDrag(l);
}

function enableDrag(l) {
  const container = document.getElementById("list-items");
  let dragEl = null;
  container.querySelectorAll(".li-row").forEach((row) => {
    row.addEventListener("dragstart", () => { dragEl = row; row.classList.add("dragging"); });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      container.querySelectorAll(".li-row").forEach((r) => r.classList.remove("over"));
      const order = [...container.querySelectorAll(".li-row")].map((r) => r.dataset.id);
      setListItems(l.id, order, true);
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
      if (dragEl && dragEl !== row) container.insertBefore(dragEl, after ? row.nextSibling : row);
    });
  });
}

function setListItems(id, itemIds, silent) {
  const l = lists.find((x) => x.id === id);
  if (l) l.itemIds = itemIds;
  api.runtime.sendMessage({ type: "LIST_SET_ITEMS", id, itemIds }, (r) => {
    if (r?.lists) lists = r.lists;
    if (!silent) renderListDetail();
  });
  if (!silent) renderListDetail();
}

function listMsg(type, payload, done) {
  api.runtime.sendMessage({ type, ...payload }, (r) => {
    if (r?.lists) lists = r.lists;
    if (done) done();
    else { renderLists(); if (currentListId) renderListDetail(); }
  });
}

function backToLists() {
  currentListId = null;
  document.getElementById("list-detail").hidden = true;
  document.getElementById("lists-index").hidden = false;
  renderLists();
}

/* ---- DRAWER (work detail) ------------------------------------------------ */
function openDrawer(id) {
  const i = items.find((x) => x.id === id);
  if (!i) return;
  const d = document.getElementById("drawer");
  const isWatch = i.type === "watching";
  const unit = isWatch ? "Episode" : "Chapter";
  const cur = isWatch ? i.episode || 0 : i.chapter || 0;
  const memberIn = lists.filter((l) => (l.itemIds || []).includes(i.id)).map((l) => l.id);
  d.innerHTML = `
    <div class="drawer-hero">
      <button class="icon-btn drawer-close" id="dr-close">${I.close}</button>
      <div class="drawer-cover" style="background:${i.accent || "#B7A2F2"}">${coverInner(i, 40)}
        <button class="change-cover" id="dr-cover" title="Change cover">${I.image}</button>
      </div>
      <h2 class="drawer-title">${esc(i.title || "Untitled")}</h2>
      <p class="drawer-marker">${esc(marker(i))} · ${relative(i.updatedAt)}</p>
    </div>
    <div class="drawer-body">
      ${
        i.synopsis
          ? `<div class="section-t">Synopsis</div><p class="synopsis clamp" id="dr-syn">${esc(i.synopsis)}</p><button class="link-btn" id="dr-syn-toggle">Show more</button>`
          : ""
      }
      <div class="section-t">Progress</div>
      <div class="stepper">
        <button id="dr-minus">${I.minus}</button>
        <input id="dr-num" type="number" min="0" value="${cur}" />
        <button id="dr-plus">${I.plus}</button>
        <span>${unit}${isWatch && i.season ? ` · Season ${i.season}` : ""}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn ${(i.progress || 0) >= 100 ? "" : "primary"}" id="dr-done">${I.check} ${(i.progress || 0) >= 100 ? "Mark unfinished" : "Mark finished"}</button>
        <a class="btn" href="${esc(i.url || "#")}" target="_blank" rel="noreferrer">${I.open} Open</a>
      </div>
      <div class="section-t">Rating</div>
      <div class="rate-big" id="dr-rate">${[1, 2, 3, 4, 5].map((n) => `<span data-v="${n}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= (i.rating || 0) ? "on" : ""}"`)}</span>`).join("")}</div>
      <div class="section-t">Tags</div>
      <div class="tag-edit" id="dr-tags"></div>
      <div class="section-t">Lists</div>
      <div class="chips-wrap" id="dr-lists">
        ${lists.map((l) => `<button class="chip-toggle ${memberIn.includes(l.id) ? "on" : ""}" data-list="${l.id}">${memberIn.includes(l.id) ? I.check : I.plus} ${esc(l.name)}</button>`).join("") || '<span style="color:var(--muted);font-size:12px">No lists yet — create one in the Lists tab.</span>'}
      </div>
      <div class="section-t">Manage</div>
      <button class="btn danger" id="dr-remove">${I.trash} Remove from library</button>
    </div>`;
  document.getElementById("scrim").classList.add("open");
  d.classList.add("open");
  wireDrawer(i, isWatch);
}

function wireDrawer(i, isWatch) {
  const close = () => closeDrawer();
  document.getElementById("dr-close").onclick = close;
  const syn = document.getElementById("dr-syn");
  const synT = document.getElementById("dr-syn-toggle");
  if (synT) synT.onclick = () => { syn.classList.toggle("clamp"); synT.textContent = syn.classList.contains("clamp") ? "Show more" : "Show less"; };

  const num = document.getElementById("dr-num");
  const key = isWatch ? "episode" : "chapter";
  const latestKey = isWatch ? "latestEpisode" : "latestChapter";
  const setNum = (v) => {
    const n = Math.max(0, Math.round(Number(v) || 0));
    num.value = n;
    const patch = { [key]: n || undefined };
    patch[latestKey] = Math.max(i[latestKey] || 0, n) || undefined;
    update(i.id, patch);
  };
  document.getElementById("dr-minus").onclick = () => setNum((Number(num.value) || 0) - 1);
  document.getElementById("dr-plus").onclick = () => setNum((Number(num.value) || 0) + 1);
  num.onchange = () => setNum(num.value);

  document.getElementById("dr-done").onclick = () => {
    const done = (i.progress || 0) >= 100;
    update(i.id, { progress: done ? 0 : 100, status: done ? "in_progress" : "completed" });
    setTimeout(() => openDrawer(i.id), 30);
  };
  document.getElementById("dr-cover").onclick = () => changeCover((val) => { update(i.id, { coverOverride: val }); setTimeout(() => openDrawer(i.id), 30); });

  document.querySelectorAll("#dr-rate span").forEach((s) =>
    (s.onclick = () => { const v = Number(s.dataset.v); update(i.id, { rating: i.rating === v ? 0 : v }); setTimeout(() => openDrawer(i.id), 30); }),
  );

  renderDrawerTags(i);

  document.querySelectorAll("#dr-lists [data-list]").forEach((b) =>
    (b.onclick = () => {
      const l = lists.find((x) => x.id === b.dataset.list);
      if (!l) return;
      const has = (l.itemIds || []).includes(i.id);
      setListItemsSilent(l.id, has ? l.itemIds.filter((x) => x !== i.id) : [...(l.itemIds || []), i.id]);
      setTimeout(() => openDrawer(i.id), 30);
    }),
  );

  document.getElementById("dr-remove").onclick = () => {
    if (!confirm(`Remove "${i.title}" from your library?`)) return;
    api.runtime.sendMessage({ type: "REMOVE_ITEM", id: i.id }, (r) => { items = r?.items || items.filter((x) => x.id !== i.id); closeDrawer(); renderAll(); });
  };
}

function renderDrawerTags(i) {
  const wrap = document.getElementById("dr-tags");
  wrap.innerHTML =
    (i.tags || []).map((t) => `<span class="tag">${esc(t)} <span class="rm" data-rm="${esc(t)}">${I.close.replace('class="ic"', 'class="ic" style="width:11px;height:11px"')}</span></span>`).join("") +
    `<button class="tag-add" id="dr-addtag">+ tag</button>`;
  wrap.querySelectorAll("[data-rm]").forEach((s) => (s.onclick = () => update(i.id, { tags: (i.tags || []).filter((x) => x !== s.dataset.rm) })));
  document.getElementById("dr-addtag").onclick = () => {
    const t = (prompt("Add a tag") || "").trim();
    if (t) update(i.id, { tags: [...new Set([...(i.tags || []), t])] });
  };
}

function setListItemsSilent(id, itemIds) {
  const l = lists.find((x) => x.id === id);
  if (l) l.itemIds = itemIds;
  api.runtime.sendMessage({ type: "LIST_SET_ITEMS", id, itemIds }, (r) => { if (r?.lists) lists = r.lists; });
}

function closeDrawer() {
  document.getElementById("scrim").classList.remove("open");
  document.getElementById("drawer").classList.remove("open");
}

/* Change a cover: pick a saved work's art, paste a URL, or upload an image. */
function changeCover(apply) {
  const choice = prompt("Cover image — paste an image URL, or type 'upload' to pick a file, or leave blank to clear:", "");
  if (choice === null) return;
  if (choice.trim().toLowerCase() === "upload") {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => apply(String(r.result));
      r.readAsDataURL(f);
    };
    inp.click();
    return;
  }
  apply(choice.trim());
}

/* ---- render + nav -------------------------------------------------------- */
function renderAll() {
  renderHero();
  renderStats();
  renderGrid();
  renderLists();
  if (currentListId) renderListDetail();
  const newCount = items.filter(isNew).length;
  const bell = document.getElementById("bell");
  bell.querySelector(".badge-dot")?.remove();
  if (newCount) { const b = document.createElement("span"); b.className = "badge-dot"; b.textContent = newCount; bell.appendChild(b); }
  document.getElementById("sw-notify").classList.toggle("on", !!settings.notifyNew);
}

function switchView(v) {
  view = v;
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("active", s.id === `view-${v}`));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---- events -------------------------------------------------------------- */
document.getElementById("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) switchView(b.dataset.v);
});
document.getElementById("brand").onclick = () => { filter = "all"; query = ""; document.getElementById("q").value = ""; document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("active", x.dataset.f === "all")); switchView("home"); };
document.getElementById("bell").onclick = () => {
  const n = items.filter(isNew).length;
  switchView("home");
  toast(n ? `${n} work${n === 1 ? "" : "s"} with something new` : "Nothing new right now");
};

document.getElementById("filters").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("active", x === b));
  renderGrid();
});
document.getElementById("q").addEventListener("input", (e) => { query = e.target.value; renderGrid(); });

document.getElementById("grid").addEventListener("click", (e) => {
  const fav = e.target.closest(".fav");
  if (fav) { const it = items.find((x) => x.id === fav.dataset.fav); if (it) update(it.id, { favorite: !it.favorite }); return; }
  const rate = e.target.closest("[data-rate]");
  if (rate) { const it = items.find((x) => x.id === rate.dataset.rate); const v = Number(rate.dataset.v); update(rate.dataset.rate, { rating: it && it.rating === v ? 0 : v }); return; }
  const card = e.target.closest("[data-open]");
  if (card) openDrawer(card.dataset.open);
});

document.getElementById("list-grid").addEventListener("click", (e) => {
  if (e.target.closest("#new-list")) { listMsg("LIST_CREATE", { name: "New list" }, () => { renderLists(); const last = lists[lists.length - 1]; if (last) openList(last.id); }); return; }
  const card = e.target.closest("[data-list]");
  if (card) openList(card.dataset.list);
});

document.getElementById("scrim").onclick = closeDrawer;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

document.getElementById("sw-notify").onclick = () => {
  settings.notifyNew = !settings.notifyNew;
  document.getElementById("sw-notify").classList.toggle("on", settings.notifyNew);
  api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { notifyNew: settings.notifyNew } }, (r) => { if (r?.settings) settings = r.settings; });
};

document.getElementById("export").onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 2, items, sites, notifications, lists, settings }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dasi-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
document.getElementById("import").onclick = () => document.getElementById("file").click();
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
        lists = Array.isArray(parsed.lists) ? parsed.lists : lists;
        renderAll();
        toast("Library restored");
      });
    } catch { alert("Invalid backup file"); }
  });
  e.target.value = "";
});
document.getElementById("sync-link").onclick = () => api.runtime.openOptionsPage();

/* Share row + store rating — on the web interface too, not just the popup. */
const openUrl = (u) => api.tabs.create({ url: u });
document.getElementById("share").innerHTML = `
  <button class="soc x" title="Share on X">${I.x}</button>
  <button class="soc fb" title="Share on Facebook">${I.fb}</button>
  <button class="soc wa" title="Share on WhatsApp">${I.wa}</button>
  <button class="soc rd" title="Share on Reddit">${I.rd}</button>
  <button class="soc cp" title="Copy link">${I.link}</button>`;
const [sx, sf, sw, sr, sc] = document.querySelectorAll("#share .soc");
sx.onclick = () => openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(DASI_STORE_URL)}`);
sf.onclick = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(DASI_STORE_URL)}`);
sw.onclick = () => openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_TEXT + " " + DASI_STORE_URL)}`);
sr.onclick = () => openUrl(`https://www.reddit.com/submit?url=${encodeURIComponent(DASI_STORE_URL)}&title=${encodeURIComponent(SHARE_TEXT)}`);
sc.onclick = () => { try { navigator.clipboard?.writeText(DASI_STORE_URL); } catch {} toast("Link copied"); };

const rateStore = document.getElementById("rate-store");
rateStore.innerHTML = [1, 2, 3, 4, 5].map((n) => `<span data-v="${n}">${I.star}</span>`).join("");
const rsStars = [...rateStore.querySelectorAll("span")];
const paint = (n) => rsStars.forEach((s, idx) => s.querySelector(".ic").classList.toggle("on", idx < n));
rsStars.forEach((s) => (s.onmouseenter = () => paint(Number(s.dataset.v))));
rateStore.onmouseleave = () => paint(0);
rateStore.onclick = () => { paint(5); setTimeout(() => openUrl(DASI_STORE_URL), 350); };

/* ---- boot ---------------------------------------------------------------- */
api.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
  items = state?.items || [];
  sites = state?.sites || [];
  notifications = state?.notifications || [];
  lists = state?.lists || [];
  settings = { notifyNew: true, ...(state?.settings || {}) };
  renderAll();
});
api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => {
  void api.runtime.lastError;
  if (s && s.configured) document.getElementById("sync-state").textContent = s.meta && s.meta.lastError ? "Signed in — sync needs attention" : `Synced as ${s.email || "you"}`;
});
