import { useMemo } from "react";
import { parseBookMarkup } from "../lib/bookMarkup.js";

export default function BookMarkupView({ text, lang, emptyLabel }) {
  const blocks = useMemo(() => parseBookMarkup(text, lang), [text, lang]);

  if (!blocks.length) {
    return <p className="reader-page-body reader-page-body--justify">{emptyLabel}</p>;
  }

  return blocks.map((block, index) => {
    if (block.type === "h1") {
      return (
        <h1 key={`h1-${index}`} className="reader-h1">
          {block.text}
        </h1>
      );
    }
    if (block.type === "h2") {
      return (
        <h2 key={`h2-${index}`} className="reader-h2">
          {block.text}
        </h2>
      );
    }
    return (
      <p key={`p-${index}`} className="reader-page-body reader-page-body--justify">
        {block.text}
      </p>
    );
  });
}
