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
it('retries failed background sync after its backoff without losing saved data',async()=>{
 const w=worker({'dasi.items':[{id:'saved',title:'Saved',updatedAt:1}],'dasi.sync.config':{apiUrl:'https://sync.example/api',userId:'a',token:'a'}});let calls=0;
 w.ctx.fetch=async()=>{calls++;throw Error('offline');};await w.run('runAutoSync()');expect(w.data['dasi.sync.meta'].retryCount).toBe(1);await w.run('runAutoSync()');expect(calls).toBe(1);expect(w.data['dasi.items'][0].id).toBe('saved');
 w.data['dasi.sync.meta'].nextRetryAt=0;w.ctx.fetch=async(_url:any,init:any)=>({ok:true,status:200,json:async()=>({blob:{items:[],updatedAt:0}})});await w.run('runAutoSync()');expect(w.data['dasi.sync.meta'].retryCount).toBe(0);expect(w.data['dasi.sync.meta'].lastError).toBeNull();expect(w.data['dasi.items'][0].id).toBe('saved');
});
it('coalesces simultaneous automatic sync triggers',async()=>{
 const w=worker({'dasi.items':[],'dasi.sync.config':{apiUrl:'https://sync.example/api',userId:'a',token:'a'}});let requests=0;
 w.ctx.fetch=async()=>{requests++;await new Promise(resolve=>setTimeout(resolve,10));return {ok:true,status:200,json:async()=>({blob:{items:[],updatedAt:0}})};};
 await Promise.all([w.run('runAutoSync()'),w.run('runAutoSync()'),w.run('runAutoSync()')]);expect(requests).toBe(2);
});


describe("automatic video checkpoints",()=>{
  const video={title:"Test Show",type:"watching",episode:2,season:1,position:180,duration:1200,confidence:.95,enrichedAt:1};
  it("does not add an untracked video",async()=>{
    const w=worker();const r=await w.call({type:"VIDEO_PROGRESS",payload:video});expect(r.skipped).toBe("not_tracked_or_ambiguous");expect(w.data["dasi.items"]||[]).toHaveLength(0);
  });
  it("saves checkpoints only for an existing unambiguous work",async()=>{
    const w=worker();await w.save({...video,position:30});await w.call({type:"VIDEO_PROGRESS",payload:video});expect(w.data["dasi.items"]).toHaveLength(1);expect(w.data["dasi.items"][0].position).toBe(180);
  });
  it("respects opt out and keeps manual saving available",async()=>{
    const w=worker({"dasi.settings":{autoTrack:false}});await w.save({...video,position:30});expect((await w.call({type:"VIDEO_PROGRESS",payload:video})).skipped).toBe("disabled");expect(w.data["dasi.items"][0].position).toBe(30);await w.call({type:"SAVE_PROGRESS",payload:video});expect(w.data["dasi.items"][0].position).toBe(180);
  });
  it("ignores low-confidence detections",async()=>{
    const w=worker();await w.save({...video,position:30});expect((await w.call({type:"VIDEO_PROGRESS",payload:{...video,confidence:.4}})).skipped).toBe("uncertain_video");expect(w.data["dasi.items"][0].position).toBe(30);
  });
});


describe("video resume regression guards",()=>{
  it("keeps the later season when an old season is revisited",async()=>{
    const w=worker();await w.save(book("Show",{type:"watching",season:2,episode:3,position:180,duration:1200}));
    const r=await w.save(book("Show",{type:"watching",season:1,episode:20,position:900,duration:1200}));expect(r.kept).toBe("existing");expect(r.item.season).toBe(2);
  });
  it("keeps the furthest position within the same episode",async()=>{
    const w=worker();await w.save(book("Show",{type:"watching",season:2,episode:3,position:180,duration:1200}));
    const r=await w.save(book("Show",{type:"watching",season:2,episode:3,position:20,duration:1200}));expect(r.kept).toBe("existing");expect(r.item.position).toBe(180);
  });
  it("accepts a new episode starting at an earlier timestamp",async()=>{
    const w=worker();await w.save(book("Show",{type:"watching",season:2,episode:3,position:1100,duration:1200}));
    const r=await w.save(book("Show",{type:"watching",season:2,episode:4,position:20,duration:1200}));expect(r.item.episode).toBe(4);expect(r.item.position).toBe(20);
  });
});


