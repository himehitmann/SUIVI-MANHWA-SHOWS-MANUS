import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function worker(seed: Record<string, any> = {}, syncSeed:Record<string,any>={}) {
  const data: Record<string, any> = structuredClone(seed),
    listeners: any[] = [],
    installed: any[] = [];
  const synced:Record<string,any>=structuredClone(syncSeed),accessLevels:string[]=[];
  const local = {
    async setAccessLevel({accessLevel}:{accessLevel:string}){accessLevels.push("local:"+accessLevel);},
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
          async get(key:string) {
            return { [key]:structuredClone(synced[key]) };
          },
          async set(values:any) {Object.assign(synced,structuredClone(values));},
          async setAccessLevel({accessLevel}:{accessLevel:string}){accessLevels.push("sync:"+accessLevel);},
        },
      },
      runtime: {
        id:"test",
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
    synced,accessLevels,
    ctx,
    installed,
    call: (input: any, sender:any={id:"test",url:"chrome-extension://test/library.html"}) =>
      new Promise<any>(resolve => listeners[0](input, sender, resolve)),
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
    expect(restarted.data["dasi.items"][0].metadataPending).toBeFalsy();
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
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
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

describe("manual metadata refresh",()=>{
  it("refreshes known artwork even when a record was already enriched",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Saved",type:"reading",chapter:7,cover:"old",synopsis:"Saved synopsis",identityVersion:1,enrichedAt:1,externalIds:{anilist:"123"}}]});
    w.run('anilistDetail=async()=>({title:"Canonical",type:"reading",cover:"new",synopsis:"Summary",externalIds:{anilist:"123"}})');
    const result=await w.call({type:"COMPLETE_ITEM_METADATA",id:"a",force:true});
    expect(result.matched).toBe(true);
    expect(result.item).toMatchObject({chapter:7,cover:"new",title:"Saved",synopsis:"Saved synopsis"});
  });
});

describe("independent manga catalog fallback",()=>{
  it("keeps title search available when AniList is down",async()=>{
    const w=worker();
    w.run('anilistSearch=async()=>{throw Error("offline")};jikanSearch=async()=>[{title:"Fallback manga",type:"reading",externalIds:{mal:"123"}}]');
    expect(await w.run('mangaSearchResilient("manga")')).toEqual([{title:"Fallback manga",type:"reading",externalIds:{mal:"123"}}]);
  });
  it("recovers metadata using the confirmed MAL identity",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Local title",type:"reading",chapter:9,externalIds:{anilist:"1",mal:"123"}}]});
    w.run('anilistDetail=async()=>{throw Error("offline")};jikanRequest=async()=>({data:{mal_id:123,title:"Canonical",type:"Manga",images:{jpg:{large_image_url:"cover"}},synopsis:"Summary",chapters:20}})');
    await w.run('enrichWork("a")');
    expect(w.data["dasi.items"][0]).toMatchObject({title:"Local title",chapter:9,cover:"cover",synopsis:"Summary",externalIds:{anilist:"1",mal:"123"}});
  });
  it("preserves stored details if both sources fail",async()=>{
    const w=worker({"dasi.items":[{id:"a",title:"Saved",type:"reading",chapter:9,cover:"original",externalIds:{anilist:"1",mal:"123"}}]});
    w.run('anilistDetail=async()=>{throw Error("offline")};jikanRequest=async()=>{throw Error("offline")}');
    await w.run('enrichWork("a",true)');
    expect(w.data["dasi.items"][0]).toMatchObject({chapter:9,cover:"original"});
  });
  it("rejects the wrong MAL identifier",async()=>{
    const w=worker();
    w.run('jikanRequest=async()=>({data:{mal_id:456,title:"Wrong"}})');
    await expect(w.run('jikanDetail({type:"reading",externalIds:{mal:"123"}})')).rejects.toThrow("catalog_identity_mismatch");
  });
  it("maps real metadata and themes without inventing user progress",()=>{
    const w=worker();
    const item=w.run('jikanMedia({mal_id:12,title:"Title",type:"Manhwa",chapters:80,themes:[{name:"Reincarnation"}],authors:[{name:"Author"}]},"reading")');
    expect(item).toMatchObject({format:"MANHWA",total:80,authors:["Author"],genres:["Reincarnation"]});
    expect(item.chapter).toBeUndefined();
  });
});

describe("game news notifications",()=>{
  const now=1700000000000;
  const news=[{id:"patch",title:"Patch 2.0",publishedAt:now-1000},{id:"event",title:"Summer festival",publishedAt:now-2000},{id:"reward",title:"Twitch drops rewards",publishedAt:now-3000}];
  it("establishes a silent baseline and respects global and per-game mute",()=>{
    const w=worker();w.ctx.news=news;w.ctx.now=now;
    expect(w.run("freshGameNews({},news,{},now)")).toEqual([]);
    expect(w.run("freshGameNews({gameNewsCheckedAt:now-5000,notifyUpdates:false},news,{},now)")).toEqual([]);
    expect(w.run("freshGameNews({gameNewsCheckedAt:now-5000},news,{notifyNew:false},now)")).toEqual([]);
  });
  it("honors each category independently",()=>{
    const w=worker();w.ctx.news=news;w.ctx.now=now;
    expect(w.run("freshGameNews({gameNewsCheckedAt:now-5000,notifyGameUpdates:false,notifyGameRewards:false},news,{},now).map(n=>n.id)")).toEqual(["event"]);
    expect(w.run("freshGameNews({gameNewsCheckedAt:now-5000,notifyGameEvents:false},news,{},now).map(n=>n.id)")).toEqual(["patch","reward"]);
  });
  it("rejects duplicates, historical posts, future dates and invalid dates",()=>{
    const w=worker();w.ctx.now=now;
    w.ctx.news=[...news,news[0],{id:"old",publishedAt:now-8*86400000},{id:"future",publishedAt:now+1},{id:"invalid",publishedAt:"bad"}];
    expect(w.run("freshGameNews({gameNewsCheckedAt:now-9*86400000,gameNewsSeenIds:['event']},news,{},now).map(n=>n.id)")).toEqual(["patch","reward"]);
  });
  it("persists a notification and the seen state together and does not repeat it",async()=>{
    const checked=Date.now()-7*3600000;
    const w=worker({"dasi.items":[{id:"game",title:"Game",type:"game",released:true,url:"https://store.steampowered.com/app/123/",gameNewsCheckedAt:checked}],"dasi.settings":{notifyNew:true}});
    w.ctx.news=[{id:"new",title:"Patch 2",publishedAt:Date.now()-1000}];
    w.run("steamNews=async()=>news");
    await w.run("checkGameNewsOnce()");
    expect(w.data["dasi.notifications"]).toHaveLength(1);
    expect(w.data["dasi.items"][0].gameNewsSeenIds).toContain("new");
    await w.run("checkGameNewsOnce()");
    expect(w.data["dasi.notifications"]).toHaveLength(1);
  });
  it("does not advance the baseline when Steam fails",async()=>{
    const w=worker({"dasi.items":[{id:"game",title:"Game",type:"game",released:true,url:"https://store.steampowered.com/app/123/"}]});
    w.run("steamNews=async()=>{throw Error('offline')}");
    await w.run("checkGameNewsOnce()");
    expect(w.data["dasi.items"][0].gameNewsCheckedAt).toBeUndefined();
    expect(w.data["dasi.notifications"]).toBeUndefined();
  });
});

describe("catalog content categories",()=>{
  it("excludes biographies and unknown Wikipedia pages",()=>{const w=worker();for(const desc of ["American film actor","Japanese manga author","French actress","American company",""]) {w.ctx.desc=desc;expect(w.run("classifyWiki(desc).type")).toBe("");}expect(w.run('classifyWiki("Japanese manga series").type')).toBe("reading");expect(w.run('classifyWiki("American television series").type')).toBe("watching");});
  it("does not put animated shows in regional drama rows",()=>{const w=worker();expect(w.run('liveActionShow({type:"Animation",genres:["Adventure"]})')).toBe(false);expect(w.run('liveActionShow({type:"Scripted",genres:["Anime"]})')).toBe(false);expect(w.run('liveActionShow({type:"Scripted",genres:["Drama","Romance"]})')).toBe(true);});
});


