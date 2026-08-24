import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Flame, Lock, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/Bits";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import {
  CATEGORIES, LEARN_LANGS, levelInfo, wordsFor, type CategoryId, type LearnLang, type Word,
} from "@/lib/vocab";

export default function Learn() {
  const { t, lang } = useI18n();
  const store = useStore();
  const learn = store.learn;
  const pro = store.plan !== "free";
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [detail, setDetail] = useState<Word | null>(null);
  const [review, setReview] = useState<{ queue: Word[]; i: number; revealed: boolean } | null>(null);

  const tr = (w: Word) => (lang === "fr" ? w.fr : w.en);
  const lvl = levelInfo(learn.xp);

  const langLocked = (code: LearnLang) => !pro && code !== "ko";
  const catLocked = (id: CategoryId, idx: number) => !pro && idx >= 2;

  const masteryOf = (id: string) => learn.mastery[id];

  const study = (w: Word, known: boolean) => {
    const res = store.studyWord(w.id, known);
    if (res.leveledUp) toast.success(t("toast.levelUp", { n: res.level }));
    else toast(t("toast.xp", { n: res.xpGained }));
  };

  const catProgress = (id: CategoryId) => {
    const ws = wordsFor(learn.lang, id);
    const done = ws.filter((w) => masteryOf(w.id) === 2).length;
    return { done, total: ws.length };
  };

  const startReview = () => {
    const seen = wordsFor(learn.lang).filter((w) => masteryOf(w.id));
    const queue = [...seen.filter((w) => masteryOf(w.id) === 1), ...seen.filter((w) => masteryOf(w.id) === 2)];
    if (queue.length === 0) {
      toast(t("learn.reviewEmpty"));
      return;
    }
    setReview({ queue, i: 0, revealed: false });
  };

  const gradeReview = (known: boolean) => {
    if (!review) return;
    study(review.queue[review.i], known);
    if (review.i + 1 >= review.queue.length) {
      setReview(null);
      toast.success(t("learn.reviewDone"));
    } else {
      setReview({ ...review, i: review.i + 1, revealed: false });
    }
  };

  const words = useMemo(() => (category ? wordsFor(learn.lang, category) : []), [learn.lang, category]);

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main">
        <div className="welcome">
          <div>
            <span className="eyebrow pastel-label">{t("learn.eyebrow")}</span>
            <h1>{t("learn.title")}</h1>
            <p>{t("learn.subtitle")}</p>
          </div>
          <button className="refresh-button" onClick={startReview}>
            <RotateCcw size={16} />
            {t("learn.startReview")}
          </button>
        </div>

        {/* Progress banner */}
        <section className="learn-banner">
          <div className="learn-level">
            <span className="learn-level-badge"><Trophy size={16} /> {t("learn.level", { n: lvl.level })}</span>
            <div className="learn-xp">
              <Progress value={lvl.pct} accent="#9B86DA" />
              <small>{t("learn.xpTo", { into: lvl.into, needed: lvl.needed })}</small>
            </div>
          </div>
          <div className="learn-streak">
            <Flame size={16} /> {t("learn.dayStreak", { n: learn.streak })}
          </div>
          <div className="learn-langs">
            {LEARN_LANGS.map((l) => (
              <button
                key={l.code}
                className={`learn-lang ${learn.lang === l.code ? "on" : ""}`}
                onClick={() => (langLocked(l.code) ? toast(t("learn.locked")) : (store.setLearnLang(l.code), setCategory(null)))}
              >
                <span>{l.flag}</span>
                {l.label.split(" · ")[0]}
                {langLocked(l.code) && <Lock size={11} />}
              </button>
            ))}
          </div>
        </section>

        {!category ? (
          <section className="learn-cats">
            <div className="rail-title">
              <div>
                <span className="eyebrow">{t("learn.categories")}</span>
                <h3>{LEARN_LANGS.find((l) => l.code === learn.lang)?.label}</h3>
              </div>
            </div>
            <div className="learn-cat-grid">
              {CATEGORIES.map((c, idx) => {
                const locked = catLocked(c.id, idx);
                const { done, total } = catProgress(c.id);
                return (
                  <button
                    key={c.id}
                    className={`learn-cat ${locked ? "locked" : ""}`}
                    onClick={() => (locked ? undefined : setCategory(c.id))}
                  >
                    <span className="learn-cat-emoji">{c.emoji}</span>
                    <strong>{c.label}</strong>
                    {locked ? (
                      <Link href="/pricing" className="learn-lock" onClick={(e) => e.stopPropagation()}>
                        <Lock size={12} /> {t("learn.locked")}
                      </Link>
                    ) : (
                      <>
                        <Progress value={total ? (done / total) * 100 : 0} accent="#6CBE9E" />
                        <small>{t("learn.mastered", { done, total })}</small>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            {!pro && <p className="muted-note">{t("learn.lockedNote")}</p>}
          </section>
        ) : (
          <section className="learn-words">
            <button className="back-link" onClick={() => setCategory(null)}>
              <ArrowLeft size={16} /> {t("learn.back")}
            </button>
            <div className="word-grid">
              {words.map((w) => {
                const m = masteryOf(w.id);
                return (
                  <article key={w.id} className="word-card" onClick={() => setDetail(w)}>
                    <span className={`word-status ${m === 2 ? "known" : m === 1 ? "learning" : "new"}`}>
                      {m === 2 ? t("learn.known") : m === 1 ? t("learn.learning") : t("learn.new")}
                    </span>
                    <span className="word-emoji">{w.emoji}</span>
                    <h4 className="word-script">{w.script}</h4>
                    <span className="word-reading">{w.reading}</span>
                    <span className="word-tr">{tr(w)}</span>
                    <div className="word-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="w-learning" onClick={() => study(w, false)}>{t("learn.stillLearning")}</button>
                      <button className="w-known" onClick={() => study(w, true)}><Check size={13} /> {t("learn.iKnow")}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Word detail modal */}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="word-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetail(null)}><X size={18} /></button>
            <div className="word-modal-head">
              <span className="word-modal-emoji">{detail.emoji}</span>
              <div>
                <h2>{detail.script}</h2>
                <span className="word-modal-reading">{detail.reading}</span>
              </div>
            </div>
            <div className="word-modal-row"><span>{t("learn.meaning")}</span><strong>{tr(detail)}</strong></div>
            {detail.note && <div className="word-modal-block"><span>{t("learn.note")}</span><p>{detail.note}</p></div>}
            {detail.example && (
              <div className="word-modal-block">
                <span>{t("learn.example")}</span>
                <p className="word-example-script">{detail.example}</p>
                {detail.exampleReading && <p className="word-example-reading">{detail.exampleReading}</p>}
                {detail.exampleEn && <p className="word-example-tr">{detail.exampleEn}</p>}
              </div>
            )}
            <div className="word-modal-actions">
              <button className="heart-button" onClick={() => { study(detail, false); setDetail(null); }}>{t("learn.stillLearning")}</button>
              <button className="primary-cta" onClick={() => { study(detail, true); setDetail(null); }}><Check size={15} /> {t("learn.iKnow")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Review session */}
      {review && (
        <div className="modal-backdrop">
          <div className="review-modal">
            <button className="modal-close" onClick={() => setReview(null)}><X size={18} /></button>
            <span className="eyebrow pastel-label"><Sparkles size={12} /> {t("learn.reviewTitle")} · {review.i + 1}/{review.queue.length}</span>
            <div className="review-card">
              <span className="word-emoji">{review.queue[review.i].emoji}</span>
              <h2>{review.queue[review.i].script}</h2>
              {review.revealed ? (
                <>
                  <span className="word-modal-reading">{review.queue[review.i].reading}</span>
                  <strong className="review-meaning">{tr(review.queue[review.i])}</strong>
                </>
              ) : (
                <button className="primary-cta" onClick={() => setReview({ ...review, revealed: true })}>{t("learn.reveal")}</button>
              )}
            </div>
            {review.revealed && (
              <div className="review-actions">
                <button className="heart-button" onClick={() => gradeReview(false)}>{t("learn.stillLearning")}</button>
                <button className="primary-cta" onClick={() => gradeReview(true)}><Check size={15} /> {t("learn.iKnow")}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
