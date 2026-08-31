/*
 * Dasi service worker — local-first storage and merge policy.
 *
 * The content script is injected ON DEMAND (when the user opens the popup or
 * presses the shortcut) using the activeTab grant, so Dasi never reads every
 * site in the background. One canonical item is kept per work; the furthest
 * progress wins by default and a lower incoming progress is surfaced as a
 * conflict for the user to resolve instead of silently overwriting.
 */
const api = globalThis.chrome;
const ITEMS_KEY = "dasi.items";
const SITES_KEY = "dasi.sites";
const NOTIF_KEY = "dasi.notifications";
const LISTS_KEY = "dasi.lists";
const SETTINGS_KEY = "dasi.settings";
const DEFAULT_SETTINGS = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" }, tmdbKey: "", rawgKey: "", imgServer: "" };

// Canonical work id + fuzzy matching — MUST mirror the web app's item.ts
// (normalizeTitle / workId / sameWork) so the same work merges across the
// extension and the web app, and across DIFFERENT sites even when the title
// differs slightly (spelling, word order, an article, a subtitle).
const LEADING_ARTICLE = /^(the|a|an|le|la|les|un|une|el|los|las|der|die|das)\s+/;
const normalizeTitle = (title) => {
  let t = (title || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  t = t.replace(/\b(chapter|chap|ch|episode|epi|ep|season|saison|vol|volume|page|part|arc|cour)\s*\d+\b/g, " ");
  t = t.replace(/\bs\s*\d+\s*e\s*\d+\b/g, " ");
  t = t.replace(/第?\s*\d+\s*[화話话巻卷章回]/g, " ");
  t = t.replace(/[\u2000-\u206F\u3000-\u303F\uFF00-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/g, " ");
  t = t.replace(/[^0-9a-z\u0080-\uffff]+/gi, " ").trim();
  t = t.replace(LEADING_ARTICLE, "");
  return t.replace(/\s+/g, " ").trim();
};
const workKey = (p) => {
  const n = normalizeTitle(p.workId || p.title);
  return n ? n.replace(/\s+/g, "-") : "";
};
const editRatio = (a, b) => {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m = a.length, n = b.length, d = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return 1 - d[n] / Math.max(m, n);
};
const sameWork = (a, b) => {
  const na = normalizeTitle(a), nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(na.split(" ").filter(Boolean)), tb = new Set(nb.split(" ").filter(Boolean));
  if (ta.size === tb.size && [...ta].every((x) => tb.has(x))) return true;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size >= 2) { let inter = 0; small.forEach((x) => big.has(x) && inter++); if (inter === small.size && small.size / big.size >= 0.6) return true; }
  return editRatio(na, nb) >= 0.9;
};

const numericProgress = (p) =>
  p.chapter || p.episode || p.page || (p.duration && p.position ? p.position / p.duration : 0) || 0;

const percent = (p) => {
  if (p.duration && p.position) return Math.min(100, Math.round((p.position / p.duration) * 100));
  return undefined;
};

/*
 * Persistence: library data (items, sites, notifications) is written to BOTH
 * chrome.storage.local (always current) and chrome.storage.sync (best-effort),
 * so a fresh install on another computer signed into the same browser account
 * gets the library back. Reads prefer local; when local is empty (new device)
 * they fall back to sync. chrome.storage.sync has quota limits, so a failed
 * sync write degrades silently to local-only — the product never breaks.
 * Transient values (current detection, last conflict) stay local-only.
 */
const read = async (key, fallback) => {
  const local = (await api.storage.local.get(key))[key];
  if (local !== undefined) return local;
  try {
    const synced = (await api.storage.sync.get(key))[key];
    if (synced !== undefined) {
      await api.storage.local.set({ [key]: synced }); // seed local from sync on a new device
      return synced;
    }
  } catch {
    /* sync unavailable */
  }
  return fallback;
};

/** Write data keys to local (authoritative) and mirror to sync when it fits. */
const writeData = async (obj) => {
  await api.storage.local.set(obj);
  try {
    await api.storage.sync.set(obj);
  } catch {
    /* over quota or unavailable: local-only is fine */
  }
};

/*
 * Notifications. When a tracked work gains newly-released entries (or an awaited
 * game reaches its release date), we record an in-app notification and — if the
 * user hasn't turned them off — raise a system notification. Local and
 * best-effort: no network, no polling of sites we aren't already on.
 */
async function pushNotification(rec) {
  const list = await read(NOTIF_KEY, []);
  const next = [{ id: "n_" + Math.random().toString(36).slice(2, 10), read: false, ts: Date.now(), ...rec }, ...list].slice(0, 120);
  await writeData({ [NOTIF_KEY]: next });
  return next;
}
async function systemNotify(title, message, id) {
  try {
    const s = await read(SETTINGS_KEY, DEFAULT_SETTINGS);
    if (s && s.notifyNew === false) return;
    if (api.notifications && api.notifications.create) {
      api.notifications.create(id || "dasi_" + Date.now(), { type: "basic", iconUrl: "icon.png", title, message });
    }
  } catch {
    /* notifications unavailable */
  }
}

/*
 * Optional cloud sync (mirrors the web app's HTTP provider, lib/sync.ts).
 *
 * Config is device-local auth — { apiUrl, token, email, plan } — kept ONLY in
 * storage.local (never mirrored to storage.sync, so a token never leaves the
 * machine). Sync is pull → merge → push against the same /sync endpoint the web
 * app uses, so both surfaces converge on one library. Everything here is
 * best-effort: if the backend is absent or fails, the extension keeps working
 * entirely on local data.
 */
const SYNC_CFG_KEY = "dasi.sync.config";
const SYNC_META_KEY = "dasi.sync.meta";
const AUTO_SYNC_COOLDOWN_MS = 8000;
let lastAutoSync = 0;

const apiBase = (url) => (url || "").replace(/\/+$/, "");
const getSyncConfig = async () => (await api.storage.local.get(SYNC_CFG_KEY))[SYNC_CFG_KEY] || null;

const setSyncMeta = async (meta) => {
  const prev = (await api.storage.local.get(SYNC_META_KEY))[SYNC_META_KEY] || {};
  await api.storage.local.set({ [SYNC_META_KEY]: { ...prev, ...meta } });
};

async function apiCall(cfg, path, init = {}) {
  return fetch(apiBase(cfg.apiUrl) + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

/** Sign in / sign up against the backend and persist the resulting config. */
async function syncAuth(path, apiUrl, email, password) {
  const res = await fetch(apiBase(apiUrl) + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `http_${res.status}`);
  }
  const data = await res.json();
  const cfg = { apiUrl: apiBase(apiUrl), token: data.token, email: data.user.email, plan: data.user.plan };
  await api.storage.local.set({ [SYNC_CFG_KEY]: cfg });
  await setSyncMeta({ lastError: null });
  return cfg;
}

/** Item merge: same id, greater updatedAt wins (matches server/lib/merge.ts). */
function mergeItems(remote, local) {
  const byId = new Map();
  for (const it of remote || []) byId.set(it.id, it);
  for (const it of local || []) {
    const prev = byId.get(it.id);
    if (!prev || (it.updatedAt || 0) >= (prev.updatedAt || 0)) byId.set(it.id, it);
  }
  return [...byId.values()];
}

/** Union by id (falls back to url) preferring the second list's copy. */
function mergeById(remote, local) {
  const byId = new Map();
  for (const it of remote || []) byId.set(it.id ?? it.url, it);
  for (const it of local || []) byId.set(it.id ?? it.url, it);
  return [...byId.values()];
}

/** Pull the remote blob, merge into local storage, push the union back. */
async function syncNow() {
  const cfg = await getSyncConfig();
  if (!cfg || !cfg.token) throw new Error("not_signed_in");

  const getRes = await apiCall(cfg, "/sync");
  if (getRes.status === 401) {
    await setSyncMeta({ lastError: "unauthorized" });
    throw new Error("unauthorized");
  }
  const remote = getRes.ok ? await getRes.json().catch(() => ({ blob: null })) : { blob: null };
  const rb = remote.blob || null;

  const [items, sites, notifs, lists] = await Promise.all([
    read(ITEMS_KEY, []),
    read(SITES_KEY, []),
    read(NOTIF_KEY, []),
    read(LISTS_KEY, []),
  ]);
  const mergedItems = mergeItems(rb && rb.items, items);
  const mergedSites = mergeById(rb && rb.sites, sites);
  const mergedNotifs = mergeById(rb && rb.notifications, notifs);
  const mergedLists = mergeById(rb && rb.lists, lists);
  await writeData({ [ITEMS_KEY]: mergedItems, [SITES_KEY]: mergedSites, [NOTIF_KEY]: mergedNotifs, [LISTS_KEY]: mergedLists });

  // Push the merged library, preserving web-only slices (learn/plan) that the
  // extension doesn't own so a push never wipes them.
  const blob = {
    items: mergedItems,
    sites: mergedSites,
    notifications: mergedNotifs,
    lists: mergedLists,
    updatedAt: Date.now(),
  };
  if (rb) {
    if (rb.learn) blob.learn = rb.learn;
    if (rb.plan) blob.plan = rb.plan;
  }
  const putRes = await apiCall(cfg, "/sync", { method: "PUT", body: JSON.stringify({ blob }) });
  if (!putRes.ok) {
    await setSyncMeta({ lastError: `push_${putRes.status}` });
    throw new Error(`push_${putRes.status}`);
  }
  await setSyncMeta({ lastSyncAt: Date.now(), lastError: null });
  return { items: mergedItems.length, sites: mergedSites.length, notifications: mergedNotifs.length };
}

/** Fire-and-forget sync after a local change, rate-limited so saves stay cheap. */
function autoSync() {
  getSyncConfig().then((cfg) => {
    if (!cfg || !cfg.token) return;
    const now = Date.now();
    if (now - lastAutoSync < AUTO_SYNC_COOLDOWN_MS) return;
    lastAutoSync = now;
    syncNow().catch(() => {
      /* best-effort; error is recorded in sync meta */
    });
  });
}

async function writeItem(payload) {
  const items = await read(ITEMS_KEY, []);
  let key = workKey(payload);
  let existing = items.find((i) => i.id === key);
  // Cross-site merge: no exact id match → look for the same work saved under a
  // slightly different title on another site, and keep its id so they converge.
  if (!existing && payload.type !== "game") {
    const fuzzy = items.find((i) => i.type === payload.type && i.id !== key && sameWork(i.title, payload.title));
    if (fuzzy) { existing = fuzzy; key = fuzzy.id; }
  }
  const incomingScore = numericProgress(payload);
  const existingScore = existing ? numericProgress(existing) : -1;

  const incoming = {
    ...payload,
    id: key,
    updatedAt: Date.now(),
    progress: percent(payload) ?? existing?.progress ?? 0,
    status: percent(payload) && percent(payload) > 92 ? "completed" : "in_progress",
  };

  // Regression guard: keep the furthest position, flag the conflict.
  if (existing && existingScore > incomingScore && incomingScore > 0) {
    await api.storage.local.set({ "dasi.lastConflict": { existing, incoming, reason: "lower_progress" } });
    return { item: existing, conflict: true, kept: "existing" };
  }

  // Series-stable cover: keep the first cover we captured; only replace it when
  // a save comes from a series/overview page (no chapter/episode marker), which
  // carries the real series art rather than an episode thumbnail. A manual
  // coverOverride always wins at render time.
  const incomingIsSeriesLevel = !(payload.chapter || payload.episode || payload.season || payload.volume);
  let cover = existing?.cover || "";
  if (payload.cover && (!cover || incomingIsSeriesLevel)) cover = payload.cover;

  const merged = {
    ...existing,
    ...incoming,
    cover,
    coverOverride: existing?.coverOverride || undefined,
    synopsis: payload.synopsis || existing?.synopsis || "",
    // Auto-tags: seed from detected genres on first save, then user-owned.
    tags: existing?.tags ?? (Array.isArray(payload.genres) ? payload.genres : []),
    // Furthest point ever reached (for "mark all up to here", progress display).
    latestChapter: Math.max(existing?.latestChapter || 0, payload.chapter || 0) || undefined,
    latestEpisode: Math.max(existing?.latestEpisode || 0, payload.episode || 0) || undefined,
    // How many entries are released (auto-detected from the page, never lowered).
    total: Math.max(existing?.total || 0, payload.available || 0, payload.chapter || 0, payload.episode || 0) || existing?.total || undefined,
    createdAt: existing?.createdAt || Date.now(),
    favorite: existing?.favorite || false,
    rating: existing?.rating || 0,
    sources: [...new Set([...(existing?.sources || []), payload.domain].filter(Boolean))],
  };

  const next = [merged, ...items.filter((i) => i.id !== key)].slice(0, 800);
  await writeData({ [ITEMS_KEY]: next });
  await api.storage.local.set({ "dasi.lastConflict": null });

  // Newly-released entries on a work we were already tracking → notify.
  if (existing && merged.type !== "game") {
    const cur = merged.type === "watching" ? merged.episode || 0 : merged.chapter || 0;
    const newTotal = merged.total || 0;
    if (newTotal > (existing.total || 0) && newTotal > cur) {
      const n = newTotal - cur;
      const unit = merged.type === "watching" ? "episode" : "chapter";
      const msg = `${n} new ${unit}${n > 1 ? "s" : ""} available`;
      await pushNotification({ itemId: key, title: merged.title, message: msg, url: merged.url });
      systemNotify(merged.title, msg, "dasi_" + key);
    }
  }
  // First time we see this work → enrich it from AniList in the background so
  // it gets a real series cover, synopsis, tags and released count.
  if (merged.type !== "game" && !merged.enrichedAt) enrichWork(key).then(() => autoSync()).catch(() => {});
  return { item: merged, conflict: Boolean(existing), kept: "incoming" };
}

/*
 * Optional translation relay. The in-page translator (translate.js) hands us an
 * array of strings and a target language; we translate them (keyless Google
 * endpoint, MyMemory fallback) and hand them back. Runs in the background so the
 * cross-origin fetch uses the extension's host permissions instead of the
 * page's CSP. Best-effort: a failed segment returns the original text.
 */
async function gtxTranslate(text, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`gtx_${r.status}`);
  const j = await r.json();
  return Array.isArray(j && j[0]) ? j[0].map((s) => (s && s[0]) || "").join("") : text;
}
async function mymemoryTranslate(text, target) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${encodeURIComponent("en|" + target)}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j && j.responseData && j.responseData.translatedText) || text;
}
async function translateOne(text, target) {
  try {
    return await gtxTranslate(text, target);
  } catch {
    try {
      return await mymemoryTranslate(text, target);
    } catch {
      return text;
    }
  }
}
/** Translate an array of strings, batching with a newline join to cut calls. */
async function translateTexts(texts, target) {
  const out = new Array(texts.length);
  const cap = Math.min(texts.length, 500);
  const SEP = "\n";
  let i = 0;
  while (i < cap) {
    const chunk = texts.slice(i, i + 20);
    const joined = chunk.join(SEP);
    let ok = false;
    if (joined.length < 4000) {
      try {
        const tr = await gtxTranslate(joined, target);
        const parts = tr.split(SEP);
        if (parts.length === chunk.length) { parts.forEach((p, k) => (out[i + k] = p)); ok = true; }
      } catch {
        /* fall through to per-item */
      }
    }
    if (!ok) for (let k = 0; k < chunk.length; k++) out[i + k] = await translateOne(chunk[k], target);
    i += chunk.length;
  }
  for (let k = cap; k < texts.length; k++) out[k] = texts[k]; // beyond cap: keep original
  return out;
}

