import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { nanoid } from "nanoid";
import type { AppNotification, CustomList, DasiState, FavoriteSite, LearnLang, LibraryItem, Plan } from "@/lib/types";
import { seedState } from "@/lib/seed";
import { createItem, type ItemInput } from "@/lib/item";
import { XP_KNOWN, XP_LEARNING, XP_REVIEW, levelInfo, nextStreak, todayStr } from "@/lib/vocab";

const STORAGE_KEY = "dasi.state.v1";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function load(): DasiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DasiState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) {
        // Forward-compatible: fill in slices added in later versions.
        if (!parsed.learn) parsed.learn = { lang: "ko", xp: 0, streak: 0, lastStudied: null, mastery: {} };
        return parsed;
      }
    }
  } catch {
    /* corrupt or unavailable — fall back to seed */
  }
  return seedState();
}

interface StoreValue extends DasiState {
  addItem: (input: ItemInput) => LibraryItem;
  importItems: (items: LibraryItem[]) => number;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearUpdate: (id: string) => void;
  addSite: (name: string, url: string) => void;
  removeSite: (id: string) => void;
  createList: (name: string, color: string) => CustomList;
  deleteList: (id: string) => void;
  setListColor: (id: string, color: string) => void;
  addItemToList: (listId: string, itemId: string) => void;
  removeItemFromList: (listId: string, itemId: string) => void;
  reorderList: (listId: string, itemIds: string[]) => void;
  markAllRead: () => void;
  simulateUpdateScan: () => number;
  setPlan: (plan: Plan) => void;
  reset: () => void;
  exportData: () => void;
  importData: (json: string) => boolean;
  applyState: (next: Partial<DasiState>) => void;
  snapshot: () => DasiState;
  setLearnLang: (lang: LearnLang) => void;
  studyWord: (wordId: string, known: boolean) => { xpGained: number; leveledUp: boolean; level: number };
}

const StoreContext = createContext<StoreValue | null>(null);

