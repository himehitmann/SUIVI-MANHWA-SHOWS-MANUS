import type { DasiState } from "./types";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const LEGACY = "dasi.state.v1",
  MIGRATED = "yomu.accountStorage.v1";
export const accountKey = (owner: string | null) =>
  "yomu.library.v1:" + encodeURIComponent(owner || "guest");
/** Separate caches survive sign-out, but are never uploaded into a different account. */
export function createAccountStorage(
  storage: StorageLike,
  initialOwner: string | null,
  empty: () => DasiState
) {
  if (!storage.getItem(MIGRATED)) {
    const legacy = storage.getItem(LEGACY);
    if (legacy && !storage.getItem(accountKey(initialOwner)))
      storage.setItem(accountKey(initialOwner), legacy);
    storage.setItem(MIGRATED, "1");
  }
  return {
    load(owner: string | null): DasiState {
      const raw = storage.getItem(accountKey(owner));
      if (!raw) return empty();
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed.version !== 1 ||
          !Array.isArray(parsed.items) ||
          !Array.isArray(parsed.lists)
        )
          throw Error("invalid_library");
        return parsed;
      } catch {
        throw Error("library_unreadable");
      }
    },
    save(owner: string | null, state: DasiState) {
      storage.setItem(accountKey(owner), JSON.stringify(state));
    },
  };
}
