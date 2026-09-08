import { describe, expect, it } from "vitest";
import { createPostgresStore, ensureSchema, type SqlClient } from "../server/lib/store-postgres";

/**
 * A tiny in-memory Postgres stand-in: it understands just the handful of SQL
 * statements the adapter issues, so we test the adapter's SQL/params and row
 * mapping without a real database.
 */
function fakePg() {
  const users: any[] = [];
  const sync: Record<string, { blob: any; updated_at: number }> = {};
  const log: string[] = [];
  const client: SqlClient = {
    async query(text, params = []) {
      log.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
      const t = text.trim();
      if (t.startsWith("CREATE TABLE")) return { rows: [] };
      if (t.startsWith("SELECT * FROM users WHERE email")) return { rows: users.filter((u) => u.email === params[0]) };
      if (t.startsWith("SELECT * FROM users WHERE id")) return { rows: users.filter((u) => u.id === params[0]) };
      if (t.startsWith("INSERT INTO users")) {
        users.push({ id: params[0], email: params[1], password_hash: params[2], plan: params[3], created_at: params[4] });
        return { rows: [] };
      }
      if (t.startsWith("UPDATE users")) {
        const u = users.find((x) => x.id === params[0]);
        if (u) Object.assign(u, { email: params[1], password_hash: params[2], plan: params[3], created_at: params[4] });
        return { rows: [] };
      }
      if (t.startsWith("SELECT blob")) {
        const r = sync[params[0] as string];
        return { rows: r ? [{ blob: r.blob, updated_at: r.updated_at }] : [] };
      }
      if (t.startsWith("INSERT INTO sync")) {
        sync[params[0] as string] = { blob: JSON.parse(params[1] as string), updated_at: params[2] as number };
        return { rows: [] };
      }
      throw new Error("unexpected SQL: " + t.slice(0, 40));
    },
  };
  return { client, users, sync, log };
}

describe("postgres store adapter", () => {
  it("creates its schema", async () => {
    const { client, log } = fakePg();
    await ensureSchema(client);
    expect(log.filter((l) => l.startsWith("CREATE TABLE")).length).toBe(3);
  });

  it("round-trips a user and normalizes email", async () => {
    const { client } = fakePg();
    const store = createPostgresStore(client);
    await store.createUser({ id: "u1", email: "  Reader@Example.com ", passwordHash: "h", plan: "free", createdAt: 42 });
    const byEmail = await store.getUserByEmail("reader@example.com");
    expect(byEmail?.id).toBe("u1");
    expect(byEmail?.createdAt).toBe(42);
    const byId = await store.getUserById("u1");
    expect(byId?.email).toBe("reader@example.com");
  });

  it("updates a user's plan", async () => {
    const { client } = fakePg();
    const store = createPostgresStore(client);
    await store.createUser({ id: "u2", email: "a@b.c", passwordHash: "h", plan: "free", createdAt: 1 });
    await store.updateUser({ id: "u2", email: "a@b.c", passwordHash: "h", plan: "pro", createdAt: 1 });
    expect((await store.getUserById("u2"))?.plan).toBe("pro");
  });

  it("upserts and reads a sync blob", async () => {
    const { client } = fakePg();
    const store = createPostgresStore(client);
    const blob = { items: [{ id: "x", updatedAt: 5 }], updatedAt: 5 };
    await store.setSync("u3", { blob, updatedAt: 5 });
    const got = await store.getSync("u3");
    expect(got?.blob.items[0].id).toBe("x");
    expect(got?.updatedAt).toBe(5);
    expect(await store.getSync("missing")).toBeNull();
  });
});
