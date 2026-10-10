/** Pure helpers to build canonical LibraryItems (shared by manual add + importers). */
import type { ContentType, ItemStatus, LibraryItem } from "./types";

const ACCENTS = ["#D9F4EA", "#DDE7FF", "#F0DFFF", "#FFE7D6", "#FFEAF2", "#E9F5FF"];

const LEADING_ARTICLE = /^(the|a|an|le|la|les|un|une|el|los|las|der|die|das)\s+/;

/**
 * Normalized title used to decide whether two saves are the SAME work across
 * different sites: lowercased, accents stripped, chapter/episode/season markers
 * removed, a leading article dropped, and everything but letters/numbers (across
 * scripts — Latin, Hangul, Kana, Han…) collapsed to single spaces.
 */
export function normalizeTitle(title: string): string {
  let t = (title || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  t = t.replace(/\b(chapter|chap|ch|episode|epi|ep|season|saison|vol|volume|page|part|arc|cour)\s*\d+\b/g, " ");
  t = t.replace(/\bs\s*\d+\s*e\s*\d+\b/g, " "); // s01e02 style
  t = t.replace(/第?\s*\d+\s*[화話话巻卷章回]/g, " "); // CJK/KR counters: 第12話, 12화, 3章…
  // Strip general / CJK / fullwidth punctuation (em dash, 、。！…) then keep
  // digits, Latin letters and any non-ASCII letter (Hangul, Kana, Han…);
  // collapse the rest. Avoids \p{} so it works on the ES5 target.
  t = t.replace(/[\u2000-\u206F\u3000-\u303F\uFF00-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/g, " ");
  t = t.replace(/[^0-9a-z-￿]+/gi, " ").trim();
  t = t.replace(LEADING_ARTICLE, "");
  return t.replace(/\s+/g, " ").trim();
}

/** Stable, human work key derived from the normalized title. */
export function workId(title: string): string {
  const n = normalizeTitle(title);
  return (n ? n.replace(/\s+/g, "-") : "") || `item-${Math.random().toString(36).slice(2, 8)}`;
}

function editRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m = a.length, n = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - d[n] / Math.max(m, n);
}

/**
 * Whether two titles denote the same work — used to merge the same series saved
 * on different sites even when the titles differ in spelling, word order, an
 * article, or a subtitle. Conservative to avoid merging distinct works.
 */
export function sameWork(a: string, b: string): boolean {
  const na = normalizeTitle(a), nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Numbered sequels and remakes must never be auto-merged as a spelling variant.
  if ((na.match(/\d+|\b[ivx]+\b/g) || []).join(',') !== (nb.match(/\d+|\b[ivx]+\b/g) || []).join(',')) return false;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  if (ta.size === tb.size && Array.from(ta).every((x) => tb.has(x))) return true; // same tokens, any order
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size >= 2) {
    let inter = 0;
    small.forEach((x) => big.has(x) && inter++);
    if (inter === small.size && small.size / big.size >= 0.6) return false; // subtitle superset
  }
  return editRatio(na, nb) >= 0.9; // spelling / romanization variants
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

export interface ItemInput extends Partial<LibraryItem> {
  year?:number;
  format?:string;
  total?:number;
  synopsis?:string;
  externalIds?:Record<string,string|number>;
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
    ...input,
    id: workId(title),
    year:input.year,format:input.format,total:input.total,synopsis:input.synopsis,externalIds:input.externalIds,
    title,
    type: input.type ?? "reading",
    chapter: input.chapter===undefined?undefined:Math.min(input.total||Infinity,Math.max(0,Math.floor(Number(input.chapter)||0))),
    volume: input.volume,
    season: input.season,
    episode: input.episode===undefined?undefined:Math.min(input.total||Infinity,Math.max(0,Math.floor(Number(input.episode)||0))),
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