describe("progressive catalog search",()=>{
  it("publishes fast providers before the slow provider finishes and shares the running job",async()=>{
    const w=worker();
    w.run('var releaseSlow; var calls=0; mangaSearchResilient=()=>{calls++;return new Promise(resolve=>{releaseSlow=resolve;});};steamSearch=async()=>[{title:"Fast game",type:"game",source:"steam"}];openLibrarySearch=async()=>[];tvmazeSearch=async()=>[];wikipediaSearch=async()=>[];');
    const first=await w.call({type:"CATALOG_SEARCH",query:"test",progressive:true});
    expect(first.pending).toBe(true);
    await new Promise(r=>setTimeout(r,20));
    const partial=await w.call({type:"CATALOG_SEARCH",query:"test",progressive:true});
    expect(partial.pending).toBe(true);
    expect(partial.results.map((r:any)=>r.title)).toContain("Fast game");
    expect(w.run("calls")).toBe(1);
    w.run('releaseSlow([{title:"Slow manga",type:"reading",source:"anilist"}])');
    await w.run('Array.from(catalogJobs.values())[0].task');
    const done=await w.call({type:"CATALOG_SEARCH",query:"test",progressive:true});
    expect(done.pending).toBe(false);
    expect(done.results.map((r:any)=>r.title)).toEqual(["Fast game","Slow manga"]);
  });
  it("allows an immediate retry after total provider failure",async()=>{
    const w=worker();
    w.run('catalogSearchAll=async()=>{throw Error("offline");}');
    await w.call({type:"CATALOG_SEARCH",query:"retry",progressive:true});
    await w.run('Array.from(catalogJobs.values())[0].task');
    const failed=await w.call({type:"CATALOG_SEARCH",query:"retry",progressive:true});
    expect(failed.ok).toBe(false);
    w.run('catalogSearchAll=async()=>[{title:"Recovered",type:"reading"}]');
    await w.call({type:"CATALOG_SEARCH",query:"retry",progressive:true,retry:true});
    await w.run('Array.from(catalogJobs.values())[0].task');
    const result=await w.call({type:"CATALOG_SEARCH",query:"retry",progressive:true});
    expect(result.ok).toBe(true);
    expect(result.results[0].title).toBe("Recovered");
  });
});


describe("series episode guide",()=>{
  it("loads named seasons and only the selected season episodes, reusing the cache",async()=>{
    const w=worker();
    w.run('var guidePaths=[];fetchRemote=async url=>{guidePaths.push(url);return {ok:true,json:async()=>url.endsWith("/seasons")?[{id:20,number:2,name:"New chapter",episodeOrder:12},{id:10,number:1,name:""}]:[{id:100,season:2,number:1,type:"regular",name:"Return",airdate:"2028-01-01",runtime:42},{id:101,season:2,number:null,type:"significant_special",name:"Special"},{id:102,season:99,number:1,name:"Wrong season"}]};}');
    const item={type:"watching",externalIds:{tvmaze:"7"}};
    const first=await w.call({type:"CATALOG_EPISODE_GUIDE",item});
    expect(first.seasons.map((s:any)=>s.number)).toEqual([1,2]);
    expect(w.run("guidePaths.length")).toBe(1);
    const result=await w.call({type:"CATALOG_EPISODE_GUIDE",item,seasonId:"20"});
    expect(result.season.name).toBe("New chapter");
    expect(result.season.episodeCount).toBe(12);
    expect(result.episodes.map((e:any)=>e.name)).toEqual(["Return","Special"]);
    expect(result.episodes[1].number).toBe(null);
    expect(result.episodes[1].special).toBe(true);
    await w.call({type:"CATALOG_EPISODE_GUIDE",item,seasonId:"20"});
    expect(w.run("guidePaths.length")).toBe(2);
  });
  it("rejects seasons belonging to another show before requesting episodes",async()=>{
    const w=worker();w.run('var guidePaths=[];fetchRemote=async url=>{guidePaths.push(url);return {ok:true,json:async()=>[{id:10,number:1}]};}');
    const result=await w.call({type:"CATALOG_EPISODE_GUIDE",item:{type:"watching",externalIds:{tvmaze:"7"}},seasonId:"999"});
    expect(result.ok).toBe(false);expect(w.run("guidePaths.length")).toBe(1);
  });
  it("does not request a guide for unsupported or malformed identities",async()=>{
    const w=worker();w.run('fetchRemote=async()=>{throw Error("must not fetch")};');
    for(const item of [{type:"reading",externalIds:{tvmaze:"7"}},{type:"watching",externalIds:{tvmaze:"../7"}},{type:"watching"}]){
      const result=await w.call({type:"CATALOG_EPISODE_GUIDE",item});expect(result.ok).toBe(true);expect(result.supported).toBe(false);
    }
  });
  it("does not cache failed requests",async()=>{
    const w=worker();w.run('fetchRemote=async()=>({ok:false});');
    const item={type:"watching",externalIds:{tvmaze:"7"}};
    expect((await w.call({type:"CATALOG_EPISODE_GUIDE",item})).ok).toBe(false);
    w.run('fetchRemote=async()=>({ok:true,json:async()=>[{id:10,number:1}]});');
    expect((await w.call({type:"CATALOG_EPISODE_GUIDE",item})).seasons).toHaveLength(1);
  });
});


