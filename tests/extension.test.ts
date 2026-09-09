import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function worker(seed: Record<string, any> = {}) {
  const data: Record<string, any> = structuredClone(seed),
    listeners: any[] = [],
    installed: any[] = [];
  const local = {
    async get(key: string) {
      await new Promise(r => setTimeout(r, 1));
      return { [key]: structuredClone(data[key]) };
    },
    async set(values: any) {
      await new Promise(r => setTimeout(r, 1));
      Object.assign(data, structuredClone(values));
    },
  };
  const ctx = vm.createContext({
    console,
    crypto:globalThis.crypto,
    importScripts:()=>vm.runInContext(readFileSync(new URL("../sync-core.js",import.meta.url),"utf8"),ctx),
    URL,
    AbortController,
    AbortSignal,
    Date,
    Map,
    Set,
    setTimeout,
    clearTimeout,
    structuredClone,
    fetch: async () => {
      throw Error("Network not used by storage tests");
    },
    chrome: {
      storage: {
        local,
        sync: {
          async get() {
            return {};
          },
          async set() {},
        },
      },
      runtime: {
        onMessage: { addListener: (fn: any) => listeners.push(fn) },
        onInstalled: { addListener: (fn: any) => installed.push(fn) },
        getURL: (p: string) => "chrome-extension://test/" + p,
      },
      commands: { onCommand: { addListener() {} } },
      tabs: {
        async query() {
          return [];
        },
      },
    },
  });
  vm.runInContext(
    readFileSync(new URL("../background.js", import.meta.url), "utf8"),
    ctx
  );
  return {
    data,
    ctx,
    installed,
    call: (input: any) =>
      new Promise<any>(resolve => listeners[0](input, {}, resolve)),
    save: (input: any) => {
      ctx.input = input;
      return vm.runInContext("writeItem(input)", ctx);
    },
    run: (code: string) => vm.runInContext(code, ctx),
  };
}
const book = (title: string, more: any = {}) => ({
  title,
  type: "reading",
  enrichedAt: 1,
  domain: "reader.example",
  ...more,
});
describe("extension storage regressions", () => {
  it("preserves every simultaneous save", async () => {
    const w = worker();
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => w.save(book("Work " + i)))
    );
    expect(w.data["dasi.items"]).toHaveLength(12);
  });
  it("does not truncate a library above 800 works", async () => {
    const w = worker({
      "dasi.items": Array.from({ length: 805 }, (_, i) => ({
        ...book("Book " + i),
        id: "book-" + i,
      })),
    });
    await w.save(book("New title"));
    expect(w.data["dasi.items"]).toHaveLength(806);
  });
  it("keeps a show and its manga as separate records", async () => {
    const w = worker();
    await w.save(book("Solo Leveling"));
    await w.save(book("Solo Leveling", { type: "watching" }));
    expect(w.data["dasi.items"]).toHaveLength(2);
  });
  it("clamps known episode counts at save time", async () => {
    const w = worker();
    const r = await w.save(
      book("Alchemy of Souls", { type: "watching", episode: 847, total: 20 })
    );
    expect(r.item.episode).toBe(20);
    expect(r.item.total).toBe(20);
  });
  it("clamps direct updates and cannot overwrite the id", async () => {
    const w = worker();
    await w.save(
      book("Alchemy of Souls", { type: "watching", episode: 1, total: 20 })
    );
    await w.call({
      type: "UPDATE_ITEM",
      id: "alchemy-of-souls",
      patch: { id: "different-user", episode: 847 },
    });
    expect(w.data["dasi.items"][0].episode).toBe(20);
    expect(w.data["dasi.items"][0].id).toBe("alchemy-of-souls");
  });
  it("allows the first episode of the next season", async () => {
    const w = worker();
    await w.save(
      book("Series", { type: "watching", season: 1, episode: 20, total: 20 })
    );
    const r = await w.save(
      book("Series", { type: "watching", season: 2, episode: 1, total: 10 })
    );
    expect(r.item.season).toBe(2);
    expect(r.item.episode).toBe(1);
  });
  it("does not merge numbered sequels or distinct subtitles", () => {
    const w = worker();
    expect(w.run('sameWork("Grand Theft Auto V","Grand Theft Auto VI")')).toBe(
      false
    );
    expect(w.run('sameWork("Solo Leveling","Solo Leveling Ragnarok")')).toBe(
      false
    );
    expect(w.run('sameWork("Portal","Portal 2")')).toBe(false);
  });
  it("deduplicates Steam hardware and keeps titles containing ost", () => {
    const w = worker();
    w.ctx.games = [
      { id: "1", name: "Ghost of Tsushima" },
      { id: "1", name: "Ghost of Tsushima" },
      { id: "1675200", name: "Steam Deck" },
      { id: "2", name: "Game Soundtrack" },
    ];
    expect(w.run("steamGames(games,false).map(x=>x.title)")).toEqual([
      "Ghost of Tsushima",
    ]);
  });
  it("migrates legacy IDs and every list reference without dropping collisions", async () => {
    const w = worker({
      "dasi.schema": 1,
      "dasi.items": [
        { id: "my work", title: "My work" },
        { id: "my-work", title: "Other work" },
      ],
      "dasi.lists": [{ id: "list", itemIds: ["my work", "my-work"] }],
    });
    await w.installed[0]();
    expect(w.data["dasi.items"]).toHaveLength(2);
    expect(w.data["dasi.lists"][0].itemIds).toEqual(
      w.data["dasi.items"].map((i: any) => i.id)
    );
    expect(w.data["dasi.migrationBackup.v1"].items).toHaveLength(2);
  });
  it("preserves profile, session and memberships across an update", async () => {
    const seed = {
      "dasi.schema": 2,
      "dasi.items": [
        { id: "my-work", title: "My work", type: "reading", chapter: 12 },
      ],
      "dasi.lists": [{ id: "list", itemIds: ["my-work"] }],
      "dasi.settings": { lang: "fr", profile: { name: "Reader" } },
      "dasi.sync.config": { token: "test-session" },
    };
    const w = worker(seed);
    await w.installed[0]();
    for (const [key, value] of Object.entries(seed))
      if (key !== "dasi.schema") expect(w.data[key]).toEqual(value);
  });
  it("keeps simultaneous list creation and membership saves", async () => {
    const w = worker();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        w.call({ type: "LIST_CREATE", name: "List " + i })
      )
    );
    expect(w.data["dasi.lists"]).toHaveLength(8);
    const id = w.data["dasi.lists"][0].id;
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        w.call({
          type: "SAVE_PROGRESS",
          payload: book("Entry " + i),
          listId: id,
        })
      )
    );
    expect(w.data["dasi.lists"][0].itemIds).toHaveLength(8);
  });
  it("imports more than 2000 works without truncation or adaptation collisions", async () => {
    const w = worker({
      "dasi.items": Array.from({ length: 2001 }, (_, i) => ({
        ...book("Book " + i),
        id: "book-" + i,
      })),
    });
    await w.call({
      type: "IMPORT_MERGE",
      items: [book("New work"), book("New work", { type: "watching" })],
    });
    expect(w.data["dasi.items"]).toHaveLength(2003);
  });
  it("merges backups additively and remaps list references", async () => {
    const w = worker({
      "dasi.items": [{ id: "kept", ...book("Existing work") }],
      "dasi.lists": [{ id: "original", name: "Original", itemIds: ["kept"] }],
    });
    const r = await w.call({
      type: "IMPORT_STATE",
      payload: {
        items: [{ id: "imported", ...book("Existing work") }],
        lists: [{ id: "import-list", name: "Imported", itemIds: ["imported"] }],
      },
    });
    expect(r.ok).toBe(true);
    expect(w.data["dasi.items"]).toHaveLength(1);
    expect(w.data["dasi.lists"]).toHaveLength(2);
    expect(w.data["dasi.lists"][1].itemIds).toEqual(["kept"]);
  });
  it("imports season 2 episode 1 without carrying season 1 episode 20", async () => {
    const w = worker();
    await w.call({
      type: "IMPORT_MERGE",
      items: [
        { title: "Show", type: "watching", season: 1, episode: 20 },
        { title: "Show", type: "watching", season: 2, episode: 1 },
      ],
    });
    expect(w.data["dasi.items"][0].season).toBe(2);
    expect(w.data["dasi.items"][0].episode).toBe(1);
  });
  it("keeps known remakes with different years separate", async () => {
    const w = worker();
    await w.call({
      type: "IMPORT_MERGE",
      items: [book("Remake", { year: 1998 }), book("Remake", { year: 2026 })],
    });
    expect(w.data["dasi.items"]).toHaveLength(2);
  });
  it("removes deleted works from their lists", async () => {
    const w = worker({
      "dasi.items": [{ id: "gone", ...book("Work") }],
      "dasi.lists": [{ id: "list", itemIds: ["gone"] }],
    });
    await w.call({ type: "REMOVE_ITEM", id: "gone" });
    expect(w.data["dasi.lists"][0].itemIds).toEqual([]);
  });
});


