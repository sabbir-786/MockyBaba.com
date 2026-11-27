import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Trophy,
  User,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getTopUsers, syncUserLeaderboard } from "../services/leaderboardService";

export default function Leaderboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [tab, setTab] = useState("totalMarks"); // totalMarks | totalAttempted
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        if (currentUser?.uid) {
          await syncUserLeaderboard(currentUser).catch(() => {});
        }
        // Make sure limit(10) is removed inside getTopUsers
        const data = await getTopUsers(tab);
        if (!cancelled) setUsers(data);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
        if (!cancelled)
          setError("Leaderboard load nahi hua. Internet ya Firestore rules check karo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, currentUser]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              aria-label="Back to Home"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800 sm:px-3 sm:text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-base">
                Leaderboard
              </h1>
              <p className="truncate text-xs text-slate-500">
                Tap any user to view their topics and last attempt
              </p>
            </div>
          </div>

          {!loading && !error && users.length > 0 && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 tabular-nums">
              {users.length} {users.length === 1 ? "User" : "Users"}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
        {/* Sort Tabs */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setTab("totalMarks")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
              tab === "totalMarks"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Trophy size={15} aria-hidden="true" />
            <span>Top Scorers</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("totalAttempted")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
              tab === "totalAttempted"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ListChecks size={15} aria-hidden="true" />
            <span>Most Attempted</span>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-sm font-medium text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading Leaderboard...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No ranked users yet. Finish a practice set to appear here.
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            {users.map((u, idx) => {
              const rank = idx + 1;
              const isMe = u.userId === currentUser?.uid;
              const rankBadge =
                rank === 1
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : rank === 2
                    ? "bg-slate-200 text-slate-800 border-slate-300"
                    : rank === 3
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : "bg-slate-50 text-slate-600 border-slate-200";

              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/leaderboard/${u.userId}`, { state: { profile: u } })
                    }
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-emerald-50/40 ${
                      isMe ? "bg-emerald-50/30" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold tabular-nums ${rankBadge}`}
                      >
                        {rank}
                      </span>

                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt={u.displayName}
                          className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500">
                          <User size={16} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {u.displayName || "Student"}
                          {isMe && (
                            <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              You
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {u.totalSets || 0} sets · {u.accuracy || 0}% accuracy
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="text-right">
                        <p className="text-sm font-extrabold tabular-nums text-slate-900">
                          {tab === "totalMarks"
                            ? `${u.totalMarks ?? 0} pts`
                            : `${u.totalAttempted ?? 0} Qs`}
                        </p>
                        <p className="text-[11px] tabular-nums text-slate-500">
                          {tab === "totalMarks"
                            ? `${u.totalAttempted ?? 0} attempted`
                            : `${u.totalMarks ?? 0} pts`}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}