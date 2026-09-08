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

export type SyncStatus =
  "offline" | "unavailable" | "signed_in" | "syncing" | "error";

export interface SyncProvider {
  readonly id: string;
  isConfigured(): boolean;
  getSession(): SyncSession | null;
  signUp(email: string, password: string): Promise<SyncSession>;
  signIn(email: string, password: string): Promise<SyncSession>;
  signOut(): Promise<void>;
  push(state: DasiState): Promise<void>;
  pull(): Promise<DasiState | null>;
  accountAction(
    action: "password" | "email" | "logout-all" | "delete",
    data?: Record<string, string>
  ): Promise<void>;
}

/** No backend: honest "offline" state, everything stays local. */
export function createLocalProvider(): SyncProvider {
  const notAvailable = () =>
    Promise.reject(new Error("Cloud sync is not available in this build"));
  return {
    id: "local",
    isConfigured: () => false,
    getSession: () => null,
    accountAction: notAvailable,
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
  const tokenKey = TOKEN_KEY + ":" + encodeURIComponent(base),
    sessionKey = SESSION_KEY + ":" + encodeURIComponent(base);
  let token: string | null = null;
  let session: SyncSession | null = null;
  try {
    token = localStorage.getItem(tokenKey);
    const raw = localStorage.getItem(sessionKey);
    session = raw ? (JSON.parse(raw) as SyncSession) : null;
  } catch {
    /* storage unavailable */
  }

  const persist = () => {
    try {
      if (token) localStorage.setItem(tokenKey, token);
      else localStorage.removeItem(tokenKey);
      if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
      else localStorage.removeItem(sessionKey);
    } catch {
      /* ignore */
    }
  };

  const authFetch = (path: string, init: RequestInit = {}) =>
    fetch(base + path, {
      signal: AbortSignal.timeout(15000),
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });

  const authenticate = async (
    path: string,
    email: string,
    password: string
  ): Promise<SyncSession> => {
    const res = await authFetch(path, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error || `HTTP ${res.status}`
      );
    }
    const data = (await res.json()) as {
      token: string;
      user: { id: string; email: string; plan: string };
    };
    token = data.token;
    session = {
      userId: data.user.id,
      email: data.user.email,
      plan: data.user.plan,
    };
    persist();
    return session;
  };

  return {
    id: "http",
    isConfigured: () => true,
    getSession: () => session,
    signUp: (email, password) => authenticate("/auth/signup", email, password),
    signIn: (email, password) => authenticate("/auth/login", email, password),
    async accountAction(action, data = {}) {
      const res = await authFetch("/auth/" + action, {
        method: "POST",
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw Error(out.error || "account_change_failed");
      if (out.token) token = out.token;
      if (out.user && session) session = { ...session, email: out.user.email };
      if (action === "delete" || action === "logout-all") {
        token = null;
        session = null;
      }
      persist();
    },
    async signOut() {
      if (token) {
        const res = await authFetch("/auth/logout", { method: "POST" });
        if (!res.ok) throw new Error("sign_out_failed");
      }
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
        tombstones: state.tombstones,
        updatedAt: state.updatedAt || 0,
      };
      const res = await authFetch("/sync", {
        method: "PUT",
        body: JSON.stringify({ blob }),
      });
      if (!res.ok) throw new Error(`sync_push_${res.status}`);
    },
    async pull() {
      if (!token) return null;
      const requestToken = token;
      const res = await authFetch("/sync");
      if (!res.ok) throw new Error(`sync_pull_${res.status}`);
      const data = (await res.json()) as {
        blob: (DasiState & { updatedAt: number }) | null;
      };
      if (requestToken !== token) throw new Error("account_changed");
      if (!data.blob) return null;
      const out: Partial<DasiState> = {
        items: data.blob.items ?? [],
        tombstones: data.blob.tombstones,
        updatedAt: data.blob.updatedAt,
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
export const syncProvider: SyncProvider = apiUrl
  ? createHttpProvider(apiUrl)
  : createLocalProvider();

export function currentSyncStatus(): SyncStatus {
  if (!syncProvider.isConfigured()) return "offline";
  return syncProvider.getSession() ? "signed_in" : "unavailable";
}

export const currentAccountScope = () => {
  const session = syncProvider.getSession();
  return session ? (apiUrl || "") + "|" + session.userId : null;
};
