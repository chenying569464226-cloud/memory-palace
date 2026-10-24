/** Display order within a time band (independent of createdAt). */
export function defaultSortRank() {
  return Math.random();
}

export function sortConceptsInBand(items) {
  return items.slice().sort((a, b) => (a.sortRank ?? 0) - (b.sortRank ?? 0));
}

export function sortBucketArrays(buckets) {
  const next = { ...buckets };
  for (const key of Object.keys(next)) {
    if (Array.isArray(next[key])) next[key] = sortConceptsInBand(next[key]);
  }
  return next;
}
