import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { Reorder } from "framer-motion";
import { ArrowLeft, GripVertical, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ColorSwatches } from "@/components/ColorSwatches";
import { Progress, itemAccent } from "@/components/Bits";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import { markerLabel } from "@/lib/format";
import type { LibraryItem } from "@/lib/types";
import NotFound from "./NotFound";

export default function ListDetail() {
  const { t,lang } = useI18n();
  const store = useStore();
  const fr=lang==="fr";
  const [selected,setSelected]=useState<string[]>([]);
  const [destination,setDestination]=useState("");
  const params = useParams();
  const list = store.lists.find((l) => l.id === params.id);
  const [adding, setAdding] = useState(false);

  // Ordered items, kept in sync with the list's itemIds order.
  const orderedItems = useMemo(() => {
    if (!list) return [];
    return list.itemIds
      .map((id) => store.items.find((i) => i.id === id))
      .filter((i): i is LibraryItem => Boolean(i));
  }, [list, store.items]);

  if (!list) return <NotFound />;

  const candidates = store.items.filter((i) => !list.itemIds.includes(i.id));

  const onReorder = (next: LibraryItem[]) => {
    store.reorderList(list.id, next.map((i) => i.id));
  };

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main">
        <Link href="/collections" className="back-link">
          <ArrowLeft size={16} />
          {t("lists.back")}
        </Link>

        <div className="list-detail-head">
          <div className="list-detail-cap" style={{ background: list.color }} />
          <div className="list-detail-title">
            <h1>{list.name}</h1>
            <label>{fr?"Nom de la liste":"List name"}<input defaultValue={list.name} key={list.id} maxLength={100} onBlur={e=>store.updateList(list.id,{name:e.target.value})}/></label>
            <label>{fr?"Description":"Description"}<textarea defaultValue={list.description||""} maxLength={2000} onBlur={e=>store.updateList(list.id,{description:e.target.value})}/></label>
            <p>
              {t("lists.count", { n: list.itemIds.length })} · {t("lists.dragHint")}
            </p>
          </div>
          <div className="list-detail-tools">
            <ColorSwatches value={list.color} onChange={(c) => store.setListColor(list.id, c)} />
            <button className="refresh-button" onClick={() => setAdding((v) => !v)}>
              <Plus size={15} />
              {t("lists.addItem")}
            </button>
          </div>
        </div>

        {adding && (
          <div className="add-candidates">
            {candidates.length === 0 && <p className="muted-note">{t("library.empty")}</p>}
            {candidates.map((c) => (
              <button
                key={c.id}
                className="candidate"
                onClick={() => {
                  store.addItemToList(list.id, c.id);
                  toast.success(t("action.add"));
                }}
              >
                <span style={{ background: c.accent }}>{c.cover ? <img src={c.cover} alt="" /> : c.title[0]}</span>
                <div>
                  <strong>{c.title}</strong>
                  <small>{markerLabel(c, t)}</small>
                </div>
                <Plus size={15} />
              </button>
            ))}
          </div>
        )}

        {orderedItems.length>0&&<div className="catalog-filters">
          <button onClick={()=>setSelected(selected.length===orderedItems.length?[]:orderedItems.map(i=>i.id))}>{fr?'Tout sélectionner':'Select all'}</button><span>{selected.length} {fr?'sélectionnées':'selected'}</span>
          <select aria-label={fr?'Liste de destination':'Destination list'} value={destination} onChange={e=>setDestination(e.target.value)}><option value="">{fr?'Choisir une liste':'Choose a list'}</option>{store.lists.filter(l=>l.id!==list.id&&!l.archived).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <button disabled={!selected.length||!destination} onClick={()=>{selected.forEach(id=>store.addItemToList(destination,id));setSelected([]);toast.success(fr?'Œuvres copiées':'Works copied');}}>{fr?'Copier vers':'Copy to'}</button>
          <button disabled={!selected.length} onClick={()=>{selected.forEach(id=>store.removeItemFromList(list.id,id));setSelected([]);}}>{fr?'Retirer de cette liste':'Remove from this list'}</button>
        </div>}
        {orderedItems.length === 0 ? (
          <p className="muted-note big">{t("lists.empty")}</p>
        ) : (
          <Reorder.Group axis="y" values={orderedItems} onReorder={onReorder} className="reorder-list" as="div">
            {orderedItems.map((item) => (
              <Reorder.Item key={item.id} value={item} className="reorder-row" as="div">
                <input type="checkbox" aria-label={(fr?"Sélectionner ":"Select ")+item.title} checked={selected.includes(item.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/>
                <span className="drag-handle" aria-hidden>
                  <GripVertical size={16} />
                </span>
                <Link href={`/work/${encodeURIComponent(item.id)}`} className="reorder-cover" style={{ background: item.accent }} aria-label={item.title}>
                  {item.cover ? <img src={item.cover} alt="" /> : item.title[0]}
                </Link>
                <div className="reorder-main">
                  <div>
                    <h4>{item.title}</h4>
                    <span className="row-type">{t(`type.${item.type}`)}</span>
                    {item.hasUpdate && <span className="row-new">{t("unit.newBadge")}</span>}
                  </div>
                  <p>{markerLabel(item, t)}</p>
                  <div className="row-progress">
                    <Progress value={item.progress} accent={itemAccent(item)} />
                    <small>{t("unit.percent", { n: item.progress })}</small>
                  </div>
                </div>
                <a className="reorder-open" href={item.url} target="_blank" rel="noreferrer">
                  {t("action.open")}
                </a>
                <button
                  className="delete-row"
                  onClick={() => store.removeItemFromList(list.id, item.id)}
                  aria-label={t("action.delete")}
                >
                  <X size={16} />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </main>
    </div>
  );
}
