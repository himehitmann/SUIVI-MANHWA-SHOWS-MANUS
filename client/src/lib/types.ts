/** Shared data model for the Dasi library, used by the web app and mirrored by the extension. */
export type ContentType = "reading" | "watching";
export type ItemStatus = "in_progress" | "completed" | "on_hold" | "planned";
export type Plan = "free" | "pro" | "lifetime";

export interface LibraryItem {
  id: string;
  title: string;
  type: ContentType;
  chapter?: number;
  volume?: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  page?: number;
  totalPages?: number;
  position?: number; // seconds into a video
  duration?: number; // total seconds
  progress: number; // 0-100
  status: ItemStatus;
  url: string;
  domain: string;
  sources: string[];
  cover?: string;
  accent: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  /** Set when a source reports content beyond the saved position. */
  hasUpdate?: boolean;
  updateLabel?: string;
  rating?: number;
}

export interface CustomList {
  id: string;
  name: string;
  color: string;
  itemIds: string[]; // explicit order, drag-and-drop reorders this
  createdAt: number;
}

export interface FavoriteSite {
  id: string;
  name: string;
  url: string;
  domain: string;
  color: string;
}

export type NotificationKind = "new_chapter" | "new_episode" | "reminder" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  itemId?: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

export type LearnLang = "ko" | "ja" | "zh";

/** Spaced-repetition card state per word (see lib/srs.ts). */
export interface SrsCard {
  ease: number;
  reps: number;
  intervalDays: number;
  due: string; // YYYY-MM-DD
  last: string | null;
  lapses: number;
}

export interface LearnState {
  lang: LearnLang;
  xp: number;
  streak: number;
  lastStudied: string | null; // YYYY-MM-DD
  /** wordId -> mastery (1 = learning, 2 = known). Absent = unseen. */
  mastery: Record<string, 1 | 2>;
  /** wordId -> SM-2 scheduling card. Absent = never reviewed. */
  srs: Record<string, SrsCard>;
  /** Target number of study actions per day. */
  dailyGoal: number;
  /** YYYY-MM-DD -> study actions logged that day (daily goal + calendar). */
  daily: Record<string, number>;
  /** Unlocked achievement ids (sticky union over time). */
  achievements: string[];
  /** Count of perfect quizzes completed. */
  perfectQuizzes: number;
}

export interface DasiState {
  items: LibraryItem[];
  lists: CustomList[];
  sites: FavoriteSite[];
  notifications: AppNotification[];
  plan: Plan;
  learn: LearnState;
  version: 1;
}