describe("release check isolation",()=>{
  it("ignores a delayed Steam result after the account changes",async()=>{
    const w=worker();await w.save(book("Game",{type:"game",url:"https://store.steampowered.com/app/123/",released:false}));
    await w.run("checkGameReleases()");
    w.run("steamAppDetails=()=>new Promise(resolve=>{globalThis.finishSteam=resolve;})");
    const pending=w.run("checkGameReleases()");
    await new Promise(r=>setTimeout(r,10));
    w.run("accountEpoch++;finishSteam({comingSoon:false,releaseDate:'Today'})");
    await pending;expect(w.data["dasi.items"][0].released).toBe(false);expect(w.data["dasi.notifications"]||[]).toHaveLength(0);
  });
  it("coalesces overlapping checks and emits one confirmed release",async()=>{
    const w=worker();await w.save(book("Game",{type:"game",url:"https://store.steampowered.com/app/123/",released:false}));await w.run("checkGameReleases()");
    w.run("globalThis.steamCalls=0;steamAppDetails=async()=>{steamCalls++;return {comingSoon:false,releaseDate:'Today'};}");
    await Promise.all([w.run("checkGameReleases()"),w.run("checkGameReleases()")]);expect(w.run("steamCalls")).toBe(1);expect(w.data["dasi.items"][0].released).toBe(true);expect(w.data["dasi.notifications"]).toHaveLength(1);
  });
});


describe("translation rate limits",()=>{
  it("does not expand a rate-limited batch into per-line requests",async()=>{
    const w=worker();w.run("globalThis.requests=0;fetch=async()=>{requests++;return {status:429,ok:false,headers:{get:()=> '120'}};}");
    await expect(w.run("translateTexts(['hello','world'],'fr')")).rejects.toThrow("translation_rate_limited");expect(w.run("requests")).toBe(1);
    await expect(w.run("gtxTranslate('again','fr')")).rejects.toThrow("translation_rate_limited");expect(w.run("requests")).toBe(1);
  });
});


it("retains the translation cooldown after restarting the worker",async()=>{
  const w=worker({"yomu.translationRetryAt":Date.now()+120000});w.run("globalThis.requests=0;fetch=async()=>{requests++;throw Error('unexpected request');}");
  await expect(w.run("gtxTranslate('hello','fr')")).rejects.toThrow("translation_rate_limited");expect(w.run("requests")).toBe(0);
});

describe("import catalog enrichment", () => {
  it("fills a matching series without changing viewing progress", async () => {
    const w=worker({"dasi.items":[{id:"show",title:"The Example",type:"watching",season:2,episode:7,updatedAt:1}]});
    w.run('catalogSearchAll=async()=>[{title:"The Example",type:"watching",format:"SERIES",cover:"https://example.org/poster.jpg",synopsis:"A series.",genres:["Drama"]}]');
    await w.run('enrichWork("show")');
    expect(w.data["dasi.items"][0]).toMatchObject({format:"SERIES",season:2,episode:7,synopsis:"A series."});
  });
  it("does not enrich a conflicting film adaptation", async () => {
    const w=worker({"dasi.items":[{id:"show",title:"The Example",type:"watching",format:"ANIME",episode:7,updatedAt:1}]});
    w.run('catalogSearchAll=async()=>[{title:"The Example",type:"watching",format:"MOVIE",cover:"https://example.org/wrong.jpg",genres:[]}]');
    await w.run('enrichWork("show")');
    expect(w.data["dasi.items"][0].cover).toBeUndefined();
  });
  it("does not overwrite changes made during a catalog lookup", async () => {
    const w=worker({"dasi.items":[{id:"show",title:"The Example",type:"watching",updatedAt:1}]});
    w.run('catalogSearchAll=async()=>{await chrome.storage.local.set({"dasi.items":[{id:"show",title:"The Example",type:"watching",cover:"manual",updatedAt:2}]});return [{title:"The Example",type:"watching",format:"SERIES",cover:"automatic",genres:[]}]}');
    await w.run('enrichWork("show")');
    expect(w.data["dasi.items"][0].cover).toBe("manual");
  });
});