/*
 * Optional online enrichment via AniList (keyless GraphQL). Fills in the fields
 * a page often lacks — a proper SERIES cover, synopsis, genres/tags, and the
 * released episode/chapter count — so a work saved from a single episode still
 * gets rich, correct metadata. Also powers "search by name to add". Best-effort
 * and non-blocking: failures leave the local-first data untouched.
 */
const ANILIST_URL = "https://graphql.anilist.co";
const stripHtml = (s) => (s || "").replace(/<br\s*\/?>(\s*)/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
const READING_FORMATS = new Set(["MANGA", "NOVEL", "ONE_SHOT"]);
function mediaToResult(m) {
  const title = (m.title && (m.title.english || m.title.romaji || m.title.native)) || "";
  const type = READING_FORMATS.has(m.format) ? "reading" : "watching";
  let format = m.format || "";
  if (m.format === "MANGA") format = m.countryOfOrigin === "KR" ? "MANHWA" : m.countryOfOrigin === "CN" ? "MANHUA" : "MANGA";
  else if (m.format === "NOVEL") format = "NOVEL";
  else if (type === "watching") format = m.format === "MOVIE" ? "MOVIE" : "ANIME";
  return {
    title,
    type,
    cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || "",
    synopsis: stripHtml(m.description).slice(0, 700),
    genres: Array.isArray(m.genres) ? m.genres.slice(0, 6) : [],
    total: type === "reading" ? m.chapters || undefined : m.episodes || undefined,
    season: m.seasonYear || undefined,
    format,
    url: m.siteUrl || "",
  };
}
async function anilistSearch(query) {
  const gql = `query($s:String){Page(perPage:10){media(search:$s,sort:SEARCH_MATCH,isAdult:false){id title{romaji english native} coverImage{extraLarge large} description genres seasonYear format countryOfOrigin siteUrl episodes chapters}}}`;
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables: { s: query } }),
  });
  if (!res.ok) throw new Error(`anilist_${res.status}`);
  const data = await res.json();
  const media = (data && data.data && data.data.Page && data.data.Page.media) || [];
  return media.map(mediaToResult).filter((r) => r.title);
}
/** Books via OpenLibrary (keyless). */
async function openLibrarySearch(query) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=title,author_name,cover_i,first_publish_year,subject`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`openlibrary_${res.status}`);
  const data = await res.json();
  return (data.docs || []).filter((d) => d.title).map((d) => ({
    title: d.title,
    type: "reading",
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : "",
    synopsis: Array.isArray(d.author_name) && d.author_name.length ? `by ${d.author_name[0]}` : "",
    genres: Array.isArray(d.subject) ? d.subject.slice(0, 4) : [],
    total: undefined,
    season: undefined,
    format: "Book",
    url: "",
  }));
}
/** Games via the Steam storefront search (keyless). */
async function steamSearch(query) {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`steam_${res.status}`);
  const data = await res.json();
  return (data.items || []).filter((g) => g.name).slice(0, 6).map((g) => ({
    title: g.name,
    type: "game",
    cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.id}/header.jpg`,
    synopsis: "",
    genres: [],
    price: g.price ? `$${(g.price.final / 100).toFixed(2)}` : undefined,
    platform: "Steam",
    format: "Game",
    url: `https://store.steampowered.com/app/${g.id}`,
  }));
}
/** Live-action TV series via TVMaze (keyless) — covers Western/American shows. */
async function tvmazeSearch(query) {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tvmaze_${res.status}`);
  const data = await res.json();
  return (data || []).slice(0, 6).map((row) => row.show).filter((sh) => sh && sh.name).map((sh) => ({
    title: sh.name,
    type: "watching",
    cover: (sh.image && (sh.image.original || sh.image.medium)) || "",
    synopsis: stripHtml(sh.summary).slice(0, 500),
    genres: Array.isArray(sh.genres) ? sh.genres.slice(0, 4) : [],
    season: (sh.premiered || "").slice(0, 4) || undefined,
    format: "Series",
    url: sh.url || "",
  }));
}

/** Films & TV via TMDB (needs the user's free API key from settings). */
async function tmdbSearch(query, key) {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tmdb_${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
    .slice(0, 6)
    .map((r) => ({
      title: r.title || r.name,
      type: "watching",
      cover: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : "",
      synopsis: (r.overview || "").slice(0, 500),
      genres: [],
      season: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
      format: r.media_type === "tv" ? "TV" : "Movie",
      url: `https://www.themoviedb.org/${r.media_type}/${r.id}`,
    }));
}
/** Games via RAWG (needs the user's free API key from settings). */
async function rawgSearch(query, key) {
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(query)}&page_size=6`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rawg_${res.status}`);
  const data = await res.json();
  return (data.results || []).filter((g) => g.name).map((g) => ({
    title: g.name,
    type: "game",
    cover: g.background_image || "",
    synopsis: "",
    genres: (g.genres || []).map((x) => x.name).slice(0, 4),
    releaseDate: g.released || undefined,
    platform: (g.platforms && g.platforms[0] && g.platforms[0].platform && g.platforms[0].platform.name) || "PC",
    format: "Game",
    url: g.slug ? `https://rawg.io/games/${g.slug}` : "",
  }));
}
/** Unified catalog search across AniList (anime/manga), Steam & RAWG (games),
 * OpenLibrary (books) and TMDB (films/TV). Keyless sources always run; TMDB and
 * RAWG run only when a key is configured. Each source is best-effort. */
