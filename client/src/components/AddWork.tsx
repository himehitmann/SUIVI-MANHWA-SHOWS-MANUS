import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import { searchCatalog, type CatalogResult } from "@/lib/catalog";
import type { ContentType } from "@/lib/types";

/** Modal: search a title online (best-effort) or enter it manually, then add. */
export function AddWork({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const store = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContentType>("reading");
  const [num, setNum] = useState("");
  const [season, setSeason] = useState("");
  const [url, setUrl] = useState("");
  const [cover, setCover] = useState<string | undefined>();

  const abort = useRef<AbortController | undefined>(undefined);

  // Debounced online search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      const r = await searchCatalog(query, abort.current.signal);
      setResults(r);
      setSearching(false);
      setSearched(true);
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  const pick = (r: CatalogResult) => {
    setTitle(r.title);
    setType(r.type);
    setCover(r.cover);
    setResults([]);
    setQuery(r.title);
  };

  const submit = () => {
    if (!title.trim()) return;
    const n = num ? parseInt(num, 10) || undefined : undefined;
    store.addItem({
      title,
      type,
      cover,
      url: url.trim() || undefined,
      chapter: type === "reading" ? n : undefined,
      episode: type === "watching" ? n : undefined,
      season: type === "watching" && season ? parseInt(season, 10) || undefined : undefined,
    });
    toast.success(t("toast.itemAdded"));
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="add-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <span className="eyebrow pastel-label">{t("add.title")}</span>

        <div className="add-search">
          <Search size={16} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("add.search")} />
        </div>
        {searching && <p className="muted-note">{t("add.searching")}</p>}
        {results.length > 0 && (
          <ul className="add-results">
            {results.map((r, i) => (
              <li key={i}>
                <button onClick={() => pick(r)}>
                  {r.cover ? <img src={r.cover} alt="" /> : <span className="add-res-ph" />}
                  <div>
                    <strong>{r.title}</strong>
                    <small>{t(`type.${r.type}`)}</small>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searched && !searching && results.length === 0 && <p className="muted-note">{t("add.noResults")}</p>}

        <div className="add-manual">
          <span className="add-manual-label">{t("add.manual")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("add.titleField")} />
          <div className="add-type-toggle">
            <button className={type === "reading" ? "on" : ""} onClick={() => setType("reading")}>
              {t("type.reading")}
            </button>
            <button className={type === "watching" ? "on" : ""} onClick={() => setType("watching")}>
              {t("type.watching")}
            </button>
          </div>
          <div className="add-row-fields">
            {type === "watching" && (
              <input type="number" min="0" value={season} onChange={(e) => setSeason(e.target.value)} placeholder={t("add.season")} />
            )}
            <input
              type="number"
              min="0"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder={type === "reading" ? t("add.chapter") : t("add.episode")}
            />
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("add.url")} />
          <button className="primary-cta full" onClick={submit} disabled={!title.trim()}>
            {t("add.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
