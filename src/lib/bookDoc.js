const SEP = "\n\n---\n\n";

/** Memory palace pages store answers only; text/title may exist on legacy items. */
export function bookPageAnswer(page) {
  return (page.answer || "").trim() || (page.text || "").trim();
}

/** @deprecated Chapter headings live in answer text as `#` / `##` lines. */
export function pageChapter(page) {
  return (page.chapter || "").trim();
}

export function composeBookDocument(pages) {
  if (!pages.length) return "";
  return pages
    .map((page) => {
      let answer = bookPageAnswer(page);
      const ch = pageChapter(page);
      if (ch && !/^#\s/m.test(answer)) {
        answer = `# ${ch}\n\n${answer}`.trim();
      }
      return answer;
    })
    .join(SEP);
}

function parseLegacyBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) return "";

  const lines = trimmed.split("\n");
  const first = lines[0].trim();

  if (/^【\d+】/.test(first)) {
    const answerLines = [];
    let inAnswer = false;
    const bodyLines = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("答：")) {
        inAnswer = true;
        answerLines.push(line.slice(2).trim());
      } else if (inAnswer) {
        answerLines.push(line);
      } else {
        bodyLines.push(line);
      }
    }
    if (inAnswer) return answerLines.join("\n").trim();
    const body = bodyLines.join("\n").trim();
    const fromTitle = first.replace(/^【\d+】/, "").trim();
    return body || fromTitle;
  }

  const markerAnswer = [];
  let sawMarker = false;
  for (const line of lines) {
    if (line.startsWith("答：")) {
      sawMarker = true;
      markerAnswer.push(line.slice(2).trim());
    } else if (sawMarker) {
      markerAnswer.push(line);
    }
  }
  if (sawMarker) return markerAnswer.join("\n").trim();

  return trimmed;
}

export function parseBookDocument(doc) {
  return doc
    .split(SEP)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      title: "",
      text: "",
      answer: parseLegacyBlock(block),
      chapter: "",
    }));
}
