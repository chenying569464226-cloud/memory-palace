const GLUED_PHRASES = [
  [/madeupof/gi, "made up of"],
  [/madeof/gi, "made of"],
  [/madeup/gi, "made up"],
  [/upto/gi, "up to"],
  [/inthe/gi, "in the"],
  [/ofthe/gi, "of the"],
  [/andthe/gi, "and the"],
  [/tothe/gi, "to the"],
  [/forthe/gi, "for the"],
  [/withthe/gi, "with the"],
  [/itis/gi, "it is"],
  [/thatis/gi, "that is"],
];

/** Improve English OCR / missing-space text for display and TTS. */
export function formatReaderBody(text, lang) {
  if (!text) return "";
  if (lang !== "en") return text;
  return formatEnglishReaderText(text);
}

export function formatEnglishReaderText(text) {
  let s = text.replace(/\r\n/g, "\n");

  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  s = s.replace(/([A-Za-z])(\d)/g, "$1 $2");
  s = s.replace(/(\d)([A-Za-z])/g, "$1 $2");
  s = s.replace(/([^\s\d])([,;:!?])/g, "$1 $2");
  s = s.replace(/([,.;:!?])([^\s])/g, "$1 $2");
  s = s.replace(/([^\s])([([{])/g, "$1 $2");
  s = s.replace(/([)\]}])([^\s])/g, "$1 $2");

  for (const [pattern, replacement] of GLUED_PHRASES) {
    s = s.replace(pattern, replacement);
  }

  return s.replace(/[ \t]+/g, " ");
}
