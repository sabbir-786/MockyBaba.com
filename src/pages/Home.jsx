import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Edit3,
  GraduationCap,
  LogOut,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserExamHistory } from "../services/examService";
import { DEFAULT_CHAPTERS } from "../services/topicService";

// Tailwind CSS v4 — Full Light UI
const SUBJECTS = [
  {
    id: "reasoning",
    name: "Reasoning",
    label: "LOGICAL THINKING",
    number: "01",
    icon: Brain,
    description:
      "Practice seating arrangements, puzzles, syllogisms, inequalities, blood relations and series.",
    topics: ["Puzzles", "Syllogism", "Seating"],
  },
  {
    id: "aptitude",
    name: "Quantitative Aptitude",
    label: "NUMERICAL ABILITY",
    number: "02",
    icon: Calculator,
    description:
      "Build speed and accuracy in data interpretation, simplification, number series and arithmetic.",
    topics: ["Data Interpretation", "Arithmetic", "Speed Maths"],
  },
  {
    id: "manual",
    name: "Manual Practice",
    label: "YOUR PRACTICE SPACE",
    number: "03",
    icon: Edit3,
    description:
      "Create custom OMR-style tests with flexible question counts, timers and self-grading.",
    topics: ["Custom Tests", "OMR Sheets", "Self-Grading"],
  },
];

const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(value);

function getCurriculumCounts(subjectId) {
  const chapters = DEFAULT_CHAPTERS?.[subjectId] || [];
  return {
    chapters: chapters.length,
    topicCount: chapters.reduce(
      (sum, chapter) => sum + (Number(chapter.totalTopics) || 0),
      0
    ),
  };
}

function getAttemptStats(items) {
  return items.reduce(
    (result, attempt) => {
      const correct = Math.max(0, Number(attempt.correctAnswers) || 0);
      const wrong = Math.max(0, Number(attempt.wrongAnswers) || 0);
      result.sessions += 1;
      result.attempted += Math.max(0, Number(attempt.attemptedQuestions) || 0);
      result.correct += correct;
      result.graded += correct + wrong;
      return result;
    },
    { sessions: 0, attempted: 0, correct: 0, graded: 0 }
  );
}

const getAccuracy = ({ correct, graded }) =>
  graded > 0 ? Math.round((correct / graded) * 100) : null;

function AccuracyCircle({ accuracy, loading }) {
  const radius = 51;
  const circumference = 2 * Math.PI * radius;
  const filled =
    (Math.min(100, Math.max(0, accuracy ?? 0)) / 100) * circumference;

  return (
    <div
      className="relative mx-auto size-38 shrink-0 sm:size-42"
      role="img"
      aria-label={
        loading
          ? "Loading overall accuracy"
          : accuracy === null
            ? "No graded answers yet"
            : `Overall accuracy: ${accuracy}%`
      }
    >
      <svg
        viewBox="0 0 128 128"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          className="stroke-emerald-100"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          className="stroke-emerald-600 transition-all duration-500"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {loading ? "···" : accuracy === null ? "—" : `${accuracy}%`}
        </strong>
        <span className="mt-1 text-center text-[11px] font-medium text-slate-500">
          Overall accuracy
        </span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, footnote }) {
  return (
    <article className="flex min-w-0 items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors hover:border-emerald-200 sm:p-6">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-400">{footnote}</p>
      </div>
    </article>
  );
}

