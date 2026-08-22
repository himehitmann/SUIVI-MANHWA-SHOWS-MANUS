/**
 * Storage interface for the sync backend. The default implementation is
 * in-memory with optional JSON-file persistence, so the API runs out of the box
 * for development and self-hosting. For production, implement this same
 * interface over Postgres / D1 and swap it in `createStore()` — nothing else in
 * the API changes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SyncBlob } from "./merge";

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

export interface Store {
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(user: UserRecord): Promise<void>;
  getSync(userId: string): Promise<SyncRecord | null>;
  setSync(userId: string, record: SyncRecord): Promise<void>;
}

interface Snapshot {
  users: UserRecord[];
  sync: Record<string, SyncRecord>;
}

export function createStore(filePath?: string): Store {
  const snap: Snapshot = { users: [], sync: {} };
  if (filePath && existsSync(filePath)) {
    try {
      Object.assign(snap, JSON.parse(readFileSync(filePath, "utf8")));
    } catch {
      /* start fresh on corrupt file */
    }
  }
  const persist = () => {
    if (!filePath) return;
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(snap));
    } catch {
      /* best-effort */
    }
  };
  const norm = (e: string) => e.trim().toLowerCase();

  return {
    async getUserByEmail(email) {
      return snap.users.find((u) => u.email === norm(email)) ?? null;
    },
    async getUserById(id) {
      return snap.users.find((u) => u.id === id) ?? null;
    },
    async createUser(user) {
      snap.users.push({ ...user, email: norm(user.email) });
      persist();
    },
    async updateUser(user) {
      const i = snap.users.findIndex((u) => u.id === user.id);
      if (i >= 0) snap.users[i] = { ...user, email: norm(user.email) };
      persist();
    },
    async getSync(userId) {
      return snap.sync[userId] ?? null;
    },
    async setSync(userId, record) {
      snap.sync[userId] = record;
      persist();
    },
  };
}
