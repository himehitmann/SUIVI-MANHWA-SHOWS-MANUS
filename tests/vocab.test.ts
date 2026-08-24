import { describe, expect, it } from "vitest";
import { CATEGORIES, LEARN_LANGS, WORDS, levelInfo, nextStreak, wordsFor } from "../client/src/lib/vocab";

describe("vocab dataset integrity", () => {
  it("has unique ids and required fields", () => {
    const ids = new Set<string>();
    for (const w of WORDS) {
      expect(w.id, `duplicate id ${w.id}`).not.toBe(undefined);
      expect(ids.has(w.id), `duplicate id ${w.id}`).toBe(false);
      ids.add(w.id);
      expect(w.script).toBeTruthy();
      expect(w.reading).toBeTruthy();
      expect(w.en).toBeTruthy();
      expect(w.fr).toBeTruthy();
      expect(w.emoji).toBeTruthy();
    }
  });
  it("covers every language and category", () => {
    for (const lang of LEARN_LANGS) {
      for (const cat of CATEGORIES) {
        expect(wordsFor(lang.code, cat.id).length, `${lang.code}/${cat.id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("level curve", () => {
  it("starts at level 1 with 0 xp", () => {
    expect(levelInfo(0).level).toBe(1);
  });
  it("levels up after enough xp and is monotonic", () => {
    expect(levelInfo(60).level).toBe(2); // first level costs 60
    let prev = 0;
    for (let xp = 0; xp <= 1000; xp += 37) {
      const l = levelInfo(xp).level;
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
  it("reports progress within the level", () => {
    const info = levelInfo(30);
    expect(info.level).toBe(1);
    expect(info.into).toBe(30);
    expect(info.pct).toBe(50);
  });
});

describe("streak", () => {
  it("increments on consecutive days", () => {
    expect(nextStreak(3, "2026-01-01", "2026-01-02")).toBe(4);
  });
  it("keeps the same on the same day", () => {
    expect(nextStreak(3, "2026-01-02", "2026-01-02")).toBe(3);
  });
  it("resets after a gap", () => {
    expect(nextStreak(9, "2026-01-01", "2026-01-05")).toBe(1);
  });
});
