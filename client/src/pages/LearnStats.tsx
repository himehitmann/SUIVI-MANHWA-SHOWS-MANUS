import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Award, CalendarDays, Flame, Sparkles, Target, Trophy } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/Bits";
import { useI18n } from "@/i18n/I18nContext";
import type { StringKey } from "@/i18n/strings";
import { useStore } from "@/store/StoreContext";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { LEARN_LANGS, levelInfo, todayStr } from "@/lib/vocab";
import {
  activeDays, calendarCells, categoryMastery, dueForecast, learnTotals, studyHistory, totalStudied,
} from "@/lib/stats";

const HISTORY_DAYS = 14;
const CAL_WEEKS = 13;
const FORECAST_DAYS = 7;

/** Map a study count to a heatmap intensity level 0–4. */
function heat(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

export default function LearnStats() {
  const { t, lang } = useI18n();
  const store = useStore();
  const learn = store.learn;
  const today = todayStr();
  const lvl = levelInfo(learn.xp);

  const history = useMemo(() => studyHistory(learn.daily, today, HISTORY_DAYS), [learn.daily, today]);
  const cells = useMemo(() => calendarCells(learn.daily, today, CAL_WEEKS), [learn.daily, today]);
  const forecast = useMemo(() => dueForecast(learn.srs, today, FORECAST_DAYS), [learn.srs, today]);
  const cats = useMemo(() => categoryMastery(learn.mastery, learn.lang), [learn.mastery, learn.lang]);
  const totals = useMemo(() => learnTotals(learn.mastery, learn.lang), [learn.mastery, learn.lang]);

  const langMeta = LEARN_LANGS.find((l) => l.code === learn.lang);
  const historyMax = Math.max(1, ...history.map((d) => d.count));
  const forecastMax = Math.max(1, ...forecast.map((d) => d.count));
  const unlocked = learn.achievements.length;
  const active30 = activeDays(learn.daily, today, 30);
  const totalActions = totalStudied(learn.daily);

  const shortDay = (date: string) =>
    new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
  const dayNum = (date: string) => Number(date.slice(8, 10));
  const monthShort = (date: string) =>
    new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));

  const tiles = [
    { icon: <Trophy size={16} />, label: t("stats.level"), value: String(lvl.level), sub: t("learn.xpTo", { into: lvl.into, needed: lvl.needed }) },
    { icon: <Flame size={16} />, label: t("stats.streak"), value: String(learn.streak), sub: t("stats.streakSub", { n: active30 }) },
    { icon: <Sparkles size={16} />, label: t("stats.known"), value: String(totals.known), sub: t("stats.knownSub", { learning: totals.learning }) },
    { icon: <Target size={16} />, label: t("stats.actions"), value: String(totalActions), sub: t("stats.actionsSub") },
    { icon: <Award size={16} />, label: t("stats.badges"), value: `${unlocked}/${ACHIEVEMENTS.length}`, sub: t("stats.badgesSub") },
  ];

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main">
        <div className="welcome">
          <div>
            <span className="eyebrow pastel-label">{t("stats.eyebrow")}</span>
            <h1>{t("stats.title")}</h1>
            <p>{t("stats.subtitle")}</p>
          </div>
          <Link href="/learn" className="refresh-button">
            <ArrowLeft size={16} /> {t("stats.backToLearn")}
          </Link>
        </div>

        {/* Summary tiles */}
        <section className="stat-tiles">
          {tiles.map((tile) => (
            <div key={tile.label} className="stat-tile">
              <span className="stat-tile-label">{tile.icon} {tile.label}</span>
              <strong className="stat-tile-value">{tile.value}</strong>
              <small>{tile.sub}</small>
            </div>
          ))}
        </section>

        <div className="stats-grid">
          {/* Activity: last 14 days */}
          <section className="stats-panel">
            <div className="stats-panel-head">
              <h3>{t("stats.activity")}</h3>
              <span>{t("stats.activitySub", { n: HISTORY_DAYS })}</span>
            </div>
            <div className="bar-chart">
              {history.map((d) => (
                <div key={d.date} className="bar-col" title={`${d.date}: ${d.count}`}>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${d.count > 0 ? "on" : ""}`}
                      style={{ height: `${Math.round((d.count / historyMax) * 100)}%` }}
                    />
                  </div>
                  <span className="bar-label">{dayNum(d.date)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Review forecast */}
          <section className="stats-panel">
            <div className="stats-panel-head">
              <h3>{t("stats.forecast")}</h3>
              <span>{t("stats.forecastSub")}</span>
            </div>
            <div className="bar-chart">
              {forecast.map((d, i) => (
                <div key={d.date} className="bar-col" title={`${d.date}: ${d.count}`}>
                  <div className="bar-track">
                    <div
                      className={`bar-fill forecast ${d.count > 0 ? "on" : ""}`}
                      style={{ height: `${Math.round((d.count / forecastMax) * 100)}%` }}
                    />
                  </div>
                  <span className="bar-label">{i === 0 ? t("stats.today") : shortDay(d.date)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Streak calendar */}
        <section className="stats-panel">
          <div className="stats-panel-head">
            <h3><CalendarDays size={16} /> {t("stats.calendar")}</h3>
            <span>{t("stats.calendarSub", { n: CAL_WEEKS })}</span>
          </div>
          <div className="heatmap">
            {cells.map((c) => (
              <div
                key={c.date}
                className={`heat-cell ${c.future ? "future" : `l${heat(c.count)}`} ${c.date === today ? "is-today" : ""}`}
                title={c.future ? c.date : `${c.date}: ${c.count}`}
              />
            ))}
          </div>
          <div className="heat-legend">
            <span>{t("stats.less")}</span>
            <div className="heat-cell l0" />
            <div className="heat-cell l1" />
            <div className="heat-cell l2" />
            <div className="heat-cell l3" />
            <div className="heat-cell l4" />
            <span>{t("stats.more")}</span>
          </div>
        </section>

        {/* Category mastery */}
        <section className="stats-panel">
          <div className="stats-panel-head">
            <h3>{t("stats.mastery")}</h3>
            <span>{langMeta?.flag} {langMeta?.label}</span>
          </div>
          <div className="mastery-list">
            {cats.map((c) => {
              const pct = c.total ? (c.known / c.total) * 100 : 0;
              return (
                <div key={c.id} className="mastery-row">
                  <span className="mastery-name">{t(`learn.cat.${c.id}` as StringKey)}</span>
                  <Progress value={pct} accent="#6CBE9E" />
                  <small>{t("learn.mastered", { done: c.known, total: c.total })}</small>
                </div>
              );
            })}
          </div>
        </section>

        <p className="stats-foot">{monthShort(today)} · {t("stats.localNote")}</p>
      </main>
    </div>
  );
}
