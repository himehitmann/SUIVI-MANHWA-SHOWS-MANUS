/**
 * Production Store over Postgres. Implements the exact same interface as the
 * dev file store (server/lib/store.ts), so swapping it in changes nothing else
 * in the API: `createApiRouter(createPostgresStore(pool))`.
 *
 * No hard dependency on a driver — the caller injects any client with a
 * node-postgres-style `query(text, params)` (a `pg.Pool` fits directly). That
 * keeps the backend dependency-free by default and this module unit-testable
 * with a fake client.
 */
import type { SyncRecord, Store, UserRecord } from "./store";

/** Minimal node-postgres-compatible client (pg.Pool / pg.Client satisfy this). */
export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

/** Create the tables if they don't exist. Safe to call on every boot. */
export async function ensureSchema(client: SqlClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      plan          TEXT NOT NULL DEFAULT 'free',
      created_at    BIGINT NOT NULL
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS sync (
      user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      blob       JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
}

const normEmail = (e: string) => (e || "").trim().toLowerCase();

function toUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    plan: row.plan,
    createdAt: Number(row.created_at),
  };
}

export function createPostgresStore(client: SqlClient): Store {
  return {
    async getUserByEmail(email) {
      const { rows } = await client.query("SELECT * FROM users WHERE email = $1", [normEmail(email)]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async getUserById(id) {
      const { rows } = await client.query("SELECT * FROM users WHERE id = $1", [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async createUser(user) {
      await client.query(
        "INSERT INTO users (id, email, password_hash, plan, created_at) VALUES ($1, $2, $3, $4, $5)",
        [user.id, normEmail(user.email), user.passwordHash, user.plan, user.createdAt],
      );
    },
    async updateUser(user) {
      await client.query(
        "UPDATE users SET email = $2, password_hash = $3, plan = $4, created_at = $5 WHERE id = $1",
        [user.id, normEmail(user.email), user.passwordHash, user.plan, user.createdAt],
      );
    },
    async getSync(userId) {
      const { rows } = await client.query("SELECT blob, updated_at FROM sync WHERE user_id = $1", [userId]);
      if (!rows[0]) return null;
      const blob = typeof rows[0].blob === "string" ? JSON.parse(rows[0].blob) : rows[0].blob;
      return { blob, updatedAt: Number(rows[0].updated_at) } as SyncRecord;
    },
    async setSync(userId, record) {
      await client.query(
        `INSERT INTO sync (user_id, blob, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET blob = EXCLUDED.blob, updated_at = EXCLUDED.updated_at`,
        [userId, JSON.stringify(record.blob), record.updatedAt],
      );
    },
  };
}
