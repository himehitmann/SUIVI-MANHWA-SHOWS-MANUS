import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, FolderPlus, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ColorSwatches } from "@/components/ColorSwatches";
import { useI18n } from "@/i18n/I18nContext";
import { useStore, LIST_COLORS } from "@/store/StoreContext";

export default function Collections() {
  const { t } = useI18n();
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);

  const create = () => {
    if (!name.trim()) return;
    store.createList(name, color);
    setName("");
    setColor(LIST_COLORS[0]);
    setCreating(false);
    toast.success(t("toast.listCreated"));
  };

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main">
        <div className="welcome">
          <div>
            <span className="eyebrow pastel-label">{t("lists.eyebrow")}</span>
            <h1>{t("lists.title")}</h1>
            <p>{t("lists.subtitle")}</p>
          </div>
          <button className="refresh-button" onClick={() => setCreating((v) => !v)}>
            <FolderPlus size={16} />
            {t("lists.new")}
          </button>
        </div>

        {creating && (
          <div className="list-create">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("lists.namePlaceholder")} onKeyDown={(e) => e.key === "Enter" && create()} autoFocus />
            <div className="list-create-color">
              <span>{t("lists.color")}</span>
              <ColorSwatches value={color} onChange={setColor} />
            </div>
            <div className="list-create-actions">
              <button className="ghost" onClick={() => setCreating(false)}>
                {t("action.cancel")}
              </button>
              <button className="primary-cta" onClick={create}>
                {t("action.create")}
              </button>
            </div>
          </div>
        )}

        <div className="list-grid">
          {store.lists.map((list) => {
            const items = list.itemIds.map((id) => store.items.find((i) => i.id === id)).filter(Boolean);
            return (
              <Link key={list.id} href={`/list/${list.id}`} className="list-card">
                <div className="list-card-cap" style={{ background: list.color }}>
                  <div className="list-card-covers">
                    {items.slice(0, 3).map((it) => (
                      <span key={it!.id} style={{ background: it!.accent }}>
                        {it!.cover ? <img src={it!.cover} alt="" /> : it!.title[0]}
                      </span>
                    ))}
                    {items.length === 0 && <Layers size={22} />}
                  </div>
                </div>
                <div className="list-card-body">
                  <strong>{list.name}</strong>
                  <div className="list-card-foot">
                    <small>{t("lists.count", { n: list.itemIds.length })}</small>
                    <button
                      className="list-del"
                      onClick={(e) => {
                        e.preventDefault();
                        store.deleteList(list.id);
                      }}
                      aria-label={t("action.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <ChevronRight size={16} className="list-card-arrow" />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
