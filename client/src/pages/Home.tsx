/* Editorial Quiet: rail éditorial asymétrique, DM Serif Display + IBM Plex Sans, ivoire/encre/vermillon. La reprise est toujours l’action dominante. */
import { useMemo, useState } from "react";
import { Bookmark, Check, ChevronDown, Clock3, Film, Globe2, Headphones, Library, MoreHorizontal, Play, Plus, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";

const logo = "/manus-storage/suivi-logo_b12e5dda.png";

type Item = { id: number; title: string; meta: string; type: "Reading" | "Watching"; progress: number; updated: string; source: string; accent: string; status: string; image?: string; };

const initialItems: Item[] = [
  { id: 1, title: "One Piece", meta: "Chapter 1152", type: "Reading", progress: 72, updated: "12 min ago", source: "mangaplus.shueisha.co.jp", accent: "#E45B45", status: "In progress", image: "/manus-storage/suivi-reading-scene_a0b240bb.png" },
  { id: 2, title: "Breaking Bad", meta: "Season 3 · Episode 7", type: "Watching", progress: 34, updated: "Yesterday", source: "netflix.com", accent: "#28435E", status: "In progress", image: "/manus-storage/suivi-video-still_aebef692.png" },
  { id: 3, title: "The Apothecary Diaries", meta: "Episode 18", type: "Watching", progress: 51, updated: "2 days ago", source: "crunchyroll.com", accent: "#B68A5E", status: "In progress" },
  { id: 4, title: "The Pragmatic Programmer", meta: "Page 147 of 352", type: "Reading", progress: 41, updated: "4 days ago", source: "archive.org", accent: "#6C7A67", status: "In progress" },
];

function Progress({ value, accent = "#E45B45" }: { value: number; accent?: string }) { return <div className="progress-track"><div className="progress-fill" style={{ width: `${value}%`, background: accent }} /></div>; }
function TypeTag({ type }: { type: Item["type"] }) { return <span className="type-tag"><span className={`type-dot ${type === "Watching" ? "watching" : "reading"}`} />{type}</span>; }

export default function Home() {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Reading" | "Watching">("All");
  const [saved, setSaved] = useState(false);
  const [speed, setSpeed] = useState("1×");
  const [language, setLanguage] = useState("EN");
  const current = items[0];
  const filtered = useMemo(() => items.filter(item => (filter === "All" || item.type === filter) && `${item.title} ${item.meta}`.toLowerCase().includes(query.toLowerCase())), [items, filter, query]);
  const saveCurrent = () => { setSaved(true); toast.success("Progress saved locally", { description: "One Piece · Chapter 1152" }); };
  const remove = (id: number) => { setItems(prev => prev.filter(item => item.id !== id)); toast("Removed from your library"); };

  return <div className="app-shell">
    <aside className="rail">
      <div className="brand"><img src={logo} alt="Suivi" /><span>suivi</span></div>
      <div className="rail-label">Your library</div>
      <nav className="rail-nav">
        <button className="rail-link active"><span className="rail-index">01</span><Library size={16} />Continue <b>4</b></button>
        <button className="rail-link" onClick={() => setFilter("Reading")}><span className="rail-index">02</span><Bookmark size={16} />Reading</button>
        <button className="rail-link" onClick={() => setFilter("Watching")}><span className="rail-index">03</span><Film size={16} />Watching</button>
        <button className="rail-link"><span className="rail-index">04</span><Clock3 size={16} />Activity</button>
      </nav>
      <div className="rail-bottom"><button className="rail-link"><Settings2 size={16} />Settings</button><div className="privacy-note"><span className="privacy-dot" />Stored on this device<br /><small>No account required</small></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">Friday, August 14, 2026</p><h1>Pick up where your attention left off.</h1></div><div className="top-actions"><button className="icon-button" aria-label="Change language" onClick={() => setLanguage(language === "EN" ? "FR" : "EN")}>{language}<ChevronDown size={14} /></button><button className="avatar">H</button></div></header>

      <section className="continue-panel">
        <div className="section-kicker"><span className="kicker-number">01</span><span>Continue</span><span className="kicker-rule" /></div>
        <div className="hero-item">
          <div className="hero-copy"><div className="detected"><Sparkles size={14} /> Detected from this page <span>· 96% confidence</span></div><h2>{current.title}</h2><p className="hero-meta">{current.meta} <span>·</span> {current.type}</p><div className="hero-progress-row"><Progress value={current.progress} /><strong>{current.progress}%</strong></div><p className="saved-line"><Check size={14} /> Last saved {current.updated} · local only</p><div className="hero-actions"><button className="primary-button" onClick={() => toast.success("Opening the saved page…")}><Play size={16} fill="currentColor" />Continue reading</button><button className="quiet-button" onClick={saveCurrent}><Bookmark size={16} />{saved ? "Saved" : "Save progress"}</button><button className="quiet-icon" aria-label="More options"><MoreHorizontal size={18} /></button></div></div>
          <div className="hero-art"><img src={current.image} alt="Abstract reading scene" /><div className="art-caption"><span>Last position</span><strong>Chapter 1152</strong></div></div>
        </div>
      </section>

      <section className="library-section"><div className="section-heading"><div className="section-kicker"><span className="kicker-number">02</span><span>Library</span><span className="kicker-rule" /></div><div className="library-tools"><div className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find something…" /></div><button className="filter-button"><SlidersHorizontal size={15} /> Filter</button></div></div>
        <div className="filter-tabs">{(["All", "Reading", "Watching"] as const).map(tab => <button key={tab} className={filter === tab ? "selected" : ""} onClick={() => setFilter(tab)}>{tab}<span>{tab === "All" ? items.length : items.filter(i => i.type === tab).length}</span></button>)}</div>
        <div className="item-list">{filtered.map(item => <article className="library-item" key={item.id}><div className="item-mark" style={{ background: item.accent }}><span>{item.title.slice(0, 1)}</span></div><div className="item-main"><div className="item-title-row"><h3>{item.title}</h3><TypeTag type={item.type} /></div><p>{item.meta}</p><div className="item-progress"><Progress value={item.progress} accent={item.accent} /><span>{item.progress}%</span></div></div><div className="item-source"><span>{item.source}</span><small>Updated {item.updated}</small></div><button className="item-menu" aria-label={`Remove ${item.title}`} onClick={() => remove(item.id)}><Trash2 size={15} /></button></article>)}</div>
        {filtered.length === 0 && <div className="empty-state"><Search size={22} /><h3>No matches found</h3><p>Try another title or clear the filter.</p></div>}
        <button className="add-button" onClick={() => toast("Open a page and Suivi will detect it for you") }><Plus size={16} /> Add something manually</button>
      </section>
    </main>

    <aside className="context-panel"><div className="context-header"><span>On this page</span><span className="live-dot">Live</span></div><div className="detected-card"><div className="site-icon">M+</div><div><strong>One Piece</strong><span>Chapter 1152</span></div><Check className="success-icon" size={17} /></div><div className="context-divider" /><div className="context-block"><p className="context-label">Detection</p><div className="confidence-row"><span>Structured data</span><strong>96%</strong></div><Progress value={96} accent="#E45B45" /><p className="context-hint">JSON-LD · page title · URL</p></div><div className="context-block video-tools"><p className="context-label">Video tools</p><div className="tool-row"><span><Volume2 size={15} />Playback speed</span><select value={speed} onChange={e => { setSpeed(e.target.value); toast(`Playback speed set to ${e.target.value}`); }}>{["0.75×", "1×", "1.25×", "1.5×", "2×"].map(v => <option key={v}>{v}</option>)}</select></div><button className="pip-button" onClick={() => toast("Picture-in-Picture is available when a compatible HTML5 video is playing") }><Headphones size={15} />Picture-in-Picture <span>↗</span></button></div><div className="context-footer"><Globe2 size={14} /><span>Works offline · privacy by design</span></div></aside>
  </div>;
}
