import { createId } from "./id.js";

export const SUBJECTS = [
  {
    id: "chinese",
    name: { zh: "语文", en: "Chinese" },
    nodes: [
      { id: "cn-words", name: { zh: "字词", en: "Words" }, keys: ["字", "词", "拼音", "成语", "汉字", "vocab chinese", "character"] },
      { id: "cn-read", name: { zh: "阅读", en: "Reading" }, keys: ["阅读", "课文", "段落", "中心思想", "reading chinese", "passage"] },
      { id: "cn-write", name: { zh: "写作", en: "Writing" }, keys: ["作文", "写作", "记叙", "议论文", "essay", "writing"] },
      { id: "cn-classic", name: { zh: "古文", en: "Classics" }, keys: ["古文", "文言文", "诗词", "唐诗", "宋词", "classical", "poem"] },
    ],
  },
  {
    id: "math",
    name: { zh: "数学", en: "Math" },
    nodes: [
      { id: "ma-algebra", name: { zh: "代数", en: "Algebra" }, keys: ["代数", "方程", "不等式", "多项式", "algebra", "equation"] },
      { id: "ma-geo", name: { zh: "几何", en: "Geometry" }, keys: ["几何", "三角形", "圆", "相似", "勾股", "geometry", "triangle", "circle"] },
      { id: "ma-fn", name: { zh: "函数", en: "Functions" }, keys: ["函数", "一次", "二次", "导数", "function", "parabola"] },
      { id: "ma-stat", name: { zh: "统计", en: "Statistics" }, keys: ["统计", "概率", "平均数", "方差", "probability", "statistics", "mean"] },
    ],
  },
  {
    id: "english",
    name: { zh: "英语", en: "English" },
    nodes: [
      { id: "en-vocab", name: { zh: "词汇", en: "Vocabulary" }, keys: ["单词", "词汇", "词组", "vocabulary", "word", "phrase"] },
      { id: "en-grammar", name: { zh: "语法", en: "Grammar" }, keys: ["语法", "时态", "从句", "grammar", "tense", "clause"] },
      { id: "en-listen", name: { zh: "听力", en: "Listening" }, keys: ["听力", "听写", "listening", "audio"] },
      { id: "en-read", name: { zh: "阅读", en: "Reading" }, keys: ["英语阅读", "完形", "阅读理解", "comprehension", "reading"] },
    ],
  },
  {
    id: "physics",
    name: { zh: "物理", en: "Physics" },
    nodes: [
      { id: "ph-mech", name: { zh: "力学", en: "Mechanics" }, keys: ["力", "牛顿", "加速度", "速度", "惯性", "力学", "newton", "force", "velocity", "motion"] },
      { id: "ph-elec", name: { zh: "电学", en: "Electricity" }, keys: ["电", "电流", "电压", "电阻", "电路", "ohm", "current", "voltage"] },
      { id: "ph-heat", name: { zh: "热学", en: "Heat" }, keys: ["热", "温度", "内能", "比热", "heat", "temperature", "entropy"] },
      { id: "ph-opt", name: { zh: "光学", en: "Optics" }, keys: ["光", "折射", "反射", "透镜", "optics", "lens", "light"] },
    ],
  },
  {
    id: "chem",
    name: { zh: "化学", en: "Chemistry" },
    nodes: [
      { id: "ch-elem", name: { zh: "元素", en: "Elements" }, keys: ["元素", "周期表", "原子", "element", "atom", "periodic"] },
      { id: "ch-react", name: { zh: "反应", en: "Reactions" }, keys: ["反应", "氧化还原", "酸碱", "反应方程式", "reaction", "acid", "oxide"] },
      { id: "ch-org", name: { zh: "有机", en: "Organic" }, keys: ["有机", "碳", "烃", "醇", "organic", "carbon", "alkane"] },
      { id: "ch-lab", name: { zh: "实验", en: "Lab" }, keys: ["实验", "试管", "滴定", "lab", "experiment", "titration"] },
    ],
  },
  {
    id: "bio",
    name: { zh: "生物", en: "Biology" },
    nodes: [
      { id: "bi-cell", name: { zh: "细胞", en: "Cell" }, keys: ["细胞", "细胞膜", "线粒体", "cell", "mitochondria"] },
      { id: "bi-gene", name: { zh: "遗传", en: "Genetics" }, keys: ["遗传", "基因", "dna", "染色体", "gene", "heredity"] },
      { id: "bi-eco", name: { zh: "生态", en: "Ecology" }, keys: ["生态", "食物链", "种群", "ecology", "ecosystem", "food chain"] },
      { id: "bi-body", name: { zh: "人体", en: "Human body" }, keys: ["人体", "器官", "消化", "血液", "heart", "organ", "body"] },
    ],
  },
];

export function labelOf(item, lang) {
  return item.name[lang] ?? item.name.zh;
}

export function findNode(nodeId) {
  for (const subject of SUBJECTS) {
    const node = subject.nodes.find((item) => item.id === nodeId);
    if (node) return { subject, node };
  }
  return null;
}

export function skillLine(nodeId, lang) {
  const found = findNode(nodeId);
  if (!found) return null;
  return `${labelOf(found.subject, lang)} · ${labelOf(found.node, lang)}`;
}

export function defaultCategories() {
  return SUBJECTS.map((subject) => ({
    id: subject.id,
    name: { ...subject.name },
    builtin: true,
  }));
}

export function categoryLabel(categories, categoryId, lang) {
  const found = categories.find((c) => c.id === categoryId);
  if (!found) return null;
  return typeof found.name === "string" ? found.name : labelOf(found, lang);
}

export function suggestCategoryId(text) {
  const nodeId = suggestNodeId(text);
  return findNode(nodeId)?.subject.id ?? SUBJECTS[0].id;
}

export function newCategory(name) {
  const trimmed = name.trim();
  return {
    id: createId(),
    name: { zh: trimmed, en: trimmed },
    builtin: false,
  };
}

export function renameCategory(category, name) {
  const trimmed = name.trim();
  if (!trimmed) return category;
  return { ...category, name: { zh: trimmed, en: trimmed } };
}

/** Keyword classifier. Extra RAM is negligible. */
export function suggestNodeId(text) {
  const raw = (text || "").toLowerCase();
  if (!raw.trim()) return SUBJECTS[0].nodes[0].id;
  let bestId = SUBJECTS[0].nodes[0].id;
  let best = 0;
  for (const subject of SUBJECTS) {
    for (const node of subject.nodes) {
      let score = 0;
      for (const key of node.keys) {
        if (raw.includes(key.toLowerCase())) score += key.length;
      }
      if (score > best) {
        best = score;
        bestId = node.id;
      }
    }
  }
  return bestId;
}
