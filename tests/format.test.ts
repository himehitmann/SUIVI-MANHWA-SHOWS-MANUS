import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markerLabel, relativeTime } from "../client/src/lib/format";
import { dictionaries, type Language, type StringKey } from "../client/src/i18n/strings";
import type { LibraryItem } from "../client/src/lib/types";

const now = new Date("2026-10-17T12:00:00Z").getTime();
const minute = 60_000, hour = 60 * minute, day = 24 * hour;
const translate = (lang: Language) => (key: StringKey, vars?: Record<string, string | number>) =>
  dictionaries[lang][key].replace(/\{(\w+)\}/g, (_, name) => String(vars?.[name] ?? `{${name}}`));

describe("library timestamps follow the selected language", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());

  it.each([
    [0, "just now", "à l’instant"],
    [59_999, "just now", "à l’instant"],
    [minute, "1 min ago", "il y a 1 min"],
    [59 * minute, "59 min ago", "il y a 59 min"],
    [hour, "1h ago", "il y a 1 h"],
    [23 * hour + 59 * minute, "23h ago", "il y a 23 h"],
    [day, "yesterday", "hier"],
    [2 * day, "2 days ago", "il y a 2 jours"],
    [29 * day, "29 days ago", "il y a 29 jours"],
  ])("formats an age of %d ms in both languages", (age, en, fr) => {
    expect(relativeTime(now - age, translate("en"), "en")).toBe(en);
    expect(relativeTime(now - age, translate("fr"), "fr")).toBe(fr);
  });

  it("uses the app language for older dates rather than the browser default", () => {
    const ts = new Date("2026-08-10T12:00:00Z").getTime();
    expect(relativeTime(ts, translate("fr"), "fr")).toBe("10/08/2026");
    expect(relativeTime(ts, translate("en"), "en")).toBe("8/10/2026");
  });

  it("handles invalid timestamps and clocks ahead without negative ages", () => {
    expect(relativeTime(NaN, translate("fr"), "fr")).toBe("date inconnue");
    expect(relativeTime(Infinity, translate("en"), "en")).toBe("unknown date");
    expect(relativeTime(1e20, translate("en"), "en")).toBe("unknown date");
    expect(relativeTime(now + hour, translate("fr"), "fr")).toBe("à l’instant");
  });

  it("switches progress labels without the unwanted middle-dot separator", () => {
    const item = { season: 2, episode: 7, domain: "example.test" } as LibraryItem;
    expect(markerLabel(item, translate("en"))).toBe("Season 2, Episode 7");
    expect(markerLabel(item, translate("fr"))).toBe("Saison 2, Épisode 7");
  });
});