describe("metadata repair requests", () => {
  it("repairs an existing import without replacing its progress", async () => {
    const w=worker({"dasi.items":[{id:"old",title:"Existing",type:"watching",episode:9,updatedAt:1}]});
    w.run('catalogSearchAll=async()=>[{title:"Existing",type:"watching",format:"SERIES",cover:"https://example.org/cover.jpg",synopsis:"Description",genres:[]}]');
    const result=await w.call({type:"COMPLETE_ITEM_METADATA",id:"old"});
    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.item).toMatchObject({episode:9,format:"SERIES",synopsis:"Description"});
    expect(w.data["dasi.items"]).toHaveLength(1);
  });
  it("reports an unavailable item without searching", async () => {
    const w=worker();
    const result=await w.call({type:"COMPLETE_ITEM_METADATA",id:"missing"});
    expect(result).toMatchObject({ok:false,error:"item_unavailable"});
  });
});

describe("multilingual work identity",()=>{
  it("updates a known translated title and preserves the original title",async()=>{
    const w=worker();
    await w.save(book("L'Attaque des Titans",{chapter:3,alternativeTitles:["Attack on Titan","Shingeki no Kyojin"],externalIds:{anilist:"53390"},authors:["Hajime Isayama"]}));
    const result=await w.save(book("Attack on Titan",{chapter:4}));
    expect(w.data["dasi.items"]).toHaveLength(1);
    expect(result.item).toMatchObject({title:"L'Attaque des Titans",chapter:4,authors:["Hajime Isayama"]});
    const check=await w.call({type:"CHECK_EXISTING",payload:book("Shingeki no Kyojin")});
    expect(check.existing.id).toBe(result.item.id);
  });
  it("uses a unique catalog identity before saving another language",async()=>{
    const w=worker();
    await w.save(book("Titre français",{chapter:2,externalIds:{anilist:"123"}}));
    w.run('anilistSearch=async()=>[{title:"English title",type:"reading",externalIds:{anilist:"123"},alternativeTitles:["Titre français"]}]');
    await w.save(book("English title",{chapter:5}));
    expect(w.data["dasi.items"]).toHaveLength(1);
    expect(w.data["dasi.items"][0].chapter).toBe(5);
  });
  it("does not merge conflicting catalog IDs or adaptations",async()=>{
    const w=worker();
    await w.save(book("Shared title",{externalIds:{anilist:"1"},format:"MANGA"}));
    await w.save(book("Shared title",{externalIds:{anilist:"2"},format:"MANGA"}));
    await w.save(book("Shared title",{type:"watching",format:"ANIME",externalIds:{anilist:"3"}}));
    expect(w.data["dasi.items"]).toHaveLength(3);
  });
  it("does not choose arbitrarily between two alias matches",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"One",type:"reading",alternativeTitles:["Ambiguous"]},{id:"b",title:"Two",type:"reading",alternativeTitles:["Ambiguous"]}]});
    const check=await w.call({type:"CHECK_EXISTING",payload:book("Ambiguous")});
    expect(check.existing).toBeNull();
  });
  it("maps multilingual catalog titles and writers without voice actors",()=>{
    const w=worker();
    const result=w.run('mediaToResult({id:123,idMal:456,format:"MANGA",title:{english:"English",romaji:"Romaji",native:"日本語"},synonyms:["Français"],staff:{edges:[{role:"Story & Art",node:{name:{full:"Creator"}}},{role:"Voice",node:{name:{full:"Actor"}}}]}})');
    expect(result.alternativeTitles).toEqual(["English","Romaji","日本語","Français"]);
    expect(result.authors).toEqual(["Creator"]);
    expect(result.externalIds).toEqual({anilist:"123",mal:"456"});
  });
});

