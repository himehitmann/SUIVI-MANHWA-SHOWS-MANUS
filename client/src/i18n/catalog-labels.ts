import type { Language } from "./strings";

// Translate display labels only: provider values remain the filter/storage keys.
const formats: Record<string, [string, string]> = {
  GAME: ["Game", "Jeu vidéo"], MOVIE: ["Film", "Film"], SERIES: ["Series", "Série"],
  ANIME: ["Anime", "Anime"], MANGA: ["Manga", "Manga"], MANHWA: ["Manhwa", "Manhwa"],
  MANHUA: ["Manhua", "Manhua"], WEBTOON: ["Webtoon", "Webtoon"], BOOK: ["Book", "Livre"],
  NOVEL: ["Novel", "Roman"], LIGHT_NOVEL: ["Light novel", "Roman illustré"],
  ONE_SHOT: ["One-shot", "Récit unique"], KDRAMA: ["Korean drama", "Série coréenne"],
  CDRAMA: ["Chinese drama", "Série chinoise"], JDRAMA: ["Japanese drama", "Série japonaise"],
  TV: ["TV series", "Série télévisée"], TV_SHORT: ["Short series", "Série courte"],
  OVA: ["Original video animation", "Animation vidéo originale"],
  ONA: ["Original net animation", "Animation web originale"], SPECIAL: ["Special", "Épisode spécial"],
  MUSIC: ["Music", "Musique"],
};
const genres: Record<string, string> = {
  action: "Action", adventure: "Aventure", animation: "Animation", comedy: "Comédie",
  drama: "Drame", fantasy: "Fantastique", horror: "Horreur", mystery: "Mystère",
  romance: "Romance", thriller: "Thriller", crime: "Policier", sciencefiction: "Science-fiction",
  scifi: "Science-fiction", sliceoflife: "Tranche de vie", supernatural: "Surnaturel",
  psychological: "Psychologique", sports: "Sport", sport: "Sport", music: "Musique",
  historical: "Historique", history: "Histoire", war: "Guerre", western: "Western",
  family: "Famille", children: "Jeunesse", kids: "Jeunesse", documentary: "Documentaire",
  reality: "Téléréalité", food: "Cuisine", medical: "Médical", legal: "Judiciaire",
  martialarts: "Arts martiaux", school: "Vie scolaire", mecha: "Mecha",
  mahoushoujo: "Magical girl", racing: "Course", puzzle: "Réflexion",
  strategy: "Stratégie", simulation: "Simulation", casual: "Occasionnel",
  indie: "Indépendant", rpg: "Jeu de rôle", roleplaying: "Jeu de rôle",
  freetoplay: "Gratuit", massivelymultiplayer: "Massivement multijoueur",
  earlyaccess: "Accès anticipé", education: "Éducation",
};
export function catalogFormatLabel(value: string, lang: Language): string {
  const key = value.trim().toUpperCase().replace(/[ -]+/g, "_");
  return Object.prototype.hasOwnProperty.call(formats, key) ? formats[key][lang === "fr" ? 1 : 0] : value;
}
export function catalogGenreLabel(value: string, lang: Language): string {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return lang === "fr" && Object.prototype.hasOwnProperty.call(genres, key) ? genres[key] : value;
}
const regions = new Map<Language, Intl.DisplayNames>();
export function catalogCountryLabel(value: string, lang: Language): string {
  if (!/^[a-z]{2}$/i.test(value)) return value;
  try {
    let names = regions.get(lang);
    if (!names) { names = new Intl.DisplayNames([lang], { type: "region", fallback: "code" }); regions.set(lang, names); }
    return names.of(value.toUpperCase()) || value;
  } catch { return value; }
}
