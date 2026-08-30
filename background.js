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
const DEFAULT_SETTINGS = { notifyNew: true };

const normalize = (v) => (v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Canonical work id — MUST match the web app's workId() (client/src/lib/item.ts)
// so the same work merges across the extension and the web app over sync:
// lowercased, punctuation-stripped, chapter/episode markers removed, hyphenated.
const workKey = (p) =>
  normalize(p.workId || p.title)
    .replace(/\b(chapter|chap|ch|episode|ep|season|vol|volume|page|part)\s*\d+\b/g, "")
    .trim()
    .replace(/\s+/g, "-");

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
  const key = workKey(payload);
  const existing = items.find((i) => i.id === key);
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
    createdAt: existing?.createdAt || Date.now(),
    favorite: existing?.favorite || false,
    rating: existing?.rating || 0,
    sources: [...new Set([...(existing?.sources || []), payload.domain].filter(Boolean))],
  };

  const next = [merged, ...items.filter((i) => i.id !== key)].slice(0, 800);
  await writeData({ [ITEMS_KEY]: next });
  await api.storage.local.set({ "dasi.lastConflict": null });
  return { item: merged, conflict: Boolean(existing), kept: "incoming" };
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