async function catalogSearchAll(query) {
  const s = await read(SETTINGS_KEY, DEFAULT_SETTINGS);
  const tasks = [anilistSearch(query), steamSearch(query), openLibrarySearch(query), tvmazeSearch(query)];
  if (s && s.tmdbKey) tasks.push(tmdbSearch(query, s.tmdbKey));
  if (s && s.rawgKey) tasks.push(rawgSearch(query, s.rawgKey));
  const settled = await Promise.allSettled(tasks);
  const out = [];
  for (const r of settled) if (r.status === "fulfilled") out.push(...r.value);
  // De-dup by normalized title+type, keep the richest (with a cover first).
  const seen = new Map();
  for (const r of out) {
    const k = normalizeTitle(r.title) + "|" + r.type;
    if (!seen.has(k) || (!seen.get(k).cover && r.cover)) seen.set(k, r);
  }
  return [...seen.values()].slice(0, 20);
}

/** Enrich one stored work in place from AniList (once per work). */
async function enrichWork(id) {
  const items = await read(ITEMS_KEY, []);
  const it = items.find((x) => x.id === id);
  if (!it || it.type === "game" || it.enrichedAt) return;
  let results;
  try {
    results = await anilistSearch(it.title);
  } catch {
    return;
  }
  const match = results.find((r) => sameWork(r.title, it.title) && (r.type === it.type || !it.type));
  const patch = { enrichedAt: Date.now() };
  if (match) {
    if (!it.coverOverride && match.cover) patch.cover = match.cover; // real series cover (fixes episode-thumbnail covers)
    if (!it.synopsis && match.synopsis) patch.synopsis = match.synopsis;
    if ((!it.tags || !it.tags.length) && match.genres.length) patch.tags = match.genres;
    if (match.total && match.total > (it.total || 0)) patch.total = match.total;
    if (!it.season && it.type === "watching" && match.season) patch.season = match.season;
    if (!it.format && match.format) patch.format = match.format;
  }
  const next = items.map((x) => (x.id === id ? { ...x, ...patch } : x));
  await writeData({ [ITEMS_KEY]: next });
}

