import { describe, expect, it } from "vitest";
import {
  activeDays, calendarCells, categoryMastery, dueForecast, lastNDays, learnTotals, studyHistory, totalStudied,
} from "../client/src/lib/stats";
import { wordsFor } from "../client/src/lib/vocab";

describe("lastNDays / studyHistory", () => {
  it("returns n ascending dates ending today", () => {
    const days = lastNDays("2026-01-10", 3);
    expect(days).toEqual(["2026-01-08", "2026-01-09", "2026-01-10"]);
  });
  it("maps daily tallies with zero fill", () => {
    const h = studyHistory({ "2026-01-10": 5, "2026-01-08": 2 }, "2026-01-10", 3);
    expect(h.map((d) => d.count)).toEqual([2, 0, 5]);
  });
});

describe("dueForecast", () => {
  it("buckets cards by due date and rolls overdue into today", () => {
    const srs = {
      a: { due: "2026-01-01" }, // overdue -> today
      b: { due: "2026-01-05" }, // today
      c: { due: "2026-01-06" }, // tomorrow
      d: { due: "2026-01-30" }, // outside window -> ignored
    };
    const f = dueForecast(srs, "2026-01-05", 3);
    expect(f).toEqual([
      { date: "2026-01-05", count: 2 },
      { date: "2026-01-06", count: 1 },
      { date: "2026-01-07", count: 0 },
    ]);
  });
});

describe("categoryMastery / learnTotals", () => {
  it("counts known and learning per category", () => {
    const basics = wordsFor("ko", "basics");
    const mastery: Record<string, 1 | 2> = { [basics[0].id]: 2, [basics[1].id]: 1 };
    const cats = categoryMastery(mastery, "ko");
    const b = cats.find((c) => c.id === "basics")!;
    expect(b.known).toBe(1);
    expect(b.learning).toBe(1);
    expect(b.total).toBe(basics.length);
  });
  it("totals seen = known + learning", () => {
    const ws = wordsFor("ja");
    const mastery: Record<string, 1 | 2> = { [ws[0].id]: 2, [ws[1].id]: 2, [ws[2].id]: 1 };
    const t = learnTotals(mastery, "ja");
    expect(t.known).toBe(2);
    expect(t.learning).toBe(1);
    expect(t.seen).toBe(3);
    expect(t.total).toBe(ws.length);
  });
});

describe("calendarCells", () => {
  it("produces weeks*7 cells aligned to Sunday, flagging the future", () => {
    const cells = calendarCells({ "2026-01-14": 3 }, "2026-01-14", 4); // 2026-01-14 is a Wednesday
    expect(cells.length).toBe(28);
    expect(cells[0].date).toBe("2025-12-21"); // a Sunday
    expect(new Date(cells[0].date + "T00:00:00Z").getUTCDay()).toBe(0);
    const marked = cells.find((c) => c.date === "2026-01-14")!;
    expect(marked.count).toBe(3);
    expect(marked.future).toBe(false);
    expect(cells.some((c) => c.future)).toBe(true); // Thu–Sat of the current week
  });
});

describe("totalStudied / activeDays", () => {
  it("sums all actions and counts active days in the window", () => {
    const daily = { "2026-01-10": 5, "2026-01-09": 0, "2026-01-08": 2 };
    expect(totalStudied(daily)).toBe(7);
    expect(activeDays(daily, "2026-01-10", 3)).toBe(2);
  });
});
