/* Editorial Quiet / service worker: event-driven, local-only persistence, no remote dependencies. */
const api = globalThis.chrome;
const KEY = "suivi.items";
const readItems = async () => (await api.storage.local.get(KEY))[KEY] || [];
const writeItem = async payload => {
  const items = await readItems();
  const key = `${payload.domain}:${payload.title}:${payload.chapter || payload.episode || ""}`.toLowerCase();
  const next = { ...payload, id: key, updatedAt: Date.now(), status: payload.position && payload.duration && payload.position / payload.duration > 0.92 ? "Completed" : "In progress" };
  const withoutCurrent = items.filter(item => item.id !== key);
  await api.storage.local.set({ [KEY]: [next, ...withoutCurrent].slice(0, 500) });
  return next;
};

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DETECTION_UPDATED") {
    api.storage.local.set({ currentDetection: { ...message.payload, tabId: sender.tab?.id } });
    return;
  }
  if (message.type === "VIDEO_PROGRESS") { writeItem(message.payload).then(sendResponse); return true; }
  if (message.type === "SAVE_PROGRESS") { writeItem(message.payload).then(sendResponse); return true; }
  if (message.type === "GET_STATE") { Promise.all([readItems(), api.storage.local.get("currentDetection")]).then(([items, state]) => sendResponse({ items, currentDetection: state.currentDetection })); return true; }
});

api.commands.onCommand.addListener(async command => {
  if (command !== "save-progress") return;
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id) api.tabs.sendMessage(tab.id, { type: "REQUEST_DETECTION" });
});
