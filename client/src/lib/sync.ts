/**
 * Sync abstraction — the seam between Dasi's local-first core and the optional
 * cloud backend.
 *
 * The app only ever talks to a `SyncProvider`. When `VITE_SYNC_API_URL` is set
 * at build time, the real HTTP provider is used; otherwise the no-op local
 * provider keeps everything on-device. Either way, if sync is absent or fails,
 * the app keeps working entirely on local data — sync can never be a single
 * point of failure.
 */
import type { DasiState } from "./types";

export interface SyncSession {
  userId: string;
  email: string;
  plan?: string;
}

export type SyncStatus = "offline" | "unavailable" | "signed_in" | "syncing" | "error";

export interface SyncProvider {
  readonly id: string;
  isConfigured(): boolean;
  getSession(): SyncSession | null;
  signUp(email: string, password: string): Promise<SyncSession>;
  signIn(email: string, password: string): Promise<SyncSession>;
  signOut(): Promise<void>;
  push(state: DasiState): Promise<void>;
  pull(): Promise<DasiState | null>;
}

/** No backend: honest "offline" state, everything stays local. */
export function createLocalProvider(): SyncProvider {
  const notAvailable = () => Promise.reject(new Error("Cloud sync is not available in this build"));
  return {
    id: "local",
    isConfigured: () => false,
    getSession: () => null,
    signUp: notAvailable,
    signIn: notAvailable,
    async signOut() {},
    async push() {},
    async pull() {
      return null;
    },
  };
}

const TOKEN_KEY = "dasi.sync.token";
const SESSION_KEY = "dasi.sync.session";

/** Real provider backed by the Express API in server/. */
export function createHttpProvider(baseUrl: string): SyncProvider {
  const base = baseUrl.replace(/\/+$/, "");
  let token: string | null = null;
  let session: SyncSession | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as SyncSession) : null;
  } catch {
    /* storage unavailable */
  }

  const persist = () => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  };

  const authFetch = (path: string, init: RequestInit = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });

  const authenticate = async (path: string, email: string, password: string): Promise<SyncSession> => {
    const res = await authFetch(path, { method: "POST", body: JSON.stringify({ email, password }) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { token: string; user: { id: string; email: string; plan: string } };
    token = data.token;
    session = { userId: data.user.id, email: data.user.email, plan: data.user.plan };
    persist();
    return session;
  };

  return {
    id: "http",
    isConfigured: () => true,
    getSession: () => session,
    signUp: (email, password) => authenticate("/auth/signup", email, password),
    signIn: (email, password) => authenticate("/auth/login", email, password),
    async signOut() {
      token = null;
      session = null;
      persist();
    },
    async push(state) {
      if (!token) return;
      const blob = {
        items: state.items,
        lists: state.lists,
        sites: state.sites,
        notifications: state.notifications,
        plan: state.plan,
        learn: state.learn,
        updatedAt: Date.now(),
      };
      await authFetch("/sync", { method: "PUT", body: JSON.stringify({ blob }) });
    },
    async pull() {
      if (!token) return null;
      const res = await authFetch("/sync");
      if (!res.ok) return null;
      const data = (await res.json()) as { blob: (DasiState & { updatedAt: number }) | null };
      if (!data.blob) return null;
      const out: Partial<DasiState> = {
        items: data.blob.items ?? [],
        lists: data.blob.lists ?? [],
        sites: data.blob.sites ?? [],
        notifications: data.blob.notifications ?? [],
        plan: data.blob.plan ?? "free",
      };
      if (data.blob.learn) out.learn = data.blob.learn;
      return out as DasiState;
    },
  };
}

const apiUrl = import.meta.env.VITE_SYNC_API_URL as string | undefined;

/** The active provider: HTTP when a backend URL is configured, else local. */
export const syncProvider: SyncProvider = apiUrl ? createHttpProvider(apiUrl) : createLocalProvider();

export function currentSyncStatus(): SyncStatus {
  if (!syncProvider.isConfigured()) return "offline";
  return syncProvider.getSession() ? "signed_in" : "unavailable";
}
