import { describe, expect, it } from "vitest";
import { hashPassword, hashPasswordAsync, verifyPasswordAsync, createPasswordLimiter, signToken, verifyPassword, verifyToken } from "../server/lib/crypto";
import { mergeBlobs, type SyncBlob } from "../server/lib/merge";
import { createStore } from "../server/lib/store";

describe("password hashing", () => {
  it("verifies the correct password and rejects wrong ones", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });
  it("produces a different salt each time", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
});

describe("session tokens", () => {
  const secret = "test-secret";
  it("round-trips a payload", () => {
    const token = signToken({ sub: "u1" }, secret);
    expect(verifyToken(token, secret)?.sub).toBe("u1");
  });
  it("rejects a tampered token", () => {
    const token = signToken({ sub: "u1" }, secret);
    expect(verifyToken(token + "x", secret)).toBeNull();
    expect(verifyToken(token, "other-secret")).toBeNull();
  });
  it("rejects an expired token", () => {
    const token = signToken({ sub: "u1" }, secret, -1);
    expect(verifyToken(token, secret)).toBeNull();
  });
});

describe("sync merge", () => {
  const base = (over: Partial<SyncBlob>): SyncBlob => ({ items: [], updatedAt: 0, ...over });

  it("takes incoming when there is no remote", () => {
    const incoming = base({ items: [{ id: "a", updatedAt: 1 }], updatedAt: 5 });
    expect(mergeBlobs(null, incoming)).toEqual(incoming);
  });

  it("keeps the item with the greater updatedAt (no clobber across devices)", () => {
    const remote = base({ items: [{ id: "a", updatedAt: 10, v: "old" }, { id: "b", updatedAt: 3 }], updatedAt: 10 });
    const incoming = base({ items: [{ id: "a", updatedAt: 4, v: "stale" }, { id: "c", updatedAt: 7 }], updatedAt: 7 });
    const merged = mergeBlobs(remote, incoming);
    const a = merged.items.find((i) => i.id === "a");
    expect(a?.v).toBe("old"); // remote a is newer, preserved
    expect(merged.items.map((i) => i.id).sort()).toEqual(["a", "b", "c"]); // union
    expect(merged.updatedAt).toBe(10);
  });

  it("unions independently created lists and uses latest plan", () => {
    const remote = base({ items: [], lists: [{ id: "L1" }], plan: "free", updatedAt: 1 });
    const incoming = base({ items: [], lists: [{ id: "L2" }], plan: "pro", updatedAt: 9 });
    const merged = mergeBlobs(remote, incoming);
    expect(merged.plan).toBe("pro");
    expect(merged.lists).toEqual([{id:"L1"},{id:"L2"}]);
  });
});

describe("account changes (email / password)", () => {
  const mkUser = (email: string, pw: string) => ({ id: crypto.randomUUID(), email, passwordHash: hashPassword(pw), plan: "free" as const, createdAt: Date.now() });

  it("changes the password and invalidates the old one", async () => {
    const store = createStore();
    const user = mkUser("a@x.com", "oldpass12");
    await store.createUser(user);
    // rotate: verify current, then persist a new hash (mirrors /auth/password)
    expect(verifyPassword("oldpass12", user.passwordHash)).toBe(true);
    await store.updateUser({ ...user, passwordHash: hashPassword("newpass34") });
    const after = await store.getUserById(user.id);
    expect(verifyPassword("newpass34", after!.passwordHash)).toBe(true);
    expect(verifyPassword("oldpass12", after!.passwordHash)).toBe(false);
  });

  it("changes the email but refuses one already taken", async () => {
    const store = createStore();
    const a = mkUser("a@x.com", "pass1234");
    const b = mkUser("b@x.com", "pass1234");
    await store.createUser(a);
    await store.createUser(b);
    // b tries to take a's email → clash detected (mirrors /auth/email guard)
    const clash = await store.getUserByEmail("a@x.com");
    expect(clash && clash.id !== b.id).toBe(true);
    // a moves to a free address → succeeds and is findable
    await store.updateUser({ ...a, email: "a2@x.com" });
    expect((await store.getUserByEmail("a2@x.com"))?.id).toBe(a.id);
    expect(await store.getUserByEmail("a@x.com")).toBeNull();
  });
});

describe('bounded asynchronous password processing',()=>{
 it('keeps existing passwords compatible in both directions',async()=>{
  const password='A unicode password: 日本語 é';
  expect(await verifyPasswordAsync(password,hashPassword(password))).toBe(true);
  const asyncHash=await hashPasswordAsync(password);
  expect(verifyPassword(password,asyncHash)).toBe(true);
  expect(await verifyPasswordAsync('wrong',asyncHash)).toBe(false);
  expect(await hashPasswordAsync(password)).not.toBe(asyncHash);
 });
 it('rejects malformed stored hashes before costly work',async()=>{
  for(const hash of [null,undefined,'','00:00','g'.repeat(32)+':'+ '0'.repeat(128),'0'.repeat(32)+':'+ '0'.repeat(128)+':extra'])expect(await verifyPasswordAsync('password',hash)).toBe(false);
 });
 it('bounds active work and queue, preserves FIFO, and recovers after errors',async()=>{
  const run=createPasswordLimiter(1,1),order:number[]=[];let release!:()=>void;
  const first=run(()=>new Promise<void>(resolve=>{order.push(1);release=resolve;}));
  const second=run(async()=>{order.push(2);throw Error('test_failure');});
  const checked=expect(second).rejects.toThrow('test_failure');
  await expect(run(async()=>3)).rejects.toMatchObject({code:'auth_busy'});
  expect(order).toEqual([1]);release();await first;await checked;expect(order).toEqual([1,2]);
  expect(await run(async()=>4)).toBe(4);
 });
});