describe("consistent catalog identities and automatic progress",()=>{
  it("accepts confirmed catalog identity despite release-year and comic subtype drift",async()=>{
    const w=worker({"dasi.items":[{...book("Titre français"),id:"original",format:"MANGA",year:2020,chapter:6,externalIds:{anilist:"123"}}]});
    const r=await w.save(book("English title",{format:"MANHWA",year:2021,chapter:7,externalIds:{anilist:"123"}}));
    expect(w.data["dasi.items"]).toHaveLength(1);expect(r.item.id).toBe("original");expect(r.item.chapter).toBe(7);
  });
  it("rejects bridges and conflicting provider mappings before alias fallback",()=>{
    const w=worker();
    expect(w.run('findIdentity([{id:"a",title:"A",type:"reading",externalIds:{anilist:"1",mal:"10"}},{id:"b",title:"B",type:"reading",externalIds:{anilist:"2",mal:"20"}}],{title:"A",type:"reading",externalIds:{anilist:"1",mal:"20"}})')).toBeNull();
    expect(w.run('sameIdentity({title:"A",type:"reading",externalIds:{anilist:"1",mal:"10"}},{title:"A",type:"reading",externalIds:{anilist:"2",mal:"10"}})')).toBe(false);
  });
  it("keeps movie and series adaptations separate despite a malformed shared ID",()=>{
    const w=worker();
    expect(w.run('sameIdentity({title:"Same",type:"watching",format:"MOVIE",externalIds:{tmdb:"1"}},{title:"Same",type:"watching",format:"SERIES",externalIds:{tmdb:"1"}})')).toBe(false);
  });
  it("requires creator corroboration for fuzzy titles and never matches by author alone",()=>{
    const w=worker();
    expect(w.run('findIdentity([{id:"a",title:"The Long Adventure",type:"reading"}],{title:"The Long Adventur",type:"reading"})')).toBeNull();
    expect(w.run('findIdentity([{id:"a",title:"The Long Adventure",type:"reading",authors:["Émile Auteur"]}],{title:"The Long Adventur",type:"reading",authors:["Emile Auteur"]}).id')).toBe("a");
    expect(w.run('findIdentity([{id:"a",title:"One Story",type:"reading",authors:["Creator"]}],{title:"Another World",type:"reading",authors:["Creator"]})')).toBeNull();
  });
  it("keeps numbered parts separate when no catalog identity confirms a match",()=>{
    const w=worker();
    expect(w.run('sameIdentity({title:"Adventure Part 1",type:"reading"},{title:"Adventure Part 2",type:"reading"})')).toBe(false);
    expect(w.run('sameIdentity({title:"Adventure",type:"reading"},{title:"Adventure Part 2",type:"reading"})')).toBe(false);
  });
  it("corroborates ambiguous aliases with a matching creator",()=>{
    const w=worker();
    expect(w.run('findIdentity([{id:"a",title:"One",alternativeTitles:["Shared"],authors:["First"],type:"reading"},{id:"b",title:"Two",alternativeTitles:["Shared"],authors:["Second"],type:"reading"}],{title:"Shared",type:"reading",authors:["Second"]}).id')).toBe("b");
  });
  it("preserves the full viewing context when an overview contains zero progress",async()=>{
    const existing={...book("Series"),id:"series",type:"watching",season:3,episode:8,position:120,duration:900,total:12,progress:13,activityAt:10,state:"on_hold",status:"in_progress",url:"https://reader.example/s3/e8"};
    const w=worker({"dasi.items":[existing]});
    const r=await w.save(book("Series",{type:"watching",season:1,episode:0,total:6,url:"https://catalog.example/series",synopsis:"Added summary"}));
    expect(r.conflict).toBe(false);
    expect(r.item).toMatchObject({season:3,episode:8,position:120,duration:900,total:12,progress:13,activityAt:10,state:"on_hold",url:existing.url,synopsis:"Added summary"});
    expect(r.item.sourceUrls).toEqual(expect.arrayContaining([existing.url,"https://catalog.example/series"]));
  });
  it("preserves decimal chapter progress and allows an explicit manual reset",async()=>{
    const w=worker();await w.save(book("Chapter fractions",{chapter:12.5,page:8}));
    await w.save(book("Chapter fractions",{chapter:0}));expect(w.data["dasi.items"][0]).toMatchObject({chapter:12.5,page:8});
    await w.save(book("Chapter fractions",{chapter:12.75}));expect(w.data["dasi.items"][0].chapter).toBe(12.75);expect(w.data["dasi.items"][0].page).toBeUndefined();
    await w.call({type:"UPDATE_ITEM",id:"chapter-fractions",patch:{chapter:0,page:0}});expect(w.data["dasi.items"][0].chapter).toBe(0);
  });
  it("updates translated automatic playback without a network lookup or duplicate",async()=>{
    const w=worker({"dasi.items":[{...book("Titre français"),id:"saved",type:"watching",alternativeTitles:["English title"],season:3,episode:8,position:120,duration:900,total:12}]});
    const r=await w.call({type:"VIDEO_PROGRESS",payload:{title:"English title",type:"watching",position:180,duration:900,confidence:.95}});
    expect(r.item).toMatchObject({id:"saved",season:3,episode:8,position:180,total:12});expect(w.data["dasi.items"]).toHaveLength(1);
  });
  it("advances an episode without retaining the previous playback position",async()=>{
    const w=worker({"dasi.items":[{...book("Series"),id:"series",type:"watching",season:3,episode:8,position:700,duration:900,total:12,progress:78}]});
    const r=await w.save(book("Series",{type:"watching",episode:9}));
    expect(r.item).toMatchObject({season:3,episode:9,total:12,progress:0});expect(r.item.position).toBeUndefined();expect(r.item.duration).toBeUndefined();
  });
  it("advances seasons without carrying the old episode total or timestamp",async()=>{
    const w=worker({"dasi.items":[{...book("Series"),id:"series",type:"watching",season:3,episode:8,position:700,duration:900,total:12}]});
    const r=await w.save(book("Series",{type:"watching",season:4,episode:1}));
    expect(r.item).toMatchObject({season:4,episode:1});expect(r.item.total).toBeUndefined();expect(r.item.position).toBeUndefined();
  });
  it("keeps historical progress when a metadata total is lower",async()=>{
    const w=worker({"dasi.items":[{...book("Manga"),id:"manga",chapter:8,total:12}]});
    const r=await w.save(book("Manga",{chapter:0,total:6}));expect(r.item).toMatchObject({chapter:8,total:12});
  });
  it("does not automatically track ambiguous or conflicting identities",async()=>{
    const w=worker({"dasi.items":[{...book("One"),id:"a",type:"watching",alternativeTitles:["Shared"],episode:3},{...book("Two"),id:"b",type:"watching",alternativeTitles:["Shared"],episode:7}]});
    const r=await w.call({type:"VIDEO_PROGRESS",payload:{title:"Shared",type:"watching",episode:8,position:180,duration:900,confidence:.95}});
    expect(r.skipped).toBe("not_tracked_or_ambiguous");expect(w.data["dasi.items"].map((i:any)=>i.episode)).toEqual([3,7]);
  });
  it("returns the same batch and single identities for search labels and previews",async()=>{
    const w=worker({"dasi.items":[{...book("French"),id:"a",year:2020,externalIds:{anilist:"1"}}]});
    const payload=book("English",{year:2021,externalIds:{anilist:"1"}});
    const batch=await w.call({type:"CHECK_EXISTING_BATCH",items:[payload,book("Unrelated")]});
    const single=await w.call({type:"CHECK_EXISTING",payload});expect(batch.matches).toEqual([single.existing.id,null]);
  });
});


describe("ambiguous saves and placeholder progress",()=>{
  it("does not insert another record when catalog mappings conflict",async()=>{
    const w=worker({"dasi.items":[{...book("A"),id:"a",externalIds:{anilist:"1",mal:"10"}},{...book("B"),id:"b",externalIds:{anilist:"2",mal:"20"}}]});
    await expect(w.save(book("A",{externalIds:{anilist:"1",mal:"20"}}))).rejects.toThrow("ambiguous_identity");
    expect(w.data["dasi.items"]).toHaveLength(2);
  });
  it("keeps zero placeholders from erasing the episode during real playback",async()=>{
    const w=worker({"dasi.items":[{...book("Series"),id:"series",type:"watching",season:3,episode:8,position:120,duration:900,total:12}]});
    const r=await w.save(book("Series",{type:"watching",episode:0,position:180,duration:900}));
    expect(r.item).toMatchObject({season:3,episode:8,position:180});
  });
  it("ignores a smaller reported total on an actual episode advance",async()=>{
    const w=worker({"dasi.items":[{...book("Series"),id:"series",type:"watching",season:3,episode:8,total:12}]});
    const r=await w.save(book("Series",{type:"watching",episode:9,total:6}));expect(r.item).toMatchObject({episode:9,total:12});
  });
  it("rejects late video and reading-page regressions",async()=>{
    const w=worker({"dasi.items":[{...book("Series"),id:"series",type:"watching",episode:8,position:180,duration:900},{...book("Manga"),id:"manga",chapter:12.5,page:8}]});
    const video=await w.save(book("Series",{type:"watching",episode:8,position:90,duration:900}));expect(video.conflict).toBe(true);expect(video.item.position).toBe(180);
    const page=await w.save(book("Manga",{chapter:0,page:3}));expect(page.conflict).toBe(true);expect(page.item).toMatchObject({chapter:12.5,page:8});
  });
  it("does not let a film ID veto a separate matching series identity",()=>{
    const w=worker();
    expect(w.run('findIdentity([{id:"film",title:"Film",type:"watching",format:"MOVIE",externalIds:{tmdb:"1"}},{id:"series",title:"Show",type:"watching",format:"SERIES",externalIds:{tmdb:"1"}}],{title:"Show",type:"watching",format:"SERIES",externalIds:{tmdb:"1"}}).id')).toBe("series");
  });
});