describe("extension account isolation",()=>{
  const cfg=(id:string)=>({apiUrl:'https://sync.example/api',userId:id,email:id+'@example.com',token:id});
  it('retains guest, A and B libraries separately through account switches',async()=>{
    const w=worker({'dasi.items':[{id:'guest-book'}]});
    for(const id of ['a','b']){
      w.ctx.next=cfg(id);await w.run('serializeLibrary(()=>switchSyncAccount(next))');
      expect(w.data['dasi.items']).toEqual([]);
      await w.save(book('Book '+id));
    }
    w.ctx.next=cfg('a');await w.run('serializeLibrary(()=>switchSyncAccount(next))');
    expect(w.data['dasi.items'].map((i:any)=>i.title)).toEqual(['Book a']);
    w.ctx.fetch=async()=>({ok:true,status:200});
    await w.call({type:'SYNC_SIGN_OUT'});
    expect(w.data['dasi.items']).toEqual([{id:'guest-book'}]);
    expect(w.data['dasi.sync.config']).toBeNull();
  });
  it('migrates an existing signed-in library when the server supplies its user id',async()=>{
    const w=worker({'dasi.items':[{id:'existing'}],'dasi.sync.config':{apiUrl:'https://sync.example/api',email:'a@example.com',token:'old'}});
    w.ctx.next=cfg('a');await w.run('serializeLibrary(()=>switchSyncAccount(next))');
    expect(w.data['dasi.items']).toEqual([{id:'existing'}]);
  });
  it('discards an old account response arriving after sign-out',async()=>{
    const w=worker({'dasi.items':[{id:'a-book'}],'dasi.sync.config':cfg('a')});
    let respond:any;w.ctx.fetch=()=>new Promise(resolve=>respond=resolve);
    const pending=w.run('syncNow()');
    while(!respond)await new Promise(resolve=>setTimeout(resolve,1));
    await w.run('serializeLibrary(()=>switchSyncAccount(null))');
    respond({ok:true,status:200,json:async()=>({blob:{items:[{id:'private-a'}]}})});
    await expect(pending).rejects.toThrow('account_changed');
    expect(w.data['dasi.items']).toEqual([]);
  });
});

