/** One merge policy for browser, web and API. Absence is not a deletion. */
export const collections = [
  "items",
  "lists",
  "sites",
  "notifications",
] as const;
export type Collection = (typeof collections)[number];
export interface SyncItem {
  id: string;
  updatedAt?: number;
  [key: string]: any;
}
export interface Tombstone {
  kind: Collection;
  id: string;
  deletedAt: number;
}
export interface SyncBlob {
  items: SyncItem[];
  lists?: SyncItem[];
  sites?: SyncItem[];
  notifications?: SyncItem[];
  tombstones?: Tombstone[];
  settings?: unknown;
  learn?: unknown;
  plan?: string;
  updatedAt: number;
}
const stable = (value: any): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, v[k]])
        )
      : v
  );
const time = (record: any) =>
  Number(record?.updatedAt || record?.createdAt || record?.ts || 0);
const winner = (a: any, b: any) =>
  time(a) !== time(b)
    ? time(a) > time(b)
      ? a
      : b
    : stable(a) > stable(b)
      ? a
      : b;
function memberships(list: SyncItem) {
  const out: Record<string, any> = Object.assign(
    Object.create(null),
    list.memberships
  );
  for (const id of list.itemIds || [])
    if (!out[id]) out[id] = { present: true, updatedAt: time(list) };
  return out;
}
function mergeList(a: SyncItem, b: SyncItem) {
  const chosen = winner(a, b),
    members = memberships(a);
  for (const [id, op] of Object.entries(memberships(b)))
    members[id] = members[id] ? winner(members[id], op) : op;
  const present = Object.keys(members).filter(id => members[id].present),
    order = [...(chosen.itemIds || []), ...present.sort()];
  return {
    ...a,
    ...b,
    ...chosen,
    memberships: members,
    itemIds: [...new Set(order)].filter(id => present.includes(id)),
  };
}
export function mergeBlobs(
  remote: SyncBlob | null,
  incoming: SyncBlob
): SyncBlob {
  const a = remote || { items: [], updatedAt: 0 },
    newer = winner(a, incoming),
    out = { ...a, ...incoming, ...newer } as SyncBlob;
  const deleted = new Map<string, Tombstone>();
  for (const d of [...(a.tombstones || []), ...(incoming.tombstones || [])]) {
    const key = d.kind + ":" + d.id,
      old = deleted.get(key);
    if (!old || d.deletedAt > old.deletedAt) deleted.set(key, d);
  }
  for (const kind of collections) {
    if (!a[kind] && !incoming[kind]) continue;
    const records = new Map<string, SyncItem>();
    for (const record of [...(a[kind] || []), ...(incoming[kind] || [])]) {
      const old = records.get(record.id);
      records.set(
        record.id,
        old
          ? kind === "lists"
            ? mergeList(old, record)
            : { ...old, ...record, ...winner(old, record) }
          : record
      );
    }
    out[kind] = [...records.values()]
      .filter(r => (deleted.get(kind + ":" + r.id)?.deletedAt ?? -1) < time(r))
      .sort((x, y) => x.id.localeCompare(y.id));
  }
  if (deleted.size)
    out.tombstones = [...deleted.values()].sort((x, y) =>
      (x.kind + ":" + x.id).localeCompare(y.kind + ":" + y.id)
    );
  const deletedItems = new Set(
    [...deleted.values()]
      .filter(d => d.kind === "items" && !out.items.some(i => i.id === d.id))
      .map(d => d.id)
  );
  if (out.lists)
    out.lists = out.lists.map(l => ({
      ...l,
      ...(l.itemIds
        ? { itemIds: l.itemIds.filter((id: string) => !deletedItems.has(id)) }
        : {}),
    }));
  out.updatedAt = Math.max(a.updatedAt || 0, incoming.updatedAt || 0);
  return out;
}
/** Stamp actual local edits once. Do not call this on a downloaded snapshot. */
export function stampChanges<T extends object>(
  previous: T,
  next: T,
  now = Date.now()
): T {
  const a = previous as any,
    b = { ...next } as any,
    tombstones = [...(b.tombstones || a.tombstones || [])];
  for (const kind of collections) {
    if (!b[kind]) continue;
    const old = new Map<string, SyncItem>(
        (a[kind] || []).map((r: SyncItem) => [r.id, r])
      ),
      ids = new Set(b[kind].map((r: SyncItem) => r.id));
    for (const record of a[kind] || [])
      if (!ids.has(record.id))
        tombstones.push({
          kind,
          id: record.id,
          deletedAt: Math.max(now, time(record) + 1),
        });
    b[kind] = b[kind].map((r: SyncItem) => {
      const prev = old.get(r.id);
      if (prev && stable(prev) === stable(r)) return r;
      const updatedAt = Math.max(now, time(prev) + 1, time(r));
      const result: SyncItem = { ...r, updatedAt };
      if (kind === "lists") {
        const members = prev ? memberships(prev) : Object.create(null),
          was = new Set<string>(prev?.itemIds || []),
          present = new Set<string>(r.itemIds || []);
        for (const id of new Set([...was, ...present]))
          if (was.has(id) !== present.has(id))
            members[id] = { present: present.has(id), updatedAt };
        result.memberships = members;
      }
      return result;
    });
  }
  const deleted = new Map<string, Tombstone>();
  for (const d of tombstones) {
    const key = d.kind + ":" + d.id;
    if (!deleted.has(key) || deleted.get(key)!.deletedAt < d.deletedAt)
      deleted.set(key, d);
  }
  if (deleted.size) b.tombstones = [...deleted.values()];
  b.updatedAt = now;
  return b;
}
