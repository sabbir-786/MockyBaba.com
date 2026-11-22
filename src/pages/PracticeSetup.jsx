import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Hash,
  Home,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserExamHistory } from "../services/examService";
import {
  SUBJECT_META,
  getChaptersBySubject,
  getTopicsByChapterAndLevel,
} from "../services/topicService";
import { createSession, saveSession } from "../utils/mockSession.js";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export default function PracticeSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  // Opened from TopicDashboard? Then subject, chapter, level and topic are already chosen.
  const preset = location.state?.topic ? location.state : null;
  const locked = Boolean(preset);

  const [subjectId, setSubjectId] = useState(preset?.subjectId || "reasoning");
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState(
    preset?.chapter?.id || preset?.topic?.chapterId || ""
  );
  const [level, setLevel] = useState(preset?.examLevel || "prelims");
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState(preset?.topic?.id || "");
  const [bookName, setBookName] = useState("");
  const [setName, setSetName] = useState("");

  // Range
  const [startQ, setStartQ] = useState("1");
  const [endQ, setEndQ] = useState("10");
  const [rangeTouched, setRangeTouched] = useState(false);

  // Timer
  const [timeMode, setTimeMode] = useState("suggested"); // suggested | manual | none
  const [manualMins, setManualMins] = useState("");
  const [timerMode, setTimerMode] = useState("negative"); // negative | autosubmit

  // Past attempts (for the "next range" suggestion)
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const activeTopicId = locked ? preset.topic.id : topicId;
  const isMains = level === "mains";

  /* ---------- Load chapters (free-choice mode) ---------- */
  useEffect(() => {
    if (locked) return undefined;
    let cancelled = false;
    setChapterId("");
    setChapters([]);
    getChaptersBySubject(subjectId).then((list) => {
      if (!cancelled) setChapters(Array.isArray(list) ? list : []);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, locked]);

  /* ---------- Load topics (free-choice mode) ---------- */
  useEffect(() => {
    if (locked) return undefined;
    let cancelled = false;
    setTopicId("");
    setTopics([]);
    if (!chapterId) return undefined;
    getTopicsByChapterAndLevel(chapterId, level).then((list) => {
      if (!cancelled) setTopics(Array.isArray(list) ? list : []);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId, level, locked]);

  /* ---------- Load completed attempts once ---------- */
  useEffect(() => {
    if (!currentUser?.uid) return undefined;
    let cancelled = false;
    getUserExamHistory(currentUser.uid)
      .then((list) => {
        if (!cancelled) setHistory(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.warn("Could not load history:", err.message));
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  const chapter = locked
    ? preset.chapter
    : chapters.find((c) => c.id === chapterId);
  const selectedTopic = locked
    ? preset.topic
    : topics.find((t) => t.id === topicId);

  /* ---------- Next range suggestion ---------- */
  const progress = useMemo(() => {
    if (!activeTopicId) return null;

    const mine = history.filter(
      (h) =>
        h.topicId === activeTopicId &&
        String(h.examLevel || "").toLowerCase() === level
    );
    if (mine.length === 0) return null;

    const maxEnd = Math.max(...mine.map((h) => Number(h.endQuestion) || 0));
    if (maxEnd <= 0) return null;

    const latest = mine[0];
    const lastEnd = Number(latest.endQuestion) || maxEnd;
    const lastStart = Number(latest.startQuestion) || 1;
    const size = Math.max(
      1,
      lastEnd - lastStart + 1 || Number(latest.totalQuestions) || 10
    );

    return {
      lastStart,
      lastEnd,
      size,
      nextStart: maxEnd + 1,
      nextEnd: maxEnd + size,
    };
  }, [history, activeTopicId, level]);

  // A different topic means the range should be suggested fresh
  useEffect(() => {
    setRangeTouched(false);
  }, [activeTopicId, level]);

  // Fill the range automatically unless the user has typed their own
  useEffect(() => {
    if (rangeTouched) return;
    if (progress) {
      setStartQ(String(progress.nextStart));
      setEndQ(String(progress.nextEnd));
    } else {
      setStartQ("1");
      setEndQ("10");
    }
  }, [progress, rangeTouched]);

  /* ---------- Range maths ---------- */
  const start = parseInt(startQ, 10) || 0;
  const end = parseInt(endQ, 10) || 0;
  const rangeValid = start > 0 && end >= start;
  const rangeHasOrderError = !rangeValid && end !== 0 && end < start;
  const total = rangeValid ? end - start + 1 : 0;

  let totalText = "Total: 0 Questions";
  if (rangeValid) totalText = `Total: ${total} Questions`;
  else if (rangeHasOrderError) totalText = "End question must be ≥ Start";

  /* ---------- Timer maths ---------- */
  const perQuestionSec = selectedTopic?.defaultTimePerQuestionSeconds || 0;
  const suggestedMins =
    perQuestionSec && total > 0 ? Math.ceil((perQuestionSec * total) / 60) : 0;

  const effectiveMode =
    timeMode === "suggested" && !suggestedMins ? "manual" : timeMode;

  let timeLimitMins = 0;
  if (effectiveMode === "suggested") timeLimitMins = suggestedMins;
  else if (effectiveMode === "manual") {
    timeLimitMins = Math.max(0, parseInt(manualMins, 10) || 0);
  }

  /* ---------- Start ---------- */
  const handleStart = () => {
    setError("");

    if (start <= 0 || end <= 0) {
      setError("Please enter valid positive numbers for the range.");
      return;
    }
    if (end < start) {
      setError(
        "The End question number cannot be smaller than the Start number."
      );
      return;
    }

    const session = createSession({
      startQuestion: start,
      endQuestion: end,
      timeLimitMins,
      timerMode,
      meta: {
        subjectId,
        subjectName: SUBJECT_META[subjectId]?.name || subjectId,
        chapterId: chapterId || null,
        chapterName: chapter?.name || null,
        topicId: selectedTopic?.id || null,
        topicName: selectedTopic?.name || null,
        examLevel: level,
        bookName: bookName.trim(),
        setName: setName.trim(),
      },
    });

    saveSession(session);
    navigate("/practice/sheet");
  };

  const bookSetFields = (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label
          htmlFor="book"
          className="mb-1.5 block text-xs font-semibold text-slate-600"
        >
          Book <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="book"
          type="text"
          className={inputClass}
          placeholder="e.g. Kiran"
          value={bookName}
          onChange={(e) => setBookName(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="setName"
          className="mb-1.5 block text-xs font-semibold text-slate-600"
        >
          Set <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="setName"
          type="text"
          className={inputClass}
          placeholder="e.g. Set 12"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header with Back & Home */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <Home size={16} aria-hidden="true" />
              <span>Home</span>
            </button>
          </div>

          <span className="truncate text-sm font-extrabold tracking-tight text-slate-900">
            Bank Practice
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
        {/* Page Heading */}
        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-600">
            CONFIGURE SESSION
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Practice Setup
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set the question range from your book and start.
          </p>
        </div>

        <div className="space-y-5">
          {/* WHAT */}
          {locked ? (
            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <BookOpen size={19} aria-hidden="true" />
                </span>
                <h2 className="text-base font-extrabold text-slate-900">
                  Selected Topic
                </h2>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{SUBJECT_META[subjectId]?.name || subjectId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{chapter?.name || chapterId}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] ${
                      isMains
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {isMains ? "MAINS" : "PRELIMS"}
                  </span>
                </div>
                <p className="mt-1.5 text-lg font-extrabold tracking-tight text-slate-900">
                  {selectedTopic.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Choose another topic</span>
              </button>

              {bookSetFields}
            </section>
          ) : (
            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <BookOpen size={19} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    What are you practising?
                  </h2>
                  <p className="text-xs text-slate-500">
                    Topic select karoge to time aur next question range apne aap
                    suggest hoga.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="subject"
                    className="mb-1.5 block text-xs font-semibold text-slate-600"
                  >
                    Subject
                  </label>
                  <select
                    id="subject"
                    className={inputClass}
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    {Object.values(SUBJECT_META).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="level"
                    className="mb-1.5 block text-xs font-semibold text-slate-600"
                  >
                    Level
                  </label>
                  <select
                    id="level"
                    className={inputClass}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="prelims">Prelims</option>
                    <option value="mains">Mains</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="chapter"
                    className="mb-1.5 block text-xs font-semibold text-slate-600"
                  >
                    Chapter
                  </label>
                  <select
                    id="chapter"
                    className={inputClass}
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                  >
                    <option value="">Not selected</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="topic"
                    className="mb-1.5 block text-xs font-semibold text-slate-600"
                  >
                    Topic
                  </label>
                  <select
                    id="topic"
                    className={inputClass}
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    disabled={!chapterId}
                  >
                    <option value="">Not selected</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {bookSetFields}
            </section>
          )}

          {/* QUESTION RANGE */}
          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Hash size={19} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Question Range
                </h2>
                <p className="text-xs text-slate-500">
                  Enter the first and last question numbers from your book.
                </p>
              </div>
            </div>

            {progress && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
                <div className="flex items-start gap-2">
                  <Sparkles
                    size={15}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <div className="leading-5">
                    <span>
                      Last practised:{" "}
                      <strong className="font-bold">
                        Q{progress.lastStart}–{progress.lastEnd}
                      </strong>
                    </span>
                    <span className="block">
                      Next suggested:{" "}
                      <strong className="font-bold">
                        Q{progress.nextStart}–{progress.nextEnd}
                      </strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStartQ("1");
                    setEndQ(String(progress.size));
                    setRangeTouched(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs transition-colors hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Q1 se</span>
                </button>
              </div>
            )}

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div>
                <label
                  htmlFor="startQ"
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                >
                  Start
                </label>
                <input
                  id="startQ"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-lg font-extrabold text-slate-900 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={startQ}
                  onChange={(e) => {
                    setStartQ(e.target.value);
                    setRangeTouched(true);
                  }}
                />
              </div>

              <span className="pb-3.5 text-xs font-bold tracking-widest text-slate-400">
                TO
              </span>

              <div>
                <label
                  htmlFor="endQ"
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                >
                  End
                </label>
                <input
                  id="endQ"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-lg font-extrabold text-slate-900 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={endQ}
                  onChange={(e) => {
                    setEndQ(e.target.value);
                    setRangeTouched(true);
                  }}
                />
              </div>
            </div>

            <div
              className={`mt-4 rounded-xl border px-3.5 py-2.5 text-center text-xs font-bold ${
                rangeHasOrderError
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200/80 bg-slate-50 text-slate-700"
              }`}
            >
              {totalText}
            </div>
          </section>

          {/* TIMER */}
          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Timer size={19} aria-hidden="true" />
              </span>
              <h2 className="text-base font-extrabold text-slate-900">Timer</h2>
            </div>

            <div
              role="group"
              aria-label="Timer mode"
              className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1"
            >
              {[
                ["suggested", "Suggested"],
                ["manual", "Manual"],
                ["none", "No limit"],
              ].map(([key, label]) => {
                const active = effectiveMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={key === "suggested" && !suggestedMins}
                    onClick={() => setTimeMode(key)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm ${
                      active
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {effectiveMode === "suggested" && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                <p className="text-2xl font-extrabold tracking-tight text-emerald-700">
                  {suggestedMins} min
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {perQuestionSec}s per question × {total} questions
                </p>
              </div>
            )}

            {effectiveMode === "manual" && (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="manualMins"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Time (minutes)
                  </label>
                  <input
                    id="manualMins"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder="0"
                    className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={manualMins}
                    onChange={(e) => setManualMins(e.target.value)}
                  />
                </div>
                {suggestedMins > 0 && (
                  <p className="mt-2.5 text-xs text-slate-500">
                    Suggested: {suggestedMins} min{" "}
                    <button
                      type="button"
                      onClick={() => setManualMins(String(suggestedMins))}
                      className="ml-1 font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                    >
                      Use
                    </button>
                  </p>
                )}
              </div>
            )}

            {effectiveMode === "none" && (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-center text-xs text-slate-600">
                Koi limit nahi. Timer sirf tumhara time taken count karega.
              </div>
            )}

            {timeLimitMins > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <label
                  htmlFor="timerMode"
                  className="text-sm font-semibold text-slate-700"
                >
                  When time is up
                </label>
                <select
                  id="timerMode"
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={timerMode}
                  onChange={(e) => setTimerMode(e.target.value)}
                >
                  <option value="negative">Negative Timer</option>
                  <option value="autosubmit">Auto Submit</option>
                </select>
              </div>
            )}
          </section>

          {/* ERROR ALERT */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          {/* START BUTTON */}
          <button
            type="button"
            onClick={handleStart}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
            <span>
              Start Practice
              {timeLimitMins > 0 ? ` (${timeLimitMins} min)` : ""}
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}