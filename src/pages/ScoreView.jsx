import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { deleteExamAttempt, getExamAttempt } from "../services/examService";
import { syncUserLeaderboard } from "../services/leaderboardService";

const WEAK_BELOW = 60;
const STRONG_FROM = 80;
const MIN_GRADED = 5;

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

const getBookLabel = (attempt) => {
  const raw =
    attempt?.bookName ||
    attempt?.bookTitle ||
    attempt?.book ||
    attempt?.sourceName ||
    attempt?.pdfName ||
    "";
  return raw ? pretty(raw) : null;
};

const getSetLabel = (attempt) => {
  const raw =
    attempt?.setName ||
    attempt?.setTitle ||
    attempt?.setLabel ||
    (attempt?.setNumber != null ? `Set ${attempt.setNumber}` : "") ||
    attempt?.setId ||
    "";
  return raw ? pretty(raw) : null;
};

const fmtDuration = (sec) => {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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

const statusOf = (accuracy, graded) => {
  if (accuracy == null || graded < MIN_GRADED)
    return { label: "Not enough data", tone: "slate" };
  if (accuracy < WEAK_BELOW) return { label: "Weak", tone: "rose" };
  if (accuracy >= STRONG_FROM) return { label: "Strong", tone: "emerald" };
  return { label: "Average", tone: "amber" };
};

const TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
};