describe("confirmed reading duplicate consolidation",()=>{
  it("repairs already illustrated records and combines multilingual duplicates atomically",async()=>{
    const w=worker({
      "dasi.items":[
        {id:"fr",title:"Titre français",type:"reading",format:"MANGA",chapter:4,total:10,cover:"manual",coverOverride:true,synopsis:"Personal summary",enrichedAt:1,createdAt:1,updatedAt:3,tags:["FR"],favorite:true,externalIds:{anilist:"123"}},
        {id:"en",title:"English title",type:"reading",format:"MANGA",chapter:8,page:6,url:"https://reader.example/chapter/8",createdAt:2,updatedAt:4,tags:["EN"],rating:4,customField:"retained"}
      ],
      "dasi.lists":[{id:"list",itemIds:["fr","en"],createdAt:1}],
      "dasi.notifications":[{id:"notice",itemId:"en",title:"Update"}]
    });
    w.run('catalogSearchAll=async()=>[{title:"English title",type:"reading",format:"MANGA",externalIds:{anilist:"123"},alternativeTitles:["Titre français"],authors:["Creator"],cover:"catalog",synopsis:"Catalog summary"}]');
    const response=await w.call({type:"COMPLETE_ITEM_METADATA",id:"en"});
    expect(response.ok).toBe(true);
    expect(response.mergedIds).toEqual(["en"]);
    expect(w.data["dasi.items"]).toHaveLength(1);
    expect(response.item).toMatchObject({id:"fr",title:"Titre français",chapter:8,page:6,rating:4,favorite:true,cover:"manual",synopsis:"Personal summary"});
    expect(response.item.alternativeTitles).toEqual(expect.arrayContaining(["Titre français","English title"]));
    expect(response.item.tags).toEqual(expect.arrayContaining(["FR","EN"]));
    expect(response.item.mergedFrom.find((i:any)=>i.id==="en").customField).toBe("retained");
    expect(w.data["dasi.lists"][0].itemIds).toEqual(["fr"]);
    expect(w.data["dasi.notifications"][0].itemId).toBe("fr");
    expect(w.data["yomu.tombstones.v1"]).toEqual(expect.arrayContaining([expect.objectContaining({kind:"items",id:"en"})]));
  });
  it("fetches aliases for an older record even with an existing cover and synopsis",async()=>{
    const w=worker({"dasi.items":[{id:"old",title:"Existing",type:"reading",enrichedAt:1,cover:"cover",synopsis:"summary",chapter:7,updatedAt:1}]});
    w.run('catalogSearchAll=async()=>[{title:"Existing",type:"reading",alternativeTitles:["Autre titre"],externalIds:{anilist:"123"},authors:["Creator"]}]');
    await w.call({type:"COMPLETE_ITEM_METADATA",id:"old"});
    expect(w.data["dasi.items"][0]).toMatchObject({identityVersion:1,authors:["Creator"],chapter:7});
    expect(w.data["dasi.items"][0].alternativeTitles).toContain("Autre titre");
  });
  it("prioritizes an exact catalog ID over an otherwise ambiguous alias",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"One",type:"reading",externalIds:{anilist:"1"},alternativeTitles:["Shared"]},{id:"b",title:"Two",type:"reading",alternativeTitles:["Shared"]}]});
    const result=await w.call({type:"CHECK_EXISTING",payload:book("Shared",{externalIds:{anilist:"1"}})});
    expect(result.existing.id).toBe("a");
  });
  it("keeps conflicting cross-catalog mappings separate",async()=>{
    const w=worker({"dasi.items":[
      {id:"a",title:"One",type:"reading",externalIds:{anilist:"1",mal:"2"}},
      {id:"b",title:"Two",type:"reading",externalIds:{anilist:"1",mal:"3"}}
    ]});
    const checked=await w.run('(async()=>consolidateReadingIdentity(await read(ITEMS_KEY,[]),"a"))()');
    expect(checked.items).toHaveLength(2);
  });
  it("does not merge title-only matches or conflicting user ratings",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Same",type:"reading",rating:1,externalIds:{anilist:"1"}},{id:"b",title:"Same",type:"reading",rating:5,externalIds:{anilist:"1"}},{id:"c",title:"Same",type:"reading"}]});
    const result=await w.run('(async()=>consolidateReadingIdentity(await read(ITEMS_KEY,[]),"a"))()');
    expect(result.mergedIds).toEqual([]);
    expect(result.items).toHaveLength(3);
  });
});