const LIST_COLORS = ["#9B86DA", "#63B897", "#8EA8E7", "#E88BB0", "#E7A977", "#6FC5C0"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DasiState>(load);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* ignore quota errors */
      }
    }, 200);
    return () => clearTimeout(saveTimer.current);
  }, [state]);

  const patch = useCallback((updater: (s: DasiState) => DasiState) => setState(updater), []);

  const addItem = useCallback(
    (input: ItemInput) => {
      const item = createItem(input);
      patch((s) => {
        const rest = s.items.filter((i) => i.id !== item.id);
        return { ...s, items: [item, ...rest] };
      });
      return item;
    },
    [patch],
  );

  const importItems = useCallback(
    (incoming: LibraryItem[]) => {
      let count = 0;
      patch((s) => {
        const byId = new Map(s.items.map((i) => [i.id, i]));
        for (const it of incoming) {
          if (!it || !it.id) continue;
          const prev = byId.get(it.id);
          byId.set(it.id, prev ? { ...prev, ...it, createdAt: prev.createdAt } : it);
          count += 1;
        }
        return { ...s, items: Array.from(byId.values()) };
      });
      return count;
    },
    [patch],
  );

  const removeItem = useCallback(
    (id: string) =>
      patch((s) => ({
        ...s,
        items: s.items.filter((i) => i.id !== id),
        lists: s.lists.map((l) => ({ ...l, itemIds: l.itemIds.filter((x) => x !== id) })),
      })),
    [patch],
  );

  const toggleFavorite = useCallback(
    (id: string) =>
      patch((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)) })),
    [patch],
  );

  const clearUpdate = useCallback(
    (id: string) =>
      patch((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === id ? { ...i, hasUpdate: false, updateLabel: undefined } : i)),
      })),
    [patch],
  );

  const addSite = useCallback(
    (name: string, url: string) =>
      patch((s) => {
        const normalized = /^https?:\/\//.test(url) ? url : `https://${url}`;
        const site: FavoriteSite = {
          id: nanoid(8),
          name: name.trim() || domainOf(normalized),
          url: normalized,
          domain: domainOf(normalized),
          color: LIST_COLORS[s.sites.length % LIST_COLORS.length] + "22",
        };
        return { ...s, sites: [...s.sites, site] };
      }),
    [patch],
  );

  const removeSite = useCallback(
    (id: string) => patch((s) => ({ ...s, sites: s.sites.filter((x) => x.id !== id) })),
    [patch],
  );

  const createList = useCallback(
    (name: string, color: string) => {
      const list: CustomList = { id: nanoid(8), name: name.trim() || "Untitled list", color, itemIds: [], createdAt: Date.now() };
      patch((s) => ({ ...s, lists: [...s.lists, list] }));
      return list;
    },
    [patch],
  );

  const deleteList = useCallback(
    (id: string) => patch((s) => ({ ...s, lists: s.lists.filter((l) => l.id !== id) })),
    [patch],
  );

  const setListColor = useCallback(
    (id: string, color: string) =>
      patch((s) => ({ ...s, lists: s.lists.map((l) => (l.id === id ? { ...l, color } : l)) })),
    [patch],
  );

  const addItemToList = useCallback(
    (listId: string, itemId: string) =>
      patch((s) => ({
        ...s,
        lists: s.lists.map((l) =>
          l.id === listId && !l.itemIds.includes(itemId) ? { ...l, itemIds: [...l.itemIds, itemId] } : l,
        ),
      })),
    [patch],
  );

  const removeItemFromList = useCallback(
    (listId: string, itemId: string) =>
      patch((s) => ({
        ...s,
        lists: s.lists.map((l) => (l.id === listId ? { ...l, itemIds: l.itemIds.filter((x) => x !== itemId) } : l)),
      })),
    [patch],
  );

  const reorderList = useCallback(
    (listId: string, itemIds: string[]) =>
      patch((s) => ({ ...s, lists: s.lists.map((l) => (l.id === listId ? { ...l, itemIds } : l)) })),
    [patch],
  );

  const markAllRead = useCallback(
    () => patch((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    [patch],
  );

  const setPlan = useCallback((plan: Plan) => patch((s) => ({ ...s, plan })), [patch]);

  const reset = useCallback(() => setState(seedState()), []);

  const applyState = useCallback(
    (next: Partial<DasiState>) => setState((s) => ({ ...s, ...next, version: 1 })),
    [],
  );

  const stateRef = useRef(state);
  stateRef.current = state;
  const snapshot = useCallback(() => stateRef.current, []);

  const setLearnLang = useCallback(
    (lang: LearnLang) => patch((s) => ({ ...s, learn: { ...s.learn, lang } })),
    [patch],
  );

  const studyWord = useCallback(
    (wordId: string, known: boolean) => {
      const cur = stateRef.current.learn;
      const prev = cur.mastery[wordId];
      const xpGained = prev === 2 && known ? XP_REVIEW : known ? XP_KNOWN : XP_LEARNING;
      const beforeLevel = levelInfo(cur.xp).level;
      const newXp = cur.xp + xpGained;
      const afterLevel = levelInfo(newXp).level;
      const today = todayStr();
      const streak = nextStreak(cur.streak, cur.lastStudied, today);
      patch((s) => ({
        ...s,
        learn: {
          ...s.learn,
          xp: newXp,
          streak,
          lastStudied: today,
          mastery: { ...s.learn.mastery, [wordId]: known ? 2 : 1 },
        },
      }));
      return { xpGained, leveledUp: afterLevel > beforeLevel, level: afterLevel };
    },
    [patch],
  );

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dasi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importData = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as DasiState;
      if (!parsed || !Array.isArray(parsed.items)) return false;
      setState((s) => ({
        version: 1,
        items: parsed.items,
        lists: Array.isArray(parsed.lists) ? parsed.lists : [],
        sites: Array.isArray(parsed.sites) ? parsed.sites : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        plan: parsed.plan ?? "free",
        learn: parsed.learn ?? s.learn,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Manual, on-demand update scan. Real update discovery happens through the
   * extension against the pages the user actually opens; here we surface items
   * already flagged with an available update as fresh notifications.
   */
  const simulateUpdateScan = useCallback(() => {
    let found = 0;
    patch((s) => {
      const fresh: AppNotification[] = [];
      for (const item of s.items) {
        if (item.hasUpdate && !s.notifications.some((n) => n.itemId === item.id && !n.read)) {
          found += 1;
          fresh.push({
            id: nanoid(8),
            kind: item.type === "reading" ? "new_chapter" : "new_episode",
            itemId: item.id,
            title: item.title,
            body: `${item.updateLabel ?? "New content"} is available.`,
            createdAt: Date.now(),
            read: false,
          });
        }
      }
      return fresh.length ? { ...s, notifications: [...fresh, ...s.notifications] } : s;
    });
    return found;
  }, [patch]);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      addItem,
      importItems,
      removeItem,
      toggleFavorite,
      clearUpdate,
      addSite,
      removeSite,
      createList,
      deleteList,
      setListColor,
      addItemToList,
      removeItemFromList,
      reorderList,
      markAllRead,
      simulateUpdateScan,
      setPlan,
      reset,
      exportData,
      importData,
      applyState,
      snapshot,
      setLearnLang,
      studyWord,
    }),
    [state, addItem, importItems, removeItem, toggleFavorite, clearUpdate, addSite, removeSite, createList, deleteList, setListColor, addItemToList, removeItemFromList, reorderList, markAllRead, simulateUpdateScan, setPlan, reset, exportData, importData, applyState, snapshot, setLearnLang, studyWord],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { LIST_COLORS, domainOf };

export function formatMarker(item: LibraryItem): { unit: "chapter" | "volume" | "season" | "episode" | "page" | "percent"; n: number }[] {
  const parts: { unit: "chapter" | "volume" | "season" | "episode" | "page" | "percent"; n: number }[] = [];
  if (item.volume) parts.push({ unit: "volume", n: item.volume });
  if (item.chapter) parts.push({ unit: "chapter", n: item.chapter });
  if (item.season) parts.push({ unit: "season", n: item.season });
  if (item.episode) parts.push({ unit: "episode", n: item.episode });
  if (item.page) parts.push({ unit: "page", n: item.page });
  return parts;
}