describe('list archive and duplication',()=>{
 it('copies membership independently and archives without removing library items',async()=>{
  const w=worker({'dasi.items':[{id:'a',title:'Saved',type:'reading'}],'dasi.lists':[{id:'l',name:'Original',itemIds:['a']}]});
  const copy=await w.call({type:'LIST_DUPLICATE',id:'l'});expect(copy.ok).toBe(true);expect(copy.list.itemIds).toEqual(['a']);expect(copy.list.id).not.toBe('l');
  await w.call({type:'LIST_SET_ITEMS',id:copy.list.id,itemIds:[]});const archive=await w.call({type:'LIST_UPDATE',id:copy.list.id,patch:{archived:true}});expect(archive.lists.find((l:any)=>l.id==='l').itemIds).toEqual(['a']);expect(archive.lists.find((l:any)=>l.id===copy.list.id).archived).toBe(true);
 });
});
it('syncs the profile without uploading technical settings',async()=>{
 const w=worker({'dasi.items':[],'dasi.settings':{ocrKey:'local-test-value',profile:{name:'Local',updatedAt:1}},'dasi.sync.config':{apiUrl:'https://sync.example/api',userId:'a',token:'a'}});let pushed:any;
 w.ctx.fetch=async(_url:any,init:any)=>{if(init?.method==='PUT'){pushed=JSON.parse(init.body);return {ok:true,status:200};}return {ok:true,status:200,json:async()=>({blob:{items:[],updatedAt:20,profile:{name:'Remote',bio:'Biography',updatedAt:20}}})};};
 await w.run('syncNow()');expect(w.data['dasi.settings'].profile.name).toBe('Remote');expect(w.data['dasi.settings'].ocrKey).toBe('local-test-value');expect(pushed.blob.profile.bio).toBe('Biography');expect(JSON.stringify(pushed)).not.toContain('local-test-value');
});
