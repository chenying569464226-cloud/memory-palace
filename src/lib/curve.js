/**
 * Ebbinghaus-style retention checkpoints.
 * Timeline uses absolute ms since epoch on each concept (`createdAt`); UI compares `Date.now() - createdAt`.
 * Consolidation marks use `dayDoneAt` / `weekDoneAt` / `monthDoneAt` (also absolute timestamps).
 */
export const CURVE = [
  { afterMs: 0, retain: 100, id: "now" },
  { afterMs: 20 * 60 * 1000, retain: 58, id: "20m" },
  { afterMs: 60 * 60 * 1000, retain: 44, id: "1h" },
  { afterMs: 9 * 60 * 60 * 1000, retain: 36, id: "9h" },
  { afterMs: 24 * 60 * 60 * 1000, retain: 33, id: "1d" },
  { afterMs: 2 * 24 * 60 * 60 * 1000, retain: 28, id: "2d" },
  { afterMs: 6 * 24 * 60 * 60 * 1000, retain: 25, id: "6d" },
  { afterMs: 31 * 24 * 60 * 60 * 1000, retain: 21, id: "31d" },
];

export const CONSOLIDATION = [
  { id: "day", afterMs: 24 * 60 * 60 * 1000, field: "dayDoneAt" },
  { id: "week", afterMs: 7 * 24 * 60 * 60 * 1000, field: "weekDoneAt" },
  { id: "month", afterMs: 31 * 24 * 60 * 60 * 1000, field: "monthDoneAt" },
];

export const FORGET_AFTER_MS = 31 * 24 * 60 * 60 * 1000;
export const FORGET_PURGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isForgotten(createdAt, now = Date.now()) {
  return now - createdAt >= FORGET_AFTER_MS;
}

export function shouldPurge(createdAt, now = Date.now()) {
  return now - createdAt >= FORGET_AFTER_MS + FORGET_PURGE_MS;
}

export function forgetPurgeLeft(createdAt, now = Date.now()) {
  return Math.max(0, createdAt + FORGET_AFTER_MS + FORGET_PURGE_MS - now);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function retentionAt(createdAt, now = Date.now()) {
  const age = Math.max(0, now - createdAt);
  if (age <= CURVE[0].afterMs) return CURVE[0].retain;
  const last = CURVE[CURVE.length - 1];
  if (age >= last.afterMs) return last.retain;
  for (let i = 1; i < CURVE.length; i++) {
    const prev = CURVE[i - 1];
    const next = CURVE[i];
    if (age <= next.afterMs) {
      const t = (age - prev.afterMs) / (next.afterMs - prev.afterMs);
      return lerp(prev.retain, next.retain, t);
    }
  }
  return last.retain;
}

export function stageOf(createdAt, now = Date.now()) {
  const age = Math.max(0, now - createdAt);
  let stage = CURVE[0];
  for (const point of CURVE) {
    if (age >= point.afterMs) stage = point;
  }
  return stage;
}

export function nextPoint(createdAt, now = Date.now()) {
  const age = Math.max(0, now - createdAt);
  return CURVE.find((point) => point.afterMs > age) ?? null;
}

export function formatAge(ms, lang = "zh") {
  const s = Math.floor(Math.max(0, ms) / 1000);
  if (lang === "en") {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h} h`;
    return `${Math.floor(h / 24)} d`;
  }
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} 小时`;
  return `${Math.floor(h / 24)} 天`;
}
