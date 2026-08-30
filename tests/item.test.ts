import { describe, expect, it } from "vitest";
import { normalizeTitle, workId, sameWork } from "../client/src/lib/item";

describe("normalizeTitle / workId", () => {
  it("strips markers, punctuation and a leading article", () => {
    expect(normalizeTitle("The Solo Leveling - Chapter 110")).toBe("solo leveling");
    expect(workId("Solo Leveling")).toBe("solo-leveling");
    expect(workId("Solo Leveling — Chapter 110")).toBe("solo-leveling");
  });

  it("keeps non-Latin scripts (a CJK title gets a stable, non-empty key)", () => {
    const a = workId("ソロレベリング");
    expect(a).not.toBe("");
    expect(a).toBe(workId("ソロレベリング 第12話"));
  });

  it("ignores accents and case", () => {
    expect(normalizeTitle("Rémanence")).toBe(normalizeTitle("remanence"));
  });
});

describe("sameWork (cross-site matching)", () => {
  it("matches formatting / spelling / order / article variants", () => {
    expect(sameWork("Solo Leveling", "solo-leveling")).toBe(true);
    expect(sameWork("Tower of God", "Tower Of God")).toBe(true);
    expect(sameWork("The Beginning After The End", "Beginning After the End")).toBe(true);
    expect(sameWork("Solo Leveling", "Solo Levelling")).toBe(true); // spelling
    expect(sameWork("Attack on Titan", "Attack on Titan Season 4")).toBe(true); // subtitle/season
  });

  it("does NOT merge distinct works", () => {
    expect(sameWork("One Piece", "One Punch Man")).toBe(false);
    expect(sameWork("Naruto", "Boruto")).toBe(false);
    expect(sameWork("Bleach", "Berserk")).toBe(false);
    expect(sameWork("", "anything")).toBe(false);
  });
});
