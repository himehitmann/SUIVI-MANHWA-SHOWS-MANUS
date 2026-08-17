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

const normalize = (v) => (v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const workKey = (p) =>
  normalize(p.workId || p.title).replace(/\b(chapter|chap|episode|ep|season|volume|vol|page|part)\s*\d+\b/g, "").trim();

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

  const merged = {
    ...existing,
    ...incoming,
    createdAt: existing?.createdAt || Date.now(),
    favorite: existing?.favorite || false,
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
      writeItem(message.payload).then(sendResponse);
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
        api.storage.local.get(["dasi.currentDetection", "dasi.lastConflict"]),
      ]).then(([items, sites, notifications, state]) =>
        sendResponse({
          items,
          sites,
          notifications,
          currentDetection: state["dasi.currentDetection"],
          lastConflict: state["dasi.lastConflict"],
        }),
      );
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
        writeData(patch).then(() => sendResponse({ ok: true }));
      }
      return true;

    case "REMOVE_ITEM":
      read(ITEMS_KEY, []).then((items) => {
        const next = items.filter((i) => i.id !== message.id);
        writeData({ [ITEMS_KEY]: next }).then(() => sendResponse({ items: next }));
      });
      return true;

    default:
      return;
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
