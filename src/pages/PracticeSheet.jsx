import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  clearSession,
  formatClock,
  loadSession,
  saveSession,
} from "../utils/mockSession.js";

const OPTIONS = ["A", "B", "C", "D", "E"];

export default function PracticeSheet() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => loadSession());
  const sessionRef = useRef(session);
  const finishedRef = useRef(false);
  const hasSession = Boolean(session);

  const commit = useCallback((next) => {
    sessionRef.current = next;
    saveSession(next);
    setSession(next);
  }, []);

  // No session (refresh after clearing, direct URL) -> back to setup
  useEffect(() => {
    if (!hasSession) navigate("/practice/setup", { replace: true });
  }, [hasSession, navigate]);

  // Timer: counts real elapsed seconds so background tab throttling stays accurate
  useEffect(() => {
    if (!hasSession) return undefined;
    let last = Date.now();

    const id = setInterval(() => {
      if (finishedRef.current) return;

      const now = Date.now();
      const delta = Math.floor((now - last) / 1000);
      if (delta <= 0) return;
      last += delta * 1000;

      const cur = sessionRef.current;
      const next = { ...cur, timeSpent: (cur.timeSpent || 0) + delta };
      if (cur.timeRemaining != null) {
        next.timeRemaining = cur.timeRemaining - delta;
      }
      commit(next);

      if (
        next.timeRemaining != null &&
        next.timeRemaining <= 0 &&
        next.timerMode === "autosubmit"
      ) {
        finishedRef.current = true;
        navigate("/practice/grading", { state: { autoSubmitted: true } });
      }
    }, 1000);

    return () => clearInterval(id);
  }, [hasSession, commit, navigate]);

  if (!session) return null;

  const { startQuestion, endQuestion, answers = {}, meta = {} } = session;
  const total = Math.max(0, endQuestion - startQuestion + 1);
  const answeredCount = Object.values(answers).filter(
    (a) => a?.userAnswer
  ).length;
  const unansweredCount = Math.max(0, total - answeredCount);
  const progressPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const limited = session.timeLimitMins > 0;
  const clockSeconds = limited ? session.timeRemaining : session.timeSpent;
  const overtime = limited && session.timeRemaining < 0;
  const isMains = String(meta.examLevel || "").toLowerCase() === "mains";

  const setAnswer = (q, opt) => {
    const cur = sessionRef.current;
    const prev = cur.answers?.[q] || { userAnswer: null, correctAnswer: null };
    const nextAnswer = {
      ...prev,
      userAnswer: prev.userAnswer === opt ? null : opt,
    };
    commit({ ...cur, answers: { ...cur.answers, [q]: nextAnswer } });
  };

  const goBack = () => {
    if (
      answeredCount === 0 ||
      window.confirm(
        "Practice chhod ke wapas jaoge? Ab tak ke marked answers delete ho jayenge."
      )
    ) {
      finishedRef.current = true;
      clearSession();
      navigate("/practice/setup");
    }
  };

  const submit = () => {
    finishedRef.current = true;
    saveSession(sessionRef.current);
    navigate("/practice/grading");
  };

  const questionNumbers = [];
  for (let q = startQuestion; q <= endQuestion; q += 1) {
    questionNumbers.push(q);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back to setup"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-3 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                  {meta.topicName || "OMR Practice Sheet"}
                </h1>
                {meta.examLevel && (
                  <span
                    className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] sm:inline-flex ${
                      isMains
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {isMains ? "MAINS" : "PRELIMS"}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-500">
                Q{startQuestion}–Q{endQuestion} · Marked{" "}
                <strong className="font-semibold text-slate-700">
                  {answeredCount}/{total}
                </strong>
              </p>
            </div>
          </div>

          {/* Live Timer Pill */}
          <div
            role="timer"
            aria-live="off"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold tabular-nums shadow-2xs sm:text-sm ${
              !limited
                ? "border-slate-200 bg-slate-50 text-slate-700"
                : overtime
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {overtime ? (
              <AlertTriangle size={15} className="shrink-0 text-rose-600" aria-hidden="true" />
            ) : (
              <Clock
                size={15}
                className={`shrink-0 ${limited ? "text-emerald-600" : "text-slate-400"}`}
                aria-hidden="true"
              />
            )}
            <span>{formatClock(clockSeconds)}</span>
          </div>
        </div>

        {/* Thin Progress Bar */}
        <div
          className="h-1 w-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Questions answered progress"
        >
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* Main OMR Sheet */}
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 sm:px-6 sm:pt-6">
        {/* Optional Book / Set Context */}
        {(meta.bookName || meta.setName) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            {meta.bookName && (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                Book: <strong className="text-slate-700">{meta.bookName}</strong>
              </span>
            )}
            {meta.setName && (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                Set: <strong className="text-slate-700">{meta.setName}</strong>
              </span>
            )}
          </div>
        )}

        {/* OMR Question Rows */}
        <div className="space-y-2.5">
          {questionNumbers.map((q) => {
            const selected = answers[q]?.userAnswer || null;
            const isAnswered = Boolean(selected);

            return (
              <div
                key={q}
                className={`flex items-center justify-between gap-3 rounded-2xl border bg-white px-3.5 py-3 shadow-2xs transition-colors sm:px-5 sm:py-3.5 ${
                  isAnswered
                    ? "border-emerald-200/90 bg-emerald-50/20"
                    : "border-slate-200/80"
                }`}
              >
                <span
                  className={`w-12 shrink-0 text-sm font-extrabold tabular-nums sm:w-14 sm:text-base ${
                    isAnswered ? "text-emerald-700" : "text-slate-700"
                  }`}
                >
                  Q{q}.
                </span>

                <div
                  className="grid flex-1 grid-cols-5 gap-2 sm:max-w-sm sm:gap-3"
                  role="group"
                  aria-label={`Options for Question ${q}`}
                >
                  {OPTIONS.map((opt) => {
                    const active = selected === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAnswer(q, opt)}
                        className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-95 sm:h-11 ${
                          active
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 text-xs text-slate-500">
            <p className="font-bold text-slate-900">
              {answeredCount} of {total} marked
            </p>
            <p className="truncate">
              {unansweredCount === 0
                ? "All questions answered"
                : `${unansweredCount} left unattempted`}
            </p>
          </div>

          <button
            type="button"
            onClick={submit}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>Submit &amp; Grade</span>
          </button>
        </div>
      </div>
    </div>
  );
}