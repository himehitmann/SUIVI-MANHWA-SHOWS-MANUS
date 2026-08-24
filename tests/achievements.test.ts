import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_GOAL,
  dailyProgress,
  hasMasteredCategory,
  knownCount,
  langsStudied,
  unlockedAchievements,
} from "../client/src/lib/achievements";
import { wordsFor } from "../client/src/lib/vocab";

const known = (ids: string[]): Record<string, 1 | 2> => Object.fromEntries(ids.map((id) => [id, 2 as const]));

describe("knownCount / langsStudied", () => {
  it("counts only mastery 2 and reads langs from id prefixes", () => {
    const mastery: Record<string, 1 | 2> = { "ko-basics-a": 2, "ja-food-b": 1, "zh-numbers-c": 2 };
    expect(knownCount(mastery)).toBe(2);
    expect(langsStudied(mastery).sort()).toEqual(["ja", "ko", "zh"]);
  });
});

describe("hasMasteredCategory", () => {
  it("is true only when every word of a category is known", () => {
    const cat = wordsFor("ko", "numbers");
    expect(hasMasteredCategory(known(cat.slice(0, -1).map((w) => w.id)))).toBe(false);
    expect(hasMasteredCategory(known(cat.map((w) => w.id)))).toBe(true);
  });
});

describe("unlockedAchievements", () => {
  it("unlocks by thresholds and is sticky-friendly", () => {
    const base = { xp: 0, streak: 0, perfectQuizzes: 0, mastery: {} as Record<string, 1 | 2> };
    expect(unlockedAchievements(base)).toEqual([]);

    const withOne = unlockedAchievements({ ...base, mastery: { "ko-basics-a": 1 } });
    expect(withOne).toContain("first_word");

    const streaky = unlockedAchievements({ ...base, streak: 7, mastery: { "ko-basics-a": 1 } });
    expect(streaky).toContain("streak_7");

    const ace = unlockedAchievements({ ...base, perfectQuizzes: 1 });
    expect(ace).toContain("quiz_ace");
  });

  it("awards polyglot for three languages", () => {
    const mastery: Record<string, 1 | 2> = { "ko-basics-a": 1, "ja-basics-b": 1, "zh-basics-c": 1 };
    expect(unlockedAchievements({ xp: 0, streak: 0, perfectQuizzes: 0, mastery })).toContain("polyglot");
  });
});

describe("dailyProgress", () => {
  it("reports progress toward the goal and whether it is met", () => {
    const p = dailyProgress({ "2026-01-01": 5 }, "2026-01-01", DEFAULT_DAILY_GOAL);
    expect(p.done).toBe(5);
    expect(p.met).toBe(false);
    const met = dailyProgress({ "2026-01-01": 25 }, "2026-01-01", DEFAULT_DAILY_GOAL);
    expect(met.met).toBe(true);
    expect(met.pct).toBe(100);
  });
});
