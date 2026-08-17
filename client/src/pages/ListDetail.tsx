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
  const { t } = useI18n();
  const store = useStore();
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

        {orderedItems.length === 0 ? (
          <p className="muted-note big">{t("lists.empty")}</p>
        ) : (
          <Reorder.Group axis="y" values={orderedItems} onReorder={onReorder} className="reorder-list" as="div">
            {orderedItems.map((item) => (
              <Reorder.Item key={item.id} value={item} className="reorder-row" as="div">
                <span className="drag-handle" aria-hidden>
                  <GripVertical size={16} />
                </span>
                <span className="reorder-cover" style={{ background: item.accent }}>
                  {item.cover ? <img src={item.cover} alt="" /> : item.title[0]}
                </span>
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
