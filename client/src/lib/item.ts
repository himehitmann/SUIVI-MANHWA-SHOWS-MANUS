/** Pure helpers to build canonical LibraryItems (shared by manual add + importers). */
import type { ContentType, ItemStatus, LibraryItem } from "./types";

const ACCENTS = ["#D9F4EA", "#DDE7FF", "#F0DFFF", "#FFE7D6", "#FFEAF2", "#E9F5FF"];

/** Stable, human work key: lowercased, punctuation-stripped, chapter/episode markers removed. */
export function workId(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(chapter|chap|ch|episode|ep|season|vol|volume|page|part)\s*\d+\b/g, "")
    .trim()
    .replace(/\s+/g, "-") || `item-${Math.random().toString(36).slice(2, 8)}`;
}

export function accentFor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function domainOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface ItemInput {
  title: string;
  type?: ContentType;
  chapter?: number;
  volume?: number;
  season?: number;
  episode?: number;
  page?: number;
  totalPages?: number;
  progress?: number;
  status?: ItemStatus;
  url?: string;
  cover?: string;
  favorite?: boolean;
  rating?: number;
}

export function createItem(input: ItemInput): LibraryItem {
  const title = (input.title || "").trim() || "Untitled";
  const domain = domainOf(input.url);
  const now = Date.now();
  const progress =
    input.progress ?? (input.status === "completed" ? 100 : 0);
  return {
    id: workId(title),
    title,
    type: input.type ?? "reading",
    chapter: input.chapter,
    volume: input.volume,
    season: input.season,
    episode: input.episode,
    page: input.page,
    totalPages: input.totalPages,
    progress: Math.min(100, Math.max(0, progress)),
    status: input.status ?? "in_progress",
    url: input.url ?? "",
    domain,
    sources: domain ? [domain] : [],
    cover: input.cover,
    accent: accentFor(title),
    createdAt: now,
    updatedAt: now,
    favorite: input.favorite ?? false,
    rating: input.rating,
  };
}
