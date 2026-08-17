import { describe, expect, it } from "vitest";
import { adapterFromUrl, cleanTitle, parseChapter, parseSeasonEpisode, parseVolume } from "../shared/detect";

describe("cleanTitle", () => {
  it("strips site suffixes", () => {
    expect(cleanTitle("One Piece - AsuraScans")).toBe("One Piece");
    expect(cleanTitle("Solo Leveling | WEBTOON")).toBe("Solo Leveling");
    expect(cleanTitle("The Apothecary Diaries – Watch Online")).toBe("The Apothecary Diaries");
  });
  it("drops trailing chapter/episode markers", () => {
    expect(cleanTitle("One Piece Chapter 1152")).toBe("One Piece");
    expect(cleanTitle("Breaking Bad Season 3 Episode 7")).toBe("Breaking Bad");
    expect(cleanTitle("Berserk Vol. 42")).toBe("Berserk");
  });
  it("drops a trailing year", () => {
    expect(cleanTitle("A Trap Called Desire (2026)")).toBe("A Trap Called Desire");
  });
  it("never returns empty", () => {
    expect(cleanTitle("Chapter 5")).toBeTruthy();
  });
});

describe("parseSeasonEpisode", () => {
  it("reads Season X Episode Y", () => {
    expect(parseSeasonEpisode("Breaking Bad Season 3 Episode 7")).toEqual({ season: 3, episode: 7 });
  });
  it("reads SxxEyy", () => {
    expect(parseSeasonEpisode("Show S02E10 1080p")).toEqual({ season: 2, episode: 10 });
  });
  it("reads a bare episode", () => {
    expect(parseSeasonEpisode("The Apothecary Diaries Episode 18")).toEqual({ episode: 18 });
  });
  it("returns null when nothing matches", () => {
    expect(parseSeasonEpisode("just a title")).toBeNull();
  });
});

describe("parseChapter / parseVolume", () => {
  it("reads chapter forms", () => {
    expect(parseChapter("One Piece Chapter 1152")).toEqual({ chapter: 1152 });
    expect(parseChapter("Ch. 88")).toEqual({ chapter: 88 });
    expect(parseChapter("chapter-1153")).toEqual({ chapter: 1153 });
  });
  it("reads volume", () => {
    expect(parseVolume("Berserk Vol. 42")).toEqual({ volume: 42 });
  });
});

describe("adapterFromUrl", () => {
  it("extracts AsuraScans chapter from the path", () => {
    const r = adapterFromUrl("https://asuracomic.net/series/solo-leveling/chapter-179");
    expect(r).toMatchObject({ adapter: "asura", type: "reading", chapter: 179 });
    expect(r?.title).toBe("Solo Leveling");
  });
  it("extracts a WEBTOON episode number", () => {
    const r = adapterFromUrl("https://www.webtoons.com/en/action/title/ep/viewer?title_no=95&episode_no=204");
    expect(r).toMatchObject({ adapter: "webtoons", type: "reading", chapter: 204 });
  });
  it("extracts MyAsianTV episode + title from slug", () => {
    const r = adapterFromUrl("https://ww19.myasiantv.es/ep/a-trap-called-desire-2026-episode-1-english-subbed/");
    expect(r).toMatchObject({ adapter: "myasiantv", type: "watching", episode: 1 });
    expect(r?.title?.toLowerCase()).toContain("a trap called desire");
  });
  it("extracts KissAsian episode", () => {
    const r = adapterFromUrl("https://kissasian.cam/Drama/Goodbye-My-Princess/Episode-12");
    expect(r).toMatchObject({ adapter: "kissasian", type: "watching", episode: 12 });
  });
  it("extracts a Voiranime episode", () => {
    const r = adapterFromUrl("https://voiranime.rip/anime/one-piece/one-piece-1122-vostfr/");
    expect(r).toMatchObject({ adapter: "voir", type: "watching", episode: 1122 });
  });
  it("extracts a Naver episode from the query", () => {
    const r = adapterFromUrl("https://m.comic.naver.com/webtoon/detail?titleId=812645&no=42");
    expect(r).toMatchObject({ adapter: "naver", type: "reading", chapter: 42 });
  });
  it("returns null for an unknown site", () => {
    expect(adapterFromUrl("https://example.com/some/page")).toBeNull();
  });
});
