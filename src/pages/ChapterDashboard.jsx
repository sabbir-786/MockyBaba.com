import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Target,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserExamHistory } from "../services/examService";
import {
  getChapterById,
  getTopicsByChapterAndLevel,
  SUBJECT_META,
} from "../services/topicService";

const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(value);

const toMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const fmtDateTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Just now";

function computeLevelStats(attempts, chapterId, level) {
  const normalizedLevel = level.toLowerCase();
  const matching = attempts.filter(
    (item) =>
      item.chapterId === chapterId &&
      (item.examLevel || "").toLowerCase() === normalizedLevel
  );

  let questionsAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalTimeSeconds = 0;

  for (const attempt of matching) {
    questionsAttempted += Math.max(0, Number(attempt.attemptedQuestions ?? 0));
    totalCorrect += Math.max(0, Number(attempt.correctAnswers ?? 0));
    totalWrong += Math.max(0, Number(attempt.wrongAnswers ?? 0));
    totalTimeSeconds += Math.max(0, Number(attempt.timeTakenSeconds ?? 0));
  }

  const graded = totalCorrect + totalWrong;
  const accuracy = graded > 0 ? Math.round((totalCorrect / graded) * 100) : null;
  const avgTimePerQuestion =
    questionsAttempted > 0
      ? Math.round(totalTimeSeconds / questionsAttempted)
      : null;

  return {
    attemptsCount: matching.length,
    questionsAttempted,
    totalCorrect,
    totalWrong,
    accuracy,
    avgTimePerQuestion,
  };
}

function computeLastExam(attempts, chapterId, level = null) {
  const normalizedLevel = level ? level.toLowerCase() : null;
  const matching = attempts
    .filter((item) => {
      if (item.chapterId !== chapterId) return false;
      if (normalizedLevel && (item.examLevel || "").toLowerCase() !== normalizedLevel) {
        return false;
      }
      return true;
    })
    .sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));

  return matching[0] || null;
}

