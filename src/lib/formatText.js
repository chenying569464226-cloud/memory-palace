/** Clean OCR / pasted text for plain concept storage. */
export function formatOcrText(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");

  const lines = s.split("\n").map((line) => line.replace(/\s+/g, " ").trim());

  const merged = [];
  for (const line of lines) {
    if (!line) {
      if (merged.length && merged[merged.length - 1] !== "") merged.push("");
      continue;
    }
    merged.push(line);
  }

  while (merged[0] === "") merged.shift();
  while (merged[merged.length - 1] === "") merged.pop();

  s = merged.join("\n");

  // Remove spaces inserted between consecutive CJK characters.
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2");
    if (next === s) break;
    s = next;
  }

  return s.trim();
}

/** Merge broken OCR lines into full paragraphs for the concept field. */
export function formatConceptFill(raw) {
  const base = formatOcrText(raw);
  if (!base) return "";
  return base
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, ""))
    .filter(Boolean)
    .join("\n");
}