describe("durable metadata outcomes",()=>{
  const pending=(attempts=0)=>({jobId:"job",attempts,nextAttemptAt:0});
  it("uses a known Steam identity directly and completes the persisted job",async()=>{
    const w=worker({"dasi.items":[{id:"game",title:"Translated game",type:"game",released:true,externalIds:{steam:"620"},metadataPending:pending()}]});
    w.run('var requested=[];steamSearch=async()=>{throw Error("title search forbidden")};steamAppDetails=async id=>{requested.push(id);return {cover:"art",synopsis:"summary",genres:["Puzzle"],comingSoon:false}}');
    await w.run("runImportEnrichment()");
    expect(w.run("requested")).toEqual(["620"]);
    expect(w.data["dasi.items"][0]).toMatchObject({externalIds:{steam:"620"},cover:"art",synopsis:"summary",tags:["Puzzle"],metadataStatus:{state:"matched",attempts:1}});
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
  });
  it("never chooses a namesake when an exact Steam lookup fails",async()=>{
    const w=worker({"dasi.items":[{id:"game",title:"Portal",type:"game",url:"https://store.steampowered.com/app/620",metadataPending:pending(4)}]});
    w.run('var searched=0;steamSearch=async()=>{searched++;return [{title:"Portal",type:"game",externalIds:{steam:"400"}}]};steamAppDetails=async()=>{throw Error("offline")}');
    await w.run("runImportEnrichment()");
    expect(w.run("searched")).toBe(0);
    expect(w.data["dasi.items"][0]).toMatchObject({metadataStatus:{state:"failed",attempts:5}});
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
    expect(w.data["dasi.items"][0].externalIds).toBeUndefined();
  });
  it("retains a visible unmatched outcome after the third empty result",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Unknown",type:"reading",chapter:7,metadataPending:pending(2)}]});
    w.run('catalogSearchAll=async()=>[]');await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0]).toMatchObject({chapter:7,metadataStatus:{state:"not_found",attempts:3}});
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
  });
  it("records partial metadata instead of reporting a complete work",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Partial",type:"reading",metadataPending:pending()}]});
    w.run('catalogSearchAll=async()=>[{title:"Partial",type:"reading",synopsis:"Summary without artwork"}]');await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0].metadataStatus.state).toBe("partial");
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
  });
  it("stops ambiguous matches without selecting one at random",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Homonym",type:"watching",metadataPending:pending()}]});
    w.run('catalogSearchAll=async()=>[{title:"Homonym",type:"watching",year:2000},{title:"Homonym",type:"watching",year:2020}]');await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0].metadataStatus.state).toBe("ambiguous");
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
  });
  it("preserves edits made during a lookup while filling untouched fields",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Concurrent",type:"reading",chapter:3,metadataPending:pending()}]});
    w.run('catalogSearchAll=async()=>{const {"dasi.items":items}=await chrome.storage.local.get("dasi.items");items[0]={...items[0],chapter:9,cover:"manual",coverOverride:"manual",synopsis:"My summary",updatedAt:99};await chrome.storage.local.set({"dasi.items":items});return [{title:"Concurrent",type:"reading",cover:"remote",synopsis:"Remote summary",externalIds:{mal:"7"},genres:["Adventure"]}]}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0]).toMatchObject({chapter:9,cover:"manual",synopsis:"My summary",tags:["Adventure"],externalIds:{mal:"7"},metadataStatus:{state:"matched"}});
  });
  it("ignores an old success after replacement by a new job with the same attempt count",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Reimport",type:"reading",metadataPending:pending()}]});
    w.run('catalogSearchAll=async()=>{const {"dasi.items":items}=await chrome.storage.local.get("dasi.items");items[0].metadataPending={jobId:"new-job",attemptId:"new-attempt",attempts:1,state:"running",nextAttemptAt:Date.now()+120000};items[0].metadataStatus={state:"running",attempts:1};await chrome.storage.local.set({"dasi.items":items});return [{title:"Reimport",type:"reading",cover:"obsolete",synopsis:"obsolete"}]}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0].cover).toBeUndefined();
    expect(w.data["dasi.items"][0].metadataPending).toMatchObject({jobId:"new-job",attemptId:"new-attempt",attempts:1});
    expect(w.data["dasi.items"][0].metadataStatus.state).toBe("running");
  });
  it("ignores a late failure after another job already completed",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Reimport",type:"reading",metadataPending:pending(4)}]});
    w.run('catalogSearchAll=async()=>{await chrome.storage.local.set({"dasi.items":[{id:"work",title:"Reimport",type:"reading",cover:"new",synopsis:"new",metadataStatus:{state:"matched",attempts:1}}]});throw Error("old request failed")}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0]).toMatchObject({cover:"new",metadataStatus:{state:"matched",attempts:1}});
    expect(w.data["dasi.items"][0].metadataPending).toBeFalsy();
  });
  it("rejects a stale attempt of the same job",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Restart",type:"reading",metadataPending:pending()}]});
    w.run('catalogSearchAll=async()=>{const {"dasi.items":items}=await chrome.storage.local.get("dasi.items");items[0].metadataPending={...items[0].metadataPending,attemptId:"restart-attempt",attempts:2,nextAttemptAt:Date.now()+120000};await chrome.storage.local.set({"dasi.items":items});return [{title:"Restart",type:"reading",cover:"old",synopsis:"old"}]}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0].cover).toBeUndefined();
    expect(w.data["dasi.items"][0].metadataPending).toMatchObject({attemptId:"restart-attempt",attempts:2});
  });
  it("lets another work finish when a provider fails and retries with backoff",async()=>{
    const w=worker({"dasi.items":[{id:"bad",title:"Offline",type:"reading",metadataPending:pending()},{id:"good",title:"Available",type:"reading",metadataPending:{...pending(),jobId:"other"}}]});
    w.run('catalogSearchAll=async title=>{if(title==="Offline")throw Error("offline");return [{title,type:"reading",cover:"art",synopsis:"summary"}]}');
    await w.run("runImportEnrichment()");
    expect(w.data["dasi.items"][0].metadataStatus.state).toBe("retrying");
    expect(w.data["dasi.items"][0].metadataPending.nextAttemptAt).toBeGreaterThan(Date.now()+50000);
    expect(w.data["dasi.items"][1].metadataStatus.state).toBe("matched");
  });
  it("reclaims an expired attempt after worker restart",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Restart",type:"reading",metadataPending:{...pending(1),attemptId:"old",state:"running"}}]});
    w.run('var claim;catalogSearchAll=async()=>{claim=(await read(ITEMS_KEY,[]))[0].metadataPending;return [{title:"Restart",type:"reading",cover:"art",synopsis:"summary"}]}');await w.run("runImportEnrichment()");
    expect(w.run("claim.attemptId")).not.toBe("old");expect(w.run("claim.jobId")).toBe("job");expect(w.run("claim.attempts")).toBe(2);
    expect(w.data["dasi.items"][0].metadataStatus).toMatchObject({state:"matched",attempts:2});
  });
  it("persists manual retries with a new token without duplicating active jobs",async()=>{
    const w=worker({"dasi.items":[{id:"retry",title:"Retry",type:"reading",metadataStatus:{state:"failed"}},{id:"active",title:"Active",type:"reading",metadataPending:pending()}]});
    w.run('runImportEnrichment=async()=>{}');
    const result=await w.call({type:"QUEUE_MISSING_METADATA"});
    expect(result).toMatchObject({ok:true,queued:1});expect(result.items[0].metadataPending.jobId).toBeTruthy();expect(result.items[1].metadataPending.jobId).toBe("job");
    expect(w.data["dasi.items"][0].metadataStatus.state).toBe("queued");
  });
});

describe("catalog resilience and aggregation",()=>{
  it("tries the secondary manga catalog after an empty primary response",async()=>{
    const w=worker();w.run('anilistSearch=async()=>[];jikanSearch=async()=>[{title:"Secondary result",type:"reading"}]');
    expect((await w.run('mangaSearchResilient("query")'))[0].title).toBe("Secondary result");
  });
  it("keeps remakes and conflicting provider identities in the results",()=>{
    const w=worker();w.ctx.catalog=[{title:"Remake",type:"watching",season:1999},{title:"Remake",type:"watching",season:2024},{title:"Portal",type:"game",externalIds:{steam:"400"}},{title:"Portal",type:"game",externalIds:{steam:"620"}}];
    const result=w.run("mergeCatalogResults(catalog)");expect(result).toHaveLength(4);expect(result[0].year).toBe(1999);
  });
  it("combines complementary metadata only for the same identity",()=>{
    const w=worker();w.ctx.catalog=[{title:"Français",type:"reading",externalIds:{mal:"7"},source:"anilist",genres:["Action"],cover:"art"},{title:"English",type:"reading",externalIds:{mal:"7"},source:"jikan",genres:["Mystery"],synopsis:"Summary"}];
    const result=w.run("mergeCatalogResults(catalog)");expect(result).toHaveLength(1);expect(result[0]).toMatchObject({cover:"art",synopsis:"Summary",genres:["Action","Mystery"],catalogSources:["anilist","jikan"]});expect(result[0].alternativeTitles).toContain("English");
  });
});


