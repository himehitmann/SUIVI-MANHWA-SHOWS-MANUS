import { describe, expect, it } from "vitest";
import { createItem, workId } from "../client/src/lib/item";
import { parseCsv, parseImport, parseMalXml } from "../client/src/lib/importers";

describe("createItem / workId", () => {
  it("builds a canonical item with defaults", () => {
    const it0 = createItem({ title: "One Piece", type: "reading", chapter: 1152 });
    expect(it0.id).toBe("one-piece");
    expect(it0.type).toBe("reading");
    expect(it0.chapter).toBe(1152);
    expect(it0.accent).toMatch(/^#/);
    expect(it0.progress).toBe(0);
  });
  it("marks completed items at 100%", () => {
    expect(createItem({ title: "X", status: "completed" }).progress).toBe(100);
  });
  it("normalizes work ids so mirrors merge", () => {
    expect(workId("One Piece - Chapter 5")).toBe(workId("one piece"));
  });
});

describe("MyAnimeList XML import", () => {
  const xml = `<?xml version="1.0"?><myanimelist>
    <anime><series_title><![CDATA[Cowboy Bebop]]></series_title><my_watched_episodes>26</my_watched_episodes><my_status>Completed</my_status><my_score>9</my_score></anime>
    <anime><series_title><![CDATA[Frieren]]></series_title><my_watched_episodes>12</my_watched_episodes><my_status>Watching</my_status></anime>
    <manga><manga_title><![CDATA[Berserk]]></manga_title><my_read_chapters>374</my_read_chapters><my_read_volumes>41</my_read_volumes><my_status>Reading</my_status></manga>
  </myanimelist>`;
  it("parses anime and manga entries", () => {
    const items = parseMalXml(xml);
    expect(items).toHaveLength(3);
    const bebop = items.find((i) => i.title === "Cowboy Bebop")!;
    expect(bebop.type).toBe("watching");
    expect(bebop.episode).toBe(26);
    expect(bebop.status).toBe("completed");
    expect(bebop.progress).toBe(100);
    const berserk = items.find((i) => i.title === "Berserk")!;
    expect(berserk.type).toBe("reading");
    expect(berserk.chapter).toBe(374);
    expect(berserk.volume).toBe(41);
  });
  it("is picked up by the auto-detecting dispatcher", () => {
    expect(parseImport(xml).format).toBe("mal");
    expect(parseImport(xml).items.length).toBe(3);
  });
});

describe("CSV import", () => {
  const csv = `title,type,episode,status,url
"Breaking Bad",TV,7,Watching,https://netflix.com/x
"Solo Leveling",manga,110,Reading,https://asuracomic.net/s`;
  it("maps columns and infers type", () => {
    const items = parseCsv(csv);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Breaking Bad", type: "watching", episode: 7 });
    expect(items[0].domain).toBe("netflix.com");
    expect(items[1]).toMatchObject({ title: "Solo Leveling", type: "reading" });
  });
  it("is auto-detected", () => {
    expect(parseImport(csv).format).toBe("csv");
  });
});

describe("JSON imports", () => {
  it("detects a Dasi backup and keeps items", () => {
    const dasi = JSON.stringify({ version: 1, items: [{ id: "a", title: "A", type: "reading", progress: 30, accent: "#fff", status: "in_progress", url: "", domain: "", sources: [], createdAt: 1, updatedAt: 1, favorite: false }] });
    const r = parseImport(dasi);
    expect(r.format).toBe("dasi");
    expect(r.items[0].title).toBe("A");
  });
  it("normalizes a generic JSON array", () => {
    const r = parseImport(JSON.stringify([{ title: "Naruto", type: "watching", episode: 220 }]));
    expect(r.format).toBe("json");
    expect(r.items[0]).toMatchObject({ title: "Naruto", type: "watching", episode: 220 });
  });
  it("returns unknown for junk", () => {
    expect(parseImport("just some text").format).toBe("unknown");
  });
});
