export function conceptDisplayTitle(item) {
  const title = (item.title || "").trim();
  if (title) return title;
  const line = (item.text || "").trim().split("\n")[0];
  return line.slice(0, 80) || "（无标题）";
}