describe("persistent import metadata queue",()=>{
  it("resumes an unfinished lookup in a new worker without losing progress",async()=>{
    const original={id:"imported",title:"Imported work",type:"reading",chapter:12,updatedAt:1,metadataPending:{attempts:0,nextAttemptAt:0}};
    const first=worker({"dasi.items":[original]});
    first.run('catalogSearchAll=async()=>{throw Error("offline")}');
    await first.run("runImportEnrichment()");
    expect(first.data["dasi.items"][0].metadataPending.attempts).toBe(1);
    const persisted=structuredClone(first.data);
    persisted["dasi.items"][0].metadataPending.nextAttemptAt=0;
    const restarted=worker(persisted);
    restarted.run('catalogSearchAll=async()=>[{title:"Imported work",type:"reading",cover:"https://example.org/cover.jpg",synopsis:"A synopsis",externalIds:{anilist:"123"}}]');
    await restarted.run("runImportEnrichment()");
    expect(restarted.data["dasi.items"][0]).toMatchObject({chapter:12,cover:"https://example.org/cover.jpg",synopsis:"A synopsis"});
    expect(restarted.data["dasi.items"][0].metadataPending).toBeUndefined();
  });
  it("limits a batch to two works and retains the remaining queue",async()=>{
    const w=worker({"dasi.items":Array.from({length:3},(_,n)=>({id:"work"+n,title:"Work "+n,type:"reading",metadataPending:{attempts:0,nextAttemptAt:0}}))});
    w.run('catalogSearchAll=async title=>[{title,type:"reading",cover:"cover",synopsis:"summary"}]');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"].filter((i:any)=>i.metadataPending)).toHaveLength(1);
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"].filter((i:any)=>i.metadataPending)).toHaveLength(0);
  });
  it("stops automatic retries after three unsuccessful attempts",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Unknown",type:"reading",chapter:3,metadataPending:{attempts:2,nextAttemptAt:0}}]});
    w.run('catalogSearchAll=async()=>[]');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0].metadataPending).toBeUndefined();
    expect(w.data["dasi.items"][0].chapter).toBe(3);
  });
  it("does not restore a work removed during an external lookup",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Deleted",type:"reading",metadataPending:{attempts:0,nextAttemptAt:0}}]});
    w.run('catalogSearchAll=async()=>{await chrome.storage.local.set({"dasi.items":[]});return [{title:"Deleted",type:"reading",cover:"cover",synopsis:"summary"}]}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"]).toEqual([]);
  });
  it("does not write delayed results into another account",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Old account",type:"reading",metadataPending:{attempts:0,nextAttemptAt:0}}]});
    w.run('catalogSearchAll=async()=>{accountEpoch++;await chrome.storage.local.set({"dasi.items":[{id:"new",title:"New account",type:"reading"}]});return [{title:"Old account",type:"reading",cover:"cover",synopsis:"summary"}]}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"]).toEqual([{id:"new",title:"New account",type:"reading"}]);
  });
  it("recreates a missing alarm while unfinished records remain",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Pending",type:"reading",metadataPending:{attempts:1,nextAttemptAt:Date.now()+60000}}]});
    w.run('globalThis.createdAlarms=[];chrome.alarms={get:async()=>undefined,create:async(name,options)=>createdAlarms.push({name,options})}');
    await w.run("ensureImportEnrichmentAlarm()");
    expect(w.run("createdAlarms")).toEqual([{name:"yomu-import-enrichment",options:{periodInMinutes:1}}]);
  });
});

