/*
 * Yomu universal import parser (vanilla, no build step). Turns whatever a user
 * drops in — a Yomu backup, a Trakt/TV Time/IMDb/Letterboxd export, one or many
 * JSON/CSV/XML files, or a ZIP of any of those — into a flat list of works Yomu
 * can merge into the library. Best-effort and forgiving: unknown shapes are
 * skipped, never fatal, so a single odd file can't make the whole import fail.
 *
 * Exposes: window.YomuImport.parseFiles(FileList|File[]) -> Promise<{
 *   items: Array<payload>, sites?, lists?, settings?, count, formats: string[]
 * }>. `fflate` (global) is used for ZIP; if it's missing, ZIPs are skipped with
 * a clear reason.
 */
(function () {
  const dec = new TextDecoder();

  // ---- helpers ------------------------------------------------------------
  const firstString = (obj, keys) => {
    for (const k of keys) {
      const v = k.split(".").reduce((o, part) => (o == null ? o : o[part]), obj);
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const asType = (raw) => {
    const s = String(raw || "").toLowerCase();
    if (/manhwa|manhua|manga|webtoon|comic|book|novel|light.?novel|bd/.test(s)) return "reading";
    if (/game|jeu/.test(s)) return "game";
    if (/movie|film/.test(s)) return "watching";
    if (/show|serie|série|tv|episode|épisode|anime|drama|season/.test(s)) return "watching";
    return "";
  };

  // Build a Yomu import payload from a loosely-shaped media record.
  function toPayload(rec, hintType) {
    if (!rec || typeof rec !== "object") return null;
    // Trakt-style nesting: { show:{...} } / { movie:{...} } / { episode:{...} }
    const inner = rec.show || rec.movie || rec.series || rec.content || rec.media || null;
    const src = inner && typeof inner === "object" ? { ...inner, ...rec } : rec;

    const title = firstString(src, [
      "title", "name", "series_title", "seriesTitle", "show.title", "movie.title",
      "original_title", "Title", "Name", "titre", "Série", "Serie",
    ]);
    if (!title || title.length < 2) return null;

    let type = hintType || asType(rec.type || src.type || src.media_type || src.Title_Type || src["Title Type"] || (rec.movie ? "movie" : rec.show ? "show" : ""));
    if (!type) type = "watching";

    const yearRaw = firstString(src, ["year", "Year", "release_year", "first_air_date", "startDate"]);
    const year = yearRaw ? parseInt(yearRaw, 10) || undefined : undefined;

    const ratingRaw = src.rating ?? src.Rating ?? src["Your Rating"] ?? src.score ?? src.user_rating;
    let rating = Number(ratingRaw);
    if (!isFinite(rating) || rating <= 0) rating = 0;
    if (rating > 5) rating = Math.round(rating / 2); // 10-scale -> 5 stars
    rating = Math.max(0, Math.min(5, Math.round(rating)));

    const url = firstString(src, ["url", "URL", "link", "Const"]) || undefined;

    // Progress: Trakt watched shows carry seasons[].episodes[]; MAL carries
    // num_watched_episodes / my_watched_episodes; generic carries episode/chapter.
    let episode, season, chapter;
    if (Array.isArray(rec.seasons)) {
      for (const s of rec.seasons) {
        const sn = Number(s.number) || 0;
        const eps = Array.isArray(s.episodes) ? s.episodes : [];
        const maxEp = eps.reduce((m, e) => Math.max(m, Number(e.number) || 0), 0);
        if (sn >= (season || 0)) { season = sn; episode = Math.max(episode || 0, maxEp); }
      }
    }
    const num = (v) => { const n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : undefined; };
    episode = episode || num(src.episode) || num(src.episodes_watched) || num(src.num_watched_episodes) || num(src.my_watched_episodes) || num(src.watched_episodes);
    chapter = num(src.chapter) || num(src.chapters_read) || num(src.num_read_chapters) || num(src.my_read_chapters);
    season = season || num(src.season);
    if (type === "reading" && !chapter && episode) { chapter = episode; episode = undefined; }

    const cover = firstString(src, ["cover", "image", "poster", "thumb", "Image"]) || undefined;
    const status = /plan|watchlist|want|planned/i.test(String(rec.list_type || rec.status || src.status || "")) ? "planned" : undefined;

    return {
      title, type, year, url, cover,
      episode: type === "watching" ? episode : undefined,
      chapter: type === "reading" ? chapter : undefined,
      season: type === "watching" ? season : undefined,
      rating: rating || undefined,
      status,
      imported: true,
    };
  }

  // ---- JSON ---------------------------------------------------------------
  function looksLikeYomuBackup(obj) {
    return obj && Array.isArray(obj.items) && obj.items.some((i) => i && i.title && (i.type || i.id));
  }
  // Walk any JSON and collect arrays of media-ish objects.
  function collectFromJson(data, out, hintType) {
    if (Array.isArray(data)) {
      let any = false;
      for (const el of data) { const p = toPayload(el, hintType); if (p) { out.push(p); any = true; } }
      if (!any) for (const el of data) if (el && typeof el === "object") collectFromJson(el, out, hintType);
      return;
    }
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        const hint = /movie|film/i.test(k) ? "watching" : /manga|manhwa|comic|book|read/i.test(k) ? "reading" : hintType;
        if (Array.isArray(v)) collectFromJson(v, out, hint);
        else if (v && typeof v === "object") collectFromJson(v, out, hint);
      }
    }
  }

  // ---- CSV ----------------------------------------------------------------
  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some((x) => x !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); if (row.some((x) => x !== "")) rows.push(row); }
    return rows;
  }
  function collectFromCsv(text, out) {
    const rows = parseCsv(text);
    if (rows.length < 2) return;
    const header = rows[0].map((h) => h.trim());
    for (let r = 1; r < rows.length; r++) {
      const rec = {};
      header.forEach((h, i) => (rec[h] = rows[r][i]));
      const p = toPayload(rec);
      if (p) out.push(p);
    }
  }

  // ---- MAL XML ------------------------------------------------------------
  function collectFromXml(text, out) {
    try {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      const isManga = !!doc.querySelector("manga");
      doc.querySelectorAll("anime, manga").forEach((node) => {
        const g = (t) => (node.querySelector(t)?.textContent || "").trim();
        const title = g("series_title") || g("manga_title") || g("title");
        if (!title) return;
        out.push({
          title,
          type: isManga ? "reading" : "watching",
          episode: isManga ? undefined : parseInt(g("my_watched_episodes"), 10) || undefined,
          chapter: isManga ? parseInt(g("my_read_chapters"), 10) || undefined : undefined,
          rating: (() => { const s = Math.round((parseInt(g("my_score"), 10) || 0) / 2); return s > 0 ? s : undefined; })(),
          imported: true,
        });
      });
    } catch { /* not xml */ }
  }

  // ---- one file -----------------------------------------------------------
  function parseOne(name, text, acc) {
    const t = text.replace(/^﻿/, "").trim();
    // JSON?
    if (t[0] === "{" || t[0] === "[") {
      try {
        const data = JSON.parse(t);
        if (looksLikeYomuBackup(data)) {
          acc.formats.add("Yomu");
          data.items.forEach((i) => acc.items.push(i));
          if (Array.isArray(data.sites)) acc.sites = data.sites;
          if (Array.isArray(data.lists)) acc.lists = data.lists;
          if (data.settings) acc.settings = data.settings;
          return;
        }
        const before = acc.items.length;
        collectFromJson(data, acc.items);
        if (acc.items.length > before) acc.formats.add(/\.json$/i.test(name) ? "JSON" : "data");
        return;
      } catch { /* fall through */ }
    }
    // XML (MAL)?
    if (/^<\?xml|<myanimelist|<anime>|<manga>/i.test(t)) {
      const before = acc.items.length;
      collectFromXml(t, acc.items);
      if (acc.items.length > before) acc.formats.add("MyAnimeList");
      return;
    }
    // CSV?
    if (/[,;].*[\r\n]/.test(t) || /\.csv$/i.test(name)) {
      const before = acc.items.length;
      collectFromCsv(t, acc.items);
      if (acc.items.length > before) acc.formats.add(/imdb/i.test(name) ? "IMDb" : /letterb/i.test(name) ? "Letterboxd" : /tv.?time/i.test(name) ? "TV Time" : "CSV");
    }
  }

  // ---- entry point --------------------------------------------------------
  async function parseFiles(fileList) {
    const files = Array.from(fileList || []);
    const acc = { items: [], sites: undefined, lists: undefined, settings: undefined, formats: new Set(), warnings: [] };
    for (const f of files) {
      try {
        if (/\.zip$/i.test(f.name)) {
          if (typeof fflate === "undefined" || !fflate.unzipSync) { acc.warnings.push("ZIP support unavailable"); continue; }
          const buf = new Uint8Array(await f.arrayBuffer());
          const entries = fflate.unzipSync(buf);
          Object.keys(entries).forEach((entryName) => {
            if (/\/$/.test(entryName)) return;
            if (!/\.(json|csv|xml|txt|tsv)$/i.test(entryName)) return;
            try { parseOne(entryName, dec.decode(entries[entryName]), acc); } catch { /* skip entry */ }
          });
        } else {
          parseOne(f.name, await f.text(), acc);
        }
      } catch (e) { acc.warnings.push(`Could not read ${f.name}`); }
    }
    // Dedup by normalized title + type, keeping the furthest progress / a rating.
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const byKey = new Map();
    for (const it of acc.items) {
      if (!it || !it.title) continue;
      const key = norm(it.title) + "|" + (it.type || "watching");
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, it); continue; }
      byKey.set(key, {
        ...prev, ...it,
        episode: Math.max(prev.episode || 0, it.episode || 0) || undefined,
        chapter: Math.max(prev.chapter || 0, it.chapter || 0) || undefined,
        rating: it.rating || prev.rating,
        cover: prev.cover || it.cover,
      });
    }
    return {
      items: [...byKey.values()],
      sites: acc.sites, lists: acc.lists, settings: acc.settings,
      count: byKey.size, formats: [...acc.formats], warnings: acc.warnings,
    };
  }

  window.YomuImport = { parseFiles };
})();
