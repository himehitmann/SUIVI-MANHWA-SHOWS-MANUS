import { describe, expect, it } from "vitest";
import { buildChoices, buildQuiz, checkTyping, normalizeAnswer, seededRng, shuffle } from "../client/src/lib/quiz";
import { wordsFor, type Word } from "../client/src/lib/vocab";

const tr = (w: Word) => w.en;

describe("normalizeAnswer", () => {
  it("strips case, tones and punctuation", () => {
    expect(normalizeAnswer("Nǐ hǎo!")).toBe(normalizeAnswer("ni hao"));
    expect(normalizeAnswer("  arigatō ")).toBe("arigato");
  });
  it("keeps CJK and Hangul characters", () => {
    expect(normalizeAnswer("안녕")).toBe("안녕");
    expect(normalizeAnswer("寿司")).toBe("寿司");
  });
});

describe("checkTyping", () => {
  const w = wordsFor("ja").find((x) => x.reading === "arigatō")!;
  it("accepts the reading regardless of macrons/case", () => {
    expect(checkTyping(w, "Arigato", tr)).toBe(true);
    expect(checkTyping(w, "arigatō", tr)).toBe(true);
  });
  it("accepts the translation too", () => {
    expect(checkTyping(w, "thank you", tr)).toBe(true);
  });
  it("rejects wrong input and blanks", () => {
    expect(checkTyping(w, "konnichiwa", tr)).toBe(false);
    expect(checkTyping(w, "   ", tr)).toBe(false);
  });
});

describe("buildChoices", () => {
  it("always includes the correct answer and is deterministic under a seed", () => {
    const pool = ["one", "two", "three", "four", "five"];
    const a = buildChoices("one", pool, 4, seededRng(1));
    const b = buildChoices("one", pool, 4, seededRng(1));
    expect(a).toEqual(b);
    expect(a).toContain("one");
    expect(a.length).toBe(4);
    expect(new Set(a).size).toBe(4); // no duplicates
  });
  it("degrades gracefully when the pool is small", () => {
    const c = buildChoices("only", ["only"], 4, seededRng(2));
    expect(c).toEqual(["only"]);
  });
});

describe("buildQuiz", () => {
  it("produces one question per word with the answer among the choices", () => {
    const pool = wordsFor("ko", "basics");
    const qs = buildQuiz(pool, tr, { count: 4, mode: "meaning", rng: seededRng(7) });
    expect(qs.length).toBe(4);
    for (const q of qs) {
      expect(q.choices).toContain(q.answer);
      expect(q.answer).toBe(tr(q.word));
    }
  });
  it("mixed mode alternates meaning and reading", () => {
    const qs = buildQuiz(wordsFor("ko", "basics"), tr, { count: 4, mode: "mixed", rng: seededRng(3) });
    expect(qs[0].mode).toBe("meaning");
    expect(qs[1].mode).toBe("reading");
  });
  it("typing mode has no choices and answers with the reading", () => {
    const qs = buildQuiz(wordsFor("ko", "basics"), tr, { count: 3, mode: "typing", rng: seededRng(5) });
    for (const q of qs) {
      expect(q.choices).toEqual([]);
      expect(q.answer).toBe(q.word.reading);
    }
  });
});

describe("shuffle", () => {
  it("preserves the multiset of elements", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, seededRng(9));
    expect(out.slice().sort()).toEqual(src);
  });
});