describe("catalog navigation and destinations",()=>{
  it("rejects a removed destination before saving a work",async()=>{
    const w=worker();
    const r=await w.call({type:"SAVE_PROGRESS",payload:book("New"),listId:"deleted"});
    expect(r).toMatchObject({ok:false,error:"list_unavailable"});
    expect(w.data["dasi.items"]||[]).toEqual([]);
    expect(w.data["dasi.lists"]||[]).toEqual([]);
  });
  it("loads a catalog detail without adding an item",async()=>{
    const w=worker();
    w.run('anilistDetail=async()=>({title:"English",alternativeTitles:["Français"],cast:[{name:"Character"}],trailerUrl:"https://www.youtube.com/watch?v=abcdefghijk"})');
    const r=await w.call({type:"CATALOG_DETAIL",item:book("Français",{externalIds:{anilist:"123"}})});
    expect(r.ok).toBe(true);
    expect(r.item.title).toBe("Français");
    expect(r.item.cast).toEqual([{name:"Character"}]);
    expect(w.data["dasi.items"]||[]).toEqual([]);
  });
  it("updates an existing series across sites with a catalog identifier",async()=>{
    const w=worker();
    await w.save(book("French series",{type:"watching",season:6,episode:26,externalIds:{tvmaze:"123"}}));
    w.run('catalogSearchAll=async()=>[{title:"English series",type:"watching",externalIds:{tvmaze:"123"}}]');
    const result=await w.save(book("English series",{type:"watching",season:6,episode:26,domain:"second.example"}));
    expect(w.data["dasi.items"]).toHaveLength(1);
    expect(result.item).toMatchObject({season:6,episode:26});
    expect(result.item.sources).toContain("second.example");
  });
});

describe("tracked release feed",()=>{
  it("retains real release dates and progress outside discovery recommendations",async()=>{
    const w=worker({"dasi.items":[{id:"show",title:"Followed",type:"watching",season:2,episode:3,total:12,externalIds:{tvmaze:"123"},updatedAt:10}]});
    w.run('fetchTrackedReleases=async()=>[{season:2,episode:4,at:Date.now()-1000},{season:2,episode:5,at:Date.now()+86400000}]');
    await w.run("checkTrackedReleasesOnce()");
    const item=w.data["dasi.items"][0];
    expect(item).toMatchObject({season:2,episode:3,total:12,activityAt:10,releasedTotal:4,releaseSeason:2});
    expect(item.recentEpisodes).toHaveLength(1);
    const restarted=worker(w.data);
    const state=await restarted.call({type:"GET_STATE"});
    expect(state.items[0].recentEpisodes[0].episode).toBe(4);
  });
  it("deduplicates dates and excludes future and invalid episodes",()=>{
    const w=worker();
    const result=w.run('normalizeReleaseEpisodes([{season:1,episode:2,at:100},{season:1,episode:2,at:200},{season:1,episode:3,at:2000},{season:0,episode:1,at:100},{season:1,episode:0,at:100}],1000)');
    expect(result).toEqual([{season:1,episode:2,at:100}]);
  });
  it("does not overwrite a newer saved position during a release lookup",async()=>{
    const w=worker({"dasi.items":[{id:"show",title:"Followed",type:"watching",season:1,episode:2,externalIds:{tvmaze:"123"},updatedAt:1}]});
    w.run('fetchTrackedReleases=async()=>{await chrome.storage.local.set({"dasi.items":[{id:"show",title:"Followed",type:"watching",season:1,episode:8,externalIds:{tvmaze:"123"},updatedAt:9}]});return [{season:1,episode:8,at:Date.now()-1000}]}');
    await w.run("checkTrackedReleasesOnce()");
    expect(w.data["dasi.items"][0].episode).toBe(8);
  });
  it("ignores a changed catalog identity and another account",async()=>{
    const w=worker({"dasi.items":[{id:"show",title:"Followed",type:"watching",externalIds:{tvmaze:"123"}}]});
    w.run('fetchTrackedReleases=async()=>{accountEpoch++;await chrome.storage.local.set({"dasi.items":[{id:"show",title:"Other account",type:"watching",externalIds:{tvmaze:"456"}}]});return [{season:1,episode:8,at:Date.now()-1000}]}');
    await w.run("checkTrackedReleasesOnce()");
    expect(w.data["dasi.items"][0].recentEpisodes).toBeUndefined();
    expect(w.data["dasi.items"][0].title).toBe("Other account");
  });
  it("leaves previously confirmed releases intact during a source failure",async()=>{
    const recent=[{season:1,episode:5,at:Date.now()-1000}];
    const w=worker({"dasi.items":[{id:"show",type:"watching",externalIds:{tvmaze:"123"},recentEpisodes:recent}]});
    w.run('fetchTrackedReleases=async()=>{throw Error("offline")}');
    await w.run("checkTrackedReleasesOnce()");
    expect(w.data["dasi.items"][0].recentEpisodes).toEqual(recent);
  });
  it("does not map a later viewing season onto an unrelated AniList season",()=>{
    const w=worker();
    expect(w.run('releaseIdentity({type:"watching",season:2,externalIds:{anilist:"123"}})')).toBe("");
  });
});

