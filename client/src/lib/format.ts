import type { LibraryItem } from "./types";
import type { StringKey } from "@/i18n/strings";

/** Localized relative time. Returns a translation key + vars so the caller can localize. */
export function relativeTime(ts: number, t: (k: StringKey, v?: Record<string, string | number>) => string): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const daysAgo = Math.round(hours / 24);
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 30) return `${daysAgo} days ago`;
  return new Date(ts).toLocaleDateString();
}

/** Human progress marker like "Chapter 1152" or "Season 3 · Episode 7". */
export function markerLabel(item: LibraryItem, t: (k: StringKey, v?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  if (item.volume) parts.push(t("unit.volume", { n: item.volume }));
  if (item.chapter) parts.push(t("unit.chapter", { n: item.chapter }));
  if (item.season) parts.push(t("unit.season", { n: item.season }));
  if (item.episode) parts.push(t("unit.episode", { n: item.episode }));
  if (item.page) {
    parts.push(item.totalPages ? `${t("unit.page", { n: item.page })} / ${item.totalPages}` : t("unit.page", { n: item.page }));
  }
  return parts.join(" · ") || item.domain;
}

export function timecode(seconds?: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
