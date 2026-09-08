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
});
