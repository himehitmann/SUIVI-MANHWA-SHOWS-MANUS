/**
 * Pure detection heuristics — the URL/text side of Dasi's detector.
 *
 * This module is framework-free and DOM-free so it can be unit tested in
 * isolation. `extension/content.js` mirrors these exact regexes for the runtime
 * content script (which also layers DOM/JSON-LD adapters on top). Keeping the
 * algorithm here, under test, is how we guard against regressions in the part
 * that is easiest to get subtly wrong: parsing titles, chapters and episodes.
 */

export interface Marker {
  title?: string;
  type?: "reading" | "watching";
  chapter?: number;
  volume?: number;
  season?: number;
  episode?: number;
  adapter?: string;
}

const clean = (v: string): string => (v || "").replace(/\s+/g, " ").trim();
const toNum = (v: string | number | undefined): number | undefined => {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Turn a URL slug ("solo-leveling") into a display title ("Solo Leveling"). */
export function titleCase(slug: string): string {
  return clean(slug.replace(/[-_]+/g, " "))
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Strip site suffixes and reader boilerplate, keeping just the work name. */
export function cleanTitle(raw: string): string {
  let t = clean(raw);
  t = t.replace(
    /\s*[|–—·\-]\s*(read|watch|manga|manhwa|webtoon|anime|online|free|english|sub|subbed|dub|episode list|chapter list|[A-Za-z0-9]+scans?|mangadex|manganato|manganelo|mangakakalot|webtoons?|kissasian|kisskh|myasiantv|aniwatch|hianime|crunchyroll|netflix|bato|mangago|naver|kakao|viki|wetv|iq|bilibili).*$/i,
    "",
  );
  t = t.replace(/[\s\-:_#]*(?:chapter|chap|ch|episode|ep|season|s|vol(?:ume)?|part)\.?\s*\d+.*$/i, "");
  t = t.replace(/\s*\(?(?:19|20)\d{2}\)?\s*$/, "");
  return clean(t) || clean(raw);
}

export function parseSeasonEpisode(text: string): { season?: number; episode?: number } | null {
  let m = text.match(/(?:season|s)\s*(\d{1,2})\D{0,10}(?:episode|ep|e)\s*(\d{1,4})/i);
  if (m) return { season: toNum(m[1]), episode: toNum(m[2]) };
  m = text.match(/\bS(\d{1,2})[\s._-]?E(\d{1,4})\b/i);
  if (m) return { season: toNum(m[1]), episode: toNum(m[2]) };
  m = text.match(/(?:episode|ep)\.?\s*[-#:]?\s*(\d{1,4})/i);
  if (m) return { episode: toNum(m[1]) };
  return null;
}

export function parseChapter(text: string): { chapter?: number } | null {
  const m = text.match(/(?:chapter|chap|ch)\.?\s*[-#:]?\s*(\d{1,5}(?:\.\d)?)/i);
  return m ? { chapter: toNum(m[1]) } : null;
}

export function parseVolume(text: string): { volume?: number } | null {
  const m = text.match(/\bvol(?:ume)?\.?\s*(\d{1,4})/i);
  return m ? { volume: toNum(m[1]) } : null;
}

/** URL-only adapters (the DOM parts live in content.js). */
export function adapterFromUrl(url: string): Marker | null {
  let host = "";
  let pathname = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    pathname = decodeURIComponent(u.pathname);
  } catch {
    return null;
  }

  const table: { id: string; test: RegExp; run: () => Marker }[] = [
    {
      id: "asura",
      test: /asura(comic|scans|toon)?\./i,
      run: () => {
        const m = pathname.match(/series\/([a-z0-9-]+)\/chapter-(\d+(?:\.\d)?)/i);
        return m ? { title: titleCase(m[1]), type: "reading", chapter: toNum(m[2]), adapter: "asura" } : { adapter: "asura", type: "reading" };
      },
    },
    {
      id: "webtoons",
      test: /webtoons\.com/i,
      run: () => {
        const ep = new URL(url).searchParams.get("episode_no");
        return { type: "reading", chapter: toNum(ep || ""), adapter: "webtoons" };
      },
    },
    {
      id: "myasiantv",
      test: /myasiantv/i,
      run: () => {
        const m = pathname.match(/([a-z0-9-]+)-episode-(\d+)/i);
        return m ? { title: titleCase(m[1]), type: "watching", episode: toNum(m[2]), adapter: "myasiantv" } : { adapter: "myasiantv", type: "watching" };
      },
    },
    {
      id: "kissasian",
      test: /kissasian|kiss-asian/i,
      run: () => {
        const m = pathname.match(/\/([^/]+)\/Episode-(\d+)/i);
        return m ? { title: titleCase(m[1]), type: "watching", episode: toNum(m[2]), adapter: "kissasian" } : { adapter: "kissasian", type: "watching" };
      },
    },
    {
      id: "voir",
      test: /voiranime|voirdrama/i,
      run: () => {
        const m = pathname.match(/-(\d+)-(?:vostfr|vf|vf-hd|episode)/i) || pathname.match(/episode-(\d+)/i);
        return { type: "watching", episode: m ? toNum(m[1]) : undefined, adapter: "voir" };
      },
    },
    {
      id: "naver",
      test: /comic\.naver\.com/i,
      run: () => ({ type: "reading", chapter: toNum(new URL(url).searchParams.get("no") || ""), adapter: "naver" }),
    },
    {
      id: "mangago",
      test: /mangago\./i,
      run: () => {
        const t = pathname.match(/\/read-manga\/([a-z0-9_-]+)/i);
        const c = pathname.match(/\/c(\d+(?:\.\d)?)\//i);
        return { type: "reading", title: t ? titleCase(t[1]) : undefined, chapter: c ? toNum(c[1]) : undefined, adapter: "mangago" };
      },
    },
    {
      id: "manganato",
      test: /manganato|manganelo|chapmanganato|natomanga/i,
      run: () => {
        const c = pathname.match(/chapter-(\d+(?:\.\d)?)/i);
        return { type: "reading", chapter: c ? toNum(c[1]) : undefined, adapter: "manganato" };
      },
    },
    {
      id: "mangakakalot",
      test: /mangakakalot/i,
      run: () => {
        const t = pathname.match(/\/manga\/([a-z0-9_-]+)/i) || pathname.match(/\/chapter\/([a-z0-9_-]+)/i);
        const c = pathname.match(/chapter[_-](\d+(?:\.\d)?)/i);
        return { type: "reading", title: t ? titleCase(t[1]) : undefined, chapter: c ? toNum(c[1]) : undefined, adapter: "mangakakalot" };
      },
    },
    {
      id: "kisskh",
      test: /kisskh/i,
      run: () => {
        const m = pathname.match(/\/([^/]+)\/Episode-(\d+)/i);
        return m
          ? { title: titleCase(m[1]), type: "watching", episode: toNum(m[2]), adapter: "kisskh" }
          : { type: "watching", adapter: "kisskh" };
      },
    },
    {
      id: "miraculous",
      test: /miraculous\.to/i,
      run: () => {
        const m = pathname.match(/season-(\d+)\/episode-(\d+)/i);
        return { title: "Miraculous", type: "watching", season: m ? toNum(m[1]) : undefined, episode: m ? toNum(m[2]) : undefined, adapter: "miraculous" };
      },
    },
    {
      id: "mangafire",
      test: /mangafire\./i,
      run: () => {
        const m = pathname.match(/chapter-(\d+(?:\.\d+)?)/i);
        return { type: "reading", chapter: m ? toNum(m[1]) : undefined, adapter: "mangafire" };
      },
    },
    {
      id: "toonily",
      test: /toonily\./i,
      run: () => {
        const t = pathname.match(/\/(?:webtoon|serie)\/([a-z0-9-]+)/i);
        const m = pathname.match(/chapter-(\d+(?:\.\d+)?)/i);
        return { type: "reading", title: t ? titleCase(t[1]) : undefined, chapter: m ? toNum(m[1]) : undefined, adapter: "toonily" };
      },
    },
    {
      id: "mangabuddy",
      test: /mangabuddy\.com|mangaclash|topmanhua/i,
      run: () => {
        const m = pathname.match(/chapter-(\d+(?:\.\d+)?)/i);
        return { type: "reading", chapter: m ? toNum(m[1]) : undefined, adapter: "mangabuddy" };
      },
    },
    {
      id: "reaperscans",
      test: /reaperscans\.com|flamecomics\.|nightscans|drakescans/i,
      run: () => {
        const m = pathname.match(/chapter[-/](\d+(?:\.\d+)?)/i);
        return { type: "reading", chapter: m ? toNum(m[1]) : undefined, adapter: "reaperscans" };
      },
    },
    {
      id: "anitaku",
      test: /anitaku\.|gogoanime|gogotaku/i,
      run: () => {
        const m = pathname.match(/([a-z0-9-]+)-episode-(\d+(?:\.\d+)?)/i);
        return m ? { title: titleCase(m[1]), type: "watching", episode: toNum(m[2]), adapter: "anitaku" } : { type: "watching", adapter: "anitaku" };
      },
    },
    {
      id: "crunchyroll",
      test: /crunchyroll\.com/i,
      run: () => {
        const m = pathname.match(/\/watch\/[a-z0-9]+\/([a-z0-9-]+)/i);
        return { type: "watching", title: m ? titleCase(m[1]) : undefined, adapter: "crunchyroll" };
      },
    },
  ];

  for (const a of table) if (a.test.test(host) || a.test.test(url)) return a.run();
  return null;
}