describe("confirmed series duplicate repair",()=>{
  it("merges the same season across sites and preserves progress, lists and snapshots",async()=>{
    const w=worker({"dasi.items":[
      {id:"a",title:"French title",type:"watching",season:2,episode:3,position:100,createdAt:1,externalIds:{tvmaze:"123"},url:"https://first.example"},
      {id:"b",title:"English title",type:"watching",season:2,episode:5,position:42,createdAt:2,externalIds:{tvmaze:"123"},url:"https://second.example"}
    ],"dasi.lists":[{id:"list",itemIds:["a","b"]}]});
    const result=await w.run('(async()=>consolidateReadingIdentity(await read(ITEMS_KEY,[]),"b"))()');
    expect(result.items).toHaveLength(1);
    expect(result.item).toMatchObject({id:"a",title:"French title",season:2,episode:5,position:42,url:"https://second.example"});
    expect(result.item.alternativeTitles).toEqual(expect.arrayContaining(["French title","English title"]));
    expect(result.item.mergedFrom).toHaveLength(2);
    expect(result.lists[0].itemIds).toEqual(["a"]);
    expect(result.item.chapter).toBeUndefined();
  });
  it("keeps different seasons and conflicting ratings separate",async()=>{
    const w=worker({"dasi.items":[
      {id:"a",type:"watching",season:1,rating:1,externalIds:{tvmaze:"123"}},
      {id:"b",type:"watching",season:2,rating:1,externalIds:{tvmaze:"123"}},
      {id:"c",type:"watching",season:1,rating:5,externalIds:{tvmaze:"123"}}
    ]});
    const result=await w.run('(async()=>consolidateReadingIdentity(await read(ITEMS_KEY,[]),"a"))()');
    expect(result.items).toHaveLength(3);
    expect(result.mergedIds).toEqual([]);
  });
  it("repairs already enriched series without a network lookup",async()=>{
    const w=worker({"dasi.items":["a","b"].map(id=>({id,title:"Series",type:"watching",season:1,episode:id==="a"?2:4,externalIds:{tvmaze:"123"},cover:"cover",synopsis:"summary",enrichedAt:1,identityVersion:1}))});
    await w.run('enrichWork("b")');
    expect(w.data["dasi.items"]).toHaveLength(1);
    expect(w.data["dasi.items"][0].episode).toBe(4);
  });
});