/** Inject the detector into a tab (idempotent) and return its detection. */
async function detectTab(tabId) {
  try {
    await api.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (e) {
    // Restricted page (chrome://, store, PDF viewer, cross-origin frame lock).
    return null;
  }
  return new Promise((resolve) => {
    api.tabs.sendMessage(tabId, { type: "REQUEST_DETECTION" }, (resp) => {
      void api.runtime.lastError; // swallow "no receiving end" on odd pages
      resolve(resp || null);
    });
  });
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "DETECTION_UPDATED":
      api.storage.local.set({ "dasi.currentDetection": { ...message.payload, tabId: sender.tab?.id } });
      return;

    case "VIDEO_PROGRESS":
    case "SAVE_PROGRESS":
      writeItem(message.payload).then((result) => {
        sendResponse(result);
        autoSync();
      });
      return true;

    // Look up (without saving) whether this work already has a saved position, so
    // the popup can show the previous marker and ask before overwriting.
    case "CHECK_EXISTING":
      read(ITEMS_KEY, []).then((items) => {
        const key = workKey(message.payload || {});
        sendResponse({ existing: items.find((i) => i.id === key) || null, key });
      });
      return true;

    case "DETECT_ACTIVE_TAB":
      api.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
        const tab = tabs[0];
        const detection = tab?.id ? await detectTab(tab.id) : null;
        if (detection) await api.storage.local.set({ "dasi.currentDetection": { ...detection, tabId: tab.id } });
        sendResponse({ detection, tab: tab ? { title: tab.title, url: tab.url } : null });
      });
      return true;

    case "GET_STATE":
      Promise.all([
        read(ITEMS_KEY, []),
        read(SITES_KEY, []),
        read(NOTIF_KEY, []),
        read(LISTS_KEY, []),
        read(SETTINGS_KEY, DEFAULT_SETTINGS),
        api.storage.local.get(["dasi.currentDetection", "dasi.lastConflict"]),
      ]).then(([items, sites, notifications, lists, settings, state]) =>
        sendResponse({
          items,
          sites,
          notifications,
          lists,
          settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
          currentDetection: state["dasi.currentDetection"],
          lastConflict: state["dasi.lastConflict"],
        }),
      );
      return true;

    case "NOTIF_READ_ALL":
      read(NOTIF_KEY, []).then((list) => {
        const next = list.map((n) => ({ ...n, read: true }));
        writeData({ [NOTIF_KEY]: next }).then(() => sendResponse({ notifications: next }));
      });
      return true;

    case "NOTIF_CLEAR":
      writeData({ [NOTIF_KEY]: [] }).then(() => sendResponse({ notifications: [] }));
      return true;

    case "SET_SETTINGS":
      read(SETTINGS_KEY, DEFAULT_SETTINGS).then((s) => {
        const next = { ...DEFAULT_SETTINGS, ...(s || {}), ...(message.patch || {}) };
        writeData({ [SETTINGS_KEY]: next }).then(() => {
          sendResponse({ settings: next });
          autoSync();
        });
      });
      return true;

    // ---- Custom lists (collections) ------------------------------------------
    case "LIST_CREATE":
      read(LISTS_KEY, []).then((lists) => {
        const list = {
          id: "l_" + Math.random().toString(36).slice(2, 10),
          name: (message.name || "New list").slice(0, 60),
          cover: message.cover || "#EDE6FF",
          itemIds: [],
          createdAt: Date.now(),
        };
        const next = [...lists, list];
        writeData({ [LISTS_KEY]: next }).then(() => {
          sendResponse({ lists: next, list });
          autoSync();
        });
      });
      return true;

    case "LIST_UPDATE": // rename / change cover
      read(LISTS_KEY, []).then((lists) => {
        const next = lists.map((l) => (l.id === message.id ? { ...l, ...(message.patch || {}) } : l));
        writeData({ [LISTS_KEY]: next }).then(() => {
          sendResponse({ lists: next });
          autoSync();
        });
      });
      return true;

    case "LIST_DELETE":
      read(LISTS_KEY, []).then((lists) => {
        const next = lists.filter((l) => l.id !== message.id);
        writeData({ [LISTS_KEY]: next }).then(() => {
          sendResponse({ lists: next });
          autoSync();
        });
      });
      return true;

    case "LIST_SET_ITEMS": // assign membership + order in one shot
      read(LISTS_KEY, []).then((lists) => {
        const next = lists.map((l) => (l.id === message.id ? { ...l, itemIds: message.itemIds || [] } : l));
        writeData({ [LISTS_KEY]: next }).then(() => {
          sendResponse({ lists: next });
          autoSync();
        });
      });
      return true;

    case "ADD_SITE":
      read(SITES_KEY, []).then((sites) => {
        const site = message.payload;
        const next = sites.some((s) => s.url === site.url) ? sites : [...sites, site];
        writeData({ [SITES_KEY]: next }).then(() => sendResponse({ sites: next }));
      });
      return true;

    case "REMOVE_SITE":
      read(SITES_KEY, []).then((sites) => {
        const next = sites.filter((s) => (s.id || s.url) !== message.id);
        writeData({ [SITES_KEY]: next }).then(() => { sendResponse({ sites: next }); autoSync(); });
      });
      return true;

    case "IMPORT_STATE":
      {
        const payload = message.payload || {};
        const patch = {};
        if (Array.isArray(payload.items)) patch[ITEMS_KEY] = payload.items;
        if (Array.isArray(payload.sites)) patch[SITES_KEY] = payload.sites;
        if (Array.isArray(payload.notifications)) patch[NOTIF_KEY] = payload.notifications;
        if (Array.isArray(payload.lists)) patch[LISTS_KEY] = payload.lists;
        if (payload.settings) patch[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, ...payload.settings };
        writeData(patch).then(() => sendResponse({ ok: true }));
      }
      return true;

    case "REMOVE_ITEM":
      read(ITEMS_KEY, []).then((items) => {
        const next = items.filter((i) => i.id !== message.id);
        writeData({ [ITEMS_KEY]: next }).then(() => {
          sendResponse({ items: next });
          autoSync();
        });
      });
      return true;

    // Patch a saved item (favorite, rating, tags, status…) from the library page.
    case "UPDATE_ITEM":
      read(ITEMS_KEY, []).then((items) => {
        const patch = message.patch || {};
        const next = items.map((i) => (i.id === message.id ? { ...i, ...patch, updatedAt: Date.now() } : i));
        writeData({ [ITEMS_KEY]: next }).then(() => {
          sendResponse({ items: next });
          autoSync();
        });
      });
      return true;

    // Online search-to-add (AniList): returns catalog results for a title.
    case "CATALOG_SEARCH":
      catalogSearchAll(message.query || "")
        .then((results) => sendResponse({ ok: true, results }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    // Translate an array of page strings (called by the injected translate.js).
    case "DASI_MT":
      translateTexts(message.texts || [], message.target || "en")
        .then((translations) => sendResponse({ ok: true, translations }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    // Inject the in-page translator into the active tab and run it.
    case "TRANSLATE_PAGE":
      api.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) return sendResponse({ ok: false, error: "no_tab" });
        try {
          await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["translate.js"] });
        } catch (e) {
          return sendResponse({ ok: false, error: "restricted_page" });
        }
        const s = await read(SETTINGS_KEY, DEFAULT_SETTINGS);
        api.tabs.sendMessage(tab.id, { type: "DASI_TRANSLATE", lang: message.lang || "en", imgServer: (s && s.imgServer) || "" }, () => {
          void api.runtime.lastError;
          sendResponse({ ok: true });
        });
      });
      return true;

    case "SYNC_STATUS":
      Promise.all([getSyncConfig(), api.storage.local.get(SYNC_META_KEY)]).then(([cfg, m]) =>
        sendResponse({
          configured: Boolean(cfg && cfg.token),
          apiUrl: (cfg && cfg.apiUrl) || "",
          email: (cfg && cfg.email) || "",
          plan: (cfg && cfg.plan) || null,
          meta: m[SYNC_META_KEY] || {},
        }),
      );
      return true;

    case "SYNC_SIGN_IN":
    case "SYNC_SIGN_UP":
      {
        const { apiUrl, email, password } = message.payload || {};
        const path = message.type === "SYNC_SIGN_UP" ? "/auth/signup" : "/auth/login";
        syncAuth(path, apiUrl, email, password)
          .then((cfg) =>
            syncNow()
              .then((result) => sendResponse({ ok: true, email: cfg.email, plan: cfg.plan, result }))
              .catch((e) => sendResponse({ ok: true, email: cfg.email, plan: cfg.plan, warn: String(e.message) })),
          )
          .catch((e) => sendResponse({ ok: false, error: String(e.message) }));
      }
      return true;

    case "SYNC_CHANGE_EMAIL":
      getSyncConfig().then(async (cfg) => {
        if (!cfg || !cfg.token) return sendResponse({ ok: false, error: "not_signed_in" });
        try {
          const res = await apiCall(cfg, "/auth/email", { method: "POST", body: JSON.stringify({ email: message.email }) });
          if (!res.ok) { const e = await res.json().catch(() => ({})); return sendResponse({ ok: false, error: e.error || `http_${res.status}` }); }
          await api.storage.local.set({ [SYNC_CFG_KEY]: { ...cfg, email: message.email } });
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: String(e && e.message) }); }
      });
      return true;

    case "SYNC_CHANGE_PASSWORD":
      getSyncConfig().then(async (cfg) => {
        if (!cfg || !cfg.token) return sendResponse({ ok: false, error: "not_signed_in" });
        try {
          const res = await apiCall(cfg, "/auth/password", { method: "POST", body: JSON.stringify({ current: message.current, next: message.next }) });
          if (!res.ok) { const e = await res.json().catch(() => ({})); return sendResponse({ ok: false, error: e.error || `http_${res.status}` }); }
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: String(e && e.message) }); }
      });
      return true;

    case "SYNC_SIGN_OUT":
      api.storage.local.set({ [SYNC_CFG_KEY]: null, [SYNC_META_KEY]: {} }).then(() => sendResponse({ ok: true }));
      return true;

    case "SYNC_NOW":
      syncNow()
        .then((result) => sendResponse({ ok: true, result }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message) }));
      return true;

    default:
      return;
  }
});

