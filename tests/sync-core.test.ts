import { describe, it, expect } from "vitest";
import { mergeBlobs, stampChanges, type SyncBlob } from "../shared/sync-core";
const base: SyncBlob = {
  items: [
    { id: "a", updatedAt: 1 },
    { id: "b", updatedAt: 1 },
    { id: "c", updatedAt: 1 },
  ],
  lists: [{ id: "list", itemIds: ["a"], updatedAt: 1 }],
  updatedAt: 1,
};
describe("multi-device merge", () => {
  it("propagates deletions and does not revive them on a stale device", () => {
    const deleted = stampChanges(
      base,
      { ...base, items: base.items.filter(i => i.id !== "a") },
      10
    );
    const merged = mergeBlobs(base, deleted);
    expect(merged.items.map(i => i.id)).toEqual(["b", "c"]);
    expect(merged.lists![0].itemIds).toEqual([]);
    expect(mergeBlobs(merged, base).items.map(i => i.id)).toEqual(["b", "c"]);
  });
  it("allows deliberately adding an item after its deletion", () => {
    const deleted = stampChanges(base, { ...base, items: [] }, 10),
      restored = stampChanges(
        deleted,
        { ...deleted, items: [{ id: "a" }] },
        20
      );
    expect(mergeBlobs(deleted, restored).items.map(i => i.id)).toEqual(["a"]);
  });
  it("merges concurrent additions to the same list", () => {
    const a = stampChanges(
      base,
      { ...base, lists: [{ ...base.lists![0], itemIds: ["a", "b"] }] },
      10
    );
    const b = stampChanges(
      base,
      { ...base, lists: [{ ...base.lists![0], itemIds: ["a", "c"] }] },
      11
    );
    const merged = mergeBlobs(a, b);
    expect(new Set(merged.lists![0].itemIds)).toEqual(new Set(["a", "b", "c"]));
    expect(mergeBlobs(b, a)).toEqual(merged);
    expect(mergeBlobs(merged, merged)).toEqual(merged);
  });
  it("retains a membership removal when another device edits the list name", () => {
    const a = stampChanges(
      base,
      { ...base, lists: [{ ...base.lists![0], itemIds: [] }] },
      10
    );
    const b = stampChanges(
      base,
      { ...base, lists: [{ ...base.lists![0], name: "Renamed" }] },
      11
    );
    const merged = mergeBlobs(a, b);
    expect(merged.lists![0].itemIds).toEqual([]);
    expect(merged.lists![0].name).toBe("Renamed");
  });
  it("stamps favorites while leaving unrelated records untouched", () => {
    const next = stampChanges(
      base,
      {
        ...base,
        items: base.items.map(i =>
          i.id === "a" ? { ...i, favorite: true } : i
        ),
      },
      20
    );
    expect(next.items[0].updatedAt).toBe(20);
    expect(next.items[1].updatedAt).toBe(1);
    expect(mergeBlobs(base, next).items[0].favorite).toBe(true);
  });
  it("converges deterministically when timestamps tie", () => {
    const a = { ...base, items: [{ id: "a", title: "One", updatedAt: 3 }] },
      b = { ...base, items: [{ id: "a", title: "Two", updatedAt: 3 }] };
    expect(mergeBlobs(a, b)).toEqual(mergeBlobs(b, a));
  });
});
