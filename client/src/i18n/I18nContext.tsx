import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, type Language, type StringKey } from "./strings";

const STORAGE_KEY = "dasi.language";

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: StringKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function detectInitial(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    /* storage unavailable */
  }
  // English is the product default regardless of browser locale.
  return "en";
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => setLangState(next), []);

  const t = useCallback(
    (key: StringKey, vars?: Vars) => interpolate(dictionaries[lang][key] ?? dictionaries.en[key] ?? key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
