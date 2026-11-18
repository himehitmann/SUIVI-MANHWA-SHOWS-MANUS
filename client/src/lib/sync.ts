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
import {checkoutSessionUrl} from "@shared/checkout-session";
import type {OfferId} from "@shared/pricing";
import {stripePortalLoginUrl} from "@shared/billing-portal";
import type { DasiState } from "./types";

export interface SyncSession {
  userId: string;
  email: string;
  plan?: string;
  syncAccess?: "read_write"|"read_only";
  role?: "owner"|"admin"|"member";
}

export type SyncStatus =
  "offline" | "unavailable" | "signed_in" | "syncing" | "error";

export interface SyncProvider {
  readonly id: string;
  isConfigured(): boolean;
  getSession(): SyncSession | null;
  refreshSession(): Promise<SyncSession>;
  billingPortal(): Promise<string | null>;
  checkoutOffers(): Promise<OfferId[]>;
  beginCheckout(offer:OfferId): Promise<string>;
  expireCheckout(): Promise<void>;
  signUp(email: string, password: string): Promise<SyncSession>;
  signIn(email: string, password: string): Promise<SyncSession>;
  signOut(): Promise<void>;
  push(state: DasiState): Promise<void>;
  pull(): Promise<DasiState | null>;
  adminRequest(path: "me"|"lookup"|"access"|"audit", data?: Record<string,unknown>): Promise<any>;
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
    refreshSession: notAvailable,
    async billingPortal() { return null; },
    async checkoutOffers(){return [];},
    beginCheckout:notAvailable,
    expireCheckout:notAvailable,
    accountAction: notAvailable,
    adminRequest: notAvailable,
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
  const parsedBase=new URL(baseUrl,typeof location!=="undefined"?location.href:"https://invalid.local/");
  if(parsedBase.username||parsedBase.password||parsedBase.search||parsedBase.hash||!(parsedBase.protocol==="https:"||(parsedBase.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(parsedBase.hostname))))throw new Error("secure_api_required");
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
      credentials: "omit",
      redirect: "error",
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
      user: { id: string; email: string; plan: string; role?: "owner"|"admin"|"member"; syncAccess?: "read_write"|"read_only" };
    };
    token = data.token;
    session = {
      userId: data.user.id,
      email: data.user.email,
      plan: data.user.plan,
      role: data.user.role,
      ...(data.user.syncAccess?{syncAccess:data.user.syncAccess}:{}),
    };
    persist();
    return session;
  };

  return {
    id: "http",
    async checkoutOffers(){
      const response=await authFetch("/billing/offers");
      if(response.status===404)return [];
      const data=await response.json();
      if(!response.ok||!Array.isArray(data?.offers)||data.offers.some((v:unknown)=>v!=="month"&&v!=="year"))throw Error("checkout_unavailable");
      return [...new Set(data.offers)] as OfferId[];
    },
    async beginCheckout(offer){
      if(!token||!session)throw Error("unauthorized");
      const requestToken=token,requestUser=session.userId;
      const response=await authFetch("/billing/checkout",{method:"POST",body:JSON.stringify({offer})});
      const data=await response.json().catch(()=>({}));
      if(token!==requestToken||session?.userId!==requestUser)throw Error("account_changed");
      if(!response.ok)throw Error(data.error||"checkout_unavailable");
      const url=checkoutSessionUrl(data.url);
      if(!url||data.offer!==offer)throw Error("checkout_unavailable");
      return url;
    },
    async expireCheckout(){
      if(!token||!session)throw Error("unauthorized");
      const requestToken=token,requestUser=session.userId;
      const response=await authFetch("/billing/checkout/expire",{method:"POST",body:"{}"});
      const data=await response.json().catch(()=>({}));
      if(token!==requestToken||session?.userId!==requestUser)throw Error("account_changed");
      if(!response.ok||data.ok!==true)throw Error(data.error||"checkout_unavailable");
    },

    isConfigured: () => true,
    getSession: () => session,
    async billingPortal() {
      if (!token || !session) throw new Error("unauthorized");
      const requestToken=token,requestUser=session.userId;
      const response=await authFetch("/billing/portal");
      const data=await response.json().catch(()=>null);
      if (token!==requestToken || session?.userId!==requestUser) throw new Error("account_changed");
      if (response.status===404 || (response.status===503 && data?.error==="billing_portal_unavailable")) return null;
      if (!response.ok) throw new Error("billing_portal_failed");
      const url=stripePortalLoginUrl(data?.url);
      if (!url) throw new Error("billing_portal_failed");
      return url;
    },
    async refreshSession() {
      if (!token || !session) throw new Error("unauthorized");
      const requestToken=token,requestUser=session.userId;
      const response=await authFetch("/me");
      if (!response.ok) throw new Error("account_check_failed");
      const data=await response.json(),user=data?.user;
      if (token!==requestToken || session?.userId!==requestUser) throw new Error("account_changed");
      if (user?.id!==requestUser || typeof user.email!=="string" ||
          !["free","pro","lifetime"].includes(user.plan) ||
          !["member","admin","owner"].includes(user.role)) throw new Error("account_check_failed");
      if(user.syncAccess!==undefined&&!["read_write","read_only"].includes(user.syncAccess))throw new Error("account_check_failed");
      session={userId:user.id,email:user.email,plan:user.plan,role:user.role,...(user.syncAccess?{syncAccess:user.syncAccess}:{})};
      persist();
      return {...session};
    },
    signUp: (email, password) => authenticate("/auth/signup", email, password),
    signIn: (email, password) => authenticate("/auth/login", email, password),
    async adminRequest(path, data) {
      if(!token)throw new Error("unauthorized");
      if(!["me","lookup","access","audit"].includes(path))throw new Error("invalid_admin_route");
      const response=await authFetch("/admin/"+path,{method:data===undefined?"GET":"POST",body:data===undefined?undefined:JSON.stringify(data)});
      const out=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(out.error||"admin_request_failed");
      return out;
    },
    async accountAction(action, data = {}) {
      if(!token||!session)throw Error("unauthorized");
      const requestToken=token,requestUser=session.userId;
      const res = await authFetch("/auth/" + action, {
        method: "POST",
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if(token!==requestToken||session?.userId!==requestUser)throw Error("account_changed");
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
        profile: state.profile,
        tombstones: state.tombstones,
        updatedAt: state.updatedAt || 0,
      };
      const res = await authFetch("/sync", {
        method: "PUT",
        body: JSON.stringify({ blob }),
      });
      if (!res.ok) {
        const body=await res.json().catch(()=>({}));
        if(res.status===403&&body.error==="subscription_required")throw new Error("subscription_required");
        throw new Error(`sync_push_${res.status}`);
      }
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
        profile:data.blob.profile,
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

const apiUrl = (import.meta.env.VITE_SYNC_API_URL || (typeof document!=="undefined" ? document.querySelector<HTMLMetaElement>('meta[name="yomu-api"]')?.content : undefined) || undefined) as string|undefined;

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

export const serviceApiUrl=()=>apiUrl;
