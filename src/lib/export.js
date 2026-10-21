import { bookPageAnswer } from "./bookDoc.js";
import { parseBookMarkup } from "./bookMarkup.js";
import { categoryLabel } from "./skills.js";

function bookTitle(book, lang) {
  if (!book) return "book";
  if (typeof book.name === "string") return book.name;
  return book.name[lang] ?? book.name.zh ?? "book";
}

function safeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "book";
}

export function buildBookExport({ book, pages, lang, categories }) {
  const title = categoryLabel(categories, book.id, lang) ?? bookTitle(book, lang);
  const sorted = [...pages].sort((a, b) => a.createdAt - b.createdAt);
  return {
    title,
    exportedAt: new Date().toISOString(),
    pageCount: sorted.length,
    pages: sorted.map((page, index) => ({
      page: index + 1,
      answer: bookPageAnswer(page),
      createdAt: page.createdAt,
    })),
  };
}

export function bookToMarkdown(exportData) {
  const lines = [`# ${exportData.title}`, "", `导出时间：${exportData.exportedAt}`, ""];
  for (const page of exportData.pages) {
    lines.push(`## 第 ${page.page} 页`, "");
    const blocks = parseBookMarkup(page.answer || "", "zh");
    if (!blocks.length) lines.push("（无）", "");
    else {
      for (const block of blocks) {
        if (block.type === "h1") lines.push(`# ${block.text}`, "");
        else if (block.type === "h2") lines.push(`## ${block.text}`, "");
        else lines.push(block.text, "");
      }
    }
  }
  return lines.join("\n");
}

export function downloadText(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBookFiles({ book, pages, lang, categories }) {
  const data = buildBookExport({ book, pages, lang, categories });
  const base = safeFileName(data.title);
  downloadText(`${base}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  downloadText(`${base}.md`, bookToMarkdown(data), "text/markdown;charset=utf-8");
}