describe("metadata completion across serialization",()=>{
  it("keeps a completed job cleared after JSON serialization and a sync merge",async()=>{
    const w=worker({"dasi.items":[{id:"work",title:"Synced",type:"reading",updatedAt:1,metadataPending:{jobId:"old",attempts:0,nextAttemptAt:0}}]});
    w.run('catalogSearchAll=async()=>[{title:"Synced",type:"reading",cover:"art",synopsis:"summary"}]');
    const before=structuredClone(w.data["dasi.items"]);
    await w.run("runImportEnrichment()");
    const after=JSON.parse(JSON.stringify(w.data["dasi.items"]));
    expect(after[0].metadataPending).toBeNull();
    w.ctx.remote={items:before,updatedAt:1};w.ctx.incoming={items:after,updatedAt:Date.now()};
    const merged=w.run("YomuSync.mergeBlobs(remote,incoming)");
    expect(merged.items[0].metadataPending).toBeNull();
    expect(merged.items[0].metadataStatus.state).toBe("matched");
  });
});


describe("extension trust boundary",()=>{
  const page={id:"test",url:"https://reader.example/episode-1",tab:{id:12}};
  it("refuses page access to accounts, settings, backups and library mutations",async()=>{
    const w=worker({"dasi.items":[{id:"private",...book("Private")}],"dasi.settings":{ocrKey:"test-private-key"}});
    for(const type of ["GET_STATE","SET_SETTINGS","SYNC_STATUS","SYNC_SIGN_IN","IMPORT_MERGE","REMOVE_ITEM","LIST_DELETE","TEST_IMG_SERVER"]){
      const result=await w.call({type,id:"private",patch:{ocrKey:"replaced"}},page);
      expect(result).toEqual({ok:false,error:"forbidden_message"});
    }
    expect(w.data["dasi.items"][0].id).toBe("private");
    expect(w.data["dasi.settings"].ocrKey).toBe("test-private-key");
  });
  it("fails closed for absent senders and lookalike extension origins",async()=>{
    const w=worker();
    for(const sender of [{},{id:"other",url:"chrome-extension://test/library.html"},{id:"test",url:"https://test/library.html"},{id:"test",url:"chrome-extension://test.evil/library.html"}])expect((await w.call({type:"GET_STATE"},sender)).error).toBe("forbidden_message");
    expect((await w.call(null)).error).toBe("invalid_message");
    expect((await w.call({type:"GET_STATE"})).items).toEqual([]);
  });
  it("limits browser storage to trusted extension contexts",async()=>{
    const w=worker();await w.run("storageProtection");
    expect(w.accessLevels).toEqual(["local:TRUSTED_CONTEXTS","sync:TRUSTED_CONTEXTS"]);
  });
  it("binds detections to their sender and ignores privileged fields",async()=>{
    const w=worker();
    expect((await w.call({type:"DETECTION_UPDATED",payload:{title:"Show",type:"watching",url:"https://attacker.example",id:"private",metadataPending:{},episode:4}},page)).ok).toBe(true);
    expect(w.data["dasi.currentDetection"]).toMatchObject({url:page.url,domain:"reader.example",tabId:12,episode:4});
    expect(w.data["dasi.currentDetection"].id).toBeUndefined();
    expect(w.data["dasi.currentDetection"].metadataPending).toBeUndefined();
    expect((await w.call({type:"DETECTION_UPDATED",payload:{title:[],type:"watching"}},page)).error).toBe("invalid_detection");
  });
  it("saves normal video progress without returning private library fields to a page",async()=>{
    const w=worker({"dasi.items":[{id:"show",...book("Show",{type:"watching",episode:1,position:5,synopsis:"Private note"})}]});
    const result=await w.call({type:"VIDEO_PROGRESS",payload:{title:"Show",type:"watching",episode:1,position:30,duration:100,confidence:.9}},page);
    expect(result.ok).toBe(true);expect(result.item).toBeUndefined();expect(w.data["dasi.items"][0].position).toBe(30);
  });
  it("rejects malformed and oversized page translation requests before fetch",async()=>{
    const w=worker();
    for(const texts of ["not-an-array",[{}],Array(401).fill("a"),["a".repeat(10001)]])expect((await w.call({type:"DASI_MT",texts},page)).error).toBe("invalid_translation");
  });
  it("keeps API keys device-local when settings are mirrored",async()=>{
    const w=worker();await w.call({type:"SET_SETTINGS",patch:{lang:"fr",ocrKey:"private-ocr",tmdbKey:"private-tmdb",rawgKey:"private-rawg",imgServer:"https://service.example?token=secret",profile:{name:"Reader"}}});
    expect(w.data["dasi.settings"].ocrKey).toBe("private-ocr");
    expect(w.synced["dasi.settings"]).toMatchObject({lang:"fr",profile:{name:"Reader"}});
    for(const key of ["ocrKey","tmdbKey","rawgKey","imgServer"])expect(w.synced["dasi.settings"][key]).toBeUndefined();
  });
  it("does not activate service credentials or endpoints from an imported backup",async()=>{
    const w=worker();await w.call({type:"IMPORT_STATE",payload:{settings:{lang:"fr",ocrKey:"untrusted",imgServer:"https://attacker.example",unknownSecret:"hidden"}}});
    expect(w.data["dasi.settings"].lang).toBe("fr");expect(w.data["dasi.settings"].ocrKey).toBe("");expect(w.data["dasi.settings"].imgServer).toBe("");expect(w.data["dasi.settings"].unknownSecret).toBeUndefined();
  });
  it("rejects insecure account endpoints before transmitting credentials",async()=>{
    const w=worker();let calls=0;w.ctx.fetch=async()=>{calls++;throw Error("unexpected_network");};
    for(const url of ["http://sync.example/api","https://name:password@sync.example/api","https://sync.example/api?token=secret","file:///tmp/data"]) {
      w.ctx.endpoint=url;await expect(w.run('syncAuth("/auth/login",endpoint,"user@example.test","private")')).rejects.toThrow();
    }
    expect(calls).toBe(0);expect(w.run('syncEndpoint("http://127.0.0.1:3000/api/")')).toBe("http://127.0.0.1:3000/api");
    expect(w.run('syncEndpoint("https://sync.example/api/")')).toBe("https://sync.example/api");
  });
  it("forbids redirects and ambient cookies on authenticated requests",async()=>{
    const w=worker();let options:any;w.ctx.fetch=async(_url:any,init:any)=>{options=init;return {ok:true};};
    await w.run('apiCall({apiUrl:"https://sync.example/api",token:"test-token"},"/sync")');
    expect(options.redirect).toBe("error");expect(options.credentials).toBe("omit");expect(options.headers.Authorization).toBe("Bearer test-token");
  });
});

it("accepts raster panels but rejects local-network, executable and credential URLs",()=>{
  const w=worker();
  for(const url of ["file:///private","javascript:alert(1)","data:image/svg+xml;base64,PHN2Zz4=","https://u:p@cdn.example/image.png","http://localhost/image.png","http://127.1/image.png","http://2130706433/image.png","http://10.0.0.1/a","http://192.168.1.2/a","http://172.20.1.1/a","http://169.254.169.254/a","http://[::1]/a"]){w.ctx.panel=url;expect(()=>w.run("safePanelSource(panel)")).toThrow();}
  expect(w.run('safePanelSource("https://cdn.example/panel.jpg")')).toBe("https://cdn.example/panel.jpg");
  expect(w.run('safePanelSource("data:image/png;base64,YWJj")')).toBe("data:image/png;base64,YWJj");
});
it("rejects non-image and oversized downloads before OCR",async()=>{
  const w=worker();w.ctx.fetch=async()=>({ok:true,headers:{get:()=>null},blob:async()=>({type:"text/html",size:10})});
  await expect(w.run('fetchBlob("https://cdn.example/panel")')).rejects.toThrow("invalid_image_type");
  w.ctx.fetch=async()=>({ok:true,headers:{get:()=>String(30*1024*1024)},blob:async()=>{throw Error("must_not_read");}});
  await expect(w.run('fetchBlob("https://cdn.example/panel")')).rejects.toThrow("image_too_large");
});

