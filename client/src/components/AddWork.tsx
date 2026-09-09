import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import { searchCatalog, type CatalogResult } from "@/lib/catalog";
import type { ContentType } from "@/lib/types";

/** Modal: search a title online (best-effort) or enter it manually, then add. */
export function AddWork({ onClose, initial }: { onClose: () => void; initial?:CatalogResult }) {
  const { t, lang } = useI18n();
  const store = useStore();
  const fr=lang==="fr";
  const [error,setError]=useState(false);
  const [picked,setPicked]=useState<CatalogResult | undefined>(initial);
  const [listId,setListId]=useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [title, setTitle] = useState(initial?.title||"");
  const [type, setType] = useState<ContentType>(initial?.type||"reading");
  const [num, setNum] = useState("");
  const [season, setSeason] = useState("");
  const [url, setUrl] = useState(initial?.url||"");
  const [cover, setCover] = useState<string | undefined>(initial?.cover);

  const abort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    abort.current?.abort();
    const controller=new AbortController();abort.current=controller;
    setResults([]);setSearched(false);setError(false);setSearching(false);
    if(query.trim().length<2)return ()=>controller.abort();
    setSearching(true);
    const timer=setTimeout(async()=>{
      try{const found=await searchCatalog(query,controller.signal);if(!controller.signal.aborted){setResults(found);setSearched(true);}}
      catch{if(!controller.signal.aborted)setError(true);}
      finally{if(!controller.signal.aborted)setSearching(false);}
    },350);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query]);

  const pick = (r: CatalogResult) => {
    setPicked(r);
    setUrl(r.url||"");
    setTitle(r.title);
    setType(r.type);
    setCover(r.cover);
    setResults([]);
    setQuery("");
  };

  const submit = () => {
    if (!title.trim()) return;
    const n = num ? parseInt(num, 10) || undefined : undefined;
    const added=store.addItem({
      ...picked,
      title,
      type,
      cover,
      url: url.trim() || undefined,
      progress: type==="game" ? n : undefined,
      chapter: type === "reading" ? n : undefined,
      episode: type === "watching" ? n : undefined,
      season: type === "watching" && season ? parseInt(season, 10) || undefined : undefined,
    });
    if(listId)store.addItemToList(listId,added.id);
    toast.success(t("toast.itemAdded"));
    onClose();
  };

  return (
    <Dialog open onOpenChange={open=>!open&&onClose()}>
      <DialogContent className="add-modal" style={{maxHeight:"90vh",overflowY:"auto"}}>
        <DialogTitle>{t("add.title")}</DialogTitle>
        <DialogDescription>{fr?"Vérifiez l’œuvre et choisissez sa liste.":"Review the work and choose its list."}</DialogDescription>
        {picked?.synopsis&&<p>{picked.synopsis}</p>}

        <div className="add-search">
          <Search size={16} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("add.search")} />
        </div>
        {error && <p role="alert">{fr?"La recherche est indisponible. Réessayez ou ajoutez le titre manuellement.":"Search unavailable. Retry or add the title manually."}</p>}
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
          <button className={type === "game" ? "on" : ""} onClick={() => setType("game")}>{t("type.game")}</button>
          <div className="add-row-fields">
            {type === "watching" && (
              <input type="number" min="0" value={season} onChange={(e) => setSeason(e.target.value)} placeholder={t("add.season")} />
            )}
            <input
              type="number"
              min="0"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder={type === "game" ? "%" : type === "reading" ? t("add.chapter") : t("add.episode")}
            />
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("add.url")} />
          <label>{fr?"Liste de destination":"Destination list"}<select value={listId} onChange={e=>setListId(e.target.value)}><option value="">{fr?"Bibliothèque":"Library"}</option>{store.lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <button className="primary-cta full" onClick={submit} disabled={!title.trim()}>
            {t("add.submit")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
