importScripts("sync-core.js");
async function fetchRemote(input, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(input, {...init, signal: init.signal ? AbortSignal.any([init.signal,controller.signal]) : controller.signal}); }
  finally {clearTimeout(timeout);}
}
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
const TOMBSTONES_KEY="yomu.tombstones.v1";
const DEFAULT_SETTINGS = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" }, tmdbKey: "", rawgKey: "", imgServer: "", ocrKey: "", ocrSrc: "" };

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
  // Numbered sequels and remakes must never be auto-merged as a spelling variant.
  if ((na.match(/\d+|\b[ivx]+\b/g) || []).join(',') !== (nb.match(/\d+|\b[ivx]+\b/g) || []).join(',')) return false;
  const ta = new Set(na.split(" ").filter(Boolean)), tb = new Set(nb.split(" ").filter(Boolean));
  if (ta.size === tb.size && [...ta].every((x) => tb.has(x))) return true;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size >= 2) { let inter = 0; small.forEach((x) => big.has(x) && inter++); if (inter === small.size && small.size / big.size >= 0.6) return false; }
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
const DATA_KEYS={items:ITEMS_KEY,lists:LISTS_KEY,sites:SITES_KEY,notifications:NOTIF_KEY};
const writeData = async (obj, downloaded=false) => {
  if(!downloaded){
    const before={},after={};
    for(const [kind,key] of Object.entries(DATA_KEYS))if(obj[key]){before[kind]=await read(key,[]);after[kind]=obj[key];}
    if(obj[SETTINGS_KEY]?.profile){before.profile=(await read(SETTINGS_KEY,{})).profile;after.profile=obj[SETTINGS_KEY].profile;}
    before.tombstones=await read(TOMBSTONES_KEY,[]);
    const stamped=YomuSync.stampChanges(before,after);
    for(const [kind,key] of Object.entries(DATA_KEYS))if(stamped[kind])obj[key]=stamped[kind];
    if(stamped.profile)obj[SETTINGS_KEY]={...obj[SETTINGS_KEY],profile:stamped.profile};
    if(stamped.tombstones)obj[TOMBSTONES_KEY]=stamped.tombstones;
  }
  await api.storage.local.set(obj);
  if((await getSyncConfig())?.token)return;
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
let lastAutoSync = 0, autoSyncTimer = null, accountEpoch = 0;

const apiBase = (url) => (url || "").replace(/\/+$/, "");
const getSyncConfig = async () => (await api.storage.local.get(SYNC_CFG_KEY))[SYNC_CFG_KEY] || null;

const setSyncMeta = async (meta) => {
  const prev = (await api.storage.local.get(SYNC_META_KEY))[SYNC_META_KEY] || {};
  await api.storage.local.set({ [SYNC_META_KEY]: { ...prev, ...meta } });
};

async function apiCall(cfg, path, init = {}) {
  return fetchRemote(apiBase(cfg.apiUrl) + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

const ACCOUNT_CACHE_KEY='yomu.accountCaches.v1';
const scopeOf=cfg=>cfg?.token?apiBase(cfg.apiUrl)+'|'+(cfg.userId || 'legacy:'+String(cfg.email||'').toLowerCase()):'guest';
async function switchSyncAccount(nextConfig){
  const previous=await getSyncConfig(), caches=await read(ACCOUNT_CACHE_KEY,{});
  const keys=[ITEMS_KEY,LISTS_KEY,SITES_KEY,NOTIF_KEY,SETTINGS_KEY,TOMBSTONES_KEY];
  const previousData={};for(const key of keys)previousData[key]=await read(key,key===SETTINGS_KEY?DEFAULT_SETTINGS:[]);
  caches[scopeOf(previous)]=previousData;
  const sameLegacy=previous?.token && !previous.userId && nextConfig?.token && previous.apiUrl===nextConfig.apiUrl && previous.email?.toLowerCase()===nextConfig.email?.toLowerCase();
  const nextData=(sameLegacy?previousData:caches[scopeOf(nextConfig)]) || {[ITEMS_KEY]:[],[LISTS_KEY]:[],[SITES_KEY]:[],[NOTIF_KEY]:[],[TOMBSTONES_KEY]:[],[SETTINGS_KEY]:{...DEFAULT_SETTINGS,lang:previousData[SETTINGS_KEY]?.lang||'en'}};
  await api.storage.local.set({...nextData,[ACCOUNT_CACHE_KEY]:caches,[SYNC_CFG_KEY]:nextConfig,[SYNC_META_KEY]:{},'dasi.lastConflict':null,'dasi.currentDetection':null});
  ++accountEpoch;clearTimeout(autoSyncTimer);autoSyncTimer=null;lastAutoSync=0;
}

/** Sign in / sign up against the backend and persist the resulting config. */
async function syncAuth(path, apiUrl, email, password) {
  const res = await fetchRemote(apiBase(apiUrl) + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `http_${res.status}`);
  }
  const data = await res.json();
  const cfg = { apiUrl: apiBase(apiUrl), token: data.token, userId:data.user.id, email: data.user.email, plan: data.user.plan };
  await serializeLibrary(()=>switchSyncAccount(cfg));
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
    if((await getSyncConfig())?.token===cfg.token)await setSyncMeta({ lastError: "unauthorized" });
    throw new Error("unauthorized");
  }
  if(!getRes.ok)throw new Error(`pull_${getRes.status}`);
  const remote = await getRes.json();
  const rb = remote.blob || null;

  const blob=await serializeLibrary(async()=>{
    if((await getSyncConfig())?.token!==cfg.token)throw new Error('account_changed');
    const localSettings=await read(SETTINGS_KEY,{});
    const local={updatedAt:0,tombstones:await read(TOMBSTONES_KEY,[]),profile:localSettings.profile};
    for(const [kind,key] of Object.entries(DATA_KEYS))local[kind]=await read(key,[]);
    const merged=YomuSync.mergeBlobs(rb,local),values={[TOMBSTONES_KEY]:merged.tombstones||[]};
    for(const [kind,key] of Object.entries(DATA_KEYS))values[key]=merged[kind]||[];
    if(merged.profile)values[SETTINGS_KEY]={...localSettings,profile:merged.profile};
    await writeData(values,true);return merged;
  });
  const putRes = await apiCall(cfg, "/sync", { method: "PUT", body: JSON.stringify({ blob }) });
  if (!putRes.ok) {
    if((await getSyncConfig())?.token===cfg.token)await setSyncMeta({ lastError: `push_${putRes.status}` });
    throw new Error(`push_${putRes.status}`);
  }
  if((await getSyncConfig())?.token===cfg.token)await setSyncMeta({ lastSyncAt: Date.now(), lastError: null });
  return { items: blob.items.length, sites: blob.sites.length, notifications: blob.notifications.length };
}

/** Short-delay saves plus a durable alarm for suspension/network recovery. */
const SYNC_ALARM='yomu-sync-retry';
let syncInFlight=null;
async function runAutoSync(){
 if(syncInFlight)return syncInFlight;
 syncInFlight=(async()=>{
 const cfg=await getSyncConfig();if(!cfg?.token)return;
 const meta=await read(SYNC_META_KEY,{});if(Date.now()<(meta.nextRetryAt||0))return;
  lastAutoSync=Date.now();
  try{await syncNow();if((await getSyncConfig())?.token===cfg.token)await setSyncMeta({retryCount:0,nextRetryAt:0});}
  catch(error){if((await getSyncConfig())?.token===cfg.token){const retryCount=Math.min(8,(meta.retryCount||0)+1);await setSyncMeta({lastError:String(error.message),retryCount,nextRetryAt:Date.now()+Math.min(900000,30000*2**(retryCount-1))});}}
 })();try{return await syncInFlight;}finally{syncInFlight=null;}
}
async function ensureSyncAlarm(){
 try{if(api.alarms?.get&&!await api.alarms.get(SYNC_ALARM))await api.alarms.create(SYNC_ALARM,{periodInMinutes:5});}catch{/* Local saves remain available if alarms are unavailable. */}
}
function autoSync() {
 void ensureSyncAlarm();
 if(autoSyncTimer)return;
 autoSyncTimer=setTimeout(()=>{autoSyncTimer=null;void runAutoSync();},Math.max(0,AUTO_SYNC_COOLDOWN_MS-(Date.now()-lastAutoSync)));
}
void ensureSyncAlarm();

let libraryWriteQueue = Promise.resolve();
function serializeLibrary(task) {
  const result = libraryWriteQueue.then(task);
  libraryWriteQueue = result.catch(() => {});
  return result;
}
function boundedProgress(item) {
  const out = { ...item };
  const n = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const total = n(out.total);
  if (out.total !== undefined) out.total = total || undefined;
  for (const key of ['chapter','episode','page','season','volume','latestChapter','latestEpisode']) {
    if(out[key] !== undefined) out[key] = n(out[key]);
  }
  const key = out.type === 'watching' ? 'episode' : 'chapter';
  if (total && out[key] !== undefined) out[key] = Math.min(total,out[key]);
  if (out.progress !== undefined) out.progress = Math.max(0,Math.min(100,Number(out.progress) || 0));
  return out;
}
function writeItem(payload) { return serializeLibrary(() => writeItemUnlocked(payload)); }
async function writeItemUnlocked(payload) {
  if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) throw new Error('missing_title');
  payload = Object.fromEntries(Object.entries(payload).filter(([k,v]) => v !== undefined && !['__proto__','constructor','prototype','id','createdAt'].includes(k)));
  const items = await read(ITEMS_KEY, []);
  let key = workKey(payload);
  const compatible=i=>i.type===payload.type && (!i.year || !payload.year || Number(i.year)===Number(payload.year));
  let existing = items.find(i=>i.id===key && compatible(i));
  if(!existing && items.some(i=>i.id===key)){const base=key+'-'+(payload.type||'reading')+(payload.year?'-'+payload.year:'');key=base;let n=2;while(items.some(i=>i.id===key))key=base+'-'+n++;}
  // Cross-site merge: no exact id match → look for the same work saved under a
  // slightly different title on another site, and keep its id so they converge.
  if (!existing && payload.type !== "game") {
    const fuzzy = items.find((i) => compatible(i) && i.id !== key && sameWork(i.title, payload.title));
    if (fuzzy) { existing = fuzzy; key = fuzzy.id; }
  }
  const sameSeason = !existing || (Number(payload.season) || 1) === (Number(existing.season) || 1);
  payload = boundedProgress({ ...payload, total: payload.total || (sameSeason ? existing?.total : undefined) });
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
  if (existing && sameSeason && existingScore > incomingScore && incomingScore > 0) {
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
    latestEpisode: Math.max(sameSeason ? existing?.latestEpisode || 0 : 0, payload.episode || 0) || undefined,
    // How many entries are released (auto-detected from the page, never lowered).
    total: payload.total || payload.available || (sameSeason ? existing?.total : undefined),
    createdAt: existing?.createdAt || Date.now(),
    favorite: existing?.favorite || false,
    rating: existing?.rating || 0,
    sources: [...new Set([...(existing?.sources || []), payload.domain].filter(Boolean))],
  };

  const next = [boundedProgress(merged), ...items.filter((i) => i.id !== key)];
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
  return { item: boundedProgress(merged), conflict: false, kept: "incoming" };
}