function SubjectCard({ subject, loading, failed, onOpen }) {
  const Icon = subject.icon;
  const accuracy = getAccuracy(subject);
  const showValue = (value) => (loading || failed ? "—" : formatNumber(value));

  return (
    <article className="group flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md motion-reduce:transform-none sm:p-6">
      <div className="flex items-center justify-between">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
          <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold tracking-[0.16em] text-slate-400">
          {subject.number} / 03
        </span>
      </div>

      <div className="mt-6">
        <p className="text-[10px] font-bold tracking-[0.19em] text-emerald-600">
          {subject.label}
        </p>
        <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
          {subject.name}
        </h3>
        <p className="mt-2.5 min-h-16 text-sm leading-6 text-slate-600">
          {subject.description}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {subject.topics.map((topic) => (
          <span
            key={topic}
            className="rounded-full border border-emerald-100 bg-emerald-50/60 px-3 py-1 text-[11px] font-medium text-emerald-800"
          >
            {topic}
          </span>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
        <div>
          <p className="text-[11px] text-slate-500">
            {subject.id === "manual" ? "Practice mode" : "Chapters"}
          </p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {subject.id === "manual" ? "Custom" : formatNumber(subject.chapters)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">
            {subject.id === "manual" ? "Sessions" : "Total topics"}
          </p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {subject.id === "manual"
              ? showValue(subject.sessions)
              : formatNumber(subject.topicCount)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Questions</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {showValue(subject.attempted)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-500">Answer accuracy</span>
          <span className="font-bold text-emerald-700">
            {loading || failed
              ? "—"
              : accuracy === null
                ? "Not graded"
                : `${accuracy}%`}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={loading || failed ? 0 : accuracy ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${subject.name} accuracy`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${loading || failed ? 0 : accuracy ?? 0}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(subject.id)}
        className="mt-6 flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <span>
          {subject.id === "manual" ? "Create a practice set" : "Start practicing"}
        </span>
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function Home() {
  const { userProfile, currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      if (!currentUser?.uid) {
        if (active) {
          setAttempts([]);
          setStatsError(false);
          setLoadingStats(false);
        }
        return;
      }

      setLoadingStats(true);
      setStatsError(false);
      try {
        const history = await getUserExamHistory(currentUser.uid);
        if (active) setAttempts(Array.isArray(history) ? history : []);
      } catch (error) {
        console.error("Failed to load exam history:", error);
        if (active) {
          setAttempts([]);
          setStatsError(true);
        }
      } finally {
        if (active) setLoadingStats(false);
      }
    }

    loadStats();
    return () => {
      active = false;
    };
  }, [currentUser?.uid, reloadKey]);

  const displayName =
    userProfile?.displayName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "Aspirant";
  const firstName = displayName.trim().split(/\s+/)[0] || "Aspirant";
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A";
  const targetExam = userProfile?.targetExam || "SBI PO / Clerk";

  const summaries = useMemo(
    () =>
      SUBJECTS.map((subject) => ({
        ...subject,
        ...getCurriculumCounts(subject.id),
        ...getAttemptStats(
          attempts.filter(
            (attempt) =>
              String(attempt.subjectId || "").toLowerCase() === subject.id
          )
        ),
      })),
    [attempts]
  );

  const totals = useMemo(() => getAttemptStats(attempts), [attempts]);
  const totalTopics = summaries.reduce(
    (count, subject) => count + subject.topicCount,
    0
  );
  const overallAccuracy = getAccuracy(totals);
  const statsUnavailable = loadingStats || statsError;

  const openSubject = (subjectId) => navigate(`/subject/${subjectId}`);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <GraduationCap size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Bank Exam Practice
              </p>
              <p className="hidden text-[10px] font-bold tracking-[0.18em] text-emerald-700 sm:block">
                PRACTICE · IMPROVE · SUCCEED
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-52 items-center gap-2 truncate rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 md:flex">
              <Target size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="truncate">{targetExam}</span>
            </span>
            <div className="flex items-center gap-2.5" title={displayName}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-extrabold text-emerald-800">
                {initials}
              </span>
              <div className="hidden max-w-36 sm:block">
                <p className="truncate text-xs font-bold text-slate-900">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500">My workspace</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="ml-1 flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* Full Light Hero */}
        <section className="relative isolate overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br from-white via-emerald-50/40 to-teal-50/50 p-5 shadow-xs sm:p-8 lg:p-10">
          <div
            className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-emerald-200/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 size-80 rounded-full bg-teal-200/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
            <div className="min-w-0 py-1 sm:py-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-[11px] font-bold tracking-[0.12em] text-emerald-700 shadow-2xs">
                <Sparkles size={13} aria-hidden="true" />
                YOUR PERSONAL PRACTICE SPACE
              </span>
              <h1 className="mt-5 text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[42px]">
                Ready to level up,
                <span className="block text-emerald-600">{firstName}?</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                Build exam confidence one question at a time. Practice chapter-wise,
                understand your accuracy, and stay focused on your next goal.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openSubject("reasoning")}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <Play size={15} fill="currentColor" aria-hidden="true" />
                  Start practice
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <a
                  href="#subjects"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Explore subjects <ChevronRight size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-500">
                <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />
                Prelims & Mains focused preparation
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-600">
                    YOUR PERFORMANCE
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">
                    Practice overview
                  </h2>
                </div>
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp size={18} aria-hidden="true" />
                </span>
              </div>

              <div className="my-5">
                <AccuracyCircle
                  loading={statsUnavailable}
                  accuracy={statsUnavailable ? null : overallAccuracy}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Practice sessions</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">
                    {statsUnavailable ? "—" : formatNumber(totals.sessions)}
                  </p>
                </div>
                <div className="border-l border-slate-100">
                  <p className="text-xs text-slate-500">Questions solved</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">
                    {statsUnavailable ? "—" : formatNumber(totals.attempted)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {statsError && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <span>
              Could not load your practice history. Your saved results have not been
              changed.
            </span>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="inline-flex items-center gap-2 font-semibold underline underline-offset-4 hover:text-amber-700"
            >
              <RefreshCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {/* Live Metrics */}
        <section
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4"
          aria-label="Your preparation statistics"
        >
          <StatCard
            icon={BarChart3}
            label="Practice sessions"
            value={statsUnavailable ? "—" : formatNumber(totals.sessions)}
            footnote="Tests taken"
          />
          <StatCard
            icon={CheckCircle2}
            label="Questions attempted"
            value={statsUnavailable ? "—" : formatNumber(totals.attempted)}
            footnote="All subjects"
          />
          <StatCard
            icon={Target}
            label="Overall accuracy"
            value={
              statsUnavailable
                ? "—"
                : overallAccuracy === null
                  ? "—"
                  : `${overallAccuracy}%`
            }
            footnote="Graded answers"
          />
          <StatCard
            icon={BookOpen}
            label="Available topics"
            value={formatNumber(totalTopics)}
            footnote="Your curriculum"
          />
        </section>

        {/* Subject Cards */}
        <section
          id="subjects"
          className="scroll-mt-24 pt-12 sm:pt-14"
          aria-labelledby="subject-title"
        >
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.17em] text-emerald-600">
                YOUR LEARNING PATH
              </p>
              <h2
                id="subject-title"
                className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[30px]"
              >
                Choose your practice subject
                <span className="text-emerald-600">.</span>
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Focused question practice for your bank exam preparation.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              3 practice modes
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {summaries.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                loading={loadingStats}
                failed={statsError}
                onOpen={openSubject}
              />
            ))}
          </div>
        </section>

        {/* Bottom Light CTA */}
        <section className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600 shadow-2xs">
              <GraduationCap size={24} aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900">
                Consistency makes the difference.
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Practice regularly, review mistakes, and improve speed and accuracy.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSubject("reasoning")}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-2xs transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Keep practicing <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>

        <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200/80 py-5 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Bank Exam Practice</span>
          <span>Made for focused exam preparation</span>
        </footer>
      </main>
    </div>
  );
}