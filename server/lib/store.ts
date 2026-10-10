/**
 * Storage interface for the sync backend. The default implementation is
 * in-memory with optional JSON-file persistence, so the API runs out of the box
 * for development and self-hosting. For production, implement this same
 * interface over Postgres / D1 and swap it in `createStore()` — nothing else in
 * the API changes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import { mergeBlobs, type SyncBlob } from "./merge";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  plan: "free" | "pro" | "lifetime";
  createdAt: number;
}

export interface SyncRecord {
  blob: SyncBlob;
  updatedAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}
export interface BillingReceipt { provider: "stripe" | "paddle"; eventId: string; resourceId?: string; occurredAt?: number; }
export interface BillingResult { ok: boolean; plan?: UserRecord["plan"]; unchanged?: boolean; reason?: string; }
export interface Store {
  applyBillingEvent(userId: string, plan: UserRecord["plan"], receipt: BillingReceipt): Promise<BillingResult>;
  createSession(session: SessionRecord): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  revokeSession(id: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(user: UserRecord): Promise<void>;
  getSync(userId: string): Promise<SyncRecord | null>;
  setSync(userId: string, record: SyncRecord): Promise<void>;
  mergeSync(userId: string, incoming: SyncBlob): Promise<SyncRecord>;
}

interface Snapshot {
  users: UserRecord[];
  sessions: SessionRecord[];
  sync: Record<string, SyncRecord>;
  billing: (BillingReceipt & { userId: string })[];
  billingHeads: (BillingReceipt & {userId:string;plan:UserRecord["plan"]})[];
}

export function createStore(filePath?: string): Store {
  let snap: Snapshot = { users: [], sync: {}, sessions: [], billing: [], billingHeads: [] };
  if (filePath && existsSync(filePath)) {
    try {
      Object.assign(snap, JSON.parse(readFileSync(filePath, "utf8")));
    } catch {
      throw new Error(
        "The sync data file is unreadable. Restore a backup before restarting; existing data was not overwritten."
      );
    }
  }
  const persist = (next: Snapshot) => {
    if (!filePath) {
      snap = next;
      return;
    }
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      const temporary = filePath + ".tmp";
      writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 });
      renameSync(temporary, filePath);
      snap = next;
    } catch {
      throw new Error("Could not persist account data.");
    }
  };
  const norm = (e: string) => e.trim().toLowerCase();

  return {
    async applyBillingEvent(userId, plan, receipt) {
      const user=snap.users.find(u=>u.id===userId);
      if(!user)return {ok:false,reason:"user_not_found"};
      if(snap.billing.some(r=>r.provider===receipt.provider&&r.eventId===receipt.eventId))return {ok:true,unchanged:true};
      const ordered=receipt.resourceId!==undefined&&receipt.occurredAt!==undefined;
      const head=ordered?snap.billingHeads.find(h=>h.provider===receipt.provider&&h.resourceId===receipt.resourceId):undefined;
      if(head&&head.userId!==userId)return {ok:false,reason:"billing_resource_conflict"};
      if(head&&receipt.occurredAt===head.occurredAt&&plan!==head.plan)return {ok:false,reason:"billing_order_ambiguous"};
      const stale=head&&receipt.occurredAt!<=head.occurredAt!;
      if(stale){persist({...snap,billing:[...snap.billing,{...receipt,userId}]});return {ok:true,unchanged:true};}
      const nextPlan=user.plan==="lifetime"?user.plan:plan;
      const billingHeads=ordered?[...snap.billingHeads.filter(h=>h.provider!==receipt.provider||h.resourceId!==receipt.resourceId),{...receipt,userId,plan}]:snap.billingHeads;
      persist({...snap,users:snap.users.map(u=>u.id===userId?{...u,plan:nextPlan}:u),billing:[...snap.billing,{...receipt,userId}],billingHeads});
      return user.plan===nextPlan?{ok:true,unchanged:true}:{ok:true,plan:nextPlan};
    },
    async createSession(session) {
      persist({
        ...snap,
        sessions: [
          ...snap.sessions.filter(s => s.expiresAt > Date.now()),
          session,
        ],
      });
    },
    async getSession(id) {
      return (
        snap.sessions.find(s => s.id === id && s.expiresAt > Date.now()) || null
      );
    },
    async revokeSession(id) {
      persist({ ...snap, sessions: snap.sessions.filter(s => s.id !== id) });
    },
    async revokeUserSessions(userId) {
      persist({
        ...snap,
        sessions: snap.sessions.filter(s => s.userId !== userId),
      });
    },
    async deleteUser(userId) {
      const sync = { ...snap.sync };
      delete sync[userId];
      persist({
        ...snap,
        users: snap.users.filter(u => u.id !== userId),
        billing: snap.billing.filter(r=>r.userId!==userId),
        billingHeads: snap.billingHeads.filter(r=>r.userId!==userId),
        sessions: snap.sessions.filter(s => s.userId !== userId),
        sync,
      });
    },
    async getUserByEmail(email) {
      return snap.users.find(u => u.email === norm(email)) ?? null;
    },
    async getUserById(id) {
      return snap.users.find(u => u.id === id) ?? null;
    },
    async createUser(user) {
      if (snap.users.some(u => u.email === norm(user.email)))
        throw new Error("email_exists");
      persist({
        ...snap,
        users: [...snap.users, { ...user, email: norm(user.email) }],
      });
    },
    async updateUser(user) {
      if (
        snap.users.some(u => u.id !== user.id && u.email === norm(user.email))
      )
        throw new Error("email_exists");
      persist({
        ...snap,
        users: snap.users.map(u =>
          u.id === user.id ? { ...user, email: norm(user.email) } : u
        ),
      });
    },
    async getSync(userId) {
      return snap.sync[userId] ?? null;
    },
    async mergeSync(userId, incoming) {
      const user = snap.users.find(u => u.id === userId);
      if (!user) throw Error("account_missing");
      const blob = {
          ...mergeBlobs(snap.sync[userId]?.blob || null, incoming),
          plan: user.plan,
        },
        record = { blob, updatedAt: blob.updatedAt };
      persist({ ...snap, sync: { ...snap.sync, [userId]: record } });
      return record;
    },
    async setSync(userId, record) {
      persist({ ...snap, sync: { ...snap.sync, [userId]: record } });
    },
  };
}
