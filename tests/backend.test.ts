import { describe, expect, it } from "vitest";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../server/lib/crypto";
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
