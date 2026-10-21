import { STORAGE_KEY } from "./store.js";

/** All app keys in localStorage use this prefix. */
export const STORAGE_PREFIX = "memory-palace";

export const BACKUP_FORMAT = "memory-palace-backup";
export const BACKUP_VERSION = 1;

function isAppStorageKey(key) {
  return key === STORAGE_KEY || key.startsWith(`${STORAGE_PREFIX}-`);
}

function collectAppStorage() {
  const entries = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isAppStorageKey(key)) {
      entries[key] = localStorage.getItem(key);
    }
  }
  return entries;
}

function parseMainState(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.concepts)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Coerce timeline fields to numbers; never reset to Date.now() on import. */
function normalizeTimelineValue(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeConceptTimestamps(concept) {
  if (!concept || typeof concept !== "object") return concept;
  return {
    ...concept,
    createdAt: normalizeTimelineValue(concept.createdAt) ?? concept.createdAt,
    dayDoneAt: normalizeTimelineValue(concept.dayDoneAt),
    weekDoneAt: normalizeTimelineValue(concept.weekDoneAt),
    monthDoneAt: normalizeTimelineValue(concept.monthDoneAt),
  };
}

function normalizeMainStateForImport(state) {
  return {
    ...state,
    concepts: (state.concepts ?? []).map(normalizeConceptTimestamps),
    categories: Array.isArray(state.categories) ? state.categories : [],
    lang: state.lang === "en" ? "en" : "zh",
  };
}

export function backupFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `记忆宫殿备份_${y}-${m}-${d}.json`;
}

export function buildBackupPayload() {
  const entries = collectAppStorage();
  const mainRaw = entries[STORAGE_KEY];
  const main = parseMainState(mainRaw);
  if (!main) {
    throw new Error("no_state");
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    entries,
    state: main,
  };
}

export function downloadBackup() {
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

function readEntriesFromFile(parsed) {
  if (parsed?.format === BACKUP_FORMAT && parsed.entries && typeof parsed.entries === "object") {
    return parsed.entries;
  }
  if (parsed?.state && typeof parsed.state === "object") {
    return {
      [STORAGE_KEY]: JSON.stringify(
        normalizeMainStateForImport(parsed.state),
      ),
    };
  }
  if (Array.isArray(parsed?.concepts)) {
    return {
      [STORAGE_KEY]: JSON.stringify(normalizeMainStateForImport(parsed)),
    };
  }
  return null;
}

/**
 * Overwrite local app storage from a backup file. Timestamps in concepts are preserved as-is.
 * Caller should reload the page after success.
 */
export function applyBackupFromParsed(parsed) {
  const entries = readEntriesFromFile(parsed);
  if (!entries || !entries[STORAGE_KEY]) {
    throw new Error("invalid_backup");
  }

  const main = parseMainState(entries[STORAGE_KEY]);
  if (!main) {
    throw new Error("invalid_state");
  }

  const normalizedMain = normalizeMainStateForImport(main);
  entries[STORAGE_KEY] = JSON.stringify(normalizedMain);

  for (const key of Object.keys(localStorage)) {
    if (isAppStorageKey(key)) {
      localStorage.removeItem(key);
    }
  }

  for (const [key, value] of Object.entries(entries)) {
    if (!isAppStorageKey(key) || value == null) continue;
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}

export async function importBackupFromFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid_json");
  }
  applyBackupFromParsed(parsed);
}
