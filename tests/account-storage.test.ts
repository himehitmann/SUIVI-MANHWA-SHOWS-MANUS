import { describe, it, expect } from "vitest";
import {
  createAccountStorage,
  accountKey,
} from "../client/src/lib/account-storage";
import { seedState } from "../client/src/lib/seed";
const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
};
describe("account cache", () => {
  it("isolates accounts, guest and different API origins", () => {
    const storage = memory(),
      cache = createAccountStorage(storage, null, seedState);
    const a = { ...seedState(), plan: "pro" as const };
    cache.save("https://a|1", a);
    for (const owner of [null, "https://a|2", "https://b|1"])
      expect(cache.load(owner).plan).toBe("free");
    expect(cache.load("https://a|1").plan).toBe("pro");
  });
  it("migrates legacy data once and retains the original backup", () => {
    const storage = memory(),
      raw = JSON.stringify({ ...seedState(), plan: "pro" });
    storage.setItem("dasi.state.v1", raw);
    expect(createAccountStorage(storage, "a", seedState).load("a").plan).toBe(
      "pro"
    );
    expect(createAccountStorage(storage, "b", seedState).load("b").plan).toBe(
      "free"
    );
    expect(storage.getItem("dasi.state.v1")).toBe(raw);
  });
  it("refuses to overwrite unreadable libraries", () => {
    const storage = memory(),
      cache = createAccountStorage(storage, null, seedState);
    storage.setItem(accountKey("a"), "{bad");
    expect(() => cache.load("a")).toThrow("library_unreadable");
    expect(storage.getItem(accountKey("a"))).toBe("{bad");
  });
});