/*
 * Update safety. Data in chrome.storage is NOT cleared when the extension
 * updates to a new version — only a full uninstall clears it. This hook runs on
 * install/update, stamps a schema version, and is the single place to run
 * backward-compatible migrations for future breaking changes, so publishing a
 * new version never wipes existing users' libraries.
 */
const SCHEMA_VERSION = 2;
api.runtime.onInstalled.addListener(async () => {
  const stored = (await api.storage.local.get("dasi.schema"))["dasi.schema"] || 0;
  if (stored < SCHEMA_VERSION) {
    // v2: re-key existing items to the web-app-aligned work id (spaces →
    // hyphens) so cross-surface sync merges the same work instead of
    // duplicating it. Deterministic and update-safe; furthest progress wins on
    // any collision.
    if (stored < 2) {
      const items = (await api.storage.local.get(ITEMS_KEY))[ITEMS_KEY] || [];
      if (items.length) {
        const byId = new Map();
        for (const it of items) {
          const nid = (it.id || "").replace(/\s+/g, "-");
          const prev = byId.get(nid);
          if (!prev || numericProgress(it) > numericProgress(prev)) byId.set(nid, { ...it, id: nid });
        }
        await writeData({ [ITEMS_KEY]: [...byId.values()] });
      }
    }
    await api.storage.local.set({ "dasi.schema": SCHEMA_VERSION });
  }
});

