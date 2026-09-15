import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiRouter } from "../server/api";
import { createStore } from "../server/lib/store";
let server: Server, base: string;
beforeEach(async () => {
  const app = express();
  app.use("/api", createApiRouter(createStore()));
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = "http://127.0.0.1:" + String((server.address() as any).port) + "/api";
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(e => (e ? reject(e) : resolve()))
  );
});
const call = (route: string, body?: any, token?: string, headers: any = {}) =>
  fetch(base + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
describe("real HTTP API security", () => {
  it("isolates account libraries and refuses client-supplied paid plans", async () => {
    const a = await (
      await call("/auth/signup", {
        email: "alice@example.test",
        password: "a-safe-test-password",
      })
    ).json();
    const b = await (
      await call("/auth/signup", {
        email: "bob@example.test",
        password: "b-safe-test-password",
      })
    ).json();
    expect(a.token).toBeTruthy();
    expect(b.token).toBeTruthy();
    const stored = await fetch(base + "/sync", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + a.token,
      },
      body: JSON.stringify({
        blob: {
          items: [{ id: "alice-private", updatedAt: 1 }],
          plan: "pro",
          updatedAt: 1,
        },
      }),
    });
    expect(stored.status).toBe(200);
    expect((await stored.json()).blob.plan).toBe("free");
    expect(
      (await (await call("/sync", undefined, b.token)).json()).blob
    ).toBeNull();
    expect((await call("/sync")).status).toBe(401);
  });
  it("rejects untrusted browser origins", async () => {
    expect(
      (
        await call("/me", undefined, undefined, {
          Origin: "https://attacker.invalid",
        })
      ).status
    ).toBe(403);
  });
  it("handles malformed credential types without crashing", async () => {
    expect(
      (await call("/auth/login", { email: { bad: 1 }, password: [] })).status
    ).toBe(400);
  });
  it("enforces rate limits despite spoofed forwarded addresses", async () => {
    let response: Response;
    for (let i = 0; i < 12; i++)
      response = await call(
        "/auth/login",
        { email: "missing@example.test", password: "wrong" },
        undefined,
        { "X-Forwarded-For": "10.0.0." + i }
      );
    expect(response!.status).toBe(429);
  });
  it("rejects invalid sync records before storage", async () => {
    const a = await (
      await call("/auth/signup", {
        email: "validation@example.test",
        password: "validation-password",
      })
    ).json();
    const response = await fetch(base + "/sync", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + a.token,
      },
      body: JSON.stringify({ blob: { items: [{ id: 42 }], updatedAt: 1 } }),
    });
    expect(response.status).toBe(400);
  });
});
describe("persistent account file", () => {
  it("does not replace a corrupt database with an empty one", () => {
    const dir = mkdtempSync(join(tmpdir(), "yomu-store-"));
    const file = join(dir, "accounts.json");
    writeFileSync(file, "broken existing data");
    try {
      expect(() => createStore(file)).toThrow("unreadable");
      expect(readFileSync(file, "utf8")).toBe("broken existing data");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

it("keeps independently uploaded records under concurrent requests", async () => {
  const account = await (
    await call("/auth/signup", {
      email: "concurrent@example.com",
      password: "safe-test-password",
    })
  ).json();
  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      fetch(base + "/sync", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + account.token,
        },
        body: JSON.stringify({
          blob: {
            items: [{ id: "work-" + i, updatedAt: i + 1 }],
            updatedAt: i + 1,
          },
        }),
      })
    )
  );
  expect(responses.every(r => r.ok)).toBe(true);
  const state = await (await call("/sync", undefined, account.token)).json();
  expect(state.blob.items).toHaveLength(12);
});

it("revokes this session on logout without disconnecting another device", async () => {
  const credentials = {
    email: "sessions@example.com",
    password: "safe-session-password",
  };
  const first = await (await call("/auth/signup", credentials)).json(),
    second = await (await call("/auth/login", credentials)).json();
  expect((await call("/auth/logout", {}, first.token)).ok).toBe(true);
  expect((await call("/me", undefined, first.token)).status).toBe(401);
  expect((await call("/me", undefined, second.token)).status).toBe(200);
});
it("invalidates old sessions after a password change and keeps the replacement valid", async () => {
  const credentials = {
    email: "password@example.com",
    password: "old-safe-password",
  };
  const first = await (await call("/auth/signup", credentials)).json(),
    second = await (await call("/auth/login", credentials)).json();
  const changed = await (
    await call(
      "/auth/password",
      { current: credentials.password, next: "new-safe-password" },
      first.token
    )
  ).json();
  expect(changed.token).toBeTruthy();
  for (const token of [first.token, second.token])
    expect((await call("/sync", undefined, token)).status).toBe(401);
  expect((await call("/me", undefined, changed.token)).status).toBe(200);
});
it("requires the password for email changes and account deletion", async () => {
  const a = await (
    await call("/auth/signup", {
      email: "delete@example.com",
      password: "delete-safe-password",
    })
  ).json();
  expect(
    (await call("/auth/email", { email: "changed@example.com" }, a.token))
      .status
  ).toBe(401);
  expect(
    (await call("/auth/delete", { current: "wrong" }, a.token)).status
  ).toBe(401);
  expect(
    (await call("/auth/delete", { current: "delete-safe-password" }, a.token))
      .status
  ).toBe(200);
  expect((await call("/me", undefined, a.token)).status).toBe(401);
});
