import { describe, expect, it } from "vitest";
import { catalogCountryLabel, catalogFormatLabel, catalogGenreLabel } from "../client/src/i18n/catalog-labels";

describe("catalog display localization", () => {
  it("localizes provider formats without exposing uppercase codes", () => {
    expect(catalogFormatLabel("GAME", "fr")).toBe("Jeu vidéo");
    expect(catalogFormatLabel("GAME", "en")).toBe("Game");
    expect(catalogFormatLabel("KDRAMA", "fr")).toBe("Série coréenne");
    expect(catalogFormatLabel("light novel", "en")).toBe("Light novel");
    expect(catalogFormatLabel("ONE_SHOT", "fr")).toBe("Récit unique");
  });
  it("localizes common genres and punctuation variants", () => {
    expect(catalogGenreLabel("Adventure", "fr")).toBe("Aventure");
    for (const value of ["Science-Fiction", "Science Fiction", "Sci-Fi"])
      expect(catalogGenreLabel(value, "fr")).toBe("Science-fiction");
    expect(catalogGenreLabel("Free To Play", "fr")).toBe("Gratuit");
    expect(catalogGenreLabel("Adventure", "en")).toBe("Adventure");
  });
  it("shows country names in the selected language", () => {
    expect(catalogCountryLabel("JP", "fr")).toBe("Japon");
    expect(catalogCountryLabel("JP", "en")).toBe("Japan");
    expect(catalogCountryLabel("kr", "fr")).toBe("Corée du Sud");
  });
  it("preserves unknown metadata and never changes canonical filtering values", () => {
    const result = { format: "GAME", country: "JP", genres: ["Adventure", "Unknown niche"] };
    expect(result.genres.map(value => catalogGenreLabel(value, "fr"))).toEqual(["Aventure", "Unknown niche"]);
    expect(result.genres.includes("Adventure")).toBe(true);
    expect(catalogFormatLabel("NEW_FORMAT", "fr")).toBe("NEW_FORMAT");
    expect(catalogCountryLabel("Worldwide", "fr")).toBe("Worldwide");
    expect(catalogGenreLabel("constructor", "fr")).toBe("constructor");
  });
});
