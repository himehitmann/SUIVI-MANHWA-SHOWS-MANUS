import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function parser() {
  const ctx: any = vm.createContext({ window: {}, TextDecoder, console });
  vm.runInContext(
    readFileSync(new URL("../vendor/fflate.min.js", import.meta.url), "utf8"),
    ctx
  );
  vm.runInContext(readFileSync(new URL("../import-position.js", import.meta.url), "utf8"),ctx);
  vm.runInContext(
    readFileSync(new URL("../import-parse.js", import.meta.url), "utf8"),
    ctx
  );
  return ctx;
}
const file = (data: any, name = "export.json") => ({
  name,
  size: 100,
  text: async () => JSON.stringify(data),
});
describe("extension importer", () => {
  it("preserves distinct Japanese and Korean titles", async () => {
    const c = parser(),
      r = await c.window.YomuImport.parseFiles([
        file([
          { title: "進撃の巨人" },
          { title: "鬼滅の刃" },
          { title: "나 혼자만 레벨업" },
          { title: "전지적 독자 시점" },
        ]),
      ]);
    expect(r.count).toBe(4);
  });
  it("keeps same-title backups with different identifiers for list integrity", async () => {
    const c = parser(),
      r = await c.window.YomuImport.parseFiles([
        file({
          items: [
            { id: "a", title: "Show", type: "watching" },
            { id: "b", title: "Show", type: "watching" },
          ],
        }),
      ]);
    expect(r.count).toBe(2);
  });
  it("selects the episode within the latest Trakt season", async () => {
    const c = parser(),
      r = await c.window.YomuImport.parseFiles([
        file([
          {
            show: { title: "Show" },
            seasons: [
              { number: 1, episodes: [{ number: 20 }] },
              { number: 2, episodes: [{ number: 1 }] },
            ],
          },
        ]),
      ]);
    expect(r.items[0].season).toBe(2);
    expect(r.items[0].episode).toBe(1);
  });
  it("accepts semicolon CSV exports", async () => {
    const c = parser(),
      r = await c.window.YomuImport.parseFiles([
        {
          name: "export.csv",
          size: 30,
          text: async () => "title;type;episode\nShow;series;12",
        },
      ]);
    expect(r.items[0].episode).toBe(12);
  });
  it("rejects oversized uploads with a visible warning", async () => {
    const c = parser(),
      r = await c.window.YomuImport.parseFiles([
        {
          name: "huge.json",
          size: 30 * 1024 * 1024,
          text: async () => {
            throw Error("must not read");
          },
        },
      ]);
    expect(r.count).toBe(0);
    expect(r.warnings[0]).toContain("25 MB");
  });
  it("rejects an archive before inflating oversized entries", async () => {
    const c = parser();
    c.fflate = {
      unzipSync: (_b: any, opts: any) => {
        opts.filter({ name: "export.json", originalSize: 60 * 1024 * 1024 });
        throw Error("unreachable");
      },
    };
    const r = await c.window.YomuImport.parseFiles([
      {
        name: "archive.zip",
        size: 10,
        arrayBuffer: async () => new ArrayBuffer(10),
      },
    ]);
    expect(r.warnings[0]).toContain("50 MB");
  });
  it("keeps watched counts separate from series totals", async () => {
    const c = parser();
    const r = await c.window.YomuImport.parseFiles([file([
      {title:"Known total",type:"anime",num_episodes_watched:7,num_episodes:24},
      {title:"Unknown total",type:"series",num_episodes_watched:4},
    ])]);
    expect(r.items[0]).toMatchObject({episode:7,total:24,format:"ANIME"});
    expect(r.items[1].episode).toBe(4);
    expect(r.items[1].total).toBeUndefined();
  });
  it("does not interpret an ambiguous progress percentage as an episode", async () => {
    const c = parser();
    const r = await c.window.YomuImport.parseFiles([file([
      {title:"Series",type:"series",progress:80},
      {title:"Manga",type:"manga",progress:50},
    ])]);
    expect(r.items[0].episode).toBeUndefined();
    expect(r.items[1].chapter).toBeUndefined();
  });
  it("preserves tracker statuses, reading totals and nested media categories", async () => {
    const c=parser();
    const r=await c.window.YomuImport.parseFiles([file([
      {show:{title:"Show"},status:"Completed",episodes_watched:12,total_episodes:12},
      {movie:{title:"Film"},status:"plan_to_watch"},
      {title:"Comic",type:"manga",status:"on_hold",chapters_read:8,total_chapters:40},
      {title:"Dropped show",type:"series",status:"dropped"},
    ])]);
    expect(r.items[0]).toMatchObject({format:"SERIES",status:"completed",episode:12,total:12});
    expect(r.items[1]).toMatchObject({format:"MOVIE",status:"planned"});
    expect(r.items[2]).toMatchObject({format:"MANGA",status:"on_hold",chapter:8,total:40});
    expect(r.items[3].status).toBe("dropped");
  });
});

