/**
 * Derived learning statistics, pure and unit-tested.
 *
 * Everything is computed from the synced learn slice — `daily` (per-day study
 * tallies), `srs` (SM-2 cards) and `mastery` — so the stats page is a pure view
 * with no extra persisted state. Dates are day-granular UTC strings (YYYY-MM-DD)
 * to line up with the rest of the Learn module.
 */
import { addDays } from "./srs";
import { CATEGORIES, wordsFor, type CategoryId, type LearnLang } from "./vocab";

export interface DayCount {
  date: string;
  count: number;
}

/** N calendar dates ending on `today` (inclusive), ascending. */
export function lastNDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Study actions per day over the last `n` days (ascending). */
export function studyHistory(daily: Record<string, number>, today: string, n: number): DayCount[] {
  return lastNDays(today, n).map((date) => ({ date, count: daily[date] ?? 0 }));
}

/**
 * Upcoming review load. For each of the next `n` days (index 0 = today), how
 * many SM-2 cards come due; anything overdue rolls into today.
 */
export function dueForecast(srs: Record<string, { due: string }>, today: string, n: number): DayCount[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) dates.push(addDays(today, i));
  const counts = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const id in srs) {
    const due = srs[id].due;
    if (due <= today) counts.set(today, (counts.get(today) ?? 0) + 1);
    else if (counts.has(due)) counts.set(due, (counts.get(due) ?? 0) + 1);
  }
  return dates.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export interface CatMastery {
  id: CategoryId;
  known: number;
  learning: number;
  total: number;
}

/** Known/learning/total per category for one language. */
export function categoryMastery(mastery: Record<string, 1 | 2>, lang: LearnLang): CatMastery[] {
  return CATEGORIES.map((c) => {
    const ws = wordsFor(lang, c.id);
    let known = 0;
    let learning = 0;
    for (const w of ws) {
      const m = mastery[w.id];
      if (m === 2) known += 1;
      else if (m === 1) learning += 1;
    }
    return { id: c.id, known, learning, total: ws.length };
  });
}

export interface LearnTotals {
  known: number;
  learning: number;
  seen: number;
  total: number;
}

/** Known/learning/seen counts for one language, against its full word count. */
export function learnTotals(mastery: Record<string, 1 | 2>, lang: LearnLang): LearnTotals {
  const ws = wordsFor(lang);
  let known = 0;
  let learning = 0;
  for (const w of ws) {
    const m = mastery[w.id];
    if (m === 2) known += 1;
    else if (m === 1) learning += 1;
  }
  return { known, learning, seen: known + learning, total: ws.length };
}

export interface CalCell {
  date: string;
  count: number;
  future: boolean;
}

/**
 * Grid of `weeks` × 7 day cells ending with the current week's Saturday, so the
 * heatmap aligns to whole weeks (Sunday-first columns). Future days are flagged.
 */
export function calendarCells(daily: Record<string, number>, today: string, weeks: number): CalCell[] {
  const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
  const end = addDays(today, 6 - dow); // Saturday closing the current week
  const start = addDays(end, -(weeks * 7 - 1));
  const cells: CalCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    cells.push({ date, count: daily[date] ?? 0, future: date > today });
  }
  return cells;
}

/** Sum of all recorded study actions (all languages). */
export function totalStudied(daily: Record<string, number>): number {
  let n = 0;
  for (const d in daily) n += daily[d];
  return n;
}

/** How many of the last `n` days (ending today) had at least one study action. */
export function activeDays(daily: Record<string, number>, today: string, n: number): number {
  return studyHistory(daily, today, n).filter((d) => d.count > 0).length;
}
