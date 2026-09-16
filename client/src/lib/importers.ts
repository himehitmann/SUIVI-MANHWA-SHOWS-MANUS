/**
 * Import libraries exported from other trackers. Pure and dependency-free so it
 * is unit-tested. Supported inputs, auto-detected:
 *  - Dasi JSON backup ({ items: [...] })
 *  - MyAnimeList XML export (anime + manga) — also works for MAL-compatible tools
 *  - Generic CSV with a header row (Trakt/Simkl/spreadsheet exports)
 *  - Generic JSON array of { title, type, chapter/episode, url, ... }
 */
import {normalizeLibraryItem} from "./library-merge";
import { createItem, type ItemInput } from "./item";
import type { ContentType, ItemStatus, LibraryItem } from "./types";

export type ImportFormat = "dasi" | "mal" | "csv" | "json" | "unknown";

export interface ImportResult {
  format: ImportFormat;
  items: LibraryItem[];
}

function malStatus(s: string): ItemStatus {
  const v = (s || "").toLowerCase();
  if (v.includes("complete")) return "completed";
  if (v.includes("hold")) return "on_hold";
  if (v.includes("plan")) return "planned";
  if (v.includes("drop")) return "dropped";
  return "in_progress";
}

const tag = (block: string, name: string): string | undefined => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return undefined;
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() || undefined;
};
const numTag = (block: string, name: string): number | undefined => {
  const v = tag(block, name);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function parseMalXml(text: string): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const m of Array.from(text.matchAll(/<anime>([\s\S]*?)<\/anime>/gi))) {
    const b = m[1];
    const title = tag(b, "series_title");
    if (!title) continue;
    items.push(
      createItem({
        title,
        type: "watching",
        episode: numTag(b, "my_watched_episodes"),
        status: malStatus(tag(b, "my_status") || ""),
        rating: numTag(b, "my_score"),
      }),
    );
  }
  for (const m of Array.from(text.matchAll(/<manga>([\s\S]*?)<\/manga>/gi))) {
    const b = m[1];
    const title = tag(b, "manga_title") || tag(b, "series_title");
    if (!title) continue;
    items.push(
      createItem({
        title,
        type: "reading",
        chapter: numTag(b, "my_read_chapters"),
        volume: numTag(b, "my_read_volumes"),
        status: malStatus(tag(b, "my_status") || ""),
        rating: numTag(b, "my_score"),
      }),
    );
  }
  return items;
}

/** Split one CSV line, honoring double-quoted fields. */
function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): LibraryItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = csvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));
  const col = {
    title: idx(["title", "name", "series"]),
    type: idx(["type", "category", "format"]),
    chapter: idx(["chapter", "chapters", "progress"]),
    episode: idx(["episode", "episodes"]),
    season: idx(["season"]),
    status: idx(["status", "state"]),
    url: idx(["url", "link"]),
    cover: idx(["cover", "image"]),
  };
  if (col.title < 0) return [];
  const items: LibraryItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = csvLine(lines[i]);
    const title = cells[col.title];
    if (!title) continue;
    const typeRaw = (col.type >= 0 ? cells[col.type] : "").toLowerCase();
    const num = (c: number) => (c >= 0 && cells[c] ? parseInt(cells[c], 10) || undefined : undefined);
    let isWatch: boolean;
    if (typeRaw) isWatch = /anime|show|tv|movie|film|series|watch|episode/.test(typeRaw);
    else isWatch = col.episode >= 0 && Boolean(cells[col.episode]);
    const statusRaw = (col.status >= 0 ? cells[col.status] : "").toLowerCase();
    items.push(
      createItem({
        title,
        type: (isWatch ? "watching" : "reading") as ContentType,
        chapter: num(col.chapter),
        episode: num(col.episode),
        season: num(col.season),
        status: statusRaw ? malStatus(statusRaw) : undefined,
        url: col.url >= 0 ? cells[col.url] || undefined : undefined,
        cover: col.cover >= 0 ? cells[col.cover] || undefined : undefined,
      }),
    );
  }
  return items;
}

function normalizeItems(raw:unknown[]):LibraryItem[]{return raw.map(normalizeLibraryItem).filter((i):i is LibraryItem=>Boolean(i));}

export function parseImport(text: string): ImportResult {
  const trimmed = text.trim();
  if (/<myanimelist/i.test(trimmed) || (/<manga>|<anime>/i.test(trimmed))) {
    return { format: "mal", items: parseMalXml(trimmed) };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data)) return { format: "json", items: normalizeItems(data) };
      if (Array.isArray(data.items)) {
        const isDasi = data.version === 1 || data.items.some((i: Record<string, unknown>) => typeof i.accent === "string");
        return { format: "dasi", items: normalizeItems(data.items) };
      }
    } catch {
      /* fall through */
    }
  }
  if (trimmed.includes(",") && /\n/.test(trimmed)) {
    return { format: "csv", items: parseCsv(trimmed) };
  }
  return { format: "unknown", items: [] };
}
