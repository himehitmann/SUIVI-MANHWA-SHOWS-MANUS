import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function parser() {
  const ctx: any = vm.createContext({ window: {}, TextDecoder, console });
  vm.runInContext(
    readFileSync(new URL("../vendor/fflate.min.js", import.meta.url), "utf8"),
    ctx
  );
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
