import { stageOf } from "./curve.js";

/** First-day stages (not yet on Review tab); block memory palace until passed. */
export const CONCEPT_STAGE_IDS = new Set(["now", "20m", "1h", "9h"]);

/** Bands shown on the Concepts tab (20 minutes through ~1 day, no separate「刚记下」档). */
export const CONCEPT_TAB_BAND_IDS = new Set(["20m", "1h", "9h"]);

/** Stages on the Review tab (from 1-day mark onward, before forgotten purge). */
export const REVIEW_STAGE_IDS = new Set(["1d", "2d", "6d"]);

export function conceptTabBandId(createdAt, now) {
  const id = stageOf(createdAt, now).id;
  if (id === "now") return "20m";
  if (CONCEPT_TAB_BAND_IDS.has(id)) return id;
  return null;
}

/** Classified concepts past the first day can appear as memory-palace pages. */
export function isPalacePageConcept(item, now) {
  if (!item?.categoryId) return false;
  if (item.palaceOnly) return true;
  const stage = stageOf(item.createdAt, now);
  if (!CONCEPT_STAGE_IDS.has(stage.id)) return true;
  const isEditorPage =
    !(item.title || "").trim() &&
    !(item.text || "").trim() &&
    Boolean((item.answer || "").trim());
  return isEditorPage;
}
