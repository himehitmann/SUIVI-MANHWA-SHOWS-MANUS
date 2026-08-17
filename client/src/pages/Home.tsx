import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Check, ChevronRight, ExternalLink, Film, Grid2X2, Heart, History, Library, Minus, Play, Plus,
  RefreshCw, Sparkles, Trash2, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Cover, Pill, Progress, itemAccent, onImgError } from "@/components/Bits";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import { markerLabel, relativeTime } from "@/lib/format";
import type { ContentType } from "@/lib/types";

type Filter = "all" | ContentType | "favorites";

export default function Home() {
  const { t } = useI18n();
  const store = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tools, setTools] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [siteForm, setSiteForm] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");

  const current = store.items[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.items.filter((i) => {
      if (filter === "favorites" && !i.favorite) return false;
      if ((filter === "reading" || filter === "watching") && i.type !== filter) return false;
      if (!q) return true;
      return `${i.title} ${markerLabel(i, t)}`.toLowerCase().includes(q);
    });
  }, [store.items, filter, query, t]);

  const check = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      const found = store.simulateUpdateScan();
      if (found > 0) toast.success(t("toast.newFound", { n: found }));
      else toast.success(t("toast.upToDate"), { description: t("toast.upToDateDesc") });
    }, 800);
  };

  const save = () => {
    if (current && current.progress < 72) {
      setConflict(true);
      return;
    }
    toast.success(t("toast.saved"));
  };

  const addSite = () => {
    if (!siteUrl.trim()) return;
    store.addSite(siteName, siteUrl);
    setSiteName("");
    setSiteUrl("");
    setSiteForm(false);
    toast.success(t("toast.siteAdded"));
  };

  const counts = {
    all: store.items.length,
    reading: store.items.filter((i) => i.type === "reading").length,
    watching: store.items.filter((i) => i.type === "watching").length,
    favorites: store.items.filter((i) => i.favorite).length,
  };

  return (
    <div className="dasi-app">
      <AppHeader query={query} onQuery={setQuery} />
      <main className="dasi-main">
        <div className="welcome">
          <div>
            <span className="eyebrow pastel-label">{t("welcome.eyebrow")}</span>
            <h1>{t("welcome.title")}</h1>
            <p>{t("welcome.subtitle")}</p>
          </div>
          <button className="refresh-button" onClick={check} disabled={checking}>
            <RefreshCw size={16} className={checking ? "spinning" : ""} />
            {checking ? t("action.checking") : t("action.checkUpdates")}
          </button>
        </div>

        {current && (
          <section className="dasi-hero">
            <div className="hero-soft-shape shape-one" />
            <div className="hero-soft-shape shape-two" />
            <div className="hero-details">
              <div className="hero-chip">
                <Sparkles size={14} /> {t("hero.chip")}
              </div>
              <h2>{current.title}</h2>
              <p>
                {markerLabel(current, t)}
                <span> · </span>
                {t(`type.${current.type}`)}
              </p>
              <div className="hero-progress">
                <Progress value={current.progress} />
                <strong>{t("unit.percent", { n: current.progress })}</strong>
              </div>
              <small>{t("hero.savedAgo", { time: relativeTime(current.updatedAt, t) })}</small>
              <div className="hero-buttons">
                <a className="primary-cta" href={current.url} target="_blank" rel="noreferrer" onClick={() => toast(t("toast.opening"))}>
                  <Play size={16} fill="currentColor" />
                  {t("action.resume")}
                </a>
                <button className="heart-button" onClick={save}>
                  <Heart size={17} />
                  {t("action.save")}
                </button>
              </div>
            </div>
            <div className="hero-art" style={{ background: current.accent }} data-initial={current.title[0]}>
              {current.cover ? <img src={current.cover} alt="" onError={onImgError} /> : null}
              <div className="art-wash" />
              {current.hasUpdate && <span className="hero-new">{t("unit.newBadge")}</span>}
            </div>
          </section>
        )}

        <div className="quick-categories">
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>
            <Grid2X2 size={15} />
            {t("categories.all")} <b>{counts.all}</b>
          </Pill>
          <Pill active={filter === "reading"} onClick={() => setFilter("reading")}>
            <Library size={15} />
            {t("categories.reading")} <b>{counts.reading}</b>
          </Pill>
          <Pill active={filter === "watching"} onClick={() => setFilter("watching")}>
            <Film size={15} />
            {t("categories.watching")} <b>{counts.watching}</b>
          </Pill>
          <Pill active={filter === "favorites"} onClick={() => setFilter("favorites")}>
            <Heart size={15} />
            {t("categories.favorites")} <b>{counts.favorites}</b>
          </Pill>
        </div>

        {/* Quick-access favorite sites */}
        <section className="sites-section">
          <div className="rail-title">
            <div>
              <span className="eyebrow">{t("sites.eyebrow")}</span>
              <h3>{t("sites.title")}</h3>
            </div>
            <button onClick={() => setSiteForm((v) => !v)}>
              <Plus size={15} />
              {t("sites.add")}
            </button>
          </div>
          {siteForm && (
            <div className="site-form">
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder={t("sites.namePlaceholder")} />
              <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder={t("sites.urlPlaceholder")} onKeyDown={(e) => e.key === "Enter" && addSite()} />
              <button className="site-add" onClick={addSite}>
                {t("action.add")}
              </button>
            </div>
          )}
          <div className="site-grid">
            {store.sites.length === 0 && <p className="muted-note">{t("sites.empty")}</p>}
            {store.sites.map((s) => (
              <a key={s.id} className="site-card" href={s.url} target="_blank" rel="noreferrer" style={{ background: s.color }}>
                <span className="site-favi">{s.name[0]}</span>
                <div>
                  <strong>{s.name}</strong>
                  <small>{s.domain}</small>
                </div>
                <ExternalLink size={13} className="site-open" />
                <button
                  className="site-remove"
                  onClick={(e) => {
                    e.preventDefault();
                    store.removeSite(s.id);
                  }}
                  aria-label={t("action.delete")}
                >
                  <X size={12} />
                </button>
              </a>
            ))}
          </div>
        </section>

        {/* Continue rail */}
        <section className="rail-section">
          <div className="rail-title">
            <div>
              <span className="eyebrow">{t("queue.eyebrow")}</span>
              <h3>{t("queue.title")}</h3>
            </div>
            <button onClick={() => setFilter("all")}>
              {t("action.seeAll")} <ChevronRight size={16} />
            </button>
          </div>
          <div className="cover-rail">
            {filtered.slice(0, 3).map((item) => (
              <article className="cover-card" key={item.id}>
                <a className="cover-image" href={item.url} target="_blank" rel="noreferrer" style={{ background: item.accent }} data-initial={item.title[0]}>
                  {item.cover ? <img src={item.cover} alt="" onError={onImgError} /> : <span>{item.title[0]}</span>}
                  <span className="cover-badge">{t(`type.${item.type}`)}</span>
                  {item.hasUpdate && <span className="cover-new">{t("unit.newBadge")}</span>}
                </a>
                <div className="cover-info">
                  <h4>{item.title}</h4>
                  <p>{markerLabel(item, t)}</p>
                  <Progress value={item.progress} accent={itemAccent(item)} />
                  <small>
                    {t("unit.percent", { n: item.progress })} · {relativeTime(item.updatedAt, t)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="lower-grid">
          <section className="progress-panel">
            <div className="rail-title">
              <div>
                <span className="eyebrow">{t("library.eyebrow")}</span>
                <h3>{t("library.title")}</h3>
              </div>
              <button onClick={check}>
                {t("library.updates")} <RefreshCw size={14} className={checking ? "spinning" : ""} />
              </button>
            </div>
            <div className="mini-tabs">
              {(["all", "reading", "watching"] as const).map((tab) => (
                <button className={filter === tab ? "selected" : ""} onClick={() => setFilter(tab)} key={tab}>
                  {t(`categories.${tab}`)}
                </button>
              ))}
            </div>
            <div className="dasi-list">
              {filtered.length === 0 && <p className="muted-note">{t("library.empty")}</p>}
              {filtered.map((item) => (
                <article className="dasi-row" key={item.id}>
                  <Cover item={item} className="row-cover" />
                  <div className="dasi-row-main">
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
                  <div className="row-source">
                    <span>{item.sources.length > 1 ? `${item.sources.length} sources` : item.domain}</span>
                    <small>{relativeTime(item.updatedAt, t)}</small>
                  </div>
                  <div className="row-tools">
                    <button
                      className={`fav-toggle ${item.favorite ? "on" : ""}`}
                      onClick={() => store.toggleFavorite(item.id)}
                      aria-label={t("categories.favorites")}
                    >
                      <Heart size={14} fill={item.favorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      className="delete-row"
                      onClick={() => {
                        store.removeItem(item.id);
                        toast(t("toast.removed"));
                      }}
                      aria-label={t("action.delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="now-panel">
            <div className="now-head">
              <div>
                <span className="eyebrow">{t("now.eyebrow")}</span>
                <h3>{current?.title ?? "—"}</h3>
              </div>
              <span className="synced">
                <Check size={13} />
                {t("now.upToDate")}
              </span>
            </div>
            {current && (
              <div className="detected-box">
                <div className="mini-cover" data-initial={current.title[0]}>{current.cover ? <img src={current.cover} alt="" onError={onImgError} /> : null}</div>
                <div>
                  <strong>{markerLabel(current, t)}</strong>
                  <span>{t("now.detected")}</span>
                </div>
              </div>
            )}
            <button className="soft-action" onClick={check}>
              <RefreshCw size={15} />
              {t("now.checkNew")}
              <ChevronRight size={15} />
            </button>
            <button className="soft-action" onClick={() => setTools((v) => !v)}>
              <Video size={15} />
              {t("now.videoTools")} <b>{tools ? "−" : "+"}</b>
            </button>
            {tools && (
              <div className="video-pop">
                <div>
                  <span>{t("now.speed")}</span>
                  <div className="speed">
                    <button onClick={() => setSpeed(Math.max(0.25, Number((speed - 0.25).toFixed(2))))}>
                      <Minus size={14} />
                    </button>
                    <strong>{speed}×</strong>
                    <button onClick={() => setSpeed(Math.min(3, Number((speed + 0.25).toFixed(2))))}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <button className="pip-cta" onClick={() => toast(t("now.pip"))}>
                  {t("now.pip")}
                </button>
              </div>
            )}
            <Link href="/collections" className="soft-action">
              <Grid2X2 size={15} />
              {t("nav.collections")}
              <ChevronRight size={15} />
            </Link>
            <div className="local-note">
              <Heart size={14} />
              {t("now.local")}
            </div>
          </aside>
        </div>
      </main>

      {conflict && current && (
        <div className="modal-backdrop" onClick={() => setConflict(false)}>
          <div className="conflict-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setConflict(false)}>
              <X size={17} />
            </button>
            <span className="eyebrow">{t("conflict.eyebrow")}</span>
            <h2>{t("conflict.title")}</h2>
            <p dangerouslySetInnerHTML={{ __html: t("conflict.body", { title: `<strong>${current.title}</strong>` }) }} />
            <div className="conflict-actions">
              <button className="heart-button" onClick={() => setConflict(false)}>
                {t("conflict.keep")}
              </button>
              <button
                className="primary-cta"
                onClick={() => {
                  setConflict(false);
                  toast.success(t("toast.replaced"));
                }}
              >
                {t("conflict.replace")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
