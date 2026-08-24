/**
 * Quiz generation and answer checking, pure and unit-tested.
 *
 * Two multiple-choice modes (guess the meaning, or guess the reading) and a
 * typing mode (write the reading). Choices are drawn from a distractor pool so
 * options stay plausible. A seeded RNG makes generation deterministic for tests
 * while the UI passes a Math.random-backed one.
 */
import type { Word } from "./vocab";

export type QuizMode = "meaning" | "reading" | "typing";

export interface QuizQuestion {
  word: Word;
  mode: QuizMode;
  /** What the learner sees on the card (the script). */
  prompt: string;
  /** The correct answer text. */
  answer: string;
  /** Options for multiple-choice modes; empty for typing. */
  choices: string[];
}

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) so quizzes are reproducible in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Strip case, diacritics (pinyin tones, macrons), spaces and punctuation. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop Latin diacritics (macrons, pinyin tone marks)
    .normalize("NFC") // recompose Hangul jamo back into syllables
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿가-힣]/g, "");
}

/** True when the typed answer matches the word's reading (or its translation). */
export function checkTyping(word: Word, input: string, tr: (w: Word) => string): boolean {
  const norm = normalizeAnswer(input);
  if (!norm) return false;
  return norm === normalizeAnswer(word.reading) || norm === normalizeAnswer(tr(word));
}

/** Build up to `n` options including the correct answer, filled from the pool. */
export function buildChoices(correct: string, pool: readonly string[], n: number, rng: Rng): string[] {
  const seen = new Set([normalizeAnswer(correct)]);
  const distractors: string[] = [];
  for (const cand of shuffle(pool, rng)) {
    const key = normalizeAnswer(cand);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(cand);
    if (distractors.length >= n - 1) break;
  }
  return shuffle([correct, ...distractors], rng);
}

/**
 * Generate a quiz from a pool of words. Modes alternate between meaning and
 * reading; pass mode "typing" for an all-typing quiz.
 */
export function buildQuiz(
  pool: readonly Word[],
  tr: (w: Word) => string,
  opts: { count: number; mode: QuizMode | "mixed"; choices?: number; rng?: Rng },
): QuizQuestion[] {
  const rng = opts.rng ?? Math.random;
  const nChoices = opts.choices ?? 4;
  const picked = shuffle(pool, rng).slice(0, Math.min(opts.count, pool.length));

  return picked.map((word, idx) => {
    const mode: QuizMode =
      opts.mode === "mixed" ? (idx % 2 === 0 ? "meaning" : "reading") : opts.mode;

    if (mode === "typing") {
      return { word, mode, prompt: word.script, answer: word.reading, choices: [] };
    }
    const answer = mode === "meaning" ? tr(word) : word.reading;
    const distractorPool = pool
      .filter((w) => w.id !== word.id)
      .map((w) => (mode === "meaning" ? tr(w) : w.reading));
    return { word, mode, prompt: word.script, answer, choices: buildChoices(answer, distractorPool, nChoices, rng) };
  });
}
