import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserExamHistory } from "../services/examService";
import { getChaptersBySubject, SUBJECT_META } from "../services/topicService";

const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(value);

function buildChapterStatsMap(attempts) {
  const map = new Map();

  for (const attempt of attempts) {
    const id = attempt.chapterId;
    if (!id) continue;

    const current = map.get(id) || {
      attemptsCount: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalGraded: 0,
    };

    const attempted = Math.max(0, Number(attempt.attemptedQuestions ?? 0));
    const correct = Math.max(0, Number(attempt.correctAnswers ?? 0));
    const wrong = Math.max(0, Number(attempt.wrongAnswers ?? 0));

    current.attemptsCount += 1;
    current.totalQuestions += attempted;
    current.totalCorrect += correct;
    current.totalGraded += correct + wrong;

    map.set(id, current);
  }

  return map;
}

function ChapterCardSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading chapters"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-md bg-slate-100" />
            <div className="flex gap-1.5">
              <div className="h-5 w-14 rounded-full bg-slate-100" />
              <div className="h-5 w-12 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 h-6 w-3/4 rounded-md bg-slate-100" />
          <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl bg-slate-50 p-3">
            <div className="h-9 rounded-lg bg-slate-100" />
            <div className="h-9 rounded-lg bg-slate-100" />
            <div className="h-9 rounded-lg bg-slate-100" />
            <div className="h-9 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-5 h-11 w-full rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function SubjectDashboard() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const normalizedSubjectId = (subjectId || "").toLowerCase();
  const subjectInfo = SUBJECT_META[normalizedSubjectId] || {
    id: normalizedSubjectId,
    name:
      normalizedSubjectId.charAt(0).toUpperCase() +
      normalizedSubjectId.slice(1),
    subtitle: "Select a chapter to begin Prelims or Mains practice.",
  };

  const [chapters, setChapters] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setLoadError(false);
      try {
        const [chapterList, history] = await Promise.all([
          getChaptersBySubject(normalizedSubjectId),
          currentUser?.uid
            ? getUserExamHistory(currentUser.uid)
            : Promise.resolve([]),
        ]);

        if (isMounted) {
          setChapters(Array.isArray(chapterList) ? chapterList : []);
          setAttempts(Array.isArray(history) ? history : []);
        }
      } catch (err) {
        console.error("Failed to load subject dashboard:", err);
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [normalizedSubjectId, currentUser?.uid, reloadKey]);

  const chapterStatsMap = useMemo(
    () => buildChapterStatsMap(attempts),
    [attempts]
  );

  const filteredChapters = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    if (!queryText) return chapters;
    return chapters.filter((ch) =>
      String(ch.name || "").toLowerCase().includes(queryText)
    );
  }, [chapters, searchTerm]);

  const subjectAttemptsCount = useMemo(
    () =>
      attempts.filter(
        (a) => String(a.subjectId || "").toLowerCase() === normalizedSubjectId
      ).length,
    [attempts, normalizedSubjectId]
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Home</span>
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                {subjectInfo.name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {formatNumber(chapters.length)} Chapters ·{" "}
                {formatNumber(subjectAttemptsCount)} Completed Attempts
              </p>
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
            <span>Could not load chapters for this subject. Please try again.</span>
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-600">
              CURRICULUM
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Chapters
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subjectInfo.subtitle}</p>
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
              placeholder="Search chapters..."
              aria-label="Search chapters"
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

        {/* Chapters Grid */}
        {loading ? (
          <ChapterCardSkeleton />
        ) : filteredChapters.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-xs">
            <p className="text-sm font-medium text-slate-600">
              No chapters found matching{" "}
              <span className="font-bold text-slate-900">"{searchTerm}"</span>.
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredChapters.map((chapter, idx) => {
              const rawStats = chapterStatsMap.get(chapter.id);
              const attemptsCount = rawStats?.attemptsCount ?? 0;
              const totalQuestions = rawStats?.totalQuestions ?? 0;
              const accuracy =
                rawStats && rawStats.totalGraded > 0
                  ? Math.round((rawStats.totalCorrect / rawStats.totalGraded) * 100)
                  : null;
              const chapterNum = String(chapter.order || idx + 1).padStart(2, "0");

              return (
                <article
                  key={chapter.id}
                  className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md motion-reduce:transform-none"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-emerald-600">
                        <Layers size={13} aria-hidden="true" />
                        CHAPTER {chapterNum}
                      </span>

                      <div className="flex flex-wrap gap-1.5">
                        {chapter.prelimsAvailable !== false && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Prelims
                          </span>
                        )}
                        {chapter.mainsAvailable !== false && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            Mains
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">
                      {chapter.name}
                    </h3>

                    <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs">
                      <div>
                        <span className="block text-slate-500">Topics</span>
                        <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
                          {formatNumber(chapter.totalTopics ?? 0)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-slate-500">Questions</span>
                        <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
                          {formatNumber(totalQuestions)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-slate-500">Attempts</span>
                        <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
                          {formatNumber(attemptsCount)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-slate-500">Accuracy</span>
                        <strong
                          className={`mt-0.5 block text-sm font-extrabold ${
                            (accuracy ?? 0) >= 75
                              ? "text-emerald-600"
                              : "text-slate-900"
                          }`}
                        >
                          {accuracy === null ? "—" : `${accuracy}%`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/chapter/${chapter.id}`, {
                        state: { subjectId: normalizedSubjectId, chapter },
                      })
                    }
                    className="mt-5 flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <span>Open Chapter</span>
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