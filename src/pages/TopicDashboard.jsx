import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Target,
  Timer,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserExamHistory } from "../services/examService";
import {
  getChapterById,
  getTopicsByChapterAndLevel,
  SUBJECT_META,
} from "../services/topicService";

const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(value);

function getTimestampMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatAttemptDate(ts) {
  const ms = getTimestampMillis(ts);
  if (!ms) return "No attempts yet";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const EMPTY_TOPIC_STATS = {
  attemptsCount: 0,
  questionsAttempted: 0,
  lastAttemptDate: "No attempts yet",
  lastAttemptScore: "—",
  lastAttemptAccuracy: null,
  avgTimePerQuestion: null,
  bestScore: "—",
};

function buildTopicStatsMap(attempts, level) {
  const normalizedLevel = level.toLowerCase();
  const grouped = new Map();

  for (const item of attempts) {
    if (
      !item.topicId ||
      String(item.examLevel || "").toLowerCase() !== normalizedLevel
    ) {
      continue;
    }
    const list = grouped.get(item.topicId) || [];
    list.push(item);
    grouped.set(item.topicId, list);
  }

  const statsMap = new Map();

  for (const [topicId, matching] of grouped.entries()) {
    matching.sort(
      (a, b) =>
        getTimestampMillis(b.submittedAt || b.startedAt) -
        getTimestampMillis(a.submittedAt || a.startedAt)
    );

    let questionsAttempted = 0;
    let totalTimeSeconds = 0;
    let bestAttempt = matching[0];

    for (const attempt of matching) {
      const attempted = Math.max(0, Number(attempt.attemptedQuestions ?? 0));
      const timeTaken = Math.max(0, Number(attempt.timeTakenSeconds ?? 0));

      questionsAttempted += attempted;
      totalTimeSeconds += timeTaken;

      const currentCorrect = Number(attempt.correctAnswers ?? 0);
      const bestCorrect = Number(bestAttempt.correctAnswers ?? 0);
      const currentAcc = Number(attempt.accuracy ?? 0);
      const bestAcc = Number(bestAttempt.accuracy ?? 0);

      if (
        currentCorrect > bestCorrect ||
        (currentCorrect === bestCorrect && currentAcc > bestAcc)
      ) {
        bestAttempt = attempt;
      }
    }

    const latest = matching[0];
    const avgTimePerQuestion =
      questionsAttempted > 0
        ? Math.round(totalTimeSeconds / questionsAttempted)
        : null;

    statsMap.set(topicId, {
      attemptsCount: matching.length,
      questionsAttempted,
      lastAttemptDate: formatAttemptDate(latest.submittedAt || latest.startedAt),
      lastAttemptScore: `${latest.correctAnswers ?? 0} / ${latest.totalQuestions ?? 0}`,
      lastAttemptAccuracy:
        latest.accuracy !== undefined && latest.accuracy !== null
          ? Number(latest.accuracy)
          : null,
      avgTimePerQuestion,
      bestScore: `${bestAttempt.correctAnswers ?? 0} / ${bestAttempt.totalQuestions ?? 0}`,
    });
  }

  return statsMap;
}

function TopicCardSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading topics"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 rounded-md bg-slate-100" />
            <div className="h-5 w-20 rounded-full bg-slate-100" />
          </div>
          <div className="mt-4 h-6 w-3/4 rounded-md bg-slate-100" />
          <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl bg-slate-50 p-3.5">
            {Array.from({ length: 6 }).map((__, i) => (
              <div key={i} className="h-9 rounded-lg bg-slate-100" />
            ))}
          </div>
          <div className="mt-5 h-11 w-full rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function TopicDashboard() {
  const { chapterId, level } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const normalizedLevel =
    (level || "prelims").toLowerCase() === "mains" ? "mains" : "prelims";
  const isPrelims = normalizedLevel === "prelims";

  const initialChapter = location.state?.chapter || null;

  const [chapter, setChapter] = useState(initialChapter);
  const [topics, setTopics] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [track, setTrack] = useState("all"); // "all" | "clerk" | "po"
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const hasTracks = useMemo(
    () => topics.some((t) => t.track === "clerk" || t.track === "po"),
    [topics]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTopicDashboard() {
      setLoading(true);
      setLoadError(false);
      setTrack("all");
      try {
        const [chapterData, topicList, history] = await Promise.all([
          initialChapter
            ? Promise.resolve(initialChapter)
            : getChapterById(chapterId),
          getTopicsByChapterAndLevel(chapterId, normalizedLevel),
          currentUser?.uid
            ? getUserExamHistory(currentUser.uid)
            : Promise.resolve([]),
        ]);

        if (isMounted) {
          setChapter(
            chapterData || {
              id: chapterId,
              subjectId: location.state?.subjectId || "reasoning",
              name: chapterId.replace(/_/g, " "),
            }
          );
          setTopics(Array.isArray(topicList) ? topicList : []);
          setAttempts(Array.isArray(history) ? history : []);
        }
      } catch (err) {
        console.error("Failed to load topic dashboard:", err);
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTopicDashboard();
    return () => {
      isMounted = false;
    };
  }, [
    chapterId,
    normalizedLevel,
    currentUser?.uid,
    initialChapter,
    location.state?.subjectId,
    reloadKey,
  ]);

  const subjectId = (
    chapter?.subjectId ||
    location.state?.subjectId ||
    "reasoning"
  ).toLowerCase();
  const subjectName = SUBJECT_META[subjectId]?.name || subjectId;

  const topicStatsMap = useMemo(
    () => buildTopicStatsMap(attempts, normalizedLevel),
    [attempts, normalizedLevel]
  );

  const filteredTopics = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    return topics.filter((t) => {
      const trackOk =
        track === "all" || !t.track || t.track === "both" || t.track === track;
      const textOk =
        !queryText || String(t.name || "").toLowerCase().includes(queryText);
      return trackOk && textOk;
    });
  }, [topics, searchTerm, track]);

  const resetFilters = () => {
    setSearchTerm("");
    setTrack("all");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() =>
                navigate(`/chapter/${chapterId}`, {
                  state: { subjectId, chapter },
                })
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Chapter</span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xs font-semibold text-slate-500">
                  {subjectName}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] ${
                    isPrelims
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {normalizedLevel.toUpperCase()}
                </span>
              </div>
              <h1 className="mt-0.5 truncate text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                {chapter?.name || "Topics"} — {isPrelims ? "Prelims" : "Mains"}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {loadError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <span>Could not load topics and performance stats. Please try again.</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4 hover:text-amber-700"
            >
              <RefreshCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {/* Section Header + Search */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className={`text-[11px] font-bold tracking-[0.16em] ${
                isPrelims ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {isPrelims ? "PRELIMS PRACTICE" : "MAINS PRACTICE"}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Topic-Wise Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatNumber(topics.length)} topics available for{" "}
              {isPrelims ? "Prelims" : "Mains"}. Select a topic to configure
              practice.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search topics..."
              aria-label="Search topics"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Clerk / PO Track Filter */}
        {hasTracks && (
          <div
            className="mb-6 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter by exam track"
          >
            {[
              ["all", "All Tracks"],
              ["clerk", "Clerk Mains"],
              ["po", "PO Mains"],
            ].map(([key, label]) => {
              const active = track === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrack(key)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    active
                      ? isPrelims
                        ? "border-emerald-600 bg-emerald-600 text-white focus-visible:outline-emerald-600"
                        : "border-amber-600 bg-amber-600 text-white focus-visible:outline-amber-600"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Topics Grid */}
        {loading ? (
          <TopicCardSkeleton />
        ) : filteredTopics.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-xs">
            <p className="text-sm font-medium text-slate-600">
              {searchTerm
                ? `No topics found matching "${searchTerm}".`
                : `No topics configured for ${normalizedLevel.toUpperCase()} yet.`}
            </p>
            {(searchTerm || track !== "all") && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTopics.map((topic, idx) => {
              const stats = topicStatsMap.get(topic.id) || EMPTY_TOPIC_STATS;
              const topicNum = String(topic.order || idx + 1).padStart(2, "0");

              return (
                <article
                  key={topic.id}
                  className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md motion-reduce:transform-none"
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold tracking-[0.14em] ${
                          isPrelims ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        TOPIC {topicNum}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        <Timer size={12} className="text-slate-400" aria-hidden="true" />
                        {topic.defaultTimePerQuestionSeconds
                          ? `${topic.defaultTimePerQuestionSeconds}s / Q`
                          : "No default timer"}
                      </span>
                    </div>

                    {/* Topic Name */}
                    <h3 className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">
                      {topic.name}
                    </h3>

                    {/* Metrics Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs">
                      <div>
                        <span className="flex items-center gap-1 text-slate-500">
                          <CheckCircle2 size={12} className="text-slate-400" aria-hidden="true" />
                          Attempted
                        </span>
                        <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
                          {formatNumber(stats.questionsAttempted)} Qs
                        </strong>
                      </div>

                      <div>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar size={12} className="text-slate-400" aria-hidden="true" />
                          Last Attempt
                        </span>
                        <strong className="mt-0.5 block truncate text-xs font-bold text-slate-800 sm:text-sm">
                          {stats.lastAttemptDate}
                        </strong>
                      </div>

                      <div>
                        <span className="block text-slate-500">Last Score</span>
                        <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
                          {stats.lastAttemptScore}
                        </strong>
                      </div>

                      <div>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Target size={12} className="text-slate-400" aria-hidden="true" />
                          Last Accuracy
                        </span>
                        <strong
                          className={`mt-0.5 block text-sm font-extrabold ${
                            stats.lastAttemptAccuracy !== null &&
                            stats.lastAttemptAccuracy >= 75
                              ? "text-emerald-600"
                              : "text-slate-900"
                          }`}
                        >
                          {stats.lastAttemptAccuracy !== null
                            ? `${stats.lastAttemptAccuracy}%`
                            : "—"}
                        </strong>
                      </div>

                      <div>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock size={12} className="text-slate-400" aria-hidden="true" />
                          Avg Time / Q
                        </span>
                        <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
                          {stats.avgTimePerQuestion !== null
                            ? `${stats.avgTimePerQuestion}s`
                            : "—"}
                        </strong>
                      </div>

                      <div>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Award size={12} className="text-slate-400" aria-hidden="true" />
                          Best Score
                        </span>
                        <strong
                          className={`mt-0.5 block text-sm font-extrabold ${
                            isPrelims ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {stats.bestScore}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/practice/setup", {
                        state: {
                          subjectId,
                          chapter,
                          topic,
                          examLevel: normalizedLevel,
                        },
                      })
                    }
                    className={`mt-5 flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      isPrelims
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:outline-emerald-600"
                        : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-600 hover:bg-amber-600 hover:text-white focus-visible:outline-amber-600"
                    }`}
                  >
                    <span>Configure &amp; Practice</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}