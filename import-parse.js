/*
 * Yomu universal import parser (vanilla, no build step). Turns whatever a user
 * drops in — a Yomu backup, a Trakt/TV Time/IMDb/Letterboxd export, one or many
 * JSON/CSV/XML files, or a ZIP of any of those — into a flat list of works Yomu
 * can merge into the library. Unknown formats are skipped. Unreadable files
 * or malformed native backups block the selection before any data is saved.
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
  function chapterNumber(raw) {
    const token = String(raw ?? "").trim().match(/^[+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)/)?.[0];
    const value = typeof raw === "number" ? raw : Number(token?.replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const asType = (raw) => {
    const s = String(raw || "").toLowerCase();
    if (s === "reading" || /manhwa|manhua|manga|webtoon|comic|book|novel|light.?novel|bd/.test(s)) return "reading";
    if (/game|jeu/.test(s)) return "game";
    if (/movie|film|show|serie|série|tv|episode|épisode|anime|drama|season/.test(s)) return "watching";
    return "";
  };
  // Preserve the real media kind from exports. "watching" is only the tracking
  // mode; format is what makes Yomu say Anime, Series, Film, K-Drama, etc.
  const inferFormat = (raw, type) => {
    const s = String(raw || "").toLowerCase();
    if (type === "game" || /game|jeu/.test(s)) return "GAME";
    if (/webtoon/.test(s)) return "WEBTOON";
    if (/manhwa/.test(s)) return "MANHWA";
    if (/manhua/.test(s)) return "MANHUA";
    if (/manga/.test(s)) return "MANGA";
    if (/light.?novel/.test(s)) return "LIGHT_NOVEL";
    if (/novel/.test(s)) return "NOVEL";
    if (/book|livre/.test(s)) return "BOOK";
    if (/k.?drama|korean drama|corée/.test(s)) return "KDRAMA";
    if (/c.?drama|chinese drama/.test(s)) return "CDRAMA";
    if (/j.?drama|japanese drama/.test(s)) return "JDRAMA";
    if (/anime|animation|ona|ova/.test(s)) return "ANIME";
    if (/movie|film/.test(s)) return "MOVIE";
    if (/show|serie|série|tv|drama/.test(s)) return "SERIES";
    return "";
  };

  const importStatus = raw => {
    const value = String(raw || "").trim().toLowerCase().replace(/[ _-]+/g, " ");
    if (["completed","complete","finished","terminé","terminée"].includes(value)) return "completed";
    if (["on hold","paused","pause","en pause"].includes(value)) return "on_hold";
    if (["dropped","abandoned","abandonné","abandonnée"].includes(value)) return "dropped";
    if (["planned","plan to watch","plan to read","watchlist","want to watch","want to read"].includes(value)) return "planned";
    if (["watching","reading","current","in progress","en cours"].includes(value)) return "current";
    return undefined;
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
    if (!title) return null;

    let type = hintType || asType(rec.type || src.type || src.media_type || src.Title_Type || src["Title Type"] || (rec.movie ? "movie" : rec.show ? "show" : ""));
    if (!type) type = "watching";
    const format = inferFormat(src.format || src.Format || src.kind || src.media_type || src.type || rec.type || src.Title_Type || src["Title Type"] || (rec.movie ? "movie" : rec.show || rec.series ? "series" : ""), type);

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
        if (sn > (season ?? -1)) { season = sn; episode = maxEp; }
        else if(sn === season) episode = Math.max(episode || 0,maxEp);
      }
    }
    const num = (v) => { const n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : undefined; };
    const position = type === "reading" ? chapterNumber : num;
    episode = episode || position(src.episode) || position(src.episode_number) || position(src.episodeNumber) || position(src.episodes_watched) || position(src.num_watched_episodes) || position(src.my_watched_episodes) || position(src.watched_episodes) || position(src.watchedEpisodes) || position(src.num_episodes_watched);
    chapter = chapterNumber(src.chapter) || chapterNumber(src.chapter_number) || chapterNumber(src.chapters_read) || chapterNumber(src.num_read_chapters) || chapterNumber(src.my_read_chapters);
    season = season || num(src.season);
    if (type === "reading" && !chapter && episode) { chapter = episode; episode = undefined; }

    const cover = firstString(src, ["cover", "image", "poster", "thumb", "Image"]) || undefined;
    const total = num(src.total) || (type === "reading" ? num(src.chapters) || num(src.total_chapters) || num(src.num_chapters) : num(src.episodes) || num(src.total_episodes) || num(src.totalEpisodes) || num(src.num_episodes));
    const status = importStatus(src.my_status || rec.status || src.status || rec.list_type);

    return {
      title, type, format: format || undefined, year, url, cover, total,
      externalIds: src.externalIds && typeof src.externalIds === "object" ? src.externalIds : src.ids && typeof src.ids === "object" ? src.ids : undefined,
      alternativeTitles: [...new Set([...(Array.isArray(src.alternativeTitles)?src.alternativeTitles:[]),...(Array.isArray(src.synonyms)?src.synonyms:[]),src.title_english,src.title_romaji,src.title_native].filter(x=>typeof x==="string"&&x.trim()))],
      authors: (Array.isArray(src.authors)?src.authors:[src.author]).map(x=>typeof x==="string"?x:x?.name).filter(x=>typeof x==="string"&&x.trim()),
      synopsis: firstString(src,["synopsis","description","summary"]) || undefined,
      episode: type === "watching" ? episode : undefined,
      chapter: type === "reading" ? chapter : undefined,
      season: type === "watching" ? season : undefined,
      rating: rating || undefined,
      status,
      imported: true,
    };
  }

  // Check the complete candidate before any collection is saved.
  function validatePayload(payload) {
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    const fail = () => { throw Error("invalid_import_data"); };
    const strings = value => Array.isArray(value) && value.every(x => typeof x === "string");
    const fields = (row, names, check) => {
      for (const key of names) if (row[key] != null && !check(row[key])) fail();
    };
    if (!object(payload)) fail();
    for (const kind of ["items","lists","sites","notifications"]) {
      if (payload[kind] === undefined) continue;
      if (!Array.isArray(payload[kind])) fail();
      for (const row of payload[kind]) {
        if (!object(row)) fail();
        fields(row,["id","title"],value => typeof value === "string" && !!value.trim());
        if (kind === "items") {
          if (typeof row.title !== "string" || !row.title.trim()) fail();
          fields(row,["type"],value => ["reading","watching","game"].includes(value));
          fields(row,["tags","sources","alternativeTitles","authors"],strings);
          fields(row,["externalIds"],object);
          fields(row,["url","cover","notes","synopsis","episodeTitle","status","format"],value => typeof value === "string");
          fields(row,["chapter","page","totalPages","volume","season","episode","position","duration","total","progress","rating"],Number.isFinite);
          fields(row,["favorite"],value => typeof value === "boolean");
        } else {
          if (typeof row.id !== "string" || !row.id.trim()) fail();
          if (kind === "lists") {
            fields(row,["itemIds"],strings);
            fields(row,["name","cover"],value => typeof value === "string");
          }
          if (kind === "sites") fields(row,["name","url","domain","icon"],value => typeof value === "string");
          if (kind === "notifications") {
            fields(row,["message","itemId","url"],value => typeof value === "string");
            fields(row,["read"],value => typeof value === "boolean");
            fields(row,["ts"],Number.isFinite);
          }
        }
      }
    }
    if (payload.settings !== undefined) {
      if (!object(payload.settings)) fail();
      fields(payload.settings,["lang","translateLang","librarySort"],value => typeof value === "string");
      fields(payload.settings,["notifyNew","autoTrack"],value => typeof value === "boolean");
      fields(payload.settings,["homeCats"],strings);
      if (payload.settings.profile != null) {
        if (!object(payload.settings.profile)) fail();
        fields(payload.settings.profile,["name","bio","avatar","banner"],value => typeof value === "string");
        fields(payload.settings.profile,["updatedAt"],Number.isFinite);
      }
    }
  }

  // ---- JSON ---------------------------------------------------------------
  function looksLikeYomuBackup(obj) {
    return obj && typeof obj === "object" && (
      obj.version === 1 || obj.version === 2 ||
      (Array.isArray(obj.items) && obj.items.some((i) => i && i.title && (["reading","watching","game"].includes(i.type) || (typeof i.id === "string" && !i.type))))
    );
  }
  // IDs belong to their source backup. Keep conflicting records and references separate.
  function compatibleImportId(a, b) {
    const title = value => String(value || "").normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
    if ((a.type || "watching") !== (b.type || "watching") || title(a.title) !== title(b.title)) return false;
    if (a.year && b.year && String(a.year) !== String(b.year)) return false;
    if (a.format && b.format && a.format !== b.format) return false;
    return !Object.keys(a.externalIds || {}).some(key => b.externalIds?.[key] != null && String(a.externalIds[key]) !== String(b.externalIds[key]));
  }
  function separateBackupIds(data, acc) {
    const previous = new Map();
    for (const item of acc.items) if (item.id) {
      const rows = previous.get(item.id) || []; rows.push(item); previous.set(item.id, rows);
    }
    const incoming = new Map(), remap = new Map();
    const used = new Set([...previous.keys(), ...data.items.map(item => item.id).filter(Boolean)]);
    for (const item of data.items) if (item.id) {
      const duplicate = incoming.get(item.id);
      // A list cannot distinguish conflicting members that already share an ID inside one file.
      if (duplicate && !compatibleImportId(duplicate, item)) throw Error("ambiguous_backup_ids");
      incoming.set(item.id, item);
    }
    for (const [id, item] of incoming) {
      if (!(previous.get(id) || []).some(row => !compatibleImportId(row, item))) continue;
      let counter = 2, next;
      do { next = id + "-import-" + counter++; } while (used.has(next));
      used.add(next); remap.set(id, next);
    }
    const mapped = id => remap.get(id) || id;
    return {...data,
      items: data.items.map(item => remap.has(item.id) ? {...item, id: mapped(item.id)} : item),
      lists: data.lists?.map(list => ({...list, itemIds: list.itemIds?.map(mapped)})),
      notifications: data.notifications?.map(notification => ({...notification, itemId: mapped(notification.itemId)})),
    };
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
    const delimiter = text.split(/[\r\n]/,1)[0].includes("\t") ? "\t" : text.split(/[\r\n]/,1)[0].split(";").length > text.split(/[\r\n]/,1)[0].split(",").length ? ";" : ",";
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === delimiter) { row.push(field); field = ""; }
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
      
      doc.querySelectorAll("anime, manga").forEach((node) => {
        const isManga = node.tagName.toLowerCase() === "manga";
        const g = (t) => (node.querySelector(t)?.textContent || "").trim();
        const title = g("series_title") || g("manga_title") || g("title");
        if (!title) return;
        out.push({
          title,
          type: isManga ? "reading" : "watching",
          format: isManga ? "MANGA" : "ANIME",
          total: parseInt(g(isManga ? "series_chapters" : "series_episodes"), 10) || undefined,
          status: importStatus(g("my_status")),
          externalIds: { mal: g(isManga ? "series_mangadb_id" : "series_animedb_id") || undefined },
          episode: isManga ? undefined : parseInt(g("my_watched_episodes"), 10) || undefined,
          chapter: isManga ? chapterNumber(g("my_read_chapters")) : undefined,
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
      {
        let data = JSON.parse(t);
        if (looksLikeYomuBackup(data)) {
          if (data.version !== undefined && ![1,2].includes(data.version)) throw Error("unsupported_backup_version");
          if (!Array.isArray(data.items)) throw Error("invalid_import_data");
          validatePayload(data);
          data = separateBackupIds(data, acc);
          acc.formats.add("Yomu");
          data.items.forEach((i) => acc.items.push(i));
          if (Array.isArray(data.sites)) acc.sites = (acc.sites || []).concat(data.sites);
          if (Array.isArray(data.lists)) acc.lists = (acc.lists || []).concat(data.lists);
          if (Array.isArray(data.notifications)) acc.notifications = (acc.notifications || []).concat(data.notifications);
          if (data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) {
            const previous = acc.settings || {};
            acc.settings = {...previous, ...data.settings};
            if (previous.profile || data.settings.profile) acc.settings.profile = {...previous.profile, ...data.settings.profile};
          }
          return;
        }
        const before = acc.items.length;
        collectFromJson(data, acc.items);
        if (acc.items.length > before) acc.formats.add(/\.json$/i.test(name) ? "JSON" : "data");
        return;
      }
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
  async function parseFiles(fileList, {keepRecords = false} = {}) {
    const files = Array.from(fileList || []);
    const acc = { items: [], sites: undefined, lists: undefined, settings: undefined, formats: new Set(), warnings: [] };
    for (const f of files) {
      try {
        if(f.size > 25*1024*1024) throw new Error("File exceeds 25 MB");
        if (/\.zip$/i.test(f.name)) {
          if (typeof fflate === "undefined" || !fflate.unzipSync) { acc.warnings.push("ZIP support unavailable"); continue; }
          const buf = new Uint8Array(await f.arrayBuffer());
          let size=0, count=0;
          const entries = fflate.unzipSync(buf,{filter(entry) {
            if(++count>1000) throw new Error("Archive has more than 1000 entries");
            if(!/\.(json|csv|xml|txt|tsv)$/i.test(entry.name)) return false;
            size+=entry.originalSize;
            if(entry.originalSize>25*1024*1024 || size>50*1024*1024) throw new Error("Archive expands beyond the 50 MB import limit");
            return true;
          }});
          Object.keys(entries).forEach((entryName) => {
            if (/\/$/.test(entryName)) return;
            if (!/\.(json|csv|xml|txt|tsv)$/i.test(entryName)) return;
            try { parseOne(entryName, dec.decode(entries[entryName]), acc); } catch { acc.warnings.push(`Could not parse ${entryName}`); }
          });
        } else {
          parseOne(f.name, await f.text(), acc);
        }
      } catch (e) { acc.warnings.push(`Could not read ${f.name}: ${e.message || "invalid file"}`); }
    }
    // A failed file must never turn a multi-file restore into a partial success.
    if (acc.warnings.length) return {items:[],count:0,formats:[...acc.formats],warnings:acc.warnings};
    // The web library merges rows against its saved positions and personal fields.
    if (keepRecords) {
      const items = acc.items.filter(item => item && item.title);
      return {...acc, items, count: items.length, formats: [...acc.formats]};
    }
    // Dedup by normalized title + type, keeping the furthest progress / a rating.
    const norm = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const byKey = new Map();
    for (const it of acc.items) {
      if (!it || !it.title) continue;
      const key = (it.id ? "id:" + it.id : norm(it.title) + "|" + (it.year || "")) + "|" + (it.type || "watching");
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, it); continue; }
      const {fields}=YomuImportedPosition(prev,it);
      const union=(a,b)=>[...new Set([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])])];
      const saved=Object.fromEntries(Object.entries(prev).filter(([,value])=>value!==undefined&&value!==""));
      byKey.set(key, {
        ...it,...saved,...fields,
        favorite:prev.favorite||it.favorite||false,
        externalIds:{...it.externalIds,...prev.externalIds},
        tags:union(prev.tags,it.tags),
        sources:union(prev.sources,it.sources),
      });
    }
    return {
      items: [...byKey.values()],
      sites: acc.sites, lists: acc.lists, notifications: acc.notifications, settings: acc.settings,
      count: byKey.size, formats: [...acc.formats], warnings: acc.warnings,
    };
  }

  (typeof window === "undefined" ? globalThis : window).YomuImport = { parseFiles, validatePayload };
})();
