import { describe, expect, it } from "vitest";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../server/lib/crypto";
import { mergeBlobs, type SyncBlob } from "../server/lib/merge";

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

  it("uses last-writer-wins for lists/plan by top-level updatedAt", () => {
    const remote = base({ items: [], lists: [{ id: "L1" }], plan: "free", updatedAt: 1 });
    const incoming = base({ items: [], lists: [{ id: "L2" }], plan: "pro", updatedAt: 9 });
    const merged = mergeBlobs(remote, incoming);
    expect(merged.plan).toBe("pro");
    expect(merged.lists).toEqual([{ id: "L2" }]);
  });
});
