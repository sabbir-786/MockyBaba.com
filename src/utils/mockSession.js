const KEY = "bankPracticeSession";

export const createSession = ({
  startQuestion,
  endQuestion,
  timeLimitMins,
  timerMode,
  meta
}) => ({
  startQuestion,
  endQuestion,
  totalQuestions: endQuestion - startQuestion + 1,
  timeLimitMins,
  timerMode, // "negative" | "autosubmit"
  timeRemaining: timeLimitMins > 0 ? timeLimitMins * 60 : null,
  timeSpent: 0,
  answers: {}, // { [q]: { userAnswer, correctAnswer, result } }
  meta, // subject, chapter, topic, level, book, set names
  startedAt: Date.now()
});

export const loadSession = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveSession = (session) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage full or blocked: ignore */
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

const pad = (n) => String(n).padStart(2, "0");

// 125 -> "02:05", -30 -> "-00:30"
export const formatClock = (seconds) => {
  const s = Math.round(seconds || 0);
  const abs = Math.abs(s);
  return `${s < 0 ? "-" : ""}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

// 125 -> "2m 5s", 40 -> "40s"
export const formatDuration = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
};