import { shouldPurge } from "./curve.js";
import { createId } from "./id.js";
import { withReviewSample } from "./reviewSample.js";
import { defaultCategories, findNode } from "./skills.js";

export const STORAGE_KEY = "memory-palace-v1";
const KEY = STORAGE_KEY;

function mergeCategories(saved) {
  const defaults = defaultCategories();
  const list = Array.isArray(saved) ? [...saved] : [];
  const ids = new Set(list.map((c) => c.id));
  for (const item of defaults) {
    if (!ids.has(item.id)) list.push(item);
  }
  return list;
}

function migrateConcept(item) {
  const categoryId =
    item.categoryId ?? (item.nodeId ? findNode(item.nodeId)?.subject.id : null) ?? null;
  const title =
    (item.title || "").trim() || (item.text ?? "").trim().split("\n")[0]?.slice(0, 80) || "";
  const text = (item.text ?? "").trim() || title;
  return {
    ...item,
    title,
    text,
    answer: item.answer ?? "",
    chapter: (item.chapter ?? "").trim(),
    categoryId,
    isSample: Boolean(item.isSample),
    palaceOnly: Boolean(item.palaceOnly),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return {
        concepts: withReviewSample([]),
        categories: defaultCategories(),
        lang: "zh",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      concepts: withReviewSample((parsed.concepts ?? []).map(migrateConcept)),
      categories: mergeCategories(parsed.categories),
      lang: parsed.lang === "en" ? "en" : "zh",
    };
  } catch {
    return {
      concepts: withReviewSample([]),
      categories: defaultCategories(),
      lang: "zh",
    };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        concepts: state.concepts,
        categories: state.categories,
        lang: state.lang,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function purgeForgotten(concepts, now = Date.now()) {
  return concepts.filter((item) => !shouldPurge(item.createdAt, now));
}

export function newConcept({ title = "", text, answer = "", chapter = "", categoryId = null }) {
  const head = title.trim();
  const body = text.trim() || head;
  const finalTitle = head || body.split("\n")[0]?.slice(0, 80) || "";
  return {
    id: createId(),
    title: finalTitle,
    text: body,
    answer: (answer || "").trim(),
    chapter: (chapter || "").trim(),
    nodeId: categoryId ?? null,
    categoryId: categoryId ?? null,
    createdAt: Date.now(),
    dayDoneAt: null,
    weekDoneAt: null,
    monthDoneAt: null,
    palaceOnly: false,
  };
}