/*
 * Awaited games: once a day (and on startup) flip any game whose release date
 * has passed from "upcoming" to released, and notify. No network — purely the
 * dates you already saved.
 */
async function checkGameReleases() {
  const items = await read(ITEMS_KEY, []);
  let changed = false;
  for (const i of items) {
    if (i.type === "game" && !i.released && i.releaseDate) {
      const d = Date.parse(i.releaseDate);
      if (Number.isFinite(d) && d <= Date.now()) {
        i.released = true;
        i.updatedAt = Date.now();
        changed = true;
        await pushNotification({ itemId: i.id, title: i.title, message: "is out now", url: i.url });
        systemNotify(i.title, "is out now", "dasi_game_" + i.id);
      }
    }
  }
  if (changed) await writeData({ [ITEMS_KEY]: items });
}
try {
  api.alarms?.create("dasi-daily", { periodInMinutes: 720 });
  api.alarms?.onAlarm.addListener((a) => { if (a.name === "dasi-daily") checkGameReleases(); });
} catch {
  /* alarms unavailable */
}
checkGameReleases();

// Notification click → open the related page.
try {
  api.notifications?.onClicked.addListener(() => api.tabs.create({ url: api.runtime.getURL("library.html") }));
} catch {
  /* noop */
}

// Keyboard shortcut: detect the active tab and save immediately.
api.commands.onCommand.addListener(async (command) => {
  if (command !== "save-progress") return;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const detection = await detectTab(tab.id);
  if (detection && detection.confidence >= 0.8) {
    await writeItem(detection);
    try {
      await api.action.setBadgeText({ text: "✓", tabId: tab.id });
      setTimeout(() => api.action.setBadgeText({ text: "", tabId: tab.id }), 1500);
    } catch {
      /* badge best-effort */
    }
  }
});