function MetricTile({ icon: Icon, label, value, highlight = false }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-extrabold tracking-tight ${
          highlight ? "text-emerald-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading chapter overview">
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white p-2">
        <div className="h-16 rounded-xl bg-slate-100" />
        <div className="h-16 rounded-xl bg-slate-100" />
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6">
        <div className="h-5 w-28 rounded-full bg-slate-100" />
        <div className="mt-3 h-7 w-64 rounded-lg bg-slate-100" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function ChapterDashboard() {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const initialChapter = location.state?.chapter || null;

  const [chapter, setChapter] = useState(initialChapter);
  const [attempts, setAttempts] = useState([]);
  const [prelimsTopics, setPrelimsTopics] = useState([]);
  const [mainsTopics, setMainsTopics] = useState([]);
  const [activeLevel, setActiveLevel] = useState("prelims");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadChapterData() {
      setLoading(true);
      setLoadError(false);
      try {
        const chapterData = initialChapter || (await getChapterById(chapterId));
        const prelimsAllowed = chapterData?.prelimsAvailable !== false;
        const mainsAllowed = chapterData?.mainsAvailable !== false;

        const [pTopics, mTopics, history] = await Promise.all([
          prelimsAllowed
            ? getTopicsByChapterAndLevel(chapterId, "prelims")
            : Promise.resolve([]),
          mainsAllowed
            ? getTopicsByChapterAndLevel(chapterId, "mains")
            : Promise.resolve([]),
          currentUser?.uid
            ? getUserExamHistory(currentUser.uid)
            : Promise.resolve([]),
        ]);

        if (isMounted) {
          setChapter(
            chapterData || {
              id: chapterId,
              subjectId: location.state?.subjectId || "reasoning",
              order: 1,
              name: chapterId.replace(/_/g, " "),
              prelimsAvailable: true,
              mainsAvailable: true,
            }
          );
          setPrelimsTopics(Array.isArray(pTopics) ? pTopics : []);
          setMainsTopics(Array.isArray(mTopics) ? mTopics : []);
          setAttempts(Array.isArray(history) ? history : []);

          if (!prelimsAllowed && mainsAllowed) {
            setActiveLevel("mains");
          } else {
            setActiveLevel("prelims");
          }
        }
      } catch (err) {
        console.error("Failed to load chapter dashboard:", err);
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadChapterData();
    return () => {
      isMounted = false;
    };
  }, [chapterId, currentUser?.uid, initialChapter, location.state?.subjectId, reloadKey]);

  const subjectId = (
    chapter?.subjectId ||
    location.state?.subjectId ||
    "reasoning"
  ).toLowerCase();
  const subjectName = SUBJECT_META[subjectId]?.name || subjectId;

  const prelimsAvailable = chapter?.prelimsAvailable !== false;
  const mainsAvailable = chapter?.mainsAvailable !== false;

  const prelimsStats = useMemo(
    () => computeLevelStats(attempts, chapterId, "prelims"),
    [attempts, chapterId]
  );

  const mainsStats = useMemo(
    () => computeLevelStats(attempts, chapterId, "mains"),
    [attempts, chapterId]
  );

  const prelimsLastExam = useMemo(
    () => computeLastExam(attempts, chapterId, "prelims"),
    [attempts, chapterId]
  );

  const mainsLastExam = useMemo(
    () => computeLastExam(attempts, chapterId, "mains"),
    [attempts, chapterId]
  );

  const isPrelims = activeLevel === "prelims";
  const currentStats = isPrelims ? prelimsStats : mainsStats;
  const currentLastExam = isPrelims ? prelimsLastExam : mainsLastExam;
  const currentTopics = isPrelims ? prelimsTopics : mainsTopics;
  const isCurrentLevelAvailable = isPrelims ? prelimsAvailable : mainsAvailable;
  const chapterNum = String(chapter?.order || 1).padStart(2, "0");

  const openTopicsPage = () =>
    navigate(`/chapter/${chapterId}/${activeLevel}/topics`, {
      state: { subjectId, chapter },
    });

  const formatScoreValue = (exam) => {
    if (!exam) return "—";
    if (exam.score != null) return exam.score;
    return `${exam.correctAnswers ?? 0}/${exam.totalQuestions ?? 0}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate(`/subject/${subjectId}`)}
              aria-label={`Back to ${subjectName}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.14em] text-emerald-600">
                <Layers size={12} aria-hidden="true" />
                CHAPTER {chapterNum}
              </span>
              <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                {chapter?.name || "Loading chapter..."}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {loadError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <span>Could not load chapter details. Please try again.</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4 hover:text-amber-700"
            >
              <RefreshCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-6">
            {/* PRELIMS | MAINS Level Selector */}
            <div
              role="tablist"
              aria-label="Exam level"
              className="grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isPrelims}
                disabled={!prelimsAvailable}
                onClick={() => setActiveLevel("prelims")}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-4 py-3.5 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-45 ${
                  isPrelims
                    ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-2xs"
                    : "border-transparent bg-transparent text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-sm font-extrabold tracking-wide sm:text-base">
                  PRELIMS
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {prelimsAvailable
                    ? `${prelimsTopics.length} Topics · ${
                        prelimsStats.accuracy === null
                          ? "Not graded"
                          : `${prelimsStats.accuracy}% Accuracy`
                      }${
                        prelimsLastExam
                          ? ` · Last: ${formatScoreValue(prelimsLastExam)}`
                          : ""
                      }`
                    : "Not applicable"}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={!isPrelims}
                disabled={!mainsAvailable}
                onClick={() => setActiveLevel("mains")}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-4 py-3.5 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-45 ${
                  !isPrelims
                    ? "border-amber-500 bg-amber-50/70 text-amber-900 shadow-2xs"
                    : "border-transparent bg-transparent text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-sm font-extrabold tracking-wide sm:text-base">
                  MAINS
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {mainsAvailable
                    ? `${mainsTopics.length} Topics · ${
                        mainsStats.accuracy === null
                          ? "Not graded"
                          : `${mainsStats.accuracy}% Accuracy`
                      }${
                        mainsLastExam
                          ? ` · Last: ${formatScoreValue(mainsLastExam)}`
                          : ""
                      }`
                    : "Not applicable"}
                </span>
              </button>
            </div>

            {/* Active Level Performance Card */}
            {isCurrentLevelAvailable ? (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold tracking-[0.14em] ${
                        isPrelims
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {activeLevel.toUpperCase()} LEVEL
                    </span>
                    <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                      {chapter?.name} — {isPrelims ? "Prelims" : "Mains"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Independent statistics and topic configurations for{" "}
                      {isPrelims ? "Prelims" : "Mains"} only.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openTopicsPage}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      isPrelims
                        ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600"
                        : "bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600"
                    }`}
                  >
                    <span>View All {currentTopics.length} Topics</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>

                {/* Independent Metrics Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                  <MetricTile
                    icon={BookOpen}
                    label="Attempts"
                    value={formatNumber(currentStats.attemptsCount)}
                  />
                  <MetricTile
                    icon={CheckCircle2}
                    label="Questions Solved"
                    value={formatNumber(currentStats.questionsAttempted)}
                  />
                  <MetricTile
                    icon={Target}
                    label="Accuracy"
                    value={
                      currentStats.accuracy === null
                        ? "—"
                        : `${currentStats.accuracy}%`
                    }
                    highlight={(currentStats.accuracy ?? 0) >= 75}
                  />
                  <MetricTile
                    icon={Clock}
                    label="Avg Time / Q"
                    value={
                      currentStats.avgTimePerQuestion === null
                        ? "—"
                        : `${currentStats.avgTimePerQuestion}s`
                    }
                  />
                </div>

                {/* Last Exam Score Strip */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-600">
                      <Award size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                        Last Exam Score
                      </p>
                      {currentLastExam ? (
                        <p className="truncate text-sm font-bold text-slate-900">
                          {formatScoreValue(currentLastExam)}{" "}
                          <span className="font-medium text-slate-500">
                            · {currentLastExam.topicName || chapter?.name} ·{" "}
                            {fmtDateTime(toMillis(currentLastExam.submittedAt))}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-slate-500">
                          No exam attempted yet for this chapter
                        </p>
                      )}
                    </div>
                  </div>

                  {currentLastExam && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/statistics/${currentLastExam.id}`, {
                          state: { attempt: currentLastExam },
                        })
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800"
                    >
                      <span>View Details</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500 shadow-xs">
                This chapter is not available for {activeLevel.toUpperCase()}.
              </div>
            )}

            {/* Topics Preview */}
            {isCurrentLevelAvailable && currentTopics.length > 0 && (
              <section aria-labelledby="topics-preview-heading" className="pt-2">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3
                    id="topics-preview-heading"
                    className="text-lg font-extrabold tracking-tight text-slate-900"
                  >
                    {isPrelims ? "Prelims" : "Mains"} Topics Preview
                  </h3>
                  <button
                    type="button"
                    onClick={openTopicsPage}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
                  >
                    Open Full Topic Dashboard
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {currentTopics.map((topic, idx) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={openTopicsPage}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold tracking-[0.14em] text-slate-400">
                          TOPIC {String(topic.order || idx + 1).padStart(2, "0")}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900 group-hover:text-emerald-800">
                          {topic.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span>Timer: {topic.defaultTimePerQuestionSeconds}s / Q</span>
                        </p>
                      </div>

                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white">
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}