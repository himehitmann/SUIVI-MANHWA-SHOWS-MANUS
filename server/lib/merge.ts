/**
 * Sync merge policy (pure, testable).
 *
 * Items merge at the item level: the copy with the greater `updatedAt` wins, so
 * two devices editing different works never clobber each other. Lists, sites,
 * notifications and plan use last-writer-wins on the blob's top-level
 * `updatedAt` — good enough for a personal v1 and easy to reason about.
 */
export interface SyncItem {
  id: string;
  updatedAt?: number;
  [k: string]: unknown;
}

export interface SyncBlob {
  items: SyncItem[];
  lists?: unknown[];
  sites?: unknown[];
  notifications?: unknown[];
  plan?: string;
  learn?: unknown;
  updatedAt: number;
}

export function mergeBlobs(remote: SyncBlob | null, incoming: SyncBlob): SyncBlob {
  if (!remote) return incoming;

  const byId = new Map<string, SyncItem>();
  for (const it of remote.items || []) byId.set(it.id, it);
  for (const it of incoming.items || []) {
    const prev = byId.get(it.id);
    if (!prev || (it.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) byId.set(it.id, it);
  }

  const newer = incoming.updatedAt >= remote.updatedAt ? incoming : remote;
  return {
    items: Array.from(byId.values()),
    lists: newer.lists ?? remote.lists ?? [],
    sites: newer.sites ?? remote.sites ?? [],
    notifications: newer.notifications ?? remote.notifications ?? [],
    plan: newer.plan ?? remote.plan,
    learn: newer.learn ?? remote.learn,
    updatedAt: Math.max(remote.updatedAt, incoming.updatedAt),
  };
}