// Add an item to a list, creating the list when only a name is given. Membership
// is a set (no duplicates); a freshly-created list is returned so callers can
// reflect it. Shared by the popup/in-page save flow and the library.
async function addItemToList(itemId, listId, listName) {
  if (!itemId) return null;
  const lists = await read(LISTS_KEY, []);
  let target = listId ? lists.find((l) => l.id === listId) : null;
  let next;
  if (!target) {
    const name = (listName || "New list").toString().slice(0, 60);
    // Reuse a same-named list if one exists (avoids dupes from the bubble).
    target = lists.find((l) => (l.name || "").toLowerCase() === name.toLowerCase());
    if (target) {
      next = lists.map((l) => (l.id === target.id ? { ...l, itemIds: [...new Set([...(l.itemIds || []), itemId])] } : l));
    } else {
      target = { id: "l_" + Math.random().toString(36).slice(2, 10), name, cover: "#EDE6FF", itemIds: [itemId], createdAt: Date.now() };
      next = [...lists, target];
    }
  } else {
    next = lists.map((l) => (l.id === target.id ? { ...l, itemIds: [...new Set([...(l.itemIds || []), itemId])] } : l));
  }
  await writeData({ [LISTS_KEY]: next });
  return { lists: next, list: target };
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
  const r = await fetchRemote(url);
  if (!r.ok) throw new Error(`gtx_${r.status}`);
  const j = await r.json();
  if(!Array.isArray(j && j[0])) throw new Error("translation_response_invalid");
  return j[0].map(s => (s && s[0]) || "").join("");
}
async function mymemoryTranslate(text, target) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${encodeURIComponent("en|" + target)}`;
  const r = await fetchRemote(url);
  const j = await r.json();
  return (j && j.responseData && j.responseData.translatedText) || text;
}
async function translateOne(text,target) { return gtxTranslate(text,target); }
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
    anilistId: m.id || undefined,
    cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large || m.coverImage.medium)) || "",
    // Smaller AniList size the UI can fall back to if the big one 404s/blocks.
    coverFallback: (m.coverImage && (m.coverImage.medium || m.coverImage.large)) || undefined,
    synopsis: stripHtml(m.description).slice(0, 700),
    genres: Array.isArray(m.genres) ? m.genres.slice(0, 6) : [],
    total: type === "reading" ? m.chapters || undefined : m.episodes || undefined,
    season: m.seasonYear || undefined,
    country: m.countryOfOrigin || undefined,
    format,
    url: m.siteUrl || "",
  };
}
// Build a playable trailer URL from AniList's { id, site } trailer object.
function trailerUrl(tr) {
  if (!tr || !tr.id) return "";
  if (tr.site === "youtube") return `https://www.youtube.com/watch?v=${tr.id}`;
  if (tr.site === "dailymotion") return `https://www.dailymotion.com/video/${tr.id}`;
  return "";
}
// Rich detail for one AniList title (trailer + cast + exact counts). Separate
// from search so the list query stays light. Best-effort; throws are swallowed
// by the caller.
async function anilistDetail(id) {
  const gql = `query($id:Int){Media(id:$id){episodes chapters volumes seasonYear status trailer{id site} characters(sort:[ROLE,RELEVANCE],perPage:12){edges{role node{name{full} image{large}}}}}}`;
  const res = await fetchRemote(ANILIST_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: gql, variables: { id } }) });
  if (!res.ok) throw new Error(`anilist_detail_${res.status}`);
  const data = await res.json();
  const m = data && data.data && data.data.Media;
  if (!m) return null;
  const cast = (m.characters && m.characters.edges ? m.characters.edges : [])
    .map((e) => ({ name: e.node && e.node.name && e.node.name.full, image: (e.node && e.node.image && e.node.image.large) || "", role: e.role || "" }))
    .filter((c) => c.name)
    .slice(0, 12);
  return {
    episodes: m.episodes || undefined,
    chapters: m.chapters || undefined,
    volumes: m.volumes || undefined,
    seasonYear: m.seasonYear || undefined,
    status: m.status || undefined,
    trailerUrl: trailerUrl(m.trailer),
    cast,
  };
}
async function anilistSearch(query) {
  const gql = `query($s:String){Page(perPage:10){media(search:$s,sort:SEARCH_MATCH,isAdult:false){id title{romaji english native} coverImage{extraLarge large medium} description genres seasonYear format countryOfOrigin siteUrl episodes chapters}}}`;
  const res = await fetchRemote(ANILIST_URL, {
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
  const res = await fetchRemote(url);
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
  const url = 'https://store.steampowered.com/search/results/?term='+encodeURIComponent(query)+'&start=0&count=20&category1=998&infinite=1&json=1&cc=us&l=en';
  const res=await fetchRemote(url); if(!res.ok) throw new Error('steam_'+res.status);
  const data=await res.json();
  return steamGames(parseSteamSearch(data.results_html || ''),false).map(g=>({...g,released:undefined,externalIds:{steam:steamAppId(g.url)}}));
}
/** Live-action TV series via TVMaze (keyless) — covers Western/American shows. */
async function tvmazeSearch(query) {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
  const res = await fetchRemote(url);
  if (!res.ok) throw new Error(`tvmaze_${res.status}`);
  const data = await res.json();
  return (data || []).slice(0, 6).map((row) => row.show).filter((sh) => sh && sh.name).map((sh) => ({
    title: sh.name,
    type: "watching",
    cover: (sh.image && (sh.image.original || sh.image.medium)) || "",
    synopsis: stripHtml(sh.summary).slice(0, 500),
    genres: Array.isArray(sh.genres) ? sh.genres.slice(0, 4) : [],
    season: (sh.premiered || "").slice(0, 4) || undefined,
    country: (sh.network && sh.network.country && sh.network.country.code) || (sh.webChannel && sh.webChannel.country && sh.webChannel.country.code) || undefined,
    total: (sh.episodes || undefined),
    format: (sh.network && sh.network.country && sh.network.country.code === "KR") ? "KDRAMA" : (sh.network && sh.network.country && ["CN", "TW", "HK"].includes(sh.network.country.code)) ? "CDRAMA" : (sh.network && sh.network.country && sh.network.country.code === "JP") ? "JDRAMA" : "SERIES",
    url: sh.url || "",
  }));
}

// Universal, keyless search via Wikipedia — covers ANYTHING (films, K/C/J
// dramas, series, obscure or mobile games, novels…) with a cover + a short
// description we use to classify the type and country.
function classifyWiki(desc) {
  const d = (desc || "").toLowerCase();
  const country = /south korea|korean/.test(d) ? "KR" : /chinese|china|taiwan|hong kong/.test(d) ? "CN" : /japanese|japan/.test(d) ? "JP" : /american|united states|british|french|european/.test(d) ? "US" : "";
  if (/manhwa|webtoon/.test(d)) return { type: "reading", format: "MANHWA", country: country || "KR" };
  if (/manhua/.test(d)) return { type: "reading", format: "MANHUA", country: country || "CN" };
  if (/\bmanga\b|light novel/.test(d)) return { type: "reading", format: "MANGA", country: country || "JP" };
  if (/\banime\b/.test(d)) return { type: "watching", format: "ANIME", country: country || "JP" };
  if (/\bfilm\b|\bmovie\b|feature film/.test(d)) return { type: "watching", format: "MOVIE", country };
  if (/television series|tv series|drama|web series|miniseries|sitcom|television programme|streaming|k-drama|c-drama/.test(d))
    return { type: "watching", format: country === "KR" ? "KDRAMA" : country === "CN" ? "CDRAMA" : country === "JP" ? "JDRAMA" : "SERIES", country };
  if (/video game|mobile game|role-playing game|gacha|first-person shooter|platform game|indie game/.test(d)) return { type: "game", format: "Game", country };
  if (/\bnovel\b|book|comic/.test(d)) return { type: "reading", format: "BOOK", country };
  return { type: "watching", format: "", country };
}
async function wikipediaSearch(query, lang) {
  const host = `https://${lang || "en"}.wikipedia.org`;
  const url = `${host}/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&prop=pageimages|description|extracts&piprop=thumbnail&pithumbsize=400&exintro=1&explaintext=1&exlimit=10`;
  const res = await fetchRemote(url);
  if (!res.ok) throw new Error(`wiki_${res.status}`);
  const data = await res.json();
  const pages = (data.query && data.query.pages) ? Object.values(data.query.pages) : [];
  pages.sort((a, b) => (a.index || 99) - (b.index || 99));
  return pages.filter((p) => p.title && !/^(List of|Category:)/i.test(p.title)).map((p) => {
    const c = classifyWiki(p.description);
    return {
      title: p.title,
      type: c.type,
      cover: (p.thumbnail && p.thumbnail.source) || "",
      synopsis: (p.extract || "").slice(0, 500),
      genres: [],
      country: c.country || undefined,
      format: c.format || undefined,
      source: "wikipedia",
      url: `${host}/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
    };
  });
}

/** Films & TV via TMDB (needs the user's free API key from settings). */
async function tmdbSearch(query, key) {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&include_adult=false`;
  const res = await fetchRemote(url);
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
  const res = await fetchRemote(url);
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
  const tasks = [anilistSearch(query), steamSearch(query), openLibrarySearch(query), tvmazeSearch(query), wikipediaSearch(query, "en")];
  // Also query the user's own-language Wikipedia so local titles (e.g. a French
  // or Korean film) surface even if the English page is thin.
  const wl = (s && s.lang || "en").slice(0, 2);
  if (wl && wl !== "en") tasks.push(wikipediaSearch(query, wl));
  if (s && s.tmdbKey) tasks.push(tmdbSearch(query, s.tmdbKey));
  if (s && s.rawgKey) tasks.push(rawgSearch(query, s.rawgKey));
  const settled = await Promise.allSettled(tasks);
  if (settled.every(r => r.status === "rejected")) throw new Error("catalog_unavailable");
  const out = [];
  for (const r of settled) if (r.status === "fulfilled") out.push(...r.value);
  // De-dup by normalized title+type. Prefer the entry that has a cover, and
  // prefer a structured source (AniList/Steam/TVMaze) over a Wikipedia stub.
  const seen = new Map();
  for (const r of out) {
    const k = normalizeTitle(r.title) + "|" + r.type;
    const prev = seen.get(k);
    if (!prev) { seen.set(k, r); continue; }
    const better = (!prev.cover && r.cover) || (prev.source === "wikipedia" && r.source !== "wikipedia" && r.cover);
    if (better) seen.set(k, r);
  }
  return [...seen.values()].slice(0, 40);
}

/*
 * Discovery — fresh recommendations for the Home page (NOT the user's library):
 * trending manga/manhwa + anime from AniList, and upcoming/new games from the
 * Steam storefront. All keyless. Cached ~6h so the Home stays snappy and we
 * never hammer the services.
 */
const DISCOVER_KEY = "dasi.discover.cache.v2";
const DISCOVER_TTL = 6 * 3600 * 1000;
async function anilistTrending(type, country) {
  const gql = `query($t:MediaType,$c:CountryCode){Page(perPage:18){media(sort:TRENDING_DESC,type:$t,isAdult:false,countryOfOrigin:$c){id title{romaji english native} coverImage{extraLarge large medium} description genres seasonYear format countryOfOrigin siteUrl episodes chapters averageScore}}}`;
  const res = await fetchRemote(ANILIST_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: gql, variables: { t: type, c: country || undefined } }) });
  if (!res.ok) throw new Error(`anilist_${res.status}`);
  const data = await res.json();
  return ((data && data.data && data.data.Page && data.data.Page.media) || []).map(mediaToResult).filter((r) => r.title && r.cover);
}
function steamItems(list, released) {
  return (list || []).filter((g) => g && (g.name || g.title) && g.id).slice(0, 14).map((g) => ({
    title: g.name || g.title,
    type: "game",
    cover: g.header_image || g.large_capsule_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.id}/header.jpg`,
    synopsis: "",
    genres: [],
    price: g.final_price ? `$${(g.final_price / 100).toFixed(2)}` : g.discounted === false && g.original_price ? `$${(g.original_price / 100).toFixed(2)}` : undefined,
    platform: "Steam",
    format: "Game",
    released,
    url: `https://store.steampowered.com/app/${g.id}`,
  }));
}
// Non-games / hardware / filler to keep out of discovery.
const STEAM_SKIP = new Set(["1675200", "1531210", "353370", "353380"]); // Steam Deck, Index, controllers
const STEAM_JUNK = /\b(soundtrack|ost|artbook|art book|season pass|bundle|demo|playtest|dedicated server|wallpaper|steam deck|valve index|controller|hardware)\b/i;
// Parse the Steam store search "results_html" into {id, name, price}.
function parseSteamSearch(html) {
  const out = [];
  const parts = String(html || "").split('data-ds-appid="');
  for (let i = 1; i < parts.length && out.length < 40; i++) {
    const chunk = parts[i];
    const idm = chunk.match(/^(\d+)/);
    const tm = chunk.match(/<span class="title">([^<]+)<\/span>/i);
    if (!idm || !tm) continue;
    const pm = chunk.match(/discount_final_price[^>]*>([^<]+)</i) || chunk.match(/search_price[^>]*>\s*([^<\r\n]+?)\s*</i);
    const name = tm[1].trim().replace(/&amp;/g, "&").replace(/&#0?39;/g, "'");
    out.push({ id: idm[1], name, price: pm ? pm[1].trim().replace(/&nbsp;/g, "") : "" });
  }
  return out;
}
// The real "most anticipated" / "biggest" lists come from the store search sorted
// by wishlists / top-sellers — these are the AAA titles users expect. Portrait
// capsules (library_600x900) fit the cards cleanly (no cropped landscape banners).
async function steamSearchList(filter) {
  const url = `https://store.steampowered.com/search/results/?query&start=0&count=40&dynamic_data=&category1=998&filter=${filter}&infinite=1&json=1&cc=us&l=en`;
  const res = await fetchRemote(url);
  if (!res.ok) throw new Error(`steam_search_${res.status}`);
  const j = await res.json();
  return parseSteamSearch(j.results_html || "");
}
function steamGames(list, soon) {
  const seen = new Set();
  return (list || [])
    .filter(g => g && !seen.has(g.id) && seen.add(g.id))
    .filter((g) => g && g.id && g.name && !STEAM_SKIP.has(g.id) && !STEAM_JUNK.test(g.name))
    .slice(0, 14)
    .map((g) => ({
      title: g.name,
      type: "game",
      cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.id}/library_600x900.jpg`,
      coverFallback: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.id}/header.jpg`,
      price: g.price || undefined,
      platform: "Steam",
      format: "Game",
      released: soon === true ? false : undefined,
      releaseDate: soon ? "Coming soon" : undefined,
      url: `https://store.steampowered.com/app/${g.id}`,
    }));
}
// Genres/tags + a proper description for one Steam app (lazy: only when a game
// fiche is opened without tags). Keyless appdetails endpoint.
function steamAppId(url) { const m = String(url || "").match(/\/app\/(\d+)/); return m ? m[1] : ""; }
async function steamAppDetails(appid) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=en&filters=basic,genres,release_date`;
  const res = await fetchRemote(url);
  if (!res.ok) throw new Error(`steam_details_${res.status}`);
  const data = await res.json();
  const d = data && data[appid] && data[appid].success && data[appid].data;
  if (!d) return null;
  return {
    genres: Array.isArray(d.genres) ? d.genres.map((g) => g.description).filter(Boolean).slice(0, 6) : [],
    synopsis: (d.short_description || "").trim(),
    releaseDate: d.release_date && d.release_date.date ? d.release_date.date : undefined,
    comingSoon: typeof d.release_date?.coming_soon === "boolean" ? d.release_date.coming_soon : undefined,
  };
}
async function steamDiscover() {
  const [soonR, hotR] = await Promise.allSettled([steamSearchList("popularwishlist"), steamSearchList("topsellers")]);
  const soon = soonR.status === "fulfilled" ? steamGames(soonR.value, true) : [];
  const hot = hotR.status === "fulfilled" ? steamGames(hotR.value, false) : [];
  return { soon, hot };
}
// Live-action drama/series discovery (keyless, via TVMaze). Split by country so
// the Home can offer K-Drama / C-Drama / J-Drama / Series tabs like Webtoon.
async function tvmazeTrending() {
  const pages = await Promise.allSettled([
    fetchRemote("https://api.tvmaze.com/shows?page=0").then((r) => (r.ok ? r.json() : [])),
    fetchRemote("https://api.tvmaze.com/shows?page=1").then((r) => (r.ok ? r.json() : [])),
  ]);
  const shows = pages.flatMap((p) => (p.status === "fulfilled" && Array.isArray(p.value) ? p.value : []));
  const cc = (s) => (s.network && s.network.country && s.network.country.code) || (s.webChannel && s.webChannel.country && s.webChannel.country.code) || "";
  const bucket = (code) => (code === "KR" ? "kdrama" : code === "CN" || code === "TW" || code === "HK" ? "cdrama" : code === "JP" ? "jdrama" : "series");
  return shows
    .filter((s) => s && s.name && s.image && s.image.original)
    .sort((a, b) => (b.weight || 0) - (a.weight || 0) || (((b.rating && b.rating.average) || 0) - ((a.rating && a.rating.average) || 0)))
    .slice(0, 80)
    .map((s) => ({
      title: s.name,
      type: "watching",
      cat: bucket(cc(s)),
      cover: s.image.original,
      synopsis: (s.summary || "").replace(/<[^>]+>/g, "").slice(0, 400),
      genres: Array.isArray(s.genres) ? s.genres.slice(0, 4) : [],
      season: s.premiered ? Number(String(s.premiered).slice(0, 4)) : undefined,
      format: bucket(cc(s)) === "series" ? "SERIES" : "DRAMA",
      url: s.officialSite || (s.url || ""),
    }));
}
async function buildDiscover() {
  const [manga, manhwa, manhua, anime, games, drama] = await Promise.allSettled([
    anilistTrending("MANGA", "JP"), anilistTrending("MANGA", "KR"), anilistTrending("MANGA", "CN"),
    anilistTrending("ANIME"), steamDiscover(), tvmazeTrending(),
  ]);
  const val = (r) => (r.status === "fulfilled" ? r.value : []);
  const dramas = val(drama);
  return {
    ts: Date.now(),
    manga: val(manga),
    manhwa: val(manhwa),
    manhua: val(manhua),
    anime: val(anime),
    kdrama: dramas.filter((d) => d.cat === "kdrama"),
    cdrama: dramas.filter((d) => d.cat === "cdrama"),
    jdrama: dramas.filter((d) => d.cat === "jdrama"),
    series: dramas.filter((d) => d.cat === "series"),
    gamesSoon: games.status === "fulfilled" ? games.value.soon : [],
    gamesHot: games.status === "fulfilled" ? games.value.hot : [],
    gamesNew: games.status === "fulfilled" ? games.value.hot : [],
  };
}
async function getDiscover(force) {
  if (!force) {
    const c = (await api.storage.local.get(DISCOVER_KEY))[DISCOVER_KEY];
    if (c && Date.now() - c.ts < DISCOVER_TTL) return c;
  }
  const fresh = await buildDiscover();
  await api.storage.local.set({ [DISCOVER_KEY]: fresh });
  return fresh;
}

/** Enrich one stored work in place from AniList (once per work). */
async function enrichWork(id) {
  const epoch=accountEpoch;
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
    // Second pass: trailer, cast and exact released counts (real limits, so the
    // drawer can't run past the true episode/chapter count).
    if (match.anilistId) {
      try {
        const d = await anilistDetail(match.anilistId);
        if (d) {
          if (d.trailerUrl && !it.trailerUrl) patch.trailerUrl = d.trailerUrl;
          if (d.cast && d.cast.length && !(it.cast && it.cast.length)) patch.cast = d.cast;
          const realTotal = it.type === "reading" ? d.chapters : d.episodes;
          if (realTotal && realTotal > (patch.total || it.total || 0)) patch.total = realTotal;
          if (d.volumes && it.type === "reading" && !it.volumesTotal) patch.volumesTotal = d.volumes;
          if (d.status && !it.releaseStatus) patch.releaseStatus = d.status; // RELEASING / FINISHED …
        }
      } catch {}
    }
  }
  await serializeLibrary(async () => {
    if(epoch!==accountEpoch)return;
    const current = await read(ITEMS_KEY, []);
    const next = current.map(x => x.id === id ? boundedProgress({...x,...patch}) : x);
    await writeData({[ITEMS_KEY]:next});
  });
}

/*
 * Manga / webtoon IMAGE translation (OCR). Runs in the background so it can
 * fetch cross-origin panels and talk to the translation service without CORS.
 * Two backends:
 *   - a self-hosted manga-image-translator server (Settings → Advanced), which
 *     returns a full translated PNG for /translate/with-url/image; or
 *   - the public cotrans service (default, zero-config): upload the panel, poll
 *     for the translation mask, then composite mask over the original here.
 * Best-effort: any failure returns {ok:false} and the page is left untouched.
 */
async function fetchBlob(url) {
  const r = await fetchRemote(url);
  if (!r.ok) throw new Error(`img_${r.status}`);
  return await r.blob();
}
async function blobToDataUrl(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  return `data:${blob.type || "image/png"};base64,${btoa(bin)}`;
}
// Self-hosted manga-image-translator. The current server (zyddnys/
// manga-image-translator, port 8000) returns a finished PNG from the multipart
// endpoint POST /translate/with-form/image (fields: image=<file>, config=<json>).
// We fetch the panel bytes here (background has host access → no CORS) and post
// them. Falls back to the legacy /translate/with-url/image on older servers.
async function selfHostImage(server, imageUrl, code) {
  const base = server.replace(/\/+$/, "");
  const config = JSON.stringify({ translator: { translator: "google", target_lang: code } });
  // Preferred: upload the bytes to the form endpoint.
  try {
    const file = await fetchBlob(imageUrl);
    const fd = new FormData();
    fd.append("image", file, "panel");
    fd.append("config", config);
    const res = await fetchRemote(base + "/translate/with-form/image", { method: "POST", body: fd });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.indexOf("image") === 0) return await blobToDataUrl(blob);
    } else if (res.status !== 404 && res.status !== 405) {
      throw new Error(`server_${res.status}`);
    }
  } catch (e) {
    if (String(e && e.message).startsWith("server_")) throw e;
    // fetch/CORS issue on the form path — try the legacy URL path below.
  }
  // Legacy servers: JSON with the image URL.
  const res2 = await fetchRemote(base + "/translate/with-url/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl, config: { translator: { translator: "google", target_lang: code } } }),
  });
  if (!res2.ok) throw new Error(`server_${res2.status}`);
  const blob2 = await res2.blob();
  if (blob2.type.indexOf("image") !== 0) throw new Error("server_notimg");
  return await blobToDataUrl(blob2);
}
// Downscale a panel to fit the free OCR tier; keeps the bitmap for compositing.
async function scaledJpeg(blob, maxDim, quality) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const cv = new OffscreenCanvas(w, h);
  const ctx = cv.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  const out = await cv.convertToBlob({ type: "image/jpeg", quality });
  return { bmp, w, h, blob: out };
}
function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const wd of words) {
    const test = line ? line + " " + wd : wd;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
/*
 * One-click manga/webtoon OCR translation — NO server to install. Uses the
 * OCR.space engine (free; a keyless demo key works out of the box, and users
 * can set their own free key for higher limits). We OCR the panel, translate
 * each detected line, and paint the translation over a white box on the bubble.
 */
async function ocrSpaceImage(imageUrl, target, key, src) {
  const raw = await fetchBlob(imageUrl);
  let s = await scaledJpeg(raw, 1600, 0.72); // free tier caps upload ~1MB
  if (s.blob.size > 1000000) s = await scaledJpeg(raw, 1280, 0.55);
  if (s.blob.size > 1000000) s = await scaledJpeg(raw, 1024, 0.45);
  const dataUrl = await blobToDataUrl(s.blob);
  const fd = new FormData();
  fd.append("base64Image", dataUrl);
  fd.append("language", src || "jpn");
  fd.append("isOverlayRequired", "true");
  fd.append("OCREngine", "1");
  fd.append("scale", "true");
  const res = await fetchRemote("https://api.ocr.space/parse/image", { method: "POST", headers: { apikey: key || "helloworld" }, body: fd });
  if (!res.ok) throw new Error(`ocr_${res.status}`);
  const j = await res.json();
  if (j.IsErroredOnProcessing) throw new Error(Array.isArray(j.ErrorMessage) ? j.ErrorMessage[0] : "ocr_err");
  const pr = (j.ParsedResults && j.ParsedResults[0]) || null;
  const lines = (pr && pr.TextOverlay && pr.TextOverlay.Lines) || [];
  const boxes = lines.map((ln) => {
    const ws = ln.Words || [];
    if (!ws.length) return null;
    const left = Math.min(...ws.map((w) => w.Left));
    const top = Math.min(...ws.map((w) => w.Top));
    const right = Math.max(...ws.map((w) => w.Left + w.Width));
    const bottom = Math.max(...ws.map((w) => w.Top + (w.Height || ln.MaxHeight || 16)));
    return { text: ln.LineText, left, top, w: right - left, h: bottom - top };
  }).filter((b) => b && b.text && b.w > 4 && b.h > 4);
  if (!boxes.length) throw new Error("ocr_notext");
  const translations = await translateTexts(boxes.map((b) => b.text), target || "en");
  const cv = new OffscreenCanvas(s.w, s.h);
  const ctx = cv.getContext("2d");
  ctx.drawImage(s.bmp, 0, 0, s.w, s.h);
  ctx.textBaseline = "top";
  boxes.forEach((b, i) => {
    const tx = translations[i] || b.text;
    const pad = Math.max(2, b.h * 0.14);
    const rx = b.left - pad, ry = b.top - pad, rw = b.w + pad * 2, rh = b.h + pad * 2;
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, Math.min(9, rh / 2)); else ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    let fs = Math.max(10, Math.min(26, b.h * 0.8));
    ctx.fillStyle = "#141018";
    ctx.font = `600 ${fs}px system-ui,-apple-system,sans-serif`;
    let wrapped = wrapText(ctx, tx, b.w);
    while (wrapped.length * fs * 1.12 > rh && fs > 9) { fs -= 1; ctx.font = `600 ${fs}px system-ui,sans-serif`; wrapped = wrapText(ctx, tx, b.w); }
    wrapped.forEach((l, k) => ctx.fillText(l, b.left, b.top + k * fs * 1.12));
  });
  const out = await cv.convertToBlob({ type: "image/png" });
  return await blobToDataUrl(out);
}
// OCR a panel and return the translated lines (for the side-panel reader view).
// Translating the whole panel's lines together reads far better than per-word.
async function ocrSpaceText(imageUrl, target, key, src) {
  const raw = await fetchBlob(imageUrl);
  let s = await scaledJpeg(raw, 1600, 0.72);
  if (s.blob.size > 1000000) s = await scaledJpeg(raw, 1280, 0.55);
  if (s.blob.size > 1000000) s = await scaledJpeg(raw, 1024, 0.45);
  const dataUrl = await blobToDataUrl(s.blob);
  const fd = new FormData();
  fd.append("base64Image", dataUrl);
  fd.append("language", src || "jpn");
  fd.append("OCREngine", "1");
  fd.append("scale", "true");
  const res = await fetchRemote("https://api.ocr.space/parse/image", { method: "POST", headers: { apikey: key || "helloworld" }, body: fd });
  if (!res.ok) throw new Error(`ocr_${res.status}`);
  const j = await res.json();
  if (j.IsErroredOnProcessing) throw new Error(Array.isArray(j.ErrorMessage) ? j.ErrorMessage[0] : "ocr_err");
  const parsed = ((j.ParsedResults && j.ParsedResults[0] && j.ParsedResults[0].ParsedText) || "").trim();
  const srcLines = parsed.split(/\r?\n/).map((x) => x.trim()).filter((x) => x.length >= 1);
  if (!srcLines.length) return { lines: [] };
  const tr = await translateTexts(srcLines, target || "en");
  return { lines: srcLines.map((sl, i) => ({ src: sl, tr: tr[i] || sl })) };
}
// ---- Bundled offline OCR (Tesseract.js in an offscreen document) -----------
// The primary translation path: fully local, no key, no server, no CDN. The
// service worker can't run WASM/Workers, so OCR happens in offscreen.js.
const TESS_LANG = { fr:"fra",fra:"fra", eng: "eng", en: "eng", ja: "jpn", ko: "kor", kor: "kor", jpn: "jpn", chs: "chi_sim", chi_sim: "chi_sim", zh: "chi_sim" };
let offscreenReady = null;
async function ensureOffscreen() {
  if (!api.offscreen) throw new Error("no_offscreen");
  // hasDocument is the reliable check where available.
  try { if (await api.offscreen.hasDocument()) return; } catch {}
  if (offscreenReady) return offscreenReady;
  offscreenReady = api.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["WORKERS"],
    justification: "Run the bundled OCR engine (Tesseract) for image translation.",
  }).catch((e) => { offscreenReady = null; if (!/single offscreen|already/i.test(String(e && e.message))) throw e; });
  return offscreenReady;
}
function ocrViaTesseract(dataUrl, lang) {
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage({ type: "OCR_OFFSCREEN", dataUrl, lang }, (r) => {
      void api.runtime.lastError;
      if (r && r.ok) resolve(r);
      else reject(new Error((r && r.error) || "ocr_offscreen_failed"));
    });
  });
}
const translatedPanels = new Map();
async function ocrTextTesseract(imageUrl,target,src) {
  const key=JSON.stringify([imageUrl,target,src]);
  const cached=translatedPanels.get(key); if(cached && Date.now()-cached.at<10*60*1000)return cached.value;
  await ensureOffscreen();
  const blob=await fetchBlob(imageUrl); if(blob.size>25*1024*1024)throw new Error('image_too_large');
  const dataUrl=await blobToDataUrl(blob);
  const lang=TESS_LANG[src] || 'eng';
  const ocr=await ocrViaTesseract(dataUrl,lang);
  const blocks=ocr.blocks || [];
  if(!blocks.length)return {lines:[],blocks:[],width:ocr.width,height:ocr.height};
  const translated=await translateTexts(blocks.map(b=>b.text),target || 'en');
  const value={width:ocr.width,height:ocr.height,blocks:blocks.map((b,i)=>({...b,translation:translated[i]})),lines:blocks.map((b,i)=>({src:b.text,tr:translated[i]}))};
  if(translatedPanels.size>=24)translatedPanels.delete(translatedPanels.keys().next().value);
  translatedPanels.set(key,{at:Date.now(),value});return value;
}
async function translateImageText(imageUrl,target,src) { return ocrTextTesseract(imageUrl,target,src); }
// Lightweight reachability check: any HTTP response from the base or its docs
// means the server is up (endpoints differ by version, so we don't require 200).
async function testImgServer(url) {
  const base = (url || "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("bad_url");
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    for (const path of ["/docs", "/"]) {
      try {
        const r = await fetchRemote(base + path, { signal: ctrl.signal });
        if (r && (r.ok || r.status === 404 || r.status === 405)) return true;
      } catch (e) { /* try next path */ }
    }
    return false;
  } finally {
    clearTimeout(to);
  }
}
async function translateImage(imageUrl, code, target, src) {
  const s = await read(SETTINGS_KEY, DEFAULT_SETTINGS);
  // Advanced (best quality): a self-hosted manga-image-translator server.
  if (s && s.imgServer) return selfHostImage(s.imgServer, imageUrl, code);
  // Default: zero-setup OCR translation — one click, nothing to install.
  return ocrSpaceImage(imageUrl, target || "en", (s && s.ocrKey) || "helloworld", (s && s.ocrSrc) || src || "jpn");
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


// Every read-modify-write of user data shares one queue, including imports.
function mutateAndReply(task, respond) {
  serializeLibrary(task).then(result=>{respond(result);autoSync();},error=>respond({ok:false,error:String(error.message || error)}));
}
async function mergeImport(payload) {
  const items=await read(ITEMS_KEY,[]), byId=new Map(items.map(i=>[i.id,i])), ids=new Map();
  let added=0,updated=0;
  for(const raw of (Array.isArray(payload.items)?payload.items:[])) {
    if(!raw || typeof raw.title!=='string' || !raw.title.trim())continue;
    const p=Object.fromEntries(Object.entries(raw).filter(([k,v])=>v!==undefined&&!['__proto__','constructor','prototype'].includes(k)));
    const type=['reading','watching','game'].includes(p.type)?p.type:'watching';
    const compatible=i=>i.type===type && (!i.year || !p.year || Number(i.year)===Number(p.year));
    let key=p.id || workKey(p), ex=byId.get(key);
    if(ex && (!compatible(ex) || !sameWork(ex.title,p.title)))ex=null;
    if(!ex)ex=[...byId.values()].find(i=>compatible(i)&&sameWork(i.title,p.title));
    if(ex)key=ex.id;
    else {const base=key||'imported-work';let n=1;while(byId.has(key))key=base+'-'+type+'-'+n++;}
    if(p.id)ids.set(p.id,key);
    const season=Math.max(Number(ex?.season)||1,Number(p.season)||1);
    const episode=(Number(ex?.season)||1)>(Number(p.season)||1)?ex.episode:(Number(p.season)||1)>(Number(ex?.season)||1)?p.episode:Math.max(ex?.episode||0,p.episode||0);
    const sameSeason=!ex||(Number(ex.season)||1)===(Number(p.season)||1);
    const item=boundedProgress({...p,...ex,id:key,title:ex?.title||p.title,type,season:type==='watching'?season:undefined,
      episode:type==='watching'?episode:undefined,chapter:type==='reading'?Math.max(ex?.chapter||0,p.chapter||0):undefined,
      total:sameSeason?(ex?.total||p.total):season===(Number(p.season)||1)?p.total:ex?.total,
      rating:ex?.rating||p.rating||0,cover:ex?.cover||p.cover||'',url:ex?.url||p.url||'',favorite:ex?.favorite||p.favorite||false,
      tags:[...new Set([...(ex?.tags||[]),...(p.tags||[])])],sources:[...new Set([...(ex?.sources||[]),...(p.sources||[])])],
      createdAt:ex?.createdAt||p.createdAt||Date.now(),updatedAt:Date.now(),imported:true});
    byId.set(key,item);if(ex)updated++;else added++;
  }
  const patch={[ITEMS_KEY]:[...byId.values()]};
  if(Array.isArray(payload.lists)) {
    const lists=new Map((await read(LISTS_KEY,[])).map(l=>[l.id,l]));
    for(const l of payload.lists) {
      if(!l || !l.id)continue;
      const previous=lists.get(l.id), members=(l.itemIds||[]).map(id=>ids.get(id)||id).filter(id=>byId.has(id));
      lists.set(l.id,{...l,...previous,itemIds:[...new Set([...(previous?.itemIds||[]),...members])],updatedAt:Date.now()});
    }
    patch[LISTS_KEY]=[...lists.values()];
  }
  if(Array.isArray(payload.sites))patch[SITES_KEY]=mergeById(payload.sites,await read(SITES_KEY,[]));
  if(Array.isArray(payload.notifications))patch[NOTIF_KEY]=mergeById(payload.notifications.map(n=>({...n,itemId:ids.get(n.itemId)||n.itemId})),await read(NOTIF_KEY,[]));
  if(payload.settings)patch[SETTINGS_KEY]={...DEFAULT_SETTINGS,...payload.settings,...await read(SETTINGS_KEY,{})};
  await writeData(patch);return {ok:true,added,updated,total:byId.size};
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "DETECTION_UPDATED":
      api.storage.local.set({ "dasi.currentDetection": { ...message.payload, tabId: sender.tab?.id } });
      return;

    case "VIDEO_PROGRESS":
    case "SAVE_PROGRESS":
      writeItem(message.payload).then(async (result) => {
        // Optional: assign the saved work to a list (in-page bubble / popup ask
        // "which list?"). Accepts an existing listId, or a new list by name.
        if (result && result.item && (message.listId || message.listName)) {
          try {
            await serializeLibrary(()=>addItemToList(result.item.id, message.listId, message.listName));
          } catch (e) {sendResponse({ok:false,error:"list_save_failed",item:result.item});return;}
        }
        sendResponse(result);
        autoSync();
      }).catch(e=>sendResponse({ok:false,error:String(e.message)}));
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
    case "NOTIF_CLEAR":
      mutateAndReply(async()=>{const notifications=message.type==='NOTIF_CLEAR'?[]:(await read(NOTIF_KEY,[])).map(n=>({...n,read:true}));await writeData({[NOTIF_KEY]:notifications});return {notifications};},sendResponse);return true;
    case "SET_SETTINGS":
      mutateAndReply(async()=>{const settings={...DEFAULT_SETTINGS,...await read(SETTINGS_KEY,{}),...message.patch};await writeData({[SETTINGS_KEY]:settings});return {settings};},sendResponse);return true;
    case "LIST_DUPLICATE":
    case "LIST_CREATE":
    case "LIST_UPDATE":
    case "LIST_DELETE":
    case "LIST_SET_ITEMS":
      mutateAndReply(async()=>{
        let lists=await read(LISTS_KEY,[]),list;
        if(message.type==='LIST_CREATE') {list={id:'l_'+Math.random().toString(36).slice(2,10),name:String(message.name||'New list').slice(0,60),cover:message.cover||'#EDE6FF',itemIds:[],createdAt:Date.now(),updatedAt:Date.now()};lists=[...lists,list];}
        if(message.type==='LIST_DUPLICATE'){const old=lists.find(l=>l.id===message.id);if(!old)throw Error('list_not_found');list={...old,id:'l_'+crypto.randomUUID(),name:String(old.name+' (copy)').slice(0,100),itemIds:[...(old.itemIds||[])],archived:false,createdAt:Date.now(),updatedAt:Date.now()};delete list.memberships;lists=[...lists,list];}
        if(message.type==='LIST_DELETE')lists=lists.filter(l=>l.id!==message.id);
        if(message.type==='LIST_UPDATE'){const patch=Object.fromEntries(Object.entries(message.patch||{}).filter(([k])=>!['id','createdAt','itemIds','__proto__','constructor','prototype'].includes(k)));lists=lists.map(l=>l.id===message.id?{...l,...patch,updatedAt:Date.now()}:l);}
        if(message.type==='LIST_SET_ITEMS'){const valid=new Set((await read(ITEMS_KEY,[])).map(i=>i.id));lists=lists.map(l=>l.id===message.id?{...l,itemIds:[...new Set((message.itemIds||[]).filter(id=>valid.has(id)))],updatedAt:Date.now()}:l);}
        await writeData({[LISTS_KEY]:lists});return {ok:true,lists,list};
      },sendResponse);return true;
    case "ADD_SITE":
    case "REMOVE_SITE":
      mutateAndReply(async()=>{const previous=await read(SITES_KEY,[]);const sites=message.type==='REMOVE_SITE'?previous.filter(s=>(s.id||s.url)!==message.id):previous.some(s=>s.url===message.payload.url)?previous:[...previous,message.payload];await writeData({[SITES_KEY]:sites});return {sites};},sendResponse);return true;
    case "IMPORT_STATE":
    case "IMPORT_MERGE":
      mutateAndReply(()=>mergeImport(message.payload||{items:message.items}),sendResponse);return true;
    case "REMOVE_ITEM":
      mutateAndReply(async()=>{const items=(await read(ITEMS_KEY,[])).filter(i=>i.id!==message.id);const lists=(await read(LISTS_KEY,[])).map(l=>({...l,itemIds:(l.itemIds||[]).filter(id=>id!==message.id)}));await writeData({[ITEMS_KEY]:items,[LISTS_KEY]:lists});return {items,lists};},sendResponse);return true;

    // Patch a saved item (favorite, rating, tags, status…) from the library page.
    case "UPDATE_ITEM":
      serializeLibrary(async () => {
        const items = await read(ITEMS_KEY, []);
        const patch = Object.fromEntries(Object.entries(message.patch || {}).filter(([k]) => !['id','createdAt','__proto__','constructor','prototype'].includes(k)));
        const next = items.map(i => i.id === message.id ? boundedProgress({...i,...patch,updatedAt:Date.now()}) : i);
        await writeData({[ITEMS_KEY]:next});
        sendResponse({items:next}); autoSync();
      }).catch(e => sendResponse({ok:false,error:String(e.message)}));
      return true;

    // Lazy game enrichment: pull genres/tags + description from Steam when a
    // game fiche is opened without them. Best-effort; patches the item in place.
    case "GAME_ENRICH":
      {const epoch=accountEpoch;
      read(ITEMS_KEY, []).then(async (items) => {
        const it = items.find((x) => x.id === message.id);
        const appid = it ? steamAppId(it.url) : "";
        if (!it || !appid) { sendResponse({ ok: false }); return; }
        try {
          const d = await steamAppDetails(appid);
          if (!d) { sendResponse({ ok: false }); return; }
          const patch = { gameEnrichedAt: Date.now() };
          if (d.genres.length && !(it.tags && it.tags.length)) patch.tags = d.genres;
          if (d.synopsis && !it.synopsis) patch.synopsis = d.synopsis;
          if (d.releaseDate && !it.releaseDate) patch.releaseDate = d.releaseDate;
          const next = await serializeLibrary(async()=>{if(epoch!==accountEpoch)throw Error("account_changed");const current=await read(ITEMS_KEY,[]);const next=current.map(x=>x.id===message.id?{...x,...patch}:x);await writeData({[ITEMS_KEY]:next});return next;});
          sendResponse({ ok: true, item: next.find((x) => x.id === message.id) });
          autoSync();
        } catch { sendResponse({ ok: false }); }
      });
      return true;

      }
    // Fresh recommendations for the Home page (cached ~6h).
    case "DISCOVER":
      getDiscover(message.force)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    // Online search-to-add (AniList): returns catalog results for a title.
    case "CATALOG_SEARCH":
      catalogSearchAll(message.query || "")
        .then((results) => sendResponse({ ok: true, results }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    // Ping a self-hosted manga-image-translator server to validate the URL.
    case "TEST_IMG_SERVER":
      testImgServer(message.url)
        .then((ok) => sendResponse({ ok }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    // Translate one manga/webtoon panel by URL (OCR), returns a data URL.
    case "TRANSLATE_IMAGE":
      translateImage(message.url, message.code || "ENG", message.target || "en", message.src || "")
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    case "TRANSLATE_IMAGE_TEXT":
      translateImageText(message.url, message.target || "en", message.src || "")
        .then((r) => sendResponse({ ok: true, ...r }))
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
        api.tabs.sendMessage(tab.id, { type: "DASI_TRANSLATE", lang: message.lang || "en", src: message.src || "", imgServer: (s && s.imgServer) || "" }, () => {
          void api.runtime.lastError;
          const error = api.runtime.lastError; sendResponse(error ? {ok:false,error:"translation_start_failed"} : {ok:true,started:true});
        });
      }).catch(e => sendResponse({ok:false,error:String(e.message)}));
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
          const res = await apiCall(cfg, "/auth/email", { method: "POST", body: JSON.stringify({ email: message.email,current:message.current }) });
          if (!res.ok) { const e = await res.json().catch(() => ({})); return sendResponse({ ok: false, error: e.error || `http_${res.status}` }); }
          await serializeLibrary(async()=>{if((await getSyncConfig())?.token!==cfg.token)throw Error("account_changed");await api.storage.local.set({ [SYNC_CFG_KEY]: { ...cfg, email: message.email } });});
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
          const data=await res.json();
          await serializeLibrary(async()=>{if((await getSyncConfig())?.token!==cfg.token)throw Error('account_changed');await api.storage.local.set({[SYNC_CFG_KEY]:{...cfg,token:data.token}});});
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: String(e && e.message) }); }
      });
      return true;

    case 'SYNC_LOGOUT_ALL':
    case 'SYNC_DELETE_ACCOUNT':
      (async()=>{
        const cfg=await getSyncConfig();if(!cfg?.token)throw Error('not_signed_in');
        const res=await apiCall(cfg,message.type==='SYNC_DELETE_ACCOUNT'?'/auth/delete':'/auth/logout-all',{method:'POST',body:JSON.stringify({current:message.current})});
        if(!res.ok)throw Error((await res.json()).error||'account_change_failed');
        await serializeLibrary(async()=>{if((await getSyncConfig())?.token!==cfg.token)throw Error('account_changed');await switchSyncAccount(null);});
        sendResponse({ok:true});
      })().catch(error=>sendResponse({ok:false,error:String(error.message)}));return true;
    case "SYNC_SIGN_OUT":
      mutateAndReply(async()=>{
        const cfg=await getSyncConfig();
        if(cfg?.token){const res=await apiCall(cfg,'/auth/logout',{method:'POST'});if(!res.ok)throw Error('sign_out_failed');}
        await switchSyncAccount(null);return {ok:true};
      },sendResponse);
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
const SCHEMA_VERSION = 3;
async function migrateStorage() {
  const stored=(await api.storage.local.get('dasi.schema'))['dasi.schema'] || 0;
  if(stored>=SCHEMA_VERSION)return;
  if(stored<2){
    const items=await read(ITEMS_KEY,[]), lists=await read(LISTS_KEY,[]), notifications=await read(NOTIF_KEY,[]);
    const ids=new Map(), used=new Set();
    const next=items.map((item,index)=>{
      const base=String(item.id || 'legacy-'+index).replace(/\s+/g,'-');let id=base;
      while(used.has(id))id=base+'-'+index+'-'+used.size;
      used.add(id);ids.set(item.id,id);return {...item,id};
    });
    // Backup is local only. All records and references change in one storage operation.
    await api.storage.local.set({'dasi.migrationBackup.v1':{items,lists,notifications,at:Date.now()},[ITEMS_KEY]:next,[LISTS_KEY]:lists.map(l=>({...l,itemIds:(l.itemIds || []).map(id=>ids.get(id) || id)})),[NOTIF_KEY]:notifications.map(n=>({...n,itemId:ids.get(n.itemId) || n.itemId})),'dasi.schema':SCHEMA_VERSION});
  }else await api.storage.local.set({'dasi.schema':SCHEMA_VERSION});
}
api.runtime.onInstalled.addListener(()=>serializeLibrary(migrateStorage).catch(error=>api.storage.local.set({'dasi.migrationError':String(error.message)})));

/*
 * Awaited games: once a day (and on startup) flip any game whose release date
 * has passed from "upcoming" to released, and notify. No network — purely the
 * dates you already saved.
 */
async function checkGameReleases() {
  const candidates=(await read(ITEMS_KEY,[])).filter(i=>i.type==='game' && !i.released && steamAppId(i.url)).sort((a,b)=>(a.releaseCheckedAt||0)-(b.releaseCheckedAt||0)).slice(0,8);
  for(const candidate of candidates){
    try{
      const details=await steamAppDetails(steamAppId(candidate.url));if(!details)continue;
      await serializeLibrary(async()=>{
        const items=await read(ITEMS_KEY,[]), current=items.find(i=>i.id===candidate.id);if(!current)return;
        const released=details.comingSoon===false?true:details.comingSoon===true?false:current.released;
        const next=items.map(i=>i.id===current.id?{...i,released,releaseDate:details.releaseDate||i.releaseDate,releaseCheckedAt:Date.now(),updatedAt:Date.now()}:i);
        await writeData({[ITEMS_KEY]:next});
        if(released && !current.released){await pushNotification({itemId:current.id,title:current.title,message:'is out now',url:current.url});systemNotify(current.title,'is out now','dasi_game_'+current.id);}
      });
    }catch{/* A failed source never turns an expected date into a confirmed release. */}
  }
}

try {
  api.alarms?.create("dasi-daily", { periodInMinutes: 720 });
  api.alarms?.onAlarm.addListener((a) => { if (a.name === "dasi-daily") return checkGameReleases();if(a.name===SYNC_ALARM)return runAutoSync(); });
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
