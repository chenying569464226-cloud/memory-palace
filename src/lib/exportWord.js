import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { saveAs } from "file-saver";
import { bookPageAnswer } from "./bookDoc.js";
import { parseBookMarkup } from "./bookMarkup.js";

function bodyTextRun(text, lang) {
  const font =
    lang === "en"
      ? { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Times New Roman" }
      : {
          ascii: "Times New Roman",
          eastAsia: "宋体",
          hAnsi: "Times New Roman",
          cs: "Times New Roman",
        };
  return new TextRun({
    text,
    size: 24,
    font,
  });
}

function blocksToDocxChildren(blocks, lang) {
  const children = [];
  for (const block of blocks) {
    if (block.type === "h1") {
      children.push(
        new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 160 },
        }),
      );
      continue;
    }
    if (block.type === "h2") {
      children.push(
        new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
        }),
      );
      continue;
    }
    children.push(
      new Paragraph({
        children: [bodyTextRun(block.text, lang)],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, after: 200 },
      }),
    );
  }
  return children;
}

export async function exportBookToWord({ pages, bookTitle, lang = "zh" }) {
  if (!pages?.length) {
    throw new Error("empty_book");
  }

  const children = [
    new Paragraph({
      text: bookTitle || "遗忘曲线笔记",
      heading: HeadingLevel.TITLE,
      spacing: { after: 280 },
    }),
  ];

  for (const page of pages) {
    const raw = bookPageAnswer(page);
    if (!raw) continue;
    const blocks = parseBookMarkup(raw, lang);
    if (!blocks.length) continue;
    children.push(...blocksToDocxChildren(blocks, lang));
  }

  if (children.length <= 1) {
    throw new Error("empty_book");
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `遗忘曲线笔记_${date}.docx`);
}
