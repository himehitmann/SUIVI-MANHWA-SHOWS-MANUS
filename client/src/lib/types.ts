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

export interface DasiState {
  items: LibraryItem[];
  lists: CustomList[];
  sites: FavoriteSite[];
  notifications: AppNotification[];
  plan: Plan;
  version: 1;
}
