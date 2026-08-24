import { describe, expect, it } from "vitest";
import { DEFAULT_EASE, MIN_EASE, addDays, isDue, newCard, qualityOf, schedule } from "../client/src/lib/srs";

describe("srs date math", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("srs grades", () => {
  it("maps buttons to SM-2 qualities", () => {
    expect(qualityOf("again")).toBe(2);
    expect(qualityOf("good")).toBe(4);
    expect(qualityOf("easy")).toBe(5);
  });
});

describe("srs scheduling", () => {
  it("grows intervals on successive passes: 1, 6, then interval*ease", () => {
    const today = "2026-01-01";
    let c = newCard(today);
    c = schedule(c, 4, today);
    expect(c.reps).toBe(1);
    expect(c.intervalDays).toBe(1);
    expect(c.due).toBe("2026-01-02");
    c = schedule(c, 4, c.due);
    expect(c.reps).toBe(2);
    expect(c.intervalDays).toBe(6);
    const before = c.intervalDays;
    c = schedule(c, 4, c.due);
    expect(c.reps).toBe(3);
    expect(c.intervalDays).toBe(Math.round(before * c.ease));
  });

  it("resets the interval and counts a lapse on failure", () => {
    let c = newCard("2026-01-01");
    c = schedule(c, 5, "2026-01-01");
    c = schedule(c, 5, c.due);
    expect(c.reps).toBe(2);
    c = schedule(c, 2, c.due); // Again
    expect(c.reps).toBe(0);
    expect(c.intervalDays).toBe(1);
    expect(c.lapses).toBe(1);
  });

  it("clamps ease to the floor and starts at the default", () => {
    let c = newCard("2026-01-01");
    expect(c.ease).toBe(DEFAULT_EASE);
    let day = "2026-01-01";
    for (let i = 0; i < 20; i++) {
      c = schedule(c, 0, day);
      day = c.due;
    }
    expect(c.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe("srs due check", () => {
  it("treats unseen cards as due and compares dates otherwise", () => {
    expect(isDue(undefined, "2026-01-01")).toBe(true);
    const c = schedule(newCard("2026-01-01"), 5, "2026-01-01");
    expect(isDue(c, "2026-01-01")).toBe(false);
    expect(isDue(c, c.due)).toBe(true);
  });
});
