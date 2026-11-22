import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTION = "examAttempts";

function getTimestampMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const sortNewestFirst = (items) =>
  [...items].sort(
    (a, b) => getTimestampMillis(b.submittedAt) - getTimestampMillis(a.submittedAt)
  );

/* ------------------------------------------------------------------ */
/* Build an attempt record from a finished practice session            */
/* ------------------------------------------------------------------ */
/**
 * Turns the in-browser practice session into a Firestore-ready record.
 * Firestore rejects `undefined`, so every optional value falls back to null.
 *
 * Counting rules (same as the results screen):
 *  - attempted    = question has a marked answer
 *  - correct/wrong = attempted AND the actual answer was entered in grading
 *  - ungraded     = attempted but actual answer not entered yet
 *  - accuracy     = correct / (correct + wrong), rounded %
 */
export const buildAttemptFromSession = (userId, session) => {
  const { startQuestion, endQuestion, answers = {}, meta = {} } = session;
  const totalQuestions = endQuestion - startQuestion + 1;

  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let ungraded = 0;
  const answerMap = {};

  for (let q = startQuestion; q <= endQuestion; q += 1) {
    const a = answers[q] || {};
    const userAnswer = a.userAnswer || null;
    const correctAnswer = a.correctAnswer || null;
    let result = null;

    if (userAnswer) {
      attempted += 1;
      if (correctAnswer) {
        result = userAnswer === correctAnswer ? "right" : "wrong";
        if (result === "right") correct += 1;
        else wrong += 1;
      } else {
        ungraded += 1;
      }
    }

    answerMap[q] = { userAnswer, correctAnswer, result };
  }

  const graded = correct + wrong;
  const accuracy = graded > 0 ? Math.round((correct / graded) * 100) : 0;

  const timeLimitMins = Number(session.timeLimitMins) || 0;
  const timeTakenSeconds = Number(session.timeSpent) || 0;
  const overtimeSeconds =
    timeLimitMins > 0 ? Math.max(0, timeTakenSeconds - timeLimitMins * 60) : 0;

  return {
    userId,
    status: "completed",
    source: "book_practice",

    // What was practised (TopicDashboard matches on topicId + examLevel)
    subjectId: meta.subjectId || null,
    chapterId: meta.chapterId || null,
    chapterName: meta.chapterName || null,
    topicId: meta.topicId || null,
    topicName: meta.topicName || null,
    examLevel: (meta.examLevel || "prelims").toLowerCase(),
    bookName: meta.bookName || "",
    setName: meta.setName || "",

    // Range
    startQuestion,
    endQuestion,
    totalQuestions,

    // Score
    attemptedQuestions: attempted,
    unattemptedQuestions: totalQuestions - attempted,
    correctAnswers: correct,
    wrongAnswers: wrong,
    ungradedQuestions: ungraded,
    accuracy,

    // Timing
    timeLimitMins,
    timerMode: session.timerMode || "negative",
    timeTakenSeconds,
    overtimeSeconds,
    startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),

    // Per-question detail (used later for weak-topic analysis)
    answers: answerMap
  };
};

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */
/**
 * Creates or updates an exam attempt record in Firestore.
 * Stamps submittedAt with serverTimestamp().
 */
export const saveExamAttempt = async (attemptData) => {
  const { id, ...data } = attemptData;
  const docRef = doc(db, COLLECTION, id);

  await setDoc(
    docRef,
    {
      ...data,
      submittedAt: serverTimestamp()
    },
    { merge: true }
  );

  return id;
};

/**
 * Saves a finished practice session as a new attempt and returns its id.
 * Pass an existing attemptId to update the same record (prevents duplicates
 * if the user taps Finish twice).
 */
export const savePracticeAttempt = async (userId, session, existingAttemptId = null) => {
  if (!userId) throw new Error("You must be signed in to save results.");

  const id = existingAttemptId || doc(collection(db, COLLECTION)).id;
  const attempt = buildAttemptFromSession(userId, session);

  await saveExamAttempt({ id, ...attempt });
  return id;
};

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */
/**
 * Fetches a single exam attempt by its unique attemptId.
 */
export const getExamAttempt = async (attemptId) => {
  if (!attemptId) return null;
  const snap = await getDoc(doc(db, COLLECTION, attemptId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Fetches all completed attempts for a user, newest first.
 * Uses one equality filter (no composite index needed); status filter and
 * sorting happen in the browser.
 */
export const getUserExamHistory = async (userId) => {
  if (!userId) return [];

  const q = query(collection(db, COLLECTION), where("userId", "==", userId));
  const snapshot = await getDocs(q);

  return sortNewestFirst(
    snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((item) => item.status === "completed")
  );
};

/**
 * Fetches the most recent completed attempt for a topic and exam level.
 */
export const getLatestTopicAttempt = async (userId, topicId, examLevel) => {
  if (!userId || !topicId) return null;
  const normalizedLevel = (examLevel || "prelims").toLowerCase();

  const history = await getUserExamHistory(userId);
  return (
    history.find(
      (item) =>
        item.topicId === topicId &&
        (item.examLevel || "").toLowerCase() === normalizedLevel
    ) || null
  );
};