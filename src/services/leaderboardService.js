import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getUserExamHistory } from "./examService";

const LEADERBOARD_COLLECTION = "leaderboard";

const toMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Recomputes and saves the user's public leaderboard profile from their examAttempts.
 * Call this after saving or deleting an attempt.
 */
export const syncUserLeaderboard = async (user) => {
  if (!user?.uid) return;

  const history = await getUserExamHistory(user.uid);

  let totalMarks = 0;
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;

  const topicMap = new Map();

  history.forEach((a) => {
    const correct = a.correctAnswers || 0;
    const wrong = a.wrongAnswers || 0;
    const attempted = a.attemptedQuestions || 0;
    const marks = a.score != null ? Number(a.score) : correct;

    totalMarks += marks;
    totalAttempted += attempted;
    totalCorrect += correct;
    totalWrong += wrong;

    const topicKey = a.topicId || a.topicName || a.chapterName;
    if (topicKey) {
      const existing = topicMap.get(topicKey);
      const submittedMs = toMillis(a.submittedAt);
      if (!existing) {
        topicMap.set(topicKey, {
          topicId: a.topicId || topicKey,
          topicName: a.topicName || a.chapterName || "Practice set",
          subjectId: a.subjectId || "",
          attempts: 1,
          attemptedQuestions: attempted,
          bestAccuracy: a.accuracy || 0,
          lastAttemptAt: submittedMs,
        });
      } else {
        existing.attempts += 1;
        existing.attemptedQuestions += attempted;
        existing.bestAccuracy = Math.max(existing.bestAccuracy, a.accuracy || 0);
        existing.lastAttemptAt = Math.max(existing.lastAttemptAt, submittedMs);
      }
    }
  });

  const graded = totalCorrect + totalWrong;
  const accuracy = graded > 0 ? Math.round((totalCorrect / graded) * 100) : 0;

  // history is already sorted newest first
  const latest = history[0] || null;
  const lastAttempt = latest
    ? {
        topicName: latest.topicName || latest.chapterName || "Practice set",
        subjectId: latest.subjectId || "",
        examLevel: latest.examLevel || "prelims",
        correctAnswers: latest.correctAnswers || 0,
        wrongAnswers: latest.wrongAnswers || 0,
        attemptedQuestions: latest.attemptedQuestions || 0,
        totalQuestions: latest.totalQuestions || 0,
        accuracy: latest.accuracy || 0,
        timeTakenSeconds: latest.timeTakenSeconds || 0,
        submittedAt: toMillis(latest.submittedAt),
      }
    : null;

  const attemptedTopics = [...topicMap.values()]
    .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt)
    .slice(0, 30);

  await setDoc(
    doc(db, LEADERBOARD_COLLECTION, user.uid),
    {
      userId: user.uid,
      displayName: user.displayName || "Student",
      photoURL: user.photoURL || "",
      totalMarks: Number(totalMarks.toFixed(2)),
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalSets: history.length,
      accuracy,
      attemptedTopics,
      lastAttempt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Fetches all users sorted by "totalMarks" or "totalAttempted".
 */
export const getTopUsers = async (sortBy = "totalMarks") => {
  const field = sortBy === "totalAttempted" ? "totalAttempted" : "totalMarks";
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    orderBy(field, "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Fetches a single user's public leaderboard profile.
 */
export const getPublicUserProfile = async (userId) => {
  if (!userId) return null;
  const snap = await getDoc(doc(db, LEADERBOARD_COLLECTION, userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};