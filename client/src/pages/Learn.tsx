import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Check, Flame, GraduationCap, Keyboard, ListChecks, Lock, RotateCcw,
  Sparkles, Target, Trophy, Volume2, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/Bits";
import { useI18n } from "@/i18n/I18nContext";
import type { StringKey } from "@/i18n/strings";
import { useStore } from "@/store/StoreContext";
import {
  CATEGORIES, LEARN_LANGS, levelInfo, todayStr, wordsFor,
  type CategoryId, type LearnLang, type Word,
} from "@/lib/vocab";
import { isDue, newCard, qualityOf, schedule, type Grade } from "@/lib/srs";
import { buildQuiz, checkTyping, type QuizMode, type QuizQuestion } from "@/lib/quiz";
import { ACHIEVEMENTS, DAILY_GOAL_OPTIONS, dailyProgress } from "@/lib/achievements";
import { canSpeak, speak } from "@/lib/speak";
import type { StudyResult } from "@/store/StoreContext";

interface ReviewSession { queue: Word[]; i: number; revealed: boolean }
interface QuizSession {
  qs: QuizQuestion[];
  i: number;
  selected: string | null;
  answered: boolean;
  input: string;
  correct: number;
  done: boolean;
}

export default function Learn() {
  const { t, lang } = useI18n();
  const store = useStore();
  const learn = store.learn;
  const pro = store.plan !== "free";
  const speakable = canSpeak();
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [detail, setDetail] = useState<Word | null>(null);
  const [review, setReview] = useState<ReviewSession | null>(null);
  const [quiz, setQuiz] = useState<QuizSession | null>(null);
  const [quizPick, setQuizPick] = useState(false);

  const tr = (w: Word) => (lang === "fr" ? w.fr : w.en);
  const lvl = levelInfo(learn.xp);
  const today = todayStr();
  const goal = dailyProgress(learn.daily, today, learn.dailyGoal);

  const langLocked = (code: LearnLang) => !pro && code !== "ko";
  const catLocked = (_id: CategoryId, idx: number) => !pro && idx >= 2;
  const masteryOf = (id: string) => learn.mastery[id];

  const seenWords = useMemo(
    () => wordsFor(learn.lang).filter((w) => masteryOf(w.id)),
    [learn.lang, learn.mastery],
  );
  const dueWords = useMemo(
    () => seenWords.filter((w) => isDue(learn.srs[w.id], today)),
    [seenWords, learn.srs, today],
  );

  const say = (w: Word) => speak(w.script, learn.lang);

  const announce = (res: StudyResult) => {
    if (res.leveledUp) toast.success(t("toast.levelUp", { n: res.level }));
    else if (res.xpGained) toast(t("toast.xp", { n: res.xpGained }));
    for (const id of res.newAchievements) {
      const ach = ACHIEVEMENTS.find((a) => a.id === id);
      toast.success(t("toast.achievement", { emoji: ach?.emoji ?? "🏅", name: t(`learn.ach.${id}` as StringKey) }));
    }
  };

  const study = (w: Word, known: boolean) => announce(store.studyWord(w.id, known));

  const catProgress = (id: CategoryId) => {
    const ws = wordsFor(learn.lang, id);
    return { done: ws.filter((w) => masteryOf(w.id) === 2).length, total: ws.length };
  };

  // ---- Review (SM-2) ----
  const startReview = () => {
    if (seenWords.length === 0) {
      toast(t("learn.reviewEmpty"));
      return;
    }
    const queue = dueWords.length ? dueWords : seenWords;
    if (!dueWords.length) toast(t("learn.reviewAhead"));
    setReview({ queue: [...queue], i: 0, revealed: false });
  };

  const gradeReview = (grade: Grade) => {
    if (!review) return;
    announce(store.gradeCard(review.queue[review.i].id, grade));
    if (review.i + 1 >= review.queue.length) {
      setReview(null);
      toast.success(t("learn.reviewDone"));
    } else {
      setReview({ ...review, i: review.i + 1, revealed: false });
    }
  };

  // ---- Quiz ----
  const startQuiz = (mode: QuizMode | "mixed") => {
    setQuizPick(false);
    const pool = seenWords.length >= 4 ? seenWords : wordsFor(learn.lang);
    if (pool.length < 4) {
      toast(t("learn.quizNeed"));
      return;
    }
    const qs = buildQuiz(pool, tr, { count: Math.min(10, pool.length), mode });
    setQuiz({ qs, i: 0, selected: null, answered: false, input: "", correct: 0, done: false });
  };

  const answerMc = (choice: string) => {
    if (!quiz || quiz.answered) return;
    const q = quiz.qs[quiz.i];
    const ok = choice === q.answer;
    setQuiz({ ...quiz, selected: choice, answered: true, correct: quiz.correct + (ok ? 1 : 0) });
  };

  const answerTyping = () => {
    if (!quiz || quiz.answered) return;
    const q = quiz.qs[quiz.i];
    const ok = checkTyping(q.word, quiz.input, tr);
    setQuiz({ ...quiz, answered: true, correct: quiz.correct + (ok ? 1 : 0) });
  };

  const nextQuiz = () => {
    if (!quiz) return;
    if (quiz.i + 1 >= quiz.qs.length) {
      const res = store.recordQuiz(quiz.correct, quiz.qs.length);
      announce(res);
      setQuiz({ ...quiz, done: true });
    } else {
      setQuiz({ ...quiz, i: quiz.i + 1, selected: null, answered: false, input: "" });
    }
  };

  const words = useMemo(() => (category ? wordsFor(learn.lang, category) : []), [learn.lang, category]);
  const unlocked = new Set(learn.achievements);

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
          <div className="learn-cta-group">
            <button className="refresh-button ghost-cta" onClick={() => setQuizPick(true)}>
              <GraduationCap size={16} />
              {t("learn.quiz")}
            </button>
            <button className="refresh-button" onClick={startReview}>
              <RotateCcw size={16} />
              {t("learn.startReview")}
              {dueWords.length > 0 && <span className="due-badge">{dueWords.length}</span>}
            </button>
          </div>
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
          <div className="learn-goal">
            <div className="learn-goal-head">
              <span><Target size={14} /> {t("learn.dailyGoal")}</span>
              <strong className={goal.met ? "goal-met" : ""}>{goal.done}/{goal.goal}</strong>
            </div>
            <Progress value={goal.pct} accent={goal.met ? "#6CBE9E" : "#E0894A"} />
            <div className="learn-goal-opts">
              {DAILY_GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  className={`goal-opt ${learn.dailyGoal === g ? "on" : ""}`}
                  onClick={() => store.setDailyGoal(g)}
                >
                  {g}
                </button>
              ))}
            </div>
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
          <>
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
                      <strong>{t(`learn.cat.${c.id}` as StringKey)}</strong>
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

            {/* Achievements */}
            <section className="learn-achievements">
              <div className="rail-title">
                <div>
                  <span className="eyebrow">{t("learn.achievements")}</span>
                  <h3>{t("learn.achievementsSub", { n: unlocked.size, total: ACHIEVEMENTS.length })}</h3>
                </div>
              </div>
              <div className="ach-grid">
                {ACHIEVEMENTS.map((a) => {
                  const on = unlocked.has(a.id);
                  return (
                    <div key={a.id} className={`ach-card ${on ? "on" : ""}`}>
                      <span className="ach-emoji">{on ? a.emoji : "🔒"}</span>
                      <strong>{t(`learn.ach.${a.id}` as StringKey)}</strong>
                      <small>{t(`learn.achDesc.${a.id}` as StringKey)}</small>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
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
                    {speakable && (
                      <button className="audio-btn" aria-label={t("learn.listen")} onClick={(e) => { e.stopPropagation(); say(w); }}>
                        <Volume2 size={14} />
                      </button>
                    )}
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
              {speakable && (
                <button className="audio-btn big" aria-label={t("learn.listen")} onClick={() => say(detail)}>
                  <Volume2 size={18} />
                </button>
              )}
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

      {/* Review session (SM-2, three grades) */}
      {review && (
        <div className="modal-backdrop">
          <div className="review-modal">
            <button className="modal-close" onClick={() => setReview(null)}><X size={18} /></button>
            <span className="eyebrow pastel-label"><Sparkles size={12} /> {t("learn.reviewTitle")} · {review.i + 1}/{review.queue.length}</span>
            <div className="review-card">
              <span className="word-emoji">{review.queue[review.i].emoji}</span>
              <h2>{review.queue[review.i].script}</h2>
              {speakable && (
                <button className="audio-btn big" aria-label={t("learn.listen")} onClick={() => say(review.queue[review.i])}>
                  <Volume2 size={18} />
                </button>
              )}
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
              <div className="review-grades">
                <button className="grade again" onClick={() => gradeReview("again")}>
                  <span>{t("learn.gradeAgain")}</span>
                  <small>{intervalLabelFor(review.queue[review.i].id, "again", learn, today, t)}</small>
                </button>
                <button className="grade good" onClick={() => gradeReview("good")}>
                  <span>{t("learn.gradeGood")}</span>
                  <small>{intervalLabelFor(review.queue[review.i].id, "good", learn, today, t)}</small>
                </button>
                <button className="grade easy" onClick={() => gradeReview("easy")}>
                  <span>{t("learn.gradeEasy")}</span>
                  <small>{intervalLabelFor(review.queue[review.i].id, "easy", learn, today, t)}</small>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quiz mode picker */}
      {quizPick && (
        <div className="modal-backdrop" onClick={() => setQuizPick(false)}>
          <div className="quiz-pick" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setQuizPick(false)}><X size={18} /></button>
            <span className="eyebrow pastel-label"><GraduationCap size={12} /> {t("learn.quiz")}</span>
            <h2>{t("learn.quizPickTitle")}</h2>
            <p>{t("learn.quizPickSub")}</p>
            <div className="quiz-modes">
              <button onClick={() => startQuiz("mixed")}>
                <ListChecks size={20} />
                <strong>{t("learn.quizMc")}</strong>
                <small>{t("learn.quizMcDesc")}</small>
              </button>
              <button onClick={() => startQuiz("typing")}>
                <Keyboard size={20} />
                <strong>{t("learn.quizTyping")}</strong>
                <small>{t("learn.quizTypingDesc")}</small>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz runner */}
      {quiz && (
        <div className="modal-backdrop">
          <div className="quiz-modal">
            <button className="modal-close" onClick={() => setQuiz(null)}><X size={18} /></button>
            {quiz.done ? (
              <div className="quiz-result">
                <span className="quiz-result-emoji">{quiz.correct === quiz.qs.length ? "🏆" : quiz.correct >= quiz.qs.length / 2 ? "🎉" : "💪"}</span>
                <h2>{t("learn.quizScore", { correct: quiz.correct, total: quiz.qs.length })}</h2>
                {quiz.correct === quiz.qs.length && <span className="perfect-badge">🎯 {t("learn.quizPerfect")}</span>}
                <button className="primary-cta full" onClick={() => setQuiz(null)}><Check size={15} /> {t("learn.done")}</button>
              </div>
            ) : (
              <QuizQuestionView
                q={quiz.qs[quiz.i]}
                index={quiz.i}
                total={quiz.qs.length}
                answered={quiz.answered}
                selected={quiz.selected}
                input={quiz.input}
                speakable={speakable}
                tr={tr}
                t={t}
                onSpeak={(w) => speak(w.script, learn.lang)}
                onPick={answerMc}
                onInput={(v) => setQuiz({ ...quiz, input: v })}
                onSubmit={answerTyping}
                onNext={nextQuiz}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Localized "next review" preview for what grading now would schedule. */
function intervalLabelFor(
  id: string,
  grade: Grade,
  learn: { srs: Record<string, import("@/lib/types").SrsCard> },
  today: string,
  t: (key: StringKey, vars?: Record<string, string | number>) => string,
): string {
  const days = schedule(learn.srs[id] ?? newCard(today), qualityOf(grade), today).intervalDays;
  if (days <= 1) return t("learn.dueDay", { n: 1 });
  if (days < 30) return t("learn.dueDays", { n: days });
  const months = Math.round(days / 30);
  return months <= 1 ? t("learn.dueMonth", { n: 1 }) : t("learn.dueMonths", { n: months });
}

interface QuizViewProps {
  q: QuizQuestion;
  index: number;
  total: number;
  answered: boolean;
  selected: string | null;
  input: string;
  speakable: boolean;
  tr: (w: Word) => string;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  onSpeak: (w: Word) => void;
  onPick: (choice: string) => void;
  onInput: (v: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}

function QuizQuestionView(p: QuizViewProps) {
  const { q, t } = p;
  const typedCorrect = p.answered && q.mode === "typing" && checkTyping(q.word, p.input, p.tr);
  const promptHint =
    q.mode === "meaning" ? t("learn.quizAskMeaning") : q.mode === "reading" ? t("learn.quizAskReading") : t("learn.quizAskTyping");

  return (
    <div className="quiz-body">
      <span className="eyebrow pastel-label">{promptHint} · {p.index + 1}/{p.total}</span>
      <div className="quiz-prompt">
        <span className="word-emoji">{q.word.emoji}</span>
        <h2>{q.prompt}</h2>
        {p.speakable && (
          <button className="audio-btn big" aria-label={t("learn.listen")} onClick={() => p.onSpeak(q.word)}>
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {q.mode === "typing" ? (
        <div className="quiz-typing">
          <input
            autoFocus
            className="quiz-input"
            placeholder={t("learn.quizTypePlaceholder")}
            value={p.input}
            disabled={p.answered}
            onChange={(e) => p.onInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (p.answered ? p.onNext() : p.onSubmit()); }}
          />
          {p.answered && (
            <div className={`quiz-verdict ${typedCorrect ? "ok" : "no"}`}>
              {typedCorrect ? <Check size={15} /> : <X size={15} />}
              <span>{q.answer}{q.answer !== p.tr(q.word) ? ` · ${p.tr(q.word)}` : ""}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="quiz-choices">
          {q.choices.map((c) => {
            const state = !p.answered ? "" : c === q.answer ? "correct" : c === p.selected ? "wrong" : "dim";
            return (
              <button key={c} className={`quiz-choice ${state}`} disabled={p.answered} onClick={() => p.onPick(c)}>
                {c}
              </button>
            );
          })}
        </div>
      )}

      <div className="quiz-foot">
        {q.mode === "typing" && !p.answered ? (
          <button className="primary-cta full" onClick={p.onSubmit} disabled={!p.input.trim()}>{t("learn.check")}</button>
        ) : (
          <button className="primary-cta full" onClick={p.onNext} disabled={!p.answered}>{t("learn.next")}</button>
        )}
      </div>
    </div>
  );
}
