/**
 * Spaced-repetition scheduling (SM-2), pure and unit-tested.
 *
 * Each studied word gets an SrsCard tracking its easiness factor, streak of
 * correct reps, current interval and next due date. Grades map the app's three
 * review buttons to SM-2 qualities:
 *   Again → 2 (lapse),  Good → 4,  Easy → 5.
 * Scheduling is date-based (day granularity, UTC) so it stays deterministic and
 * survives across devices via the synced store.
 */

export interface SrsCard {
  /** Easiness factor, clamped to >= MIN_EASE. */
  ease: number;
  /** Consecutive successful reps (reset to 0 on a lapse). */
  reps: number;
  /** Current interval in days. */
  intervalDays: number;
  /** Next due date, YYYY-MM-DD. */
  due: string;
  /** Last graded date, YYYY-MM-DD, or null if never graded. */
  last: string | null;
  /** Number of times the card was failed after being learned. */
  lapses: number;
}

export type Grade = "again" | "good" | "easy";

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

/** Map the UI's three buttons to an SM-2 quality (0–5). */
export function qualityOf(grade: Grade): number {
  return grade === "again" ? 2 : grade === "good" ? 4 : 5;
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newCard(today: string): SrsCard {
  return { ease: DEFAULT_EASE, reps: 0, intervalDays: 0, due: today, last: null, lapses: 0 };
}

/**
 * Apply one review outcome and return the next card state. `quality` is the
 * SM-2 grade (0–5); anything below 3 is a lapse that restarts the interval.
 */
export function schedule(card: SrsCard, quality: number, today: string): SrsCard {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, reps, intervalDays, lapses } = card;

  if (q < 3) {
    reps = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(intervalDays * ease));
  }

  // SM-2 easiness update. Correct answers raise ease, weak ones lower it.
  ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  return { ease, reps, intervalDays, due: addDays(today, intervalDays), last: today, lapses };
}

/** A card with no history (unseen) counts as due; otherwise compare due date. */
export function isDue(card: SrsCard | undefined, today: string): boolean {
  if (!card) return true;
  return card.due <= today;
}

/** Human-friendly "next review" label for a given interval in days. */
export function intervalLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? "1 month" : `${months} months`;
}