it("retains the episode page when progress comes from an embedded player",async()=>{
  const w=worker();const sender={id:"test",url:"https://player.example/embed/123",tab:{id:4,url:"https://reader.example/show/episode-2"}};
  await w.call({type:"DETECTION_UPDATED",payload:{title:"Show",type:"watching",episode:2}},sender);
  expect(w.data["dasi.currentDetection"].url).toBe(sender.tab.url);
});

it("migrates legacy synced credentials locally without overwriting local preferences",async()=>{
  const w=worker({"dasi.settings":{lang:"fr",ocrKey:"current-local"}},{"dasi.settings":{lang:"en",ocrKey:"old-synced",rawgKey:"legacy-rawg",imgServer:"https://service.example"}});
  await w.run("startupSecurity");
  expect(w.data["dasi.settings"]).toMatchObject({lang:"fr",ocrKey:"current-local",rawgKey:"legacy-rawg"});
  expect(w.synced["dasi.settings"]).toEqual({lang:"en"});
});

describe("RAWG game catalogue metadata", () => {
  it("retains every supplied genre and platform without inventing PC", async () => {
    const w=worker();let requested="";
    w.ctx.fetch=async (url:string)=>{requested=String(url);return {ok:true,json:async()=>({results:[{name:"Console game",slug:"console-game",released:"2028-04-12",background_image:"https://images.example.test/game.jpg",genres:[{name:"Action"},{name:"Adventure"},{name:"RPG"},{name:"Puzzle"},{name:"Indie"}],tags:[{name:"Story Rich"},{name:"Co-op"},{name:"Story Rich"}],platforms:[{platform:{name:"Nintendo Switch"}},{platform:{name:"PlayStation 5"}}]}]})};};
    const results=await w.run('rawgSearch("Console game","test-key")');
    expect(new URL(requested).searchParams.get("page_size")).toBe("30");
    expect(results[0].genres).toHaveLength(5);expect(results[0].tags).toEqual(["Story Rich","Co-op"]);
    expect(results[0].platforms).toEqual(["Nintendo Switch","PlayStation 5"]);
    expect(results[0].platform).not.toContain("PC");expect(results[0].year).toBe(2028);expect(results[0].source).toBe("rawg");
  });
  it("handles missing and malformed optional metadata without false platform claims",async()=>{
    const w=worker();w.ctx.fetch=async()=>({ok:true,json:async()=>({results:[null,{name:""},{name:"Unknown",platforms:{},genres:null,tags:[null],released:"not-a-date",background_image:"javascript:alert(1)"}]})});
    const results=await w.run('rawgSearch("Unknown","test-key")');expect(results).toHaveLength(1);expect(results[0].platform).toBe("");expect(results[0].cover).toBe("");expect(results[0].releaseDate).toBeUndefined();expect(results[0].genres).toEqual([]);
  });
  it("treats malformed provider responses as failures rather than an empty catalogue",async()=>{
    const w=worker();w.ctx.fetch=async()=>({ok:true,json:async()=>({results:{}})});
    await expect(w.run('rawgSearch("Game","test-key")')).rejects.toThrow("rawg_response_invalid");
  });
});


describe("RAWG detail identity and store safety",()=>{
  const detail={id:123,name:"Console game",name_original:"Original name",alternative_names:["Other name"],description:"<p>A complete adventure.</p>",background_image:"https://images.example.test/game.jpg",platforms:[{platform:{name:"Switch"}}],genres:[{name:"Adventure"}],tags:[{name:"Co-op"}],developers:[{name:"Studio"}]};
  it("loads by stable ID, coalesces repeated requests and caches only provider fields",async()=>{
    const w=worker({"dasi.settings":{rawgKey:"test-key"}});const calls:string[]=[];
    w.ctx.fetch=async(url:string,init:any)=>{calls.push(String(url));expect(init.credentials).toBe("omit");expect(init.redirect).toBe("error");return {ok:true,json:async()=>String(url).includes("/stores?")?{results:[{game_id:123,url:"https://www.gog.com/game/example"},{game_id:123,url:"https://store.epicgames.com/en-US/p/example"},{game_id:123,url:"https://www.gog.com/game/example"},{game_id:456,url:"https://www.gog.com/game/wrong"},{url:"javascript:alert(1)"},{url:"https://www.gog.com.evil.test/game/x"},{url:"https://u:p@www.gog.com/game/x"},{url:"https://www.gog.com:444/game/x"}]}:detail};};
    const results=await Promise.all([w.run('catalogDetail({title:"My title",type:"game",externalIds:{rawg:"123"},tags:["My tag"]})'),w.run('catalogDetail({title:"Other title",type:"game",externalIds:{rawg:"123"}})')]);
    expect(calls).toHaveLength(2);expect(results[0].title).toBe("My title");expect(results[1].title).toBe("Other title");
    expect(results[0].synopsis).toBe("A complete adventure.");expect(results[0].tags).toEqual(["My tag","Co-op"]);expect(results[0].authors).toEqual(["Studio"]);
    expect(results[0].storeLinks).toEqual(["https://www.gog.com/game/example","https://store.epicgames.com/en-US/p/example"]);
    await w.run('catalogDetail({title:"Again",type:"game",externalIds:{rawg:"123"}})');expect(calls).toHaveLength(2);
  });
  it("does not request stores or cache a mismatched provider identity",async()=>{
    const w=worker();let calls=0;w.ctx.fetch=async()=>{calls++;return {ok:true,json:async()=>({...detail,id:456})};};
    await expect(w.run('rawgDetails("123","key")')).rejects.toThrow("catalog_identity_mismatch");
    await expect(w.run('rawgDetails("123","key")')).rejects.toThrow("catalog_identity_mismatch");expect(calls).toBe(2);
  });
  it("retains useful details and existing store links if the store service is unavailable",async()=>{
    const w=worker({"dasi.settings":{rawgKey:"key"}});w.ctx.fetch=async(url:string)=>String(url).includes("/stores?")?{ok:false,status:403}:{ok:true,json:async()=>detail};
    const result=await w.run('catalogDetail({title:"Game",type:"game",externalIds:{rawg:"123"},storeLinks:["https://www.gog.com/game/example"]})');
    expect(result.synopsis).toBe("A complete adventure.");expect(result.storeLinks).toEqual(["https://www.gog.com/game/example"]);
  });
  it("does not fall back to an unrelated Steam game when a RAWG key is absent",async()=>{
    const w=worker();let calls=0;w.ctx.fetch=async()=>{calls++;throw Error("unexpected");};
    await expect(w.run('catalogDetail({title:"Game",type:"game",externalIds:{rawg:"123"}})')).rejects.toThrow("rawg_unavailable");expect(calls).toBe(0);
  });
  it("keeps same-named games with contradictory RAWG IDs separate",async()=>{
    const w=worker();await w.save({title:"Game",type:"game",externalIds:{rawg:"123"}});await w.save({title:"Game",type:"game",externalIds:{rawg:"456"}});
    expect(w.data["dasi.items"]).toHaveLength(2);expect(w.data["dasi.items"].map((i:any)=>i.externalIds.rawg).sort()).toEqual(["123","456"]);
  });
  it("preserves saved metadata and custom tags when refreshing through the public message",async()=>{
    const w=worker({"dasi.settings":{rawgKey:"key"},"dasi.items":[{id:"game",title:"My game",type:"game",externalIds:{rawg:"123"},tags:["Custom"],synopsis:"My notes",coverOverride:"data:image/png;base64,YQ==",cover:"https://images.example.test/mine.png",updatedAt:1}]});
    w.ctx.fetch=async(url:string)=>({ok:true,json:async()=>String(url).includes("/stores?")?{results:[{game_id:123,url:"https://www.gog.com/game/example"}]}:detail});
    const result=await w.call({type:"GAME_ENRICH",id:"game",force:true});expect(result.ok).toBe(true);
    const saved=w.data["dasi.items"][0];expect(saved.tags).toEqual(["Custom"]);expect(saved.synopsis).toBe("My notes");expect(saved.cover).toBe("https://images.example.test/mine.png");expect(saved.genres).toEqual(["Adventure"]);expect(saved.storeLinks).toEqual(["https://www.gog.com/game/example"]);
  });
});


