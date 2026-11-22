import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { savePracticeAttempt } from "../services/examService";
import { loadSession, saveSession } from "../utils/mockSession.js";

const OPTIONS = ["A", "B", "C", "D", "E"];

export default function PracticeGrading() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const [session, setSession] = useState(() => loadSession());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      navigate("/practice/setup", { replace: true });
    }
  }, [session, navigate]);

  if (!session) return null;

  const { startQuestion, endQuestion, answers = {}, meta = {} } = session;
  const autoSubmitted = Boolean(location.state?.autoSubmitted);

  // After an auto-submit the timer is over, so going back to edit is not allowed
  const sheetLocked =
    session.timerMode === "autosubmit" &&
    session.timeRemaining != null &&
    session.timeRemaining <= 0;

  const totalQuestions = Math.max(0, endQuestion - startQuestion + 1);
  const attemptedQs = [];
  for (let q = startQuestion; q <= endQuestion; q += 1) {
    if (answers[q]?.userAnswer) attemptedQs.push(q);
  }

  const gradedCount = attemptedQs.filter(
    (q) => answers[q]?.correctAnswer
  ).length;
  const ungradedCount = Math.max(0, attemptedQs.length - gradedCount);
  const progressPct =
    attemptedQs.length > 0
      ? Math.round((gradedCount / attemptedQs.length) * 100)
      : 100;

  const setActual = (q, opt) => {
    const prev = answers[q] || { userAnswer: null, correctAnswer: null };
    const next = {
      ...session,
      answers: {
        ...answers,
        [q]: {
          ...prev,
          correctAnswer: prev.correctAnswer === opt ? null : opt,
        },
      },
    };
    saveSession(next);
    setSession(next);
  };

  const saveAndContinue = async () => {
    setSaving(true);
    setError("");
    try {
      const attemptId = await savePracticeAttempt(
        currentUser?.uid,
        session,
        session.attemptId || null
      );
      const next = { ...session, attemptId, savedAt: Date.now() };
      saveSession(next);
      setSession(next);
      navigate("/practice/result");
    } catch (err) {
      console.error("Failed to save practice attempt:", err);
      setError(
        "Result save nahi ho paya (internet ya Firestore rules check karo). Dobara try karo."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    if (
      ungradedCount > 0 &&
      !window.confirm(
        `${ungradedCount} question ka actual answer select nahi kiya. Unhe accuracy me count nahi kiya jayega. Continue?`
      )
    ) {
      return;
    }
    saveAndContinue();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {!sheetLocked && (
              <button
                type="button"
                onClick={() => navigate("/practice/sheet")}
                disabled={saving}
                aria-label="Back to Answer Sheet"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Sheet</span>
              </button>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Select Actual Answers
              </h1>
              <p className="truncate text-xs text-slate-500">
                {meta.topicName ? `${meta.topicName} · ` : ""}
                Graded{" "}
                <strong className="font-semibold text-slate-700">
                  {gradedCount}/{attemptedQs.length}
                </strong>{" "}
                attempted
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums text-emerald-800">
            {progressPct}%
          </span>
        </div>

        {/* Thin Grading Progress Bar */}
        <div
          className="h-1 w-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Grading progress"
        >
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-5 sm:px-6 sm:pt-6">
        {autoSubmitted && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          >
            <Clock
              size={17}
              className="shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <span>Time up! Aapke answers auto-submit ho gaye.</span>
          </div>
        )}

        <p className="mb-4 text-xs font-medium text-slate-500">
          Tap the correct answer from your book&apos;s answer key for each
          attempted question.
        </p>

        {/* Questions List */}
        <div className="space-y-2.5">
          {Array.from({ length: totalQuestions }, (_, i) => {
            const q = startQuestion + i;
            const data = answers[q];
            const userAns = data?.userAnswer || null;
            const actualAns = data?.correctAnswer || null;

            if (!userAns) {
              return (
                <div
                  key={q}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-100/60 px-4 py-3 text-slate-400 sm:px-5"
                >
                  <span className="w-12 shrink-0 text-sm font-bold tabular-nums sm:w-14">
                    Q{q}.
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-400">
                    Unattempted
                  </span>
                </div>
              );
            }

            const isGraded = Boolean(actualAns);

            return (
              <div
                key={q}
                className={`flex items-center justify-between gap-3 rounded-2xl border bg-white px-3.5 py-3 shadow-2xs transition-colors sm:px-5 sm:py-3.5 ${
                  isGraded
                    ? "border-emerald-200/90 bg-emerald-50/20"
                    : "border-slate-200/80"
                }`}
              >
                <span
                  className={`w-12 shrink-0 text-sm font-extrabold tabular-nums sm:w-14 sm:text-base ${
                    isGraded ? "text-emerald-700" : "text-slate-700"
                  }`}
                >
                  Q{q}.
                </span>

                <div
                  className="grid flex-1 grid-cols-5 gap-2 sm:max-w-sm sm:gap-3"
                  role="group"
                  aria-label={`Actual answer for Question ${q}`}
                >
                  {OPTIONS.map((opt) => {
                    const selected = actualAns === opt;

                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setActual(q, opt)}
                        className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-95 sm:h-11 ${
                          selected
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

        {/* Save Error Alert */}
        {error && (
          <div
            role="alert"
            className="mt-5 space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <div className="flex items-start gap-2.5 font-medium">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/practice/result")}
              className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-800 shadow-2xs transition-colors hover:bg-rose-100/60"
            >
              Save kiye bina result dekho
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 text-xs text-slate-500">
            <p className="font-bold text-slate-900">
              {gradedCount} of {attemptedQs.length} graded
            </p>
            <p className="truncate">
              {ungradedCount === 0
                ? "Ready to view final results"
                : `${ungradedCount} left ungraded`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            aria-busy={saving}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {saving ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>Finish &amp; View Results</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}