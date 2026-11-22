import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, GraduationCap, Loader2 } from "lucide-react";
import { continueWithGoogle, getAuthErrorMessage } from "../firebase/auth";
import { useAuth } from "../context/AuthContext";

const EXAMS = ["SBI PO", "SBI Clerk", "IBPS PO", "IBPS Clerk", "RRB"];

function GoogleIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function AuthPage() {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { currentUser, loading, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (!loading && currentUser) {
      navigate(redirectTo, { replace: true });
    }
  }, [currentUser, loading, navigate, redirectTo]);

  const handleGoogleAuth = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      await continueWithGoogle();
      // Redirects automatically via useEffect once currentUser updates
    } catch (err) {
      setErrorMsg(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = errorMsg || authError;
  const isBusy = submitting || loading;

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 font-sans text-slate-900 antialiased">
      {/* Subtle Light Ambient Glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 size-112 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-1/4 -z-10 size-96 rounded-full bg-teal-200/20 blur-3xl"
        aria-hidden="true"
      />

      <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-center shadow-sm backdrop-blur-sm sm:p-8">
        {/* Brand Emblem */}
        <div className="mx-auto flex size-13 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
          <GraduationCap size={28} strokeWidth={2} aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
          Bank Exam Practice
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Sign in to track your accuracy, speed, and chapter progress.
        </p>

        {/* Exam Pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          {EXAMS.map((exam) => (
            <span
              key={exam}
              className="rounded-full border border-emerald-100 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
            >
              {exam}
            </span>
          ))}
        </div>

        {/* Error Alert */}
        {displayError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-left text-xs font-medium text-rose-800 sm:text-sm"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isBusy}
          aria-busy={isBusy}
          className="mt-7 flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 shadow-2xs transition-all hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isBusy ? (
            <Loader2 size={18} className="animate-spin text-emerald-600" aria-hidden="true" />
          ) : (
            <GoogleIcon />
          )}
          <span>
            {submitting
              ? "Opening Google..."
              : loading
                ? "Checking session..."
                : "Continue with Google"}
          </span>
        </button>

        {/* Footer Note */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
          <span>New users are registered automatically on first sign-in.</span>
        </p>
      </section>
    </main>
  );
}