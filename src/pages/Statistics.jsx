import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ListChecks,
  Loader2,
  Target,
  Timer,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserExamHistory } from "../services/examService";

/* ------------------------------------------------------------------ */
/* Tunable thresholds                                                  */
/* ------------------------------------------------------------------ */
const WEAK_BELOW = 60; // accuracy % under this = weak
const STRONG_FROM = 80; // accuracy % from this = strong
const MIN_GRADED = 5; // topic needs this many graded Qs before it is judged
const SLOW_SEC_PER_Q = 75; // sec/question above this = slow
const TREND_POINTS = 10; // attempts shown in the trend chart

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const toMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pretty = (s) =>
  String(s || "Unknown")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fmtDuration = (sec) => {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const fmtDate = (ms) =>
  ms
    ? new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "Just now";

const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Combine many attempts into one set of totals. */
const aggregate = (list) => {
  const t = {
    attempts: list.length,
    attempted: 0,
    correct: 0,
    wrong: 0,
    ungraded: 0,
    seconds: 0,
  };
  list.forEach((a) => {
    t.attempted += a.attemptedQuestions || 0;
    t.correct += a.correctAnswers || 0;
    t.wrong += a.wrongAnswers || 0;
    t.ungraded += a.ungradedQuestions || 0;
    t.seconds += a.timeTakenSeconds || 0;
  });
  t.graded = t.correct + t.wrong;
  t.accuracy = t.graded > 0 ? Math.round((t.correct / t.graded) * 100) : null;
  t.secPerQ = t.attempted > 0 ? Math.round(t.seconds / t.attempted) : null;
  return t;
};

const statusOf = (accuracy, graded) => {
  if (accuracy == null || graded < MIN_GRADED)
    return { label: "Not enough data", tone: "slate" };
  if (accuracy < WEAK_BELOW) return { label: "Weak", tone: "rose" };
  if (accuracy >= STRONG_FROM) return { label: "Strong", tone: "emerald" };
  return { label: "Average", tone: "amber" };
};

const TONES = {
  emerald: {
    bar: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  amber: {
    bar: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
  },
  rose: {
    bar: "bg-rose-500",
    chip: "border-rose-200 bg-rose-50 text-rose-800",
  },
  slate: {
    bar: "bg-slate-300",
    chip: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */
function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
      <h2 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={15} aria-hidden="true" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Chips({ options, value, onChange, label }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={label}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
              active
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AccuracyBar({ accuracy, tone }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={accuracy ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${TONES[tone].bar}`}
        style={{ width: `${accuracy ?? 0}%` }}
      />
    </div>
  );
}

/** Accuracy per attempt, oldest -> newest. Plain SVG, no chart library. */
function TrendChart({ attempts }) {
  const W = 320;
  const H = 130;
  const padX = 22;
  const padTop = 10;
  const padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const x = (i) =>
    attempts.length === 1 ? W / 2 : padX + (i / (attempts.length - 1)) * innerW;
  const y = (v) => padTop + (1 - v / 100) * innerH;

  const points = attempts.map((a, i) => ({
    cx: x(i),
    cy: y(a.accuracy || 0),
    v: a.accuracy || 0,
    d: fmtDate(toMillis(a.submittedAt)),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Accuracy over last ${attempts.length} attempts: ${points
        .map((p) => `${p.v}%`)
        .join(", ")}`}
    >
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line
            x1={padX}
            x2={W - padX}
            y1={y(g)}
            y2={y(g)}
            stroke="#e2e8f0"
            strokeDasharray={g === 50 ? "3 3" : undefined}
          />
          <text x={2} y={y(g) + 3} fontSize="9" fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}

      {/* Weak line */}
      <line
        x1={padX}
        x2={W - padX}
        y1={y(WEAK_BELOW)}
        y2={y(WEAK_BELOW)}
        stroke="#fda4af"
        strokeDasharray="2 3"
      />

      {points.length > 1 && (
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.map((p) => `${p.cx},${p.cy}`).join(" ")}
        />
      )}

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r="4" fill="#fff" stroke="#10b981" strokeWidth="2" />
          {(points.length <= 6 || i === 0 || i === points.length - 1) && (
            <text
              x={p.cx}
              y={H - 6}
              fontSize="8.5"
              textAnchor="middle"
              fill="#64748b"
            >
              {p.d}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Questions attempted per day for the last 7 days. */
function WeekBars({ attempts }) {
  const days = useMemo(() => {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push({
        key: dayKey(d.getTime()),
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        count: 0,
      });
    }
    attempts.forEach((a) => {
      const ms = toMillis(a.submittedAt);
      if (!ms) return;
      const slot = out.find((d) => d.key === dayKey(ms));
      if (slot) slot.count += a.attemptedQuestions || 0;
    });
    return out;
  }, [attempts]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <>
      <div className="flex h-28 items-end gap-2">
        {days.map((d) => (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-slate-500">
              {d.count || ""}
            </span>
            <div
              className={`w-full rounded-t-lg ${d.count ? "bg-emerald-500" : "bg-slate-100"}`}
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              title={`${d.label}: ${d.count} questions`}
            />
            <span className="text-[10px] font-medium text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        <strong className="font-semibold text-slate-700">{total}</strong> questions in{" "}
        <strong className="font-semibold text-slate-700">{activeDays}/7</strong> days
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Statistics() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }
      try {
        const data = await getUserExamHistory(currentUser.uid);
        if (!cancelled) setHistory(data);
      } catch (err) {
        console.error("Failed to load statistics:", err);
        if (!cancelled)
          setError("Statistics load nahi hui. Internet ya Firestore rules check karo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  const subjectOptions = useMemo(() => {
    const ids = [...new Set(history.map((a) => a.subjectId).filter(Boolean))];
    return [
      { value: "all", label: "All subjects" },
      ...ids.map((id) => ({ value: id, label: pretty(id) })),
    ];
  }, [history]);

  const filtered = useMemo(
    () =>
      history.filter(
        (a) =>
          (subject === "all" || a.subjectId === subject) &&
          (level === "all" || (a.examLevel || "prelims").toLowerCase() === level)
      ),
    [history, subject, level]
  );

  const overall = useMemo(() => aggregate(filtered), [filtered]);

  // Oldest -> newest, last N attempts that have graded data
  const trend = useMemo(
    () =>
      [...filtered]
        .filter((a) => (a.correctAnswers || 0) + (a.wrongAnswers || 0) > 0)
        .sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt))
        .slice(-TREND_POINTS),
    [filtered]
  );

  const subjectRows = useMemo(() => {
    const map = new Map();
    filtered.forEach((a) => {
      const key = a.subjectId || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()]
      .map(([id, list]) => ({ id, name: pretty(id), ...aggregate(list) }))
      .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
  }, [filtered]);

  const topicRows = useMemo(() => {
    const map = new Map();
    filtered.forEach((a) => {
      const key = a.topicId || a.topicName;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: a.topicName || pretty(a.topicId),
          chapter: a.chapterName || "",
          list: [],
        });
      }
      map.get(key).list.push(a);
    });
    return [...map.values()]
      .map((t) => {
        const agg = aggregate(t.list);
        return { ...t, ...agg, status: statusOf(agg.accuracy, agg.graded) };
      })
      .filter((t) => t.graded > 0);
  }, [filtered]);

  // Weak first: judged topics only, lowest accuracy on top
  const weakTopics = useMemo(
    () =>
      topicRows
        .filter((t) => t.status.tone === "rose")
        .sort((a, b) => a.accuracy - b.accuracy),
    [topicRows]
  );

  const strongTopics = useMemo(
    () =>
      topicRows
        .filter((t) => t.status.tone === "emerald")
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 3),
    [topicRows]
  );

  const recent = useMemo(() => filtered.slice(0, 6), [filtered]);

  /* ----------------------------- render ----------------------------- */
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Home"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-3 sm:text-sm"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-base">
              Statistics
            </h1>
            <p className="truncate text-xs text-slate-500">
              Accuracy, speed and weak topics
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
        {loading && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-24 text-sm font-medium text-slate-500"
          >
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Loading your statistics...
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <BarChart3 size={28} className="mx-auto text-slate-400" aria-hidden="true" />
            <h2 className="mt-3 text-base font-extrabold">No attempts yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
              Finish one practice set and grade it. Your statistics appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate("/practice/setup")}
              className="mt-5 inline-flex items-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Start practice
            </button>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <>
            {/* Filters */}
            <div className="space-y-2.5">
              <Chips
                label="Filter by subject"
                options={subjectOptions}
                value={subject}
                onChange={setSubject}
              />
              <Chips
                label="Filter by exam level"
                options={[
                  { value: "all", label: "All levels" },
                  { value: "prelims", label: "Prelims" },
                  { value: "mains", label: "Mains" },
                ]}
                value={level}
                onChange={setLevel}
              />
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                No attempts match this filter.
              </p>
            ) : (
              <>
                {/* Summary tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    icon={Target}
                    label="Accuracy"
                    value={overall.accuracy == null ? "--" : `${overall.accuracy}%`}
                    hint={`${overall.correct} right, ${overall.wrong} wrong`}
                  />
                  <StatTile
                    icon={ListChecks}
                    label="Attempted"
                    value={overall.attempted}
                    hint={`${overall.attempts} sets`}
                  />
                  <StatTile
                    icon={Timer}
                    label="Time per Q"
                    value={overall.secPerQ == null ? "--" : `${overall.secPerQ}s`}
                    hint={`${fmtDuration(overall.seconds)} total`}
                  />
                  <StatTile
                    icon={AlertTriangle}
                    label="Ungraded"
                    value={overall.ungraded}
                    hint="Not in accuracy"
                  />
                </div>

                {/* Trend */}
                <Card
                  title="Accuracy trend"
                  subtitle={`Last ${trend.length} graded sets. Dotted red line = ${WEAK_BELOW}%.`}
                >
                  {trend.length > 0 ? (
                    <TrendChart attempts={trend} />
                  ) : (
                    <p className="text-sm text-slate-500">
                      Grade at least one set to see the trend.
                    </p>
                  )}
                </Card>

                {/* Weak topics */}
                <Card
                  title="Weak topics"
                  subtitle={`Below ${WEAK_BELOW}% accuracy with ${MIN_GRADED}+ graded questions. Revise these first.`}
                >
                  {weakTopics.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      No weak topic found yet. Keep practising to get more data.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {weakTopics.map((t) => {
                        const slow = t.secPerQ != null && t.secPerQ > SLOW_SEC_PER_Q;
                        return (
                          <li
                            key={t.key}
                            className="rounded-xl border border-rose-200/80 bg-rose-50/30 p-3.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold">{t.name}</p>
                                {t.chapter && (
                                  <p className="truncate text-xs text-slate-500">{t.chapter}</p>
                                )}
                              </div>
                              <span className="shrink-0 text-lg font-extrabold tabular-nums text-rose-700">
                                {t.accuracy}%
                              </span>
                            </div>
                            <div className="mt-2.5">
                              <AccuracyBar accuracy={t.accuracy} tone="rose" />
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                              <span>
                                {t.correct}/{t.graded} correct
                              </span>
                              <span>{t.secPerQ}s per Q</span>
                              <span>{t.attempts} sets</span>
                              <span
                                className={`rounded-full border px-2 py-0.5 font-semibold ${
                                  slow ? TONES.amber.chip : TONES.rose.chip
                                }`}
                              >
                                {slow ? "Slow and inaccurate: concept gap" : "Fast but wrong: careless or trap"}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                {/* Subject wise */}
                <Card title="Subject wise" subtitle="Lowest accuracy first.">
                  <ul className="space-y-4">
                    {subjectRows.map((s) => {
                      const st = statusOf(s.accuracy, s.graded);
                      return (
                        <li key={s.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-bold">{s.name}</p>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONES[st.tone].chip}`}
                              >
                                {st.label}
                              </span>
                            </div>
                            <span className="shrink-0 text-sm font-extrabold tabular-nums">
                              {s.accuracy == null ? "--" : `${s.accuracy}%`}
                            </span>
                          </div>
                          <div className="mt-2">
                            <AccuracyBar accuracy={s.accuracy} tone={st.tone} />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">
                            {s.attempted} attempted, {s.attempts} sets
                            {s.secPerQ != null ? `, ${s.secPerQ}s per Q` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </Card>

                {/* Strong topics */}
                {strongTopics.length > 0 && (
                  <Card title="Strong topics" subtitle={`${STRONG_FROM}%+ accuracy. Revise once a week to keep them.`}>
                    <ul className="divide-y divide-slate-100">
                      {strongTopics.map((t) => (
                        <li key={t.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                          <p className="truncate text-sm font-semibold">{t.name}</p>
                          <span className="shrink-0 text-sm font-extrabold tabular-nums text-emerald-700">
                            {t.accuracy}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Weekly activity */}
                <Card title="Last 7 days" subtitle="Questions attempted per day.">
                  <WeekBars attempts={filtered} />
                </Card>

                {/* Recent */}
                <Card title="Recent sets">
                  <ul className="divide-y divide-slate-100">
                    {recent.map((a) => {
                      const graded = (a.correctAnswers || 0) + (a.wrongAnswers || 0);
                      const st = statusOf(a.accuracy, Math.max(graded, MIN_GRADED));
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {a.topicName || a.chapterName || "Practice set"}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {fmtDate(toMillis(a.submittedAt))} ·{" "}
                              {a.attemptedQuestions || 0}/{a.totalQuestions || 0} attempted ·{" "}
                              {fmtDuration(a.timeTakenSeconds)}
                              {a.overtimeSeconds > 0 ? " (overtime)" : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${
                              graded > 0 ? TONES[st.tone === "slate" ? "slate" : st.tone].chip : TONES.slate.chip
                            }`}
                          >
                            {graded > 0 ? `${a.accuracy}%` : "Ungraded"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}