import { formatEnglishReaderText } from "./readerText.js";

/**
 * Parse page text: # → h1, ## → h2, blank line → paragraph break.
 * @returns {{ type: "h1" | "h2" | "p", text: string }[]}
 */
export function parseBookMarkup(rawText, lang = "zh") {
  const blocks = parseBlocks(rawText);
  return blocks.map((block) => {
    if (block.type !== "p" || lang !== "en") return block;
    return { ...block, text: formatEnglishReaderText(block.text) };
  });
}

function parseBlocks(rawText) {
  if (!rawText?.trim()) return [];
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paraLines = [];

  function flushPara() {
    const text = paraLines.join("\n").trim();
    if (text) blocks.push({ type: "p", text });
    paraLines = [];
  }

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h2) {
      flushPara();
      blocks.push({ type: "h2", text: h2[1].trim() });
      continue;
    }
    if (h1) {
      flushPara();
      blocks.push({ type: "h1", text: h1[1].trim() });
      continue;
    }
    if (line.trim() === "") flushPara();
    else paraLines.push(line);
  }
  flushPara();
  return blocks;
}

export function markupToPlainText(blocks) {
  return blocks.map((b) => b.text).join("\n\n");
}
