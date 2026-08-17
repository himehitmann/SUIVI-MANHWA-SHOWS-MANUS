/**
 * Sync abstraction — the seam between Dasi's local-first core and any future
 * cloud provider.
 *
 * The app only ever talks to a `SyncProvider`. A real provider (Supabase,
 * Cloudflare, …) can be dropped in later WITHOUT touching detection, storage or
 * UI, and if the provider is absent or fails, the app keeps working entirely on
 * local data. This is the "isolate the external dependency" guarantee: sync is
 * opt-in and can never be a single point of failure.
 */
import type { DasiState } from "./types";

export interface SyncSession {
  userId: string;
  email: string;
}

export type SyncStatus = "offline" | "unavailable" | "signed_in" | "syncing" | "error";

export interface SyncProvider {
  readonly id: string;
  /** Whether a real backend is wired for this build. */
  isConfigured(): boolean;
  getSession(): SyncSession | null;
  signIn(email: string): Promise<SyncSession>;
  signOut(): Promise<void>;
  /** Push local state up. No-op when not configured. */
  push(state: DasiState): Promise<void>;
  /** Pull remote state, or null when there is nothing/no backend. */
  pull(): Promise<DasiState | null>;
}

/**
 * Default provider: no backend. It advertises itself as unconfigured so the UI
 * shows an honest "offline / coming soon" state instead of pretending to sync.
 */
export function createLocalProvider(): SyncProvider {
  return {
    id: "local",
    isConfigured: () => false,
    getSession: () => null,
    async signIn() {
      throw new Error("Cloud sync is not available in this build");
    },
    async signOut() {
      /* nothing to do */
    },
    async push() {
      /* local-only: state already persisted by the store */
    },
    async pull() {
      return null;
    },
  };
}

/** Single place to swap in a real provider later. */
export const syncProvider: SyncProvider = createLocalProvider();

export function currentSyncStatus(): SyncStatus {
  if (!syncProvider.isConfigured()) return "offline";
  return syncProvider.getSession() ? "signed_in" : "unavailable";
}
