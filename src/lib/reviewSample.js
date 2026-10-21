export const REVIEW_SAMPLE_ID = "review-sample-demo";
const DISMISSED_KEY = "memory-palace-review-sample-dismissed";
const VERSION_KEY = "memory-palace-review-sample-version";
/** Bump to re-issue a fresh demo card for existing users. */
const SAMPLE_VERSION = 2;

export function dismissReviewSampleFlag() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function createReviewSampleConcept(now = Date.now()) {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  return {
    id: REVIEW_SAMPLE_ID,
    title: "PM2.5",
    text: "大气中 PM2.5 的主要来源有哪些？",
    answer: "机动车尾气、燃煤与工业排放、扬尘、生物质燃烧，以及气态前体物二次转化等。",
    categoryId: null,
    nodeId: null,
    chapter: "",
    createdAt: now - twoDays,
    dayDoneAt: null,
    weekDoneAt: null,
    monthDoneAt: null,
    isSample: true,
  };
}

export function withReviewSample(concepts) {
  let list = concepts.filter((c) => c.id !== REVIEW_SAMPLE_ID);
  try {
    const version = Number(localStorage.getItem(VERSION_KEY) || 0);
    if (version < SAMPLE_VERSION) {
      localStorage.removeItem(DISMISSED_KEY);
      localStorage.setItem(VERSION_KEY, String(SAMPLE_VERSION));
    } else if (localStorage.getItem(DISMISSED_KEY)) {
      return concepts;
    }
  } catch {
    /* ignore */
  }
  if (list.some((c) => c.id === REVIEW_SAMPLE_ID)) return list;
  return [...list, createReviewSampleConcept()];
}
