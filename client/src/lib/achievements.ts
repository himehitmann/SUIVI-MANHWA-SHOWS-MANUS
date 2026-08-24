/**
 * Daily goal and achievements — pure helpers over the learn slice.
 *
 * Achievements are derived from state (known-word count, streak, level, quiz
 * record, languages touched, fully-mastered categories) so they can be
 * recomputed deterministically and unit-tested. The store keeps the unlocked
 * set sticky (union over time) so a dip in stats never revokes a badge.
 */
import { CATEGORIES, LEARN_LANGS, levelInfo, wordsFor, type LearnLang } from "./vocab";

/** The subset of learn state the pure helpers need. */
export interface LearnStats {
  xp: number;
  streak: number;
  mastery: Record<string, 1 | 2>;
  perfectQuizzes: number;
}

export interface Achievement {
  id: string;
  emoji: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_word", emoji: "🌱" },
  { id: "ten_known", emoji: "📗" },
  { id: "fifty_known", emoji: "📚" },
  { id: "hundred_known", emoji: "🏛️" },
  { id: "streak_7", emoji: "🔥" },
  { id: "streak_30", emoji: "🌟" },
  { id: "level_5", emoji: "🥉" },
  { id: "level_10", emoji: "🥇" },
  { id: "polyglot", emoji: "🌏" },
  { id: "category_master", emoji: "👑" },
  { id: "quiz_ace", emoji: "🎯" },
];

/** Number of words marked "known" (mastery 2). */
export function knownCount(mastery: Record<string, 1 | 2>): number {
  let n = 0;
  for (const id in mastery) if (mastery[id] === 2) n += 1;
  return n;
}

/** Distinct languages the learner has touched, read from word-id prefixes. */
export function langsStudied(mastery: Record<string, 1 | 2>): LearnLang[] {
  const set = new Set<LearnLang>();
  for (const id in mastery) {
    const code = id.slice(0, 2);
    if (code === "ko" || code === "ja" || code === "zh") set.add(code);
  }
  return Array.from(set);
}

/** True when every word of some (lang, category) pair is known. */
export function hasMasteredCategory(mastery: Record<string, 1 | 2>): boolean {
  for (const l of LEARN_LANGS) {
    for (const c of CATEGORIES) {
      const ws = wordsFor(l.code, c.id);
      if (ws.length > 0 && ws.every((w) => mastery[w.id] === 2)) return true;
    }
  }
  return false;
}

/** The full set of achievement ids the current state qualifies for. */
export function unlockedAchievements(s: LearnStats): string[] {
  const known = knownCount(s.mastery);
  const level = levelInfo(s.xp).level;
  const langs = langsStudied(s.mastery).length;
  const touched = Object.keys(s.mastery).length;
  const out: string[] = [];
  if (touched >= 1) out.push("first_word");
  if (known >= 10) out.push("ten_known");
  if (known >= 50) out.push("fifty_known");
  if (known >= 100) out.push("hundred_known");
  if (s.streak >= 7) out.push("streak_7");
  if (s.streak >= 30) out.push("streak_30");
  if (level >= 5) out.push("level_5");
  if (level >= 10) out.push("level_10");
  if (langs >= 3) out.push("polyglot");
  if (hasMasteredCategory(s.mastery)) out.push("category_master");
  if (s.perfectQuizzes >= 1) out.push("quiz_ace");
  return out;
}

export const DEFAULT_DAILY_GOAL = 20;
export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50];

/** Reviews logged today vs. the goal. */
export function dailyProgress(
  daily: Record<string, number>,
  today: string,
  goal: number,
): { done: number; goal: number; pct: number; met: boolean } {
  const done = daily[today] ?? 0;
  const g = Math.max(1, goal);
  return { done, goal: g, pct: Math.min(100, Math.round((done / g) * 100)), met: done >= g };
}
