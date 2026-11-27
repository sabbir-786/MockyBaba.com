import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Home,
  MinusCircle,
  Plus,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { buildAttemptFromSession } from "../services/examService";
import {
  clearSession,
  formatDuration,
  loadSession,
} from "../utils/mockSession.js";

function SummaryStat({ label, value, tone = "default" }) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "teal"
          ? "text-teal-700"
          : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3.5 text-center shadow-2xs">
      <p className={`text-xl font-extrabold tracking-tight sm:text-2xl ${toneClass}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">
        {label}
      </p>
    </div>
  );
}

export default function PracticeResult() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [session] = useState(() => loadSession());
  const [filter, setFilter] = useState("all"); // all | wrong | right | skip | ungraded

  useEffect(() => {
    if (!session) {
      navigate("/practice/setup", { replace: true });
    }
  }, [session, navigate]);

  const attempt = useMemo(() => {
    if (!session) return null;
    return buildAttemptFromSession(currentUser?.uid || "", session);
  }, [currentUser?.uid, session]);

  const breakdown = useMemo(() => {
    if (!attempt) return [];
    const list = [];
    for (let q = attempt.startQuestion; q <= attempt.endQuestion; q += 1) {
      const a = attempt.answers?.[q] || {};
      let kind = "skip";
      if (a.userAnswer && a.result === "right") kind = "right";
      else if (a.userAnswer && a.result === "wrong") kind = "wrong";
      else if (a.userAnswer) kind = "ungraded";

      list.push({
        q,
        kind,
        userAnswer: a.userAnswer || null,
        correctAnswer: a.correctAnswer || null,
      });
    }
    return list;
  }, [attempt]);

  if (!session || !attempt) return null;

  const saved = Boolean(session.attemptId);
  const meta = session.meta || {};

  const leaveTo = (path, navOptions) => {
    if (
      !saved &&
      !window.confirm(
        "Ye result save nahi hua hai. Phir bhi chhod ke jaana hai?"
      )
    ) {
      return;
    }
    clearSession();
    navigate(path, navOptions);
  };

  const openSavedScore = () => {
    if (!session.attemptId) return;
    leaveTo(`/statistics/${session.attemptId}`, {
      state: {
        attempt: {
          id: session.attemptId,
          ...attempt,
          submittedAt: session.savedAt || Date.now(),
        },
      },
    });
  };

  const subtitle = [
    meta.topicName,
    meta.chapterName,
    meta.bookName,
    meta.setName,
  ]
    .filter(Boolean)
    .join(" · ");

  const filteredRows =
    filter === "all"
      ? breakdown
      : breakdown.filter((item) => item.kind === filter);

  const filterOptions = [
    { key: "all", label: "All", count: breakdown.length },
    { key: "wrong", label: "Wrong", count: attempt.wrongAnswers },
    { key: "right", label: "Correct", count: attempt.correctAnswers },
    { key: "skip", label: "Unattempted", count: attempt.unattemptedQuestions },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sticky Light Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/practice/grading")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Grading</span>
            </button>

            <button
              type="button"
              onClick={() => leaveTo("/")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
            >
              <Home size={16} aria-hidden="true" />
              <span>Home</span>
            </button>
          </div>

          <span className="truncate text-sm font-extrabold tracking-tight text-slate-900">
            Detailed Analysis
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
        {/* Performance Summary Hero */}
        <section className="rounded-3xl border border-slate-200/80 bg-linear-to-br from-white via-emerald-50/40 to-teal-50/40 p-5 shadow-xs sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
              <Clock size={14} className="text-emerald-600" aria-hidden="true" />
              <span>Total Time: {formatDuration(attempt.timeTakenSeconds)}</span>
              {attempt.overtimeSeconds > 0 && (
                <span className="font-bold text-rose-600">
                  (+{formatDuration(attempt.overtimeSeconds)} over)
                </span>
              )}
            </span>

            {saved ? (
              <button
                type="button"
                onClick={openSavedScore}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                <CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" />
                <span>Result saved · View</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <AlertTriangle size={14} className="text-amber-600" aria-hidden="true" />
                <span>Result saved nahi hua</span>
              </span>
            )}
          </div>

          <div className="mt-5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Performance Summary
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {subtitle || "Book Practice"}
            </p>
          </div>

          {/* 6-Stat Grid */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
            <SummaryStat label="Total" value={attempt.totalQuestions} />
            <SummaryStat label="Attempted" value={attempt.attemptedQuestions} />
            <SummaryStat label="Unattempted" value={attempt.unattemptedQuestions} />
            <SummaryStat
              label="Correct"
              value={attempt.correctAnswers}
              tone="emerald"
            />
            <SummaryStat
              label="Wrong"
              value={attempt.wrongAnswers}
              tone="rose"
            />
            <SummaryStat
              label="Accuracy"
              value={`${attempt.accuracy}%`}
              tone="teal"
            />
          </div>
        </section>

        {/* Question Breakdown Section */}
        <section className="mt-8" aria-labelledby="breakdown-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="breakdown-heading"
              className="text-lg font-extrabold tracking-tight text-slate-900"
            >
              Question Breakdown
            </h2>

            <div
              role="group"
              aria-label="Filter questions"
              className="flex flex-wrap gap-1.5"
            >
              {filterOptions.map((opt) => {
                const active = filter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFilter(opt.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}{" "}
                    <span className={active ? "text-emerald-100" : "text-slate-400"}>
                      ({opt.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-2xs">
              No questions in this category.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRows.map(({ q, kind, userAnswer, correctAnswer }) => {
                const cardStyle =
                  kind === "right"
                    ? "border-emerald-200/90 bg-white"
                    : kind === "wrong"
                      ? "border-rose-200/90 bg-white"
                      : kind === "ungraded"
                        ? "border-amber-200/90 bg-white"
                        : "border-slate-200/70 bg-slate-100/60";

                const badgeConfig =
                  kind === "right"
                    ? {
                        cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
                        icon: CheckCircle2,
                        text: "Correct",
                      }
                    : kind === "wrong"
                      ? {
                          cls: "border-rose-200 bg-rose-50 text-rose-700",
                          icon: XCircle,
                          text: "Wrong",
                        }
                      : kind === "ungraded"
                        ? {
                            cls: "border-amber-200 bg-amber-50 text-amber-700",
                            icon: AlertTriangle,
                            text: "Not Graded",
                          }
                        : {
                            cls: "border-slate-200 bg-white text-slate-500",
                            icon: MinusCircle,
                            text: "Unattempted",
                          };

                const BadgeIcon = badgeConfig.icon;

                return (
                  <article
                    key={q}
                    className={`rounded-2xl border p-4 shadow-2xs ${cardStyle}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                        Q{q}.
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeConfig.cls}`}
                      >
                        <BadgeIcon size={13} aria-hidden="true" />
                        <span>{badgeConfig.text}</span>
                      </span>
                    </div>

                    {userAnswer && (
                      <div className="mt-3 grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
                          <span className="block text-[11px] font-medium text-slate-500">
                            Your Answer
                          </span>
                          <span
                            className={`mt-0.5 block text-base font-extrabold ${
                              kind === "wrong"
                                ? "text-rose-600"
                                : kind === "right"
                                  ? "text-emerald-600"
                                  : "text-slate-900"
                            }`}
                          >
                            {userAnswer}
                          </span>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
                          <span className="block text-[11px] font-medium text-slate-500">
                            Actual Answer
                          </span>
                          <span className="mt-0.5 block text-base font-extrabold text-emerald-700">
                            {correctAnswer || "?"}
                          </span>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => leaveTo("/practice/setup")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Plus size={18} aria-hidden="true" />
            <span>Start New Practice</span>
          </button>

          <button
            type="button"
            onClick={() => leaveTo("/statistics")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <BarChart3 size={16} aria-hidden="true" />
            <span>Statistics</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/practice/grading")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Grading</span>
          </button>
        </div>
      </main>
    </div>
  );
}