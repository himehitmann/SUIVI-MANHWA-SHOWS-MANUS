// Generated from shared/sync-core.ts by pnpm build:sync. Do not edit.
"use strict";
var YomuSync = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // shared/sync-core.ts
  var sync_core_exports = {};
  __export(sync_core_exports, {
    collections: () => collections,
    mergeBlobs: () => mergeBlobs,
    stampChanges: () => stampChanges
  });
  var collections = [
    "items",
    "lists",
    "sites",
    "notifications"
  ];
  var stable = (value) => JSON.stringify(
    value,
    (_key, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(
      Object.keys(v).sort().map((k) => [k, v[k]])
    ) : v
  );
  var time = (record) => Number(record?.updatedAt || record?.createdAt || record?.ts || 0);
  var winner = (a, b) => time(a) !== time(b) ? time(a) > time(b) ? a : b : stable(a) > stable(b) ? a : b;
  function memberships(list) {
    const out = Object.assign(
      /* @__PURE__ */ Object.create(null),
      list.memberships
    );
    for (const id of list.itemIds || [])
      if (!out[id]) out[id] = { present: true, updatedAt: time(list) };
    return out;
  }
  function mergeList(a, b) {
    const chosen = winner(a, b), members = memberships(a);
    for (const [id, op] of Object.entries(memberships(b)))
      members[id] = members[id] ? winner(members[id], op) : op;
    const present = Object.keys(members).filter((id) => members[id].present), order = [...chosen.itemIds || [], ...present.sort()];
    return {
      ...a,
      ...b,
      ...chosen,
      memberships: members,
      itemIds: [...new Set(order)].filter((id) => present.includes(id))
    };
  }
  function mergeBlobs(remote, incoming) {
    const a = remote || { items: [], updatedAt: 0 }, newer = winner(a, incoming), out = { ...a, ...incoming, ...newer };
    const deleted = /* @__PURE__ */ new Map();
    for (const d of [...a.tombstones || [], ...incoming.tombstones || []]) {
      const key = d.kind + ":" + d.id, old = deleted.get(key);
      if (!old || d.deletedAt > old.deletedAt) deleted.set(key, d);
    }
    for (const kind of collections) {
      if (!a[kind] && !incoming[kind]) continue;
      const records = /* @__PURE__ */ new Map();
      for (const record of [...a[kind] || [], ...incoming[kind] || []]) {
        const old = records.get(record.id);
        records.set(
          record.id,
          old ? kind === "lists" ? mergeList(old, record) : { ...old, ...record, ...winner(old, record) } : record
        );
      }
      out[kind] = [...records.values()].filter((r) => (deleted.get(kind + ":" + r.id)?.deletedAt ?? -1) < time(r)).sort((x, y) => x.id.localeCompare(y.id));
    }
    if (deleted.size)
      out.tombstones = [...deleted.values()].sort(
        (x, y) => (x.kind + ":" + x.id).localeCompare(y.kind + ":" + y.id)
      );
    const deletedItems = new Set(
      [...deleted.values()].filter((d) => d.kind === "items" && !out.items.some((i) => i.id === d.id)).map((d) => d.id)
    );
    if (out.lists)
      out.lists = out.lists.map((l) => ({
        ...l,
        ...l.itemIds ? { itemIds: l.itemIds.filter((id) => !deletedItems.has(id)) } : {}
      }));
    out.updatedAt = Math.max(a.updatedAt || 0, incoming.updatedAt || 0);
    return out;
  }
  function stampChanges(previous, next, now = Date.now()) {
    const a = previous, b = { ...next }, tombstones = [...b.tombstones || a.tombstones || []];
    for (const kind of collections) {
      if (!b[kind]) continue;
      const old = new Map(
        (a[kind] || []).map((r) => [r.id, r])
      ), ids = new Set(b[kind].map((r) => r.id));
      for (const record of a[kind] || [])
        if (!ids.has(record.id))
          tombstones.push({
            kind,
            id: record.id,
            deletedAt: Math.max(now, time(record) + 1)
          });
      b[kind] = b[kind].map((r) => {
        const prev = old.get(r.id);
        if (prev && stable(prev) === stable(r)) return r;
        const updatedAt = Math.max(now, time(prev) + 1, time(r));
        const result = { ...r, updatedAt };
        if (kind === "lists") {
          const members = prev ? memberships(prev) : {}, was = new Set(prev?.itemIds || []), present = new Set(r.itemIds || []);
          for (const id of /* @__PURE__ */ new Set([...was, ...present]))
            if (was.has(id) !== present.has(id))
              members[id] = { present: present.has(id), updatedAt };
          result.memberships = members;
        }
        return result;
      });
    }
    const deleted = /* @__PURE__ */ new Map();
    for (const d of tombstones) {
      const key = d.kind + ":" + d.id;
      if (!deleted.has(key) || deleted.get(key).deletedAt < d.deletedAt)
        deleted.set(key, d);
    }
    if (deleted.size) b.tombstones = [...deleted.values()];
    b.updatedAt = now;
    return b;
  }
  return __toCommonJS(sync_core_exports);
})();
