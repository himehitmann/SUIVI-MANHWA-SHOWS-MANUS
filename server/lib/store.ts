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
  let snap: Snapshot = { users: [], sync: {} };
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
    async setSync(userId, record) {
      persist({ ...snap, sync: { ...snap.sync, [userId]: record } });
    },
  };
}
