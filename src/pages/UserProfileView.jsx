import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Clock,
  Loader2,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { getPublicUserProfile } from "../services/leaderboardService";

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

const fmtDuration = (sec) => {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export default function UserProfileView() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(() => location.state?.profile || null);
  const [loading, setLoading] = useState(!location.state?.profile);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile?.userId === userId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const data = await getPublicUserProfile(userId);
        if (!cancelled) {
          if (!data) setError("User profile nahi mila.");
          else setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        if (!cancelled) setError("Profile load nahi hua.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profile?.userId]);

  const last = profile?.lastAttempt || null;
  const topics = profile?.attemptedTopics || [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/leaderboard")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 sm:px-3 sm:text-sm"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
          <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-base">
            {profile?.displayName || "User Profile"}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading profile...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {!loading && profile && (
          <>
            {/* Profile Hero */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3.5">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500">
                    <User size={24} />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold text-slate-900">
                    {profile.displayName || "Student"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {profile.totalSets || 0} practice sets completed
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Trophy size={12} /> Total Marks
                  </p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
                    {profile.totalMarks ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Attempted Qs</p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
                    {profile.totalAttempted ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3">
                  <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <Target size={12} /> Accuracy
                  </p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-800">
                    {profile.accuracy ?? 0}%
                  </p>
                </div>
              </div>
            </section>

            {/* Last Attempt */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Last Attempt
              </h3>
              {!last ? (
                <p className="mt-2 text-xs text-slate-500">No recent attempt recorded.</p>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {last.topicName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock size={11} />
                        <span>{fmtDateTime(last.submittedAt)}</span>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {last.accuracy}%
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs text-slate-600">
                    Score:{" "}
                    <strong className="font-bold text-slate-900">
                      {last.correctAnswers}/{last.totalQuestions}
                    </strong>{" "}
                    · {last.attemptedQuestions} attempted · {fmtDuration(last.timeTakenSeconds)}
                  </p>
                </div>
              )}
            </section>

            {/* Attempted Topics */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                  <BookOpen size={15} className="text-emerald-600" />
                  Attempted Topics ({topics.length})
                </h3>
              </div>

              {topics.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No topics attempted yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {topics.map((t) => (
                    <li
                      key={t.topicId}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {t.topicName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.attempts} {t.attempts === 1 ? "set" : "sets"} ·{" "}
                          {t.attemptedQuestions} Qs · Last: {fmtDateTime(t.lastAttemptAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700">
                        Best {t.bestAccuracy}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}