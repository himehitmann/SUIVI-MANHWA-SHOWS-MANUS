import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { LANGUAGES } from "@/i18n/strings";

/** Compact language picker that sits next to the search bar. English is the default. */
export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="lang-switch" ref={ref}>
      <button className="lang-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <Globe size={15} />
        <span>{active.flag}</span>
        <span className="lang-code">{active.code.toUpperCase()}</span>
      </button>
      {open && (
        <ul className="lang-menu" role="listbox">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === lang}
                className={l.code === lang ? "active" : ""}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {l.code === lang && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
