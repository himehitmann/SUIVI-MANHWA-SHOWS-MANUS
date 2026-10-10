import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiRouter, createRequestLimiter } from "../server/api";
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

describe("private response caching and resource limits",()=>{
  it("marks successes, auth failures and parser errors as non-cacheable",async()=>{
    const created=await call("/auth/signup",{email:"cache@example.test",password:"cache-test-password"});
    expect(created.headers.get("cache-control")).toBe("no-store");const account=await created.json();
    const results=[await call("/me",undefined,account.token),await call("/sync",undefined,account.token),await call("/sync"),await call("/auth/login",{email:[],password:[]}),await fetch(base+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"}),await call("/auth/login",{large:"a".repeat(2100000)})];
    expect(results.map(r=>r.status)).toEqual([200,200,401,400,400,413]);
    for(const result of results){expect(result.headers.get("cache-control")).toBe("no-store");expect(result.headers.get("vary")).toContain("Origin");}
  });
  it("shares login limits across route case and trailing-slash variants",async()=>{
    let last:Response|undefined;
    for(let i=0;i<12;i++)last=await call(i%2?"/AUTH/LOGIN/":"/auth/login",{email:"missing@example.test",password:"wrong"});
    expect(last!.status).toBe(429);expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);expect(last!.headers.get("cache-control")).toBe("no-store");
  });
  it("expires limiter entries without requiring a signup",()=>{
    let now=100000;const limiter=createRequestLimiter(()=>now,3);
    for(const id of ["catalog:a","login:b","sync:c"])expect(limiter.check(id,1).allowed).toBe(true);
    now+=61000;expect(limiter.check("catalog:d",1).allowed).toBe(true);expect(limiter.size()).toBe(1);
  });
  it("bounds limiter memory without resetting active blocked clients",()=>{
    const limiter=createRequestLimiter(()=>100000,2);
    expect(limiter.check("blocked",1).allowed).toBe(true);expect(limiter.check("blocked",1).allowed).toBe(false);
    expect(limiter.check("second",1).allowed).toBe(true);
    for(let n=0;n<100;n++)expect(limiter.check("new:"+n,1).allowed).toBe(false);
    expect(limiter.size()).toBe(2);expect(limiter.check("blocked",1).allowed).toBe(false);
  });
  it("limits sync per account without exhausting another account",async()=>{
    const a=await(await call("/auth/signup",{email:"quota-a@example.test",password:"quota-safe-password"})).json();
    const b=await(await call("/auth/signup",{email:"quota-b@example.test",password:"quota-safe-password"})).json();
    let last:Response|undefined;for(let n=0;n<121;n++)last=await call("/sync",undefined,a.token);
    expect(last!.status).toBe(429);expect((await call("/sync",undefined,b.token)).status).toBe(200);
  });
});


it('rejects incorrect passwords on every sensitive route after async migration',async()=>{
 const credentials={email:'password-guards@example.test',password:'original-password'};
 const account=await(await call('/auth/signup',credentials)).json();
 expect((await call('/auth/login',{...credentials,password:'wrong-password'})).status).toBe(401);
 expect((await call('/auth/email',{email:'changed@example.test',current:'wrong-password'},account.token)).status).toBe(401);
 expect((await call('/auth/password',{current:'wrong-password',next:'changed-password'},account.token)).status).toBe(401);
 expect((await call('/auth/delete',{current:'wrong-password'},account.token)).status).toBe(401);
 const me=await(await call('/me',undefined,account.token)).json();expect(me.user.email).toBe(credentials.email);
 expect((await call('/auth/login',credentials)).status).toBe(200);
});

