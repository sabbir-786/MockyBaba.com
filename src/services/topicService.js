import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */
export const SUBJECT_META = {
  reasoning: {
    id: "reasoning",
    name: "Reasoning",
    subtitle: "Puzzles, Seating Arrangement, Syllogism, Inequality & Logical Reasoning"
  },
  aptitude: {
    id: "aptitude",
    name: "Aptitude",
    subtitle: "Data Interpretation, Simplification, Quadratic Equations & Arithmetic"
  },
  manual: {
    id: "manual",
    name: "Manual",
    subtitle: "Custom OMR answer sheets with flexible timers and manual key grading"
  }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const sortByOrder = (items) =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/**
 * Topic tuple: [name, levels, timeOverride, track]
 *  - levels: "p" = Prelims, "m" = Mains, "pm" = both
 *            ("pm" creates one topic for each level, each with its own id)
 *  - timeOverride (optional): number (seconds) | { p, m } | null
 *            Falls back to the chapter's defaults { p, m } when omitted
 *  - track (optional): "both" (default) | "clerk" | "po"
 */
const LEVEL_CODES = { p: "prelims", m: "mains" };

const resolveTopicSeconds = (timeOverride, defaults, code) => {
  if (typeof timeOverride === "number") return timeOverride;
  if (timeOverride && typeof timeOverride[code] === "number") {
    return timeOverride[code];
  }
  return defaults[code];
};

const buildTopics = (subjectId, chapterId, defaults, items) => {
  const counters = { prelims: 0, mains: 0 };
  const result = [];

  items.forEach(([name, levels, timeOverride = null, track = "both"]) => {
    levels.split("").forEach((code) => {
      const examLevel = LEVEL_CODES[code];
      counters[examLevel] += 1;
      result.push({
        id: `${chapterId}_${slugify(name)}_${examLevel}`,
        chapterId,
        subjectId,
        examLevel,
        track,
        name,
        defaultTimePerQuestionSeconds: resolveTopicSeconds(timeOverride, defaults, code),
        order: counters[examLevel]
      });
    });
  });

  return result;
};

const R = "reasoning";
const A = "aptitude";
const M = "manual";

/* ------------------------------------------------------------------ */
/* Default Per-Question Timers (in seconds) for Chapters               */
/* Used by fallback chapters & getDefaultTimeForChapter()              */
/* ------------------------------------------------------------------ */
export const CHAPTER_DEFAULT_TIMERS = {
  // Aptitude (chapters without granular topic lists)
  quadratic_equations: { p: 25, m: 55 },
  ratio_proportion: { p: 40, m: 80 },
  ages_problems: { p: 40, m: 80 },
  partnership: { p: 45, m: 85 },
  average: { p: 40, m: 80 },
  percentage: { p: 40, m: 85 },
  profit_loss: { p: 45, m: 90 },
  si_ci: { p: 50, m: 95 },
  mixture_alligation: { p: 45, m: 90 },
  time_work_pipes: { p: 45, m: 90 },
  time_speed_distance: { p: 50, m: 95 },
  boats_streams: { p: 45, m: 90 },
  permutation_combination: { p: 50, m: 100 },
  probability: { p: 50, m: 100 },
  mensuration: { p: 50, m: 100 },
  data_sufficiency_aptitude: { p: 55, m: 95 },
  quantity_comparison: { p: 50, m: 95 },

  // Manual OMR chapters
  manual_sectional_mock: { p: 40, m: 75 },
  manual_full_mock: { p: 40, m: 75 },
  manual_speed_drill: { p: 25, m: 45 },
  manual_puzzle_set: { p: 50, m: 110 },
  manual_pdf_sheet: { p: 45, m: 90 },
  manual_revision_set: { p: 45, m: 90 }
};

/* ------------------------------------------------------------------ */
/* Topics (in your sequence) with Topic-Specific Per-Question Timers   */
/* ------------------------------------------------------------------ */
export const DEFAULT_TOPICS = {
  /* ---------------- REASONING ---------------- */
  alphanumeric_series: buildTopics(R, "alphanumeric_series", { p: 30, m: 100 }, [
    ["Letter Series", "p", 25],
    ["Digit Series", "p", 25],
    ["Alphanumeric Series", "p", 30],
    ["Alphanumeric Symbol Series", "p", 30],
    ["Numeric Series", "p", 30],
    ["Word Series", "p", 30],
    ["Pair Formation (Word Based)", "p", 45],
    ["Pair Formation (Number Based)", "p", 40],
    ["Word Formation (Meaningful Words)", "p", 45],
    ["Vowel - Consonant Based", "p", 35],
    ["Odd - Even Number Based", "p", 35],
    ["Resultant Based Series", "m", 90],
    ["Step Based Series", "m", 100],
    ["Multiple Series", "m", 110]
  ]),

  coding_decoding: buildTopics(R, "coding_decoding", { p: 35, m: 100 }, [
    ["Letter/Number Coding", "p", 35],
    ["Substitutional Coding", "p", 30],
    ["Conditional Coding", "m", 90],
    ["New Pattern Coding", "m", 110],
    ["Binary Coding", "m", 90],
    ["Machine Coding", "m", 120],
    ["Mathematical Coding", "m", 100],
    ["Structure Based Coding", "m", 110],
    ["Filler Based Coding Decoding", "m", 100]
  ]),

  inequality: buildTopics(R, "inequality", { p: 20, m: 65 }, [
    ["Simple Inequalities", "p", 20],
    ["Coded Inequalities", "m", 55],
    ["Reverse Inequalities", "m", 65],
    ["Filler Inequalities", "m", 60],
    ["Out of The Box (Column Based)", "m", 75]
  ]),

  syllogism: buildTopics(R, "syllogism", { p: 25, m: 65 }, [
    ["Logically Follows", "p", 25],
    ["Logically does not Follows", "m", 55],
    ["Definitely does not Follows", "m", 60],
    ["Reverse Syllogism", "m", 75],
    ["Coded Syllogism", "m", 70],
    ["New Pattern Syllogism", "m", 75],
    ["Out of The Box (Column & Filler Based)", "m", 80]
  ]),

  blood_relation: buildTopics(R, "blood_relation", { p: 45, m: 85 }, [
    ["Passage Based", "pm", { p: 45, m: 80 }],
    ["Coded Blood Relation", "pm", { p: 50, m: 90 }]
  ]),

  direction_distance: buildTopics(R, "direction_distance", { p: 50, m: 95 }, [
    ["Passage Based", "pm", { p: 45, m: 80 }],
    ["Coded Direction & Distance", "pm", { p: 55, m: 95 }],
    ["Axis Based Direction & Distance", "pm", { p: 60, m: 100 }],
    ["Out of The Box", "m", 110]
  ]),

  // Per-question average for a 5-question set (Prelims ~3-4.5 min/set, Mains ~8-12.5 min/set)
  seating_arrangement: buildTopics(R, "seating_arrangement", { p: 45, m: 120 }, [
    ["Circular Arrangement", "p", 45],
    ["Square/Rectangular Arrangement", "p", 45],
    ["Triangular Arrangement", "p", 50],
    ["Pentagonal/Hexagonal Arrangement", "p", 50],
    ["Heptagonal/Octagonal Arrangement", "p", 55],
    ["Linear Arrangement (Single Row)", "p", 40],
    ["Linear Arrangement (Parallel Row)", "p", 45],
    ["Vacant Place Based Arrangement", "p", 55],
    ["Bounded Figure Based Arrangement", "m", 110],
    ["Linear Arrangement (Single/Parallel Row)", "m", 100],
    ["Concentric Figure Based Arrangement", "m", 135, "po"],
    ["Linear Arrangement (Three/Four Row)", "m", 140, "po"],
    ["Out of The Box", "m", 150]
  ]),

  puzzles: buildTopics(R, "puzzles", { p: 45, m: 125 }, [
    ["Day Based Puzzles", "p", 40],
    ["Month Based Puzzles", "p", 40],
    ["Date + Month Based Puzzles", "p", 45],
    ["Year Based Puzzles", "p", 45],
    ["Post Based Puzzles", "p", 45],
    ["Floor Based Puzzles", "p", 40],
    ["Floor + Flat Based Puzzles", "p", 50],
    ["Box Based Puzzles", "p", 45],
    ["Classification Based Puzzles", "p", 45],
    ["Selection Based Puzzles", "p", 50],
    ["Comparison Based Puzzles", "p", 35],
    ["Vacant Place Based Puzzles", "p", 55],
    ["Clerk Mains Puzzles", "m", 110, "clerk"],
    ["PO Mains Puzzles", "m", 140, "po"],
    ["Out of The Box", "m", 150]
  ]),

  machine_input: buildTopics(R, "machine_input", { p: 90, m: 105 }, [
    ["Shifting/Arrangement Based", "m", 90],
    ["Coding Logic Based", "m", 110],
    ["Box Based / New Pattern", "m", 120]
  ]),

  data_sufficiency_reasoning: buildTopics(R, "data_sufficiency_reasoning", { p: 60, m: 80 }, [
    ["Based on Two Statement", "m", 60],
    ["Based on Three Statement", "m", 80],
    ["Based on Five Statement", "m", 100],
    ["New Pattern Questions", "m", 90]
  ]),

  logical_reasoning: buildTopics(R, "logical_reasoning", { p: 55, m: 55 }, [
    ["Course of Action", "m", 55],
    ["Statement & Argument", "m", 55],
    ["Statement & Assumption", "m", 55],
    ["Inference", "m", 65],
    ["Cause & Effect", "m", 50],
    ["Mixed Questions", "m", 60]
  ]),

  order_ranking: buildTopics(R, "order_ranking", { p: 35, m: 60 }, [
    ["Exercise", "p", 35]
  ]),

  /* ---------------- APTITUDE ---------------- */
  // Single-level topics (no Pre/Mains split needed)
  simplification_approximation: buildTopics(A, "simplification_approximation", { p: 25, m: 25 }, [
    ["Simplification", "p", 25],
    ["Approximation", "p", 25],
    ["Mixture of Simplification & Approximation", "p", 25]
  ]),

  number_series: buildTopics(A, "number_series", { p: 35, m: 65 }, [
    ["Missing Number Series", "pm", { p: 30, m: 55 }],
    ["Wrong Number Series", "pm", { p: 35, m: 65 }],
    ["Advance Number Series", "m", 75]
  ]),

  data_interpretation: buildTopics(A, "data_interpretation", { p: 50, m: 105 }, [
    ["Table DI", "pm", { p: 45, m: 90 }],
    ["Pie Chart", "pm", { p: 45, m: 95 }],
    ["Line Graph", "pm", { p: 45, m: 95 }],
    ["Bar Graph", "pm", { p: 45, m: 95 }],
    ["Mixed DI", "pm", { p: 55, m: 110 }],
    ["Caselet DI (Prelims)", "p", 55],
    ["Caselet DI (Arithmetic)", "m", 115],
    ["Caselet DI (Mains)", "m", 120],
    ["Caselet DI (Venn DI)", "pm", { p: 55, m: 105 }],
    ["Arithmetic DI", "m", 115],
    ["Advanced DI", "m", 135],
    ["Radar DI", "pm", { p: 50, m: 105 }]
  ]),

  number_system_algebra: buildTopics(A, "number_system_algebra", { p: 45, m: 85 }, [
    ["Number System", "pm", { p: 45, m: 85 }],
    ["Algebra (Mains)", "m", 90]
  ]),

  /* ---------------- MANUAL (No Pre/Mains split) ---------------- */
  manual_sectional_mock: buildTopics(M, "manual_sectional_mock", { p: 40, m: 40 }, [
    ["Reasoning Sectional Sheet", "p", 40],
    ["Aptitude Sectional Sheet", "p", 40],
    ["English Sectional Sheet", "p", 35]
  ]),

  manual_full_mock: buildTopics(M, "manual_full_mock", { p: 40, m: 40 }, [
    ["Prelims Full Mock (100 Qs)", "p", 36],
    ["Mains Full Mock (150 Qs)", "p", 72],
    ["Custom Question Count Sheet", "p", 45]
  ]),

  manual_speed_drill: buildTopics(M, "manual_speed_drill", { p: 25, m: 25 }, [
    ["Simplification & Speed Math Drill", "p", 20],
    ["Inequality & Syllogism Drill", "p", 25],
    ["Mixed 20-Question Sprint", "p", 25]
  ]),

  manual_puzzle_set: buildTopics(M, "manual_puzzle_set", { p: 50, m: 50 }, [
    ["Single Puzzle / Seating Set (5 Qs)", "p", 45],
    ["Multi-Set Puzzle Practice (20 Qs)", "p", 55],
    ["Data Interpretation Set Practice", "p", 60]
  ]),

  manual_pdf_sheet: buildTopics(M, "manual_pdf_sheet", { p: 45, m: 45 }, [
    ["Checklist / Daily Target PDF", "p", 45],
    ["Book Exercise Sheet", "p", 45],
    ["Previous Year Paper PDF", "p", 45]
  ]),

  manual_revision_set: buildTopics(M, "manual_revision_set", { p: 45, m: 45 }, [
    ["Re-attempt Incorrect Questions", "p", 45],
    ["Skipped Questions Practice", "p", 45],
    ["Bookmarked Questions Drill", "p", 45]
  ])
};

const ALL_DEFAULT_TOPICS = Object.values(DEFAULT_TOPICS).flat();

/* ------------------------------------------------------------------ */
/* Chapters (in your sequence)                                         */
/* levels: "p" | "m" | "pm"                                            */
/* ------------------------------------------------------------------ */
const countTopics = (chapterId) =>
  DEFAULT_TOPICS[chapterId]
    ? new Set(DEFAULT_TOPICS[chapterId].map((t) => t.name)).size
    : 3;

const makeChapter = (subjectId, order, id, name, levels = "pm", extra = {}) => ({
  id,
  subjectId,
  order,
  name,
  totalTopics: countTopics(id),
  prelimsAvailable: levels.includes("p"),
  mainsAvailable: levels.includes("m"),
  ...extra
});

// Reasoning chapters have a "Conceptual Explanation" and "Solutions" section
const RS = { hasConcept: true, hasSolutions: true };

// Chapters that bypass Pre/Mains selection and open topics directly
const NO_LEVEL = { skipLevel: true };

export const DEFAULT_CHAPTERS = {
  reasoning: [
    makeChapter(R, 1, "alphanumeric_series", "Alphanumeric Series", "pm", RS),
    makeChapter(R, 2, "coding_decoding", "Coding-Decoding", "pm", RS),
    makeChapter(R, 3, "inequality", "Inequalities", "pm", RS),
    makeChapter(R, 4, "syllogism", "Syllogism", "pm", RS),
    makeChapter(R, 5, "blood_relation", "Blood Relation", "pm", RS),
    makeChapter(R, 6, "direction_distance", "Direction & Distance", "pm", RS),
    makeChapter(R, 7, "seating_arrangement", "Seating Arrangement", "pm", RS),
    makeChapter(R, 8, "puzzles", "Puzzles", "pm", RS),
    makeChapter(R, 9, "machine_input", "Machine Input", "m", RS),
    makeChapter(R, 10, "data_sufficiency_reasoning", "Data Sufficiency", "m", RS),
    makeChapter(R, 11, "logical_reasoning", "Logical/Critical Reasoning", "m", RS),
    makeChapter(R, 12, "order_ranking", "Order and Ranking", "p", RS)
  ],
  aptitude: [
    makeChapter(A, 1, "simplification_approximation", "Simplification & Approximation", "p", NO_LEVEL),
    makeChapter(A, 2, "number_series", "Number Series"),
    makeChapter(A, 3, "quadratic_equations", "Quadratic Equation"),
    makeChapter(A, 4, "ratio_proportion", "Ratio and Proportion"),
    makeChapter(A, 5, "ages_problems", "Ages Based Problems"),
    makeChapter(A, 6, "partnership", "Partnership"),
    makeChapter(A, 7, "average", "Average"),
    makeChapter(A, 8, "percentage", "Percentage"),
    makeChapter(A, 9, "profit_loss", "Profit, Loss and Discount"),
    makeChapter(A, 10, "si_ci", "Simple and Compound Interest"),
    makeChapter(A, 11, "mixture_alligation", "Mixture and Alligation"),
    makeChapter(A, 12, "time_work_pipes", "Time and Work & Pipe and Cistern"),
    makeChapter(A, 13, "time_speed_distance", "Speed, Time and Distance"),
    makeChapter(A, 14, "boats_streams", "Boat and Stream"),
    makeChapter(A, 15, "permutation_combination", "Permutation & Combination"),
    makeChapter(A, 16, "probability", "Probability"),
    makeChapter(A, 17, "mensuration", "Mensuration"),
    makeChapter(A, 18, "data_sufficiency_aptitude", "Data Sufficiency", "m"),
    makeChapter(A, 19, "quantity_comparison", "Quantity Comparison"),
    makeChapter(A, 20, "data_interpretation", "Data Interpretation"),
    makeChapter(A, 21, "number_system_algebra", "Number System & Algebra")
  ],
  manual: [
    makeChapter(M, 1, "manual_sectional_mock", "Sectional Timed Practice", "p", NO_LEVEL),
    makeChapter(M, 2, "manual_full_mock", "Full-Length Answer Sheet", "p", NO_LEVEL),
    makeChapter(M, 3, "manual_speed_drill", "Speed Drill OMR", "p", NO_LEVEL),
    makeChapter(M, 4, "manual_puzzle_set", "Puzzle & DI Set Practice", "p", NO_LEVEL),
    makeChapter(M, 5, "manual_pdf_sheet", "PDF / Book Practice Sheet", "p", NO_LEVEL),
    makeChapter(M, 6, "manual_revision_set", "Error-Log Revision Sheet", "p", NO_LEVEL)
  ]
};

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */
function findDefaultChapterById(chapterId) {
  for (const subjectChapters of Object.values(DEFAULT_CHAPTERS)) {
    const match = subjectChapters.find((ch) => ch.id === chapterId);
    if (match) return match;
  }
  return null;
}

// track: null = show everything; "clerk" or "po" hides topics meant for the other exam
const filterByTrack = (topics, track) => {
  if (!track) return topics;
  return topics.filter((t) => !t.track || t.track === "both" || t.track === track);
};

export const getDefaultTimeForChapter = (chapterId, examLevel = "prelims") => {
  const code = (examLevel || "prelims").toLowerCase() === "mains" ? "m" : "p";
  const chapterTimers = CHAPTER_DEFAULT_TIMERS[chapterId];
  if (chapterTimers) return chapterTimers[code];
  return code === "m" ? 100 : 45;
};

export const getDefaultTimeForTopic = (topicId, examLevel = "prelims") => {
  const match = ALL_DEFAULT_TOPICS.find((t) => t.id === topicId);
  if (match) return match.defaultTimePerQuestionSeconds;
  return (examLevel || "prelims").toLowerCase() === "mains" ? 100 : 45;
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
export const getChaptersBySubject = async (subjectId) => {
  const normalized = (subjectId || "").toLowerCase();

  try {
    const q = query(collection(db, "chapters"), where("subjectId", "==", normalized));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return sortByOrder(
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );
    }
  } catch (err) {
    console.warn("Falling back to default chapter list:", err.message);
  }

  return DEFAULT_CHAPTERS[normalized] || [];
};

export const getChapterById = async (chapterId) => {
  try {
    const snap = await getDoc(doc(db, "chapters", chapterId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
  } catch (err) {
    console.warn("Falling back to default chapter lookup:", err.message);
  }

  return findDefaultChapterById(chapterId);
};

export const getTopicsByChapterAndLevel = async (chapterId, examLevel, track = null) => {
  const chapter = findDefaultChapterById(chapterId);
  // Force "prelims" internally for single-level chapters (Simplification & Manual)
  const normalizedLevel = chapter?.skipLevel
    ? "prelims"
    : (examLevel || "prelims").toLowerCase();

  try {
    const q = query(
      collection(db, "topics"),
      where("chapterId", "==", chapterId),
      where("examLevel", "==", normalizedLevel)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return filterByTrack(
        sortByOrder(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              defaultTimePerQuestionSeconds:
                data.defaultTimePerQuestionSeconds ??
                getDefaultTimeForTopic(docSnap.id, normalizedLevel)
            };
          })
        ),
        track
      );
    }
  } catch (err) {
    console.warn("Falling back to default topic list:", err.message);
  }

  // Built-in topics for this chapter
  const predefined = DEFAULT_TOPICS[chapterId];
  if (predefined) {
    return filterByTrack(
      sortByOrder(predefined.filter((t) => t.examLevel === normalizedLevel)),
      track
    );
  }

  // Generic fallback for chapters without detailed topics yet
  const subjectId = chapter?.subjectId || "reasoning";
  const chapterName = chapter?.name || chapterId.replace(/_/g, " ");
  const defaultSec = getDefaultTimeForChapter(chapterId, normalizedLevel);

  return [
    {
      id: `${chapterId}_basic_${normalizedLevel}`,
      chapterId,
      subjectId,
      examLevel: normalizedLevel,
      track: "both",
      name: `${chapterName} – Foundation`,
      defaultTimePerQuestionSeconds: defaultSec,
      order: 1
    },
    {
      id: `${chapterId}_moderate_${normalizedLevel}`,
      chapterId,
      subjectId,
      examLevel: normalizedLevel,
      track: "both",
      name: `${chapterName} – Exam Level`,
      defaultTimePerQuestionSeconds: defaultSec + 10,
      order: 2
    },
    {
      id: `${chapterId}_mixed_${normalizedLevel}`,
      chapterId,
      subjectId,
      examLevel: normalizedLevel,
      track: "both",
      name: `${chapterName} – Mixed Practice`,
      defaultTimePerQuestionSeconds: defaultSec + 15,
      order: 3
    }
  ];
};

export const getTopicById = async (topicId) => {
  try {
    const snap = await getDoc(doc(db, "topics", topicId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        ...data,
        defaultTimePerQuestionSeconds:
          data.defaultTimePerQuestionSeconds ??
          getDefaultTimeForTopic(snap.id, data.examLevel)
      };
    }
  } catch (err) {
    console.warn("Falling back to default topic lookup:", err.message);
  }

  return ALL_DEFAULT_TOPICS.find((t) => t.id === topicId) || null;
};