it("retains imported catalog identity and descriptive metadata",async()=>{
  const c=parser();
  const r=await c.window.YomuImport.parseFiles([file([{title:"Titre français",type:"manga",synonyms:["English title"],author:{name:"Creator"},ids:{anilist:123},description:"A synopsis",chapters_read:8}])]);
  expect(r.items[0]).toMatchObject({alternativeTitles:["English title"],authors:["Creator"],externalIds:{anilist:123},synopsis:"A synopsis",chapter:8});
});

it("imports fractional reading positions without converting episodes into fractional viewing progress",async()=>{
  const c=parser();
  const result=await c.window.YomuImport.parseFiles([file([
    {title:"Reading",type:"reading",chapters_read:"12.75"},
    {title:"Bonus",type:"manga",episode_number:"0,5"},
    {title:"Show",type:"anime",episode:4.5}
  ])]);
  expect(result.items.find((row:any)=>row.title==="Reading")).toMatchObject({type:"reading",chapter:12.75});
  expect(result.items.find((row:any)=>row.title==="Bonus").chapter).toBe(0.5);
  expect(result.items.find((row:any)=>row.title==="Show").episode).toBe(4);
});

it("combines lists and sites from every backup and keeps each timestamp with its episode",async()=>{
  const c=parser();
  const first={id:"show",title:"Show",type:"watching",season:1,episode:8,position:400,duration:900,episodeTitle:"Eight",notes:"Mine"};
  const second={id:"show",title:"Show",type:"watching",season:2,episode:1};
  const make=(row:any,id:string)=>file({version:2,items:[row],lists:[{id,itemIds:["show"]}],sites:[{id,url:"https://"+id+".example"}]});
  const r=await c.window.YomuImport.parseFiles([make(first,"a"),make(second,"b")]);
  expect(r.items).toHaveLength(1);expect(r.items[0]).toMatchObject({season:2,episode:1,notes:"Mine"});
  expect(r.items[0].position).toBeUndefined();expect(r.items[0].duration).toBeUndefined();expect(r.items[0].episodeTitle).toBeUndefined();
  expect(r.lists.map((row:any)=>row.id)).toEqual(["a","b"]);expect(r.sites.map((row:any)=>row.id)).toEqual(["a","b"]);
});

it("recognizes empty Yomu libraries and collects history and public profile data across backup files",async()=>{
  const c=parser();
  const r=await c.window.YomuImport.parseFiles([
    file({version:2,items:[],lists:[{id:"list",itemIds:[]}],sites:[{id:"site"}],notifications:[{id:"a",title:"First"}],settings:{lang:"fr",profile:{name:"Reader"}}}),
    file({version:1,items:[],notifications:[{id:"b",title:"Second"}],settings:{profile:{bio:"Bio"}}})
  ]);
  expect(r.count).toBe(0);expect(r.formats).toEqual(["Yomu"]);
  expect(r.settings).toMatchObject({lang:"fr",profile:{name:"Reader",bio:"Bio"}});
  expect(r.lists[0].id).toBe("list");expect(r.sites[0].id).toBe("site");expect(r.notifications.map((n:any)=>n.id)).toEqual(["a","b"]);
});

it.each([
  {version:2,items:[{id:"good",title:"Good",type:"reading"}],sites:[null]},
  {version:2,items:[{id:"good",title:"Good",type:"reading"}],settings:{profile:[]}},
  {version:2,items:[{id:"good",title:"Good",type:"reading",tags:"bad"}]},
  {version:2,items:"broken"},
  {version:3,items:[{id:"good",title:"Good",type:"reading"}]},
])("refuses malformed native backups without exposing partial data: %j",async backup=>{
  const c=parser();
  const r=await c.window.YomuImport.parseFiles([file(backup)]);
  expect(r.count).toBe(0);expect(r.items).toEqual([]);expect(r.sites).toBeUndefined();expect(r.settings).toBeUndefined();expect(r.warnings.length).toBeGreaterThan(0);
});

it.each([false,true])("fails the whole selection if one JSON file is truncated (keepRecords=%s)",async keepRecords=>{
  const c=parser();
  const valid=file({version:2,items:[{id:"good",title:"Good",type:"reading"}],settings:{lang:"fr"}});
  const broken={name:"broken.json",size:20,text:async()=>'{"items":[{"title":"Oops"}'};
  const r=await c.window.YomuImport.parseFiles([valid,broken],{keepRecords});
  expect(r.items).toEqual([]);expect(r.settings).toBeUndefined();expect(r.count).toBe(0);expect(r.warnings).toHaveLength(1);
});

it("does not confuse an external tracker items array with a native backup",async()=>{
  const c=parser();
  const r=await c.window.YomuImport.parseFiles([file({items:[{id:123,title:"External",type:"anime",episodes_watched:4}]})]);
  expect(r.warnings).toEqual([]);expect(r.items[0]).toMatchObject({title:"External",type:"watching",format:"ANIME",episode:4});
});
