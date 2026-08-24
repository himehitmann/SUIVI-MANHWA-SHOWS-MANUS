import type { AppNotification, CustomList, DasiState, FavoriteSite, LibraryItem } from "./types";

/** Demo content shown on first run so the app is never a blank canvas. */
const now = Date.now();
const days = (n: number) => now - n * 86_400_000;

export const seedItems: LibraryItem[] = [
  {
    id: "one-piece",
    title: "One Piece",
    type: "reading",
    chapter: 1152,
    progress: 72,
    status: "in_progress",
    url: "https://asuracomic.net/series/one-piece/chapter-1152",
    domain: "asuracomic.net",
    sources: ["asuracomic.net", "mangadex.org"],
    cover: "/manus-storage/one-piece-cover_6094f10e.jpeg",
    accent: "#D9F4EA",
    createdAt: days(40),
    updatedAt: now - 12 * 60_000,
    favorite: true,
    hasUpdate: true,
    updateLabel: "Chapter 1153",
  },
  {
    id: "breaking-bad",
    title: "Breaking Bad",
    type: "watching",
    season: 3,
    episode: 7,
    position: 1240,
    duration: 2820,
    progress: 34,
    status: "in_progress",
    url: "https://www.netflix.com/watch/70196252",
    domain: "netflix.com",
    sources: ["netflix.com"],
    cover: "/manus-storage/breaking-bad-poster_30f4862f.jpg",
    accent: "#DDE7FF",
    createdAt: days(9),
    updatedAt: days(1),
    favorite: false,
  },
  {
    id: "apothecary-diaries",
    title: "The Apothecary Diaries",
    type: "watching",
    season: 2,
    episode: 18,
    progress: 51,
    status: "in_progress",
    url: "https://aniwatchtv.to/watch/the-apothecary-diaries-18168",
    domain: "aniwatchtv.to",
    sources: ["aniwatchtv.to"],
    cover: "/manus-storage/apothecary-diaries_cd79dc6f.jpg",
    accent: "#F0DFFF",
    createdAt: days(6),
    updatedAt: days(2),
    favorite: false,
    hasUpdate: true,
    updateLabel: "Episode 19",
  },
  {
    id: "pragmatic-programmer",
    title: "The Pragmatic Programmer",
    type: "reading",
    page: 147,
    totalPages: 352,
    progress: 41,
    status: "in_progress",
    url: "https://archive.org/details/pragmaticprogram0000hunt",
    domain: "archive.org",
    sources: ["archive.org"],
    accent: "#FFE7D6",
    createdAt: days(14),
    updatedAt: days(4),
    favorite: false,
  },
];

export const seedSites: FavoriteSite[] = [
  { id: "asura", name: "AsuraScans", url: "https://asuracomic.net", domain: "asuracomic.net", color: "#FFEAF2" },
  { id: "webtoons", name: "WEBTOON", url: "https://www.webtoons.com", domain: "webtoons.com", color: "#E9F8F0" },
  { id: "aniwatch", name: "Aniwatch", url: "https://aniwatchtv.to", domain: "aniwatchtv.to", color: "#E9F5FF" },
  { id: "netflix", name: "Netflix", url: "https://www.netflix.com", domain: "netflix.com", color: "#FFF0E5" },
];

export const seedLists: CustomList[] = [
  { id: "list-favorites", name: "All-time favorites", color: "#9B86DA", itemIds: ["one-piece"], createdAt: days(30) },
  { id: "list-weekend", name: "Weekend binge", color: "#63B897", itemIds: ["breaking-bad", "apothecary-diaries"], createdAt: days(20) },
];

export const seedNotifications: AppNotification[] = [
  {
    id: "n1",
    kind: "new_chapter",
    itemId: "one-piece",
    title: "One Piece",
    body: "Chapter 1153 is available.",
    createdAt: now - 30 * 60_000,
    read: false,
  },
  {
    id: "n2",
    kind: "new_episode",
    itemId: "apothecary-diaries",
    title: "The Apothecary Diaries",
    body: "Episode 19 is available.",
    createdAt: days(1),
    read: false,
  },
];

export function seedState(): DasiState {
  return {
    items: seedItems,
    lists: seedLists,
    sites: seedSites,
    notifications: seedNotifications,
    plan: "free",
    learn: { lang: "ko", xp: 0, streak: 0, lastStudied: null, mastery: {}, srs: {}, dailyGoal: 20, daily: {}, achievements: [], perfectQuizzes: 0 },
    version: 1,
  };
}
