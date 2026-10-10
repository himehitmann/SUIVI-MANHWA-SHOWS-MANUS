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
import { mergeBlobs } from "./merge";
import type { SyncRecord, Store, UserRecord } from "./store";

/** Minimal node-postgres-compatible client (pg.Pool / pg.Client satisfy this). */
export interface SqlClient {
  connect?(): Promise<SqlClient & { release(): void }>;
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
  await client.query(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,expires_at BIGINT NOT NULL
  )`);
  await client.query("CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)");
  await client.query("CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS sync (
      user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      blob       JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
  await client.query(`CREATE TABLE IF NOT EXISTS billing_events (
    provider TEXT NOT NULL,event_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (provider,event_id)
  )`);
  await client.query("CREATE INDEX IF NOT EXISTS billing_events_user_id_idx ON billing_events (user_id)");
  await client.query(`CREATE TABLE IF NOT EXISTS billing_heads (
    provider TEXT NOT NULL,resource_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occurred_at BIGINT NOT NULL,plan TEXT NOT NULL,
    PRIMARY KEY (provider,resource_id)
  )`);
  await client.query("CREATE INDEX IF NOT EXISTS billing_heads_user_id_idx ON billing_heads (user_id)");
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
    async applyBillingEvent(userId, plan, receipt) {
      if(!client.connect)throw new Error("Billing transactions require a connection pool");
      const connection=await client.connect();
      try {
        await connection.query("BEGIN");
        const ordered=receipt.resourceId!==undefined&&receipt.occurredAt!==undefined;
        if(ordered)await connection.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[receipt.provider+":"+receipt.resourceId]);
        const locked=await connection.query("SELECT * FROM users WHERE id = $1 FOR UPDATE",[userId]);
        if(!locked.rows[0]){await connection.query("ROLLBACK");return {ok:false,reason:"user_not_found"};}
        const recorded=await connection.query("INSERT INTO billing_events (provider,event_id,user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id",[receipt.provider,receipt.eventId,userId]);
        if(!recorded.rows.length){await connection.query("COMMIT");return {ok:true,unchanged:true};}
        const head=ordered?(await connection.query("SELECT * FROM billing_heads WHERE provider=$1 AND resource_id=$2",[receipt.provider,receipt.resourceId])).rows[0]:undefined;
        if(head&&head.user_id!==userId){await connection.query("ROLLBACK");return {ok:false,reason:"billing_resource_conflict"};}
        if(head&&receipt.occurredAt===Number(head.occurred_at)&&plan!==head.plan){await connection.query("ROLLBACK");return {ok:false,reason:"billing_order_ambiguous"};}
        if(head&&receipt.occurredAt!<=Number(head.occurred_at)){await connection.query("COMMIT");return {ok:true,unchanged:true};}
        if(ordered)await connection.query("INSERT INTO billing_heads (provider,resource_id,user_id,occurred_at,plan) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (provider,resource_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at,plan=EXCLUDED.plan",[receipt.provider,receipt.resourceId,userId,receipt.occurredAt,plan]);
        const oldPlan=locked.rows[0].plan,nextPlan=oldPlan==="lifetime"?oldPlan:plan;
        if(oldPlan!==nextPlan)await connection.query("UPDATE users SET plan = $2 WHERE id = $1",[userId,nextPlan]);
        await connection.query("COMMIT");
        return oldPlan===nextPlan?{ok:true,unchanged:true}:{ok:true,plan:nextPlan};
      } catch(error){await connection.query("ROLLBACK");throw error;}
      finally{connection.release();}
    },
    async createSession(s) {
      await client.query("DELETE FROM sessions WHERE expires_at <= $1", [
        Date.now(),
      ]);
      await client.query(
        "INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES ($1,$2,$3,$4)",
        [s.id, s.userId, s.createdAt, s.expiresAt]
      );
    },
    async getSession(id) {
      const { rows } = await client.query(
        "SELECT * FROM sessions WHERE id = $1 AND expires_at > $2",
        [id, Date.now()]
      );
      const r = rows[0];
      return r
        ? {
            id: r.id,
            userId: r.user_id,
            createdAt: Number(r.created_at),
            expiresAt: Number(r.expires_at),
          }
        : null;
    },
    async revokeSession(id) {
      await client.query("DELETE FROM sessions WHERE id = $1", [id]);
    },
    async revokeUserSessions(userId) {
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    },
    async deleteUser(userId) {
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    },
    async getUserByEmail(email) {
      const { rows } = await client.query(
        "SELECT * FROM users WHERE email = $1",
        [normEmail(email)]
      );
      return rows[0] ? toUser(rows[0]) : null;
    },
    async getUserById(id) {
      const { rows } = await client.query("SELECT * FROM users WHERE id = $1", [
        id,
      ]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async createUser(user) {
      await client.query(
        "INSERT INTO users (id, email, password_hash, plan, created_at) VALUES ($1, $2, $3, $4, $5)",
        [
          user.id,
          normEmail(user.email),
          user.passwordHash,
          user.plan,
          user.createdAt,
        ]
      );
    },
    async updateUser(user) {
      await client.query(
        "UPDATE users SET email = $2, password_hash = $3, plan = $4, created_at = $5 WHERE id = $1",
        [
          user.id,
          normEmail(user.email),
          user.passwordHash,
          user.plan,
          user.createdAt,
        ]
      );
    },
    async getSync(userId) {
      const { rows } = await client.query(
        "SELECT blob, updated_at FROM sync WHERE user_id = $1",
        [userId]
      );
      if (!rows[0]) return null;
      const blob =
        typeof rows[0].blob === "string"
          ? JSON.parse(rows[0].blob)
          : rows[0].blob;
      return { blob, updatedAt: Number(rows[0].updated_at) } as SyncRecord;
    },
    async mergeSync(userId, incoming) {
      if (!client.connect)
        throw new Error("Sync transactions require a connection pool");
      const connection = await client.connect();
      try {
        await connection.query("BEGIN");
        const locked = await connection.query(
          "SELECT * FROM users WHERE id = $1 FOR UPDATE",
          [userId]
        );
        if (!locked.rows[0]) throw new Error("account_missing");
        const tx = createPostgresStore(connection),
          previous = await tx.getSync(userId);
        const blob = {
            ...mergeBlobs(previous?.blob || null, incoming),
            plan: locked.rows[0].plan,
          },
          record = { blob, updatedAt: blob.updatedAt };
        await tx.setSync(userId, record);
        await connection.query("COMMIT");
        return record;
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    },
    async setSync(userId, record) {
      await client.query(
        `INSERT INTO sync (user_id, blob, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET blob = EXCLUDED.blob, updated_at = EXCLUDED.updated_at`,
        [userId, JSON.stringify(record.blob), record.updatedAt]
      );
    },
  };
}