describe("game metadata refresh races",()=>{
  const seed=()=>({"dasi.settings":{rawgKey:"key"},"dasi.items":[{id:"game",title:"Game",type:"game",externalIds:{rawg:"123"},updatedAt:1,tags:[]}]});
  function deferred(w:ReturnType<typeof worker>){
    let release!:(value:any)=>void,started!:()=>void;
    const began=new Promise<void>(resolve=>{started=resolve;});
    const response=new Promise(resolve=>{release=resolve;});
    w.ctx.fetch=async(url:string)=>{if(String(url).includes("/stores?"))return {ok:true,json:async()=>({results:[]})};started();return response;};
    return {began,finish:()=>release({ok:true,json:async()=>({id:123,name:"Game",description:"Remote synopsis",background_image:"https://images.example.test/remote.png",tags:[{name:"Remote tag"}]})})};
  }
  it("preserves edits made while game details are downloading",async()=>{
    const w=worker(seed()),request=deferred(w),pending=w.call({type:"GAME_ENRICH",id:"game",force:true});await request.began;
    Object.assign(w.data["dasi.items"][0],{synopsis:"My revised synopsis",tags:["My tag"],coverOverride:"custom",cover:"https://images.example.test/mine.png"});
    request.finish();const result=await pending;expect(result.ok).toBe(true);
    expect(w.data["dasi.items"][0]).toMatchObject({synopsis:"My revised synopsis",tags:["My tag"],cover:"https://images.example.test/mine.png"});
  });
  it("does not recreate a game removed while its refresh was running",async()=>{
    const w=worker(seed()),request=deferred(w),pending=w.call({type:"GAME_ENRICH",id:"game",force:true});await request.began;
    w.data["dasi.items"]=[];request.finish();const result=await pending;
    expect(result.ok).toBe(false);expect(result.status).toBe("stale");expect(w.data["dasi.items"]).toEqual([]);
  });
  it("does not apply a response after the catalogue identity was changed",async()=>{
    const w=worker(seed()),request=deferred(w),pending=w.call({type:"GAME_ENRICH",id:"game",force:true});await request.began;
    w.data["dasi.items"][0].externalIds={rawg:"456"};request.finish();const result=await pending;
    expect(result.status).toBe("stale");expect(w.data["dasi.items"][0].synopsis).toBeUndefined();expect(w.data["dasi.items"][0].externalIds.rawg).toBe("456");
  });
  it("does not write an old account's response into a new account",async()=>{
    const w=worker(seed()),request=deferred(w),pending=w.call({type:"GAME_ENRICH",id:"game",force:true});await request.began;
    w.run("accountEpoch++");w.data["dasi.items"]=[{id:"other",title:"Other account",type:"game"}];request.finish();
    expect((await pending).status).toBe("stale");expect(w.data["dasi.items"]).toEqual([{id:"other",title:"Other account",type:"game"}]);
  });
});



describe("resilient game detail providers",()=>{
  it("uses the established Steam identity when RAWG is offline",async()=>{
    const w=worker({"dasi.settings":{rawgKey:"key"}});
    w.run('var requested=[];rawgDetails=async()=>{throw Error("offline")};steamAppDetails=async id=>{requested.push(id);return {synopsis:"Steam summary",genres:["Adventure"],trailer:"https://cdn.example.test/trailer.mp4"}}');
    const result=await w.run('catalogDetail({title:"Game",type:"game",externalIds:{rawg:"123",steam:"620"},storeLinks:["https://www.gog.com/game/example"]})');
    expect(w.run("requested")).toEqual(["620"]);expect(result.synopsis).toBe("Steam summary");
    expect(result.externalIds).toEqual({rawg:"123",steam:"620"});expect(result.storeLinks).toContain("https://www.gog.com/game/example");expect(result.storeLinks).toContain("https://store.steampowered.com/app/620/");
  });
  it("still opens a Steam-backed game after its optional RAWG key is removed",async()=>{
    const w=worker();w.run('steamAppDetails=async()=>({synopsis:"Available on Steam",genres:[]})');
    const result=await w.run('catalogDetail({title:"Game",type:"game",externalIds:{rawg:"123",steam:"620"}})');
    expect(result.synopsis).toBe("Available on Steam");
  });
  it("uses RAWG when the established Steam source fails and combines successful sources",async()=>{
    const w=worker();
    w.run('steamAppDetails=async()=>{throw Error("offline")};rawgDetails=async()=>({externalIds:{rawg:"123"},synopsis:"RAWG summary",platform:"Nintendo Switch",genres:["RPG"],tags:["Co-op"],storeLinks:["https://www.gog.com/game/example"]})');
    const first=await w.run('catalogDetail({title:"Game",type:"game",externalIds:{rawg:"123",steam:"620"}})');expect(first.synopsis).toBe("RAWG summary");
    w.run('steamAppDetails=async()=>({synopsis:"Short summary",genres:["Adventure"],trailer:"https://cdn.example.test/video.mp4",news:[{title:"Update"}]})');
    const both=await w.run('catalogDetail({title:"Game",type:"game",externalIds:{rawg:"123",steam:"620"},platform:"PlayStation 5",tags:["My tag"]})');
    expect(both.synopsis).toBe("RAWG summary");expect(both.trailer).toBe("https://cdn.example.test/video.mp4");
    expect(both.news).toEqual([{title:"Update"}]);expect(both.genres).toEqual(["Adventure","RPG"]);
    expect(both.platforms).toEqual(["PlayStation 5","Nintendo Switch"]);expect(both.tags).toEqual(["My tag","Co-op"]);
  });
  it("preserves all game platforms and stores regardless of search response order",()=>{
    const w=worker();w.ctx.a={title:"Game",type:"game",platform:"Steam",genres:["Action"],url:"https://store.steampowered.com/app/620/"};
    w.ctx.b={title:"Game",type:"game",platforms:["Nintendo Switch","PlayStation 5"],platform:"Nintendo Switch · PlayStation 5",tags:["Co-op"],storeLinks:["https://www.gog.com/game/example"]};
    for(const expression of ["combineCatalogEntries(a,b)","combineCatalogEntries(b,a)"]) {
      const result=w.run(expression);expect(result.platforms).toEqual(["Nintendo Switch","PlayStation 5"]);expect(result.platform).not.toContain("Steam");
      expect([...result.storeLinks].sort()).toEqual(["https://store.steampowered.com/app/620/","https://www.gog.com/game/example"].sort());
    }
  });
  it("does not erase useful metadata when a provider returns empty fields",()=>{
    const w=worker();const result=w.run('mergeGameDetails({title:"Game",synopsis:"Existing",cover:"art",releaseDate:"2028-01-01",genres:["Puzzle"]},{synopsis:"",cover:undefined,releaseDate:null,genres:[]})');
    expect(result).toMatchObject({synopsis:"Existing",cover:"art",releaseDate:"2028-01-01",genres:["Puzzle"]});
  });
  it("never interprets unrelated or deceptive app URLs as Steam IDs",()=>{
    const w=worker();
    for(const url of ["https://other.example/app/620","https://store.steampowered.com.evil.test/app/620","https://store.steampowered.com@evil.test/app/620","https://u:p@store.steampowered.com/app/620","https://store.steampowered.com:444/app/620","https://store.steampowered.com/search?q=/app/620","https://store.steampowered.com/app/620fake","file:///app/620"]) {
      w.ctx.value=url;expect(w.run("steamAppId(value)")).toBe("");
    }
    expect(w.run('steamAppId("https://store.steampowered.com/app/620/Portal_2/?l=french")')).toBe("620");
  });
  it("rejects contradictory Steam identities before making requests",async()=>{
    const w=worker();w.run('steamAppDetails=async()=>{throw Error("must_not_request")};rawgDetails=async()=>{throw Error("must_not_request")}');
    await expect(w.run('catalogDetail({title:"Game",type:"game",url:"https://store.steampowered.com/app/400/",externalIds:{steam:"620",rawg:"123"}})')).rejects.toThrow("catalog_identity_mismatch");
  });
  it("keeps more than six Steam genres and rejects a mismatched response ID",async()=>{
    const w=worker();let mismatch=false;
    w.ctx.fetch=async(url:string)=>({ok:true,json:async()=>String(url).includes("GetNewsForApp")?{appnews:{newsitems:[]}}:{"620":{success:true,data:{steam_appid:mismatch?400:620,short_description:"Summary",genres:Array.from({length:10},(_,n)=>({description:"Genre "+n}))}}}});
    expect((await w.run('steamAppDetails("620")')).genres).toHaveLength(10);
    mismatch=true;await expect(w.run('steamAppDetails("620")')).rejects.toThrow("catalog_identity_mismatch");
  });
  it("persists merged metadata through refresh while keeping the user's tags and synopsis",async()=>{
    const w=worker({"dasi.items":[{id:"game",title:"Game",type:"game",externalIds:{steam:"620",rawg:"123"},platform:"PlayStation 5",tags:["Custom"],synopsis:"Custom summary",updatedAt:1}]});
    w.run('steamAppDetails=async()=>({genres:["Adventure"],news:[],trailer:"https://cdn.example.test/video.mp4"});rawgDetails=async()=>({externalIds:{rawg:"123"},synopsis:"Provider summary",platform:"Nintendo Switch",tags:["Co-op"],storeLinks:["https://www.gog.com/game/example"]})');
    const result=await w.call({type:"GAME_ENRICH",id:"game",force:true});expect(result.ok).toBe(true);
    const item=w.data["dasi.items"][0];expect(item.tags).toEqual(["Custom"]);expect(item.synopsis).toBe("Custom summary");
    expect(item.platform).toBe("PlayStation 5 · Nintendo Switch");expect(item.trailer).toBe("https://cdn.example.test/video.mp4");expect(item.storeLinks).toHaveLength(2);
  });
});