describe("exact catalog metadata recovery",()=>{
  it("uses the catalog ID despite a different title without searching again",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Titre traduit",type:"reading",chapter:8,externalIds:{anilist:"123"}}]});
    w.run('catalogSearchAll=async()=>{throw Error("Must not search")};anilistDetail=async()=>({title:"Original title",type:"reading",externalIds:{anilist:"123"},cover:"cover.jpg",synopsis:"Summary",authors:["Author"],cast:[{name:"Hero"}],total:20})');
    await w.run('enrichWork("a")');
    expect(w.data["dasi.items"][0]).toMatchObject({title:"Titre traduit",chapter:8,cover:"cover.jpg",synopsis:"Summary",authors:["Author"],cast:[{name:"Hero"}]});
    expect(w.data["dasi.items"][0].alternativeTitles).toContain("Original title");
  });
  it("keeps user covers and progress when recovering exact details",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Local",type:"watching",season:3,episode:4,cover:"custom",coverOverride:true,externalIds:{anilist:"123"}}]});
    w.run('anilistDetail=async()=>({title:"Catalog",type:"watching",season:2020,externalIds:{anilist:"123"},cover:"catalog",synopsis:"Summary",total:12})');
    await w.run('enrichWork("a")');
    expect(w.data["dasi.items"][0]).toMatchObject({season:3,episode:4,cover:"custom",synopsis:"Summary"});
  });
  it("does not replace a failed exact lookup with a title match",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Same title",type:"reading",externalIds:{anilist:"123"}}]});
    w.run('anilistDetail=async()=>{throw Error("offline")};catalogSearchAll=async()=>[{title:"Same title",type:"reading",cover:"wrong"}]');
    await w.run('enrichWork("a")');
    expect(w.data["dasi.items"][0].cover).toBeUndefined();
  });
  it("rejects a conflicting identifier returned by a provider",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Local",type:"reading",externalIds:{anilist:"123"}}]});
    w.run('anilistDetail=async()=>({title:"Other",type:"reading",externalIds:{anilist:"456"},cover:"wrong"})');
    await w.run('enrichWork("a")');
    expect(w.data["dasi.items"][0].cover).toBeUndefined();
  });
});

describe("season-aware existing work selection",()=>{
  it("updates the matching season without creating a third record",async()=>{
    const w=worker({"dasi.items":[
      {id:"s1",title:"Series",type:"watching",season:1,episode:10,externalIds:{tvmaze:"123"}},
      {id:"s2",title:"Series",type:"watching",season:2,episode:3,externalIds:{tvmaze:"123"}}
    ]});
    await w.save(book("Series",{type:"watching",season:2,episode:4,externalIds:{tvmaze:"123"}}));
    expect(w.data["dasi.items"]).toHaveLength(2);
    expect(w.data["dasi.items"].find((i:any)=>i.id==="s1").episode).toBe(10);
    expect(w.data["dasi.items"].find((i:any)=>i.id==="s2").episode).toBe(4);
  });
  it("selects the matching season through a translated alias",()=>{
    const w=worker();
    const selected=w.run('findIdentity([{id:"s1",title:"English",alternativeTitles:["Français"],type:"watching",season:1},{id:"s2",title:"English",alternativeTitles:["Français"],type:"watching",season:2}],{title:"Français",type:"watching",season:2})');
    expect(selected.id).toBe("s2");
  });
  it("leaves multiple matches in the same season unresolved",()=>{
    const w=worker();
    expect(w.run('findIdentity([{id:"a",title:"Same",type:"watching",season:1},{id:"b",title:"Same",type:"watching",season:1}],{title:"Same",type:"watching",season:1})')).toBeNull();
  });
  it("retains the single-record season progression behavior",()=>{
    const w=worker();
    expect(w.run('findIdentity([{id:"a",title:"Same",type:"watching",season:1}],{title:"Same",type:"watching",season:2}).id')).toBe("a");
  });
});