const STATE_BADGE = {
  right: { label: "Right", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  wrong: { label: "Wrong", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  ungraded: { label: "Ungraded", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  skipped: { label: "Skipped", cls: "border-slate-200 bg-slate-50 text-slate-500" },
};

export default function ScoreView() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const [attempt, setAttempt] = useState(() => location.state?.attempt || null);
  const [loading, setLoading] = useState(!location.state?.attempt);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (attempt?.id === attemptId) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const data = await getExamAttempt(attemptId);
        if (!cancelled) {
          if (!data) setError("Score record nahi mila. Shayad delete ho gaya ho.");
          else setAttempt(data);
        }
      } catch (err) {
        console.error("Failed to load score:", err);
        if (!cancelled)
          setError("Score load nahi hua. Internet ya Firestore rules check karo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId, attempt?.id]);

  const questionRows = useMemo(() => {
    if (!attempt?.answers || typeof attempt.answers !== "object") return [];
    return Object.entries(attempt.answers)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([q, data]) => {
        const userAnswer = data?.userAnswer || null;
        const correctAnswer = data?.correctAnswer || null;
        let state = "skipped";
        if (userAnswer) {
          if (data?.result === "right" || (correctAnswer && userAnswer === correctAnswer)) {
            state = "right";
          } else if (data?.result === "wrong" || (correctAnswer && userAnswer !== correctAnswer)) {
            state = "wrong";
          } else {
            state = "ungraded";
          }
        }
        return { q, userAnswer, correctAnswer, state };
      });
  }, [attempt]);

  const visibleRows = useMemo(() => {
    if (filter === "all") return questionRows;
    return questionRows.filter((r) => r.state === filter);
  }, [questionRows, filter]);

  const handleDelete = async () => {
    if (!attempt?.id) return;
    setDeleting(true);
    setError("");
    try {
      await deleteExamAttempt(attempt.id);

      if (currentUser) {
        syncUserLeaderboard(currentUser).catch((err) => {
          console.error("Leaderboard sync failed:", err);
        });
      }

      navigate("/statistics", { replace: true });
    } catch (err) {
      console.error("Failed to delete attempt:", err);
      setError("Score delete nahi hua. Internet ya Firestore rules check karo.");
      setDeleting(false);
    }
  };

  const correct = attempt?.correctAnswers || 0;
  const wrong = attempt?.wrongAnswers || 0;
  const ungraded = attempt?.ungradedQuestions || 0;
  const attempted = attempt?.attemptedQuestions || 0;
  const total = attempt?.totalQuestions || 0;
  const graded = correct + wrong;
  const secPerQ =
    attempted > 0 ? Math.round((attempt?.timeTakenSeconds || 0) / attempted) : null;
  const st = statusOf(attempt?.accuracy, Math.max(graded, MIN_GRADED));
  const bookLabel = getBookLabel(attempt);
  const setLabel = getSetLabel(attempt);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/statistics")}
              aria-label="Back to Statistics"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 sm:px-3 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Statistics</span>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-base">
                {attempt?.topicName || attempt?.chapterName || "Score Details"}
              </h1>
              {attempt && (
                <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                  <Clock size={11} aria-hidden="true" />
                  <span>Attempted on {fmtDateTime(toMillis(attempt.submittedAt))}</span>
                </p>
              )}
            </div>
          </div>

          {attempt && (
            <div className="shrink-0">
              {confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : "Confirm"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
        {loading && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-24 text-sm font-medium text-slate-500"
          >
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Loading score...
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

        {!loading && attempt && (
          <>
            {/* Summary Card */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {attempt.subjectId && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-slate-700">
                    {pretty(attempt.subjectId)}
                  </span>
                )}
                {attempt.examLevel && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-slate-700">
                    {pretty(attempt.examLevel)}
                  </span>
                )}
                {bookLabel && (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-indigo-800">
                    Book: {bookLabel}
                  </span>
                )}
                {setLabel && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-sky-800">
                    Set: {setLabel}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2.5 py-0.5 ${
                    graded > 0 ? TONES[st.tone] : TONES.slate
                  }`}
                >
                  {graded > 0 ? `${attempt.accuracy}% Accuracy` : "Ungraded"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                  <p className="text-xs font-semibold text-slate-500">Saved Score</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                    {attempt.score != null ? attempt.score : `${correct}/${total}`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                  <p className="text-xs font-semibold text-slate-500">Time Taken</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                    {fmtDuration(attempt.timeTakenSeconds)}
                  </p>
                  {secPerQ != null && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {secPerQ}s/Q{attempt.overtimeSeconds > 0 ? " (overtime)" : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-slate-200/80 p-2.5">
                  <p className="text-base font-extrabold tabular-nums text-slate-900">
                    {attempted}/{total}
                  </p>
                  <p className="text-[11px] text-slate-500">Attempted</p>
                </div>
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2.5">
                  <p className="text-base font-extrabold tabular-nums text-emerald-700">
                    {correct}
                  </p>
                  <p className="text-[11px] text-emerald-700/80">Correct</p>
                </div>
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-2.5">
                  <p className="text-base font-extrabold tabular-nums text-rose-700">
                    {wrong}
                  </p>
                  <p className="text-[11px] text-rose-700/80">Wrong</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5">
                  <p className="text-base font-extrabold tabular-nums text-slate-600">
                    {ungraded}
                  </p>
                  <p className="text-[11px] text-slate-500">Ungraded</p>
                </div>
              </div>
            </section>

            {/* Per-Question Breakdown Card */}
            {questionRows.length > 0 && (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                    Question Breakdown
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "all", label: `All (${questionRows.length})` },
                      { value: "wrong", label: `Wrong (${wrong})` },
                      { value: "right", label: `Right (${correct})` },
                      { value: "skipped", label: "Skipped" },
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setFilter(tab.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                          filter === tab.value
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleRows.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 py-6 text-center text-xs text-slate-500">
                    No questions in this category.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200/80">
                    {visibleRows.map(({ q, userAnswer, correctAnswer, state }) => {
                      const badge = STATE_BADGE[state];
                      return (
                        <li
                          key={q}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs sm:text-sm"
                        >
                          <span className="w-12 shrink-0 font-extrabold tabular-nums text-slate-800">
                            Q{q}
                          </span>
                          <div className="flex flex-1 items-center gap-4 text-slate-600">
                            <span>
                              Yours:{" "}
                              <strong className="font-bold text-slate-900">
                                {userAnswer || "--"}
                              </strong>
                            </span>
                            <span>
                              Actual:{" "}
                              <strong className="font-bold text-emerald-700">
                                {correctAnswer || "--"}
                              </strong>
                            </span>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}