describe("tracked episode notification delivery",()=>{
  const seed=()=>({id:"show",title:"Series",type:"watching",season:1,episode:2,externalIds:{tvmaze:"42"},releaseCheckedAt:Date.now()-86400000});
  it("establishes a silent initial baseline",async()=>{
    const item={...seed(),releaseCheckedAt:undefined};
    const w=worker({"dasi.items":[item]});
    w.ctx.releases=[{season:1,episode:3,at:Date.now()-1000}];
    w.run("fetchTrackedReleases=async()=>releases");
    await w.run("checkTrackedReleasesOnce()");
    expect(w.data["dasi.notifications"]||[]).toHaveLength(0);
    expect(w.data["dasi.items"][0].releasedTotal).toBe(3);
  });
  it("persists one French notification and its baseline without repeats",async()=>{
    const w=worker({"dasi.items":[seed()],"dasi.settings":{lang:"fr"}});
    w.ctx.releases=[{season:1,episode:3,at:Date.now()-1000},{season:1,episode:4,at:Date.now()-500}];
    w.run("fetchTrackedReleases=async()=>releases");
    await w.run("checkTrackedReleasesOnce()");
    expect(w.data["dasi.notifications"]).toHaveLength(1);
    expect(w.data["dasi.notifications"][0].message).toBe("2 nouveaux épisodes disponibles");
    await w.run("checkTrackedReleasesOnce()");
    expect(w.data["dasi.notifications"]).toHaveLength(1);
  });
  it("honors mute and paused status while updating the baseline",async()=>{
    for(const patch of [{notifyUpdates:false},{status:"on_hold"},{}]){
      const w=worker({"dasi.items":[{...seed(),...patch}],"dasi.settings":Object.keys(patch).length?{}:{notifyNew:false}});
      w.ctx.releases=[{season:1,episode:3,at:Date.now()-1000}];
      w.run("fetchTrackedReleases=async()=>releases");
      await w.run("checkTrackedReleasesOnce()");
      expect(w.data["dasi.notifications"]||[]).toHaveLength(0);
      expect(w.data["dasi.items"][0].releaseCheckedAt).toBeGreaterThan(Date.now()-60000);
    }
  });
  it("excludes watched, old and future episodes but includes the next season",()=>{
    const w=worker();const now=Date.now();w.ctx.now=now;
    w.ctx.episodes=[{season:1,episode:2,at:now-100},{season:1,episode:3,at:now-100000},{season:2,episode:1,at:now-50},{season:2,episode:2,at:now+50}];
    expect(w.run("freshTrackedReleases({season:1,episode:2,releaseCheckedAt:now-1000},episodes,{},now)")).toEqual([{season:2,episode:1,at:now-50}]);
  });
  it("uses progress edited during a fetch and rejects account changes",async()=>{
    for(const accountChange of [false,true]){
      const w=worker({"dasi.items":[seed()]});
      w.run("fetchTrackedReleases=()=>new Promise(resolve=>{globalThis.finishRelease=resolve})");
      const pending=w.run("checkTrackedReleasesOnce()");
      for(let n=0;n<50&&!w.run("typeof finishRelease==='function'");n++)await new Promise(r=>setTimeout(r,2));
      if(accountChange)w.run("accountEpoch++");
      else w.data["dasi.items"][0].episode=3;
      w.ctx.releases=[{season:1,episode:3,at:Date.now()-1000}];
      w.run("finishRelease(releases)");
      await pending;
      expect(w.data["dasi.notifications"]||[]).toHaveLength(0);
    }
  });
});

describe("game alerts across store destinations",()=>{
  const game=()=>({id:"g",title:"Game",type:"game",url:"https://www.gog.com/en/game/example",externalIds:{steam:"123"},released:true,gameNewsCheckedAt:Date.now()-86400000});
  it("uses a known Steam identity independently of the saved destination",async()=>{
    const w=worker({"dasi.items":[game()]});
    w.run("steamNews=async id=>{if(id!=='123')throw Error('wrong id');return [{id:'post',title:'Patch 2',publishedAt:Date.now()-1000}]}");
    await w.run("checkGameNewsOnce()");
    expect(w.data["dasi.notifications"]).toHaveLength(1);
    expect(w.data["dasi.items"][0].url).toBe(game().url);
  });
  it("rejects contradictory, malformed and non-game identities",()=>{
    const w=worker();
    for(const item of [{...game(),url:"https://store.steampowered.com/app/456/"},{...game(),externalIds:{steam:"123fake"}},{...game(),type:"reading"}]){
      w.ctx.item=item;expect(w.run("trackedSteamId(item)")).toBe("");
    }
  });
  it("does not save delayed news after the provider identity changes",async()=>{
    const w=worker({"dasi.items":[game()]});
    w.run("steamNews=async()=>{await chrome.storage.local.set({'dasi.items':[{... (await chrome.storage.local.get('dasi.items'))['dasi.items'][0],externalIds:{steam:'456'}}]});return [{id:'post',title:'Patch',publishedAt:Date.now()-1000}]}");
    await w.run("checkGameNewsOnce()");
    expect(w.data["dasi.notifications"]||[]).toHaveLength(0);
    expect(w.data["dasi.items"][0].news).toBeUndefined();
  });
  it("updates a confirmed release but honors global notification mute",async()=>{
    const w=worker({"dasi.items":[game()],"dasi.settings":{notifyNew:false}});
    await w.run("checkGameReleases()");
    w.data["dasi.items"][0].released=false;
    w.run("steamAppDetails=async()=>({comingSoon:false,releaseDate:'Today'})");
    await w.run("checkGameReleases()");
    expect(w.data["dasi.items"][0].released).toBe(true);
    expect(w.data["dasi.notifications"]||[]).toHaveLength(0);
  });
  it("emits a localized release once for a game saved outside Steam",async()=>{
    const w=worker({"dasi.items":[game()],"dasi.settings":{lang:"fr"}});
    await w.run("checkGameReleases()");
    w.data["dasi.items"][0].released=false;
    w.run("steamAppDetails=async()=>({comingSoon:false,releaseDate:'Today'})");
    await w.run("checkGameReleases()");
    await w.run("checkGameReleases()");
    expect(w.data["dasi.notifications"]).toHaveLength(1);
    expect(w.data["dasi.notifications"][0].message).toBe("est disponible");
  });
});
