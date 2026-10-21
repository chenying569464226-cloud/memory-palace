import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONSOLIDATION,
  CURVE,
  forgetPurgeLeft,
  formatAge,
  isForgotten,
  nextPoint,
  retentionAt,
  stageOf,
} from "./lib/curve.js";
import { CONS_LABEL, CURVE_LABEL, STR } from "./lib/i18n.js";
import {
  bookPageAnswer,
  composeBookDocument,
  parseBookDocument,
} from "./lib/bookDoc.js";
import { conceptDisplayTitle } from "./lib/concept.js";
import { exportBookFiles } from "./lib/export.js";
import { exportBookToWord } from "./lib/exportWord.js";
import BookMarkupView from "./components/BookMarkupView.jsx";
import { markupToPlainText, parseBookMarkup } from "./lib/bookMarkup.js";
import {
  readerSpeechSupported,
  speakReaderText,
  stopReaderSpeech,
} from "./lib/readerTts.js";
import { categoryLabel, newCategory, renameCategory } from "./lib/skills.js";
import ConceptImageOcr from "./components/ConceptImageOcr.jsx";
import { formatConceptFill } from "./lib/formatText.js";
import {
  CONCEPT_TAB_BAND_IDS,
  REVIEW_STAGE_IDS,
  conceptTabBandId,
  isPalacePageConcept,
} from "./lib/stages.js";
import { REVIEW_SAMPLE_ID, dismissReviewSampleFlag } from "./lib/reviewSample.js";
import { downloadBackup, importBackupFromFile } from "./lib/backup.js";
import { loadState, newConcept, purgeForgotten, saveState } from "./lib/store.js";

const ADD_CATEGORY = "__add_category__";

function useNow(tickMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, [tickMs]);
  return [now, setNow];
}

function Bar({ value, t }) {
  const remembered = Math.max(0, Math.min(100, value));
  const forgotten = 100 - remembered;
  return (
    <div className="bar-stack">
      <div
        className="bar"
        aria-label={`${t.retain(remembered.toFixed(0))}，${t.forgetRate(forgotten.toFixed(0))}`}
      >
        <span className="bar-ok" style={{ width: `${remembered}%` }} />
        <span className="bar-lost" style={{ width: `${forgotten}%` }} />
      </div>
      <div className="bar-legend">
        <span className="bar-legend-ok">{t.retain(remembered.toFixed(0))}</span>
        <span className="bar-legend-lost">{t.forgetRate(forgotten.toFixed(0))}</span>
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange, categories, lang, t, onAddCategory, allowEmpty }) {
  return (
    <select
      value={value ?? ""}
      aria-label={t.assignSkill}
      onChange={(e) => {
        const next = e.target.value;
        if (next === ADD_CATEGORY) {
          const name = window.prompt(t.newCategoryPrompt);
          if (name?.trim()) onAddCategory(name.trim());
          return;
        }
        onChange(next === "" ? null : next);
      }}
    >
      {allowEmpty && <option value="">{t.uncategorized}</option>}
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {categoryLabel(categories, c.id, lang)}
        </option>
      ))}
      <option value={ADD_CATEGORY}>{t.addCategoryOption}</option>
    </select>
  );
}

export default function App() {
  const [now, setNowTick] = useNow();
  const [tab, setTab] = useState("home");
  const initial = loadState();
  const [conceptTitle, setConceptTitle] = useState("");
  const [text, setText] = useState("");
  const [concepts, setConcepts] = useState(initial.concepts);
  const [categories, setCategories] = useState(initial.categories);
  const [lang, setLang] = useState(initial.lang);
  const [bookId, setBookId] = useState(null);
  const [bookMode, setBookMode] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [conceptFormOpen, setConceptFormOpen] = useState(true);
  const conceptTextRef = useRef(null);
  const hadConceptItemsRef = useRef(false);
  const backupInputRef = useRef(null);
  const storageWarnedRef = useRef(false);
  const t = STR[lang];

  const syncConceptTextareaHeight = useCallback(() => {
    const el = conceptTextRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(88, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    syncConceptTextareaHeight();
  }, [text, syncConceptTextareaHeight]);

  useEffect(() => {
    const ok = saveState({ concepts, categories, lang });
    if (!ok && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      window.alert(t.storageFail);
    }
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }, [concepts, categories, lang, t.storageFail]);

  useEffect(() => {
    setConcepts((list) => {
      const next = purgeForgotten(list, now);
      return next.length === list.length ? list : next;
    });
  }, [now]);

  function addCategoryFromInput(name, select) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const book = newCategory(trimmed);
    setCategories((list) => [...list, book]);
    select(book.id);
    return book.id;
  }

  function addConcept(event) {
    event.preventDefault();
    if (!conceptTitle.trim() && !text.trim()) return;
    let concept;
    try {
      concept = newConcept({ title: conceptTitle, text, categoryId: null });
    } catch {
      window.alert(t.saveConceptFail);
      return;
    }
    setConcepts((list) => [concept, ...list]);
    setConceptTitle("");
    setText("");
    setConceptFormOpen(false);
    setNowTick(Date.now());
  }

  function assignConceptCategory(id, categoryId) {
    setConcepts((list) =>
      list.map((item) =>
        item.id === id ? { ...item, categoryId, nodeId: categoryId } : item,
      ),
    );
  }

  function removeReviewSample() {
    dismissReviewSampleFlag();
    setConcepts((list) => {
      const sample = list.find((c) => c.id === REVIEW_SAMPLE_ID);
      if (!sample) return list.filter((c) => c.id !== REVIEW_SAMPLE_ID);
      if (sample.categoryId) {
        const palacePage = {
          ...newConcept({
            title: "",
            text: "",
            answer: bookPageAnswer(sample) || sample.answer,
            categoryId: sample.categoryId,
          }),
          createdAt: sample.createdAt,
          palaceOnly: true,
        };
        return list.filter((c) => c.id !== REVIEW_SAMPLE_ID).concat(palacePage);
      }
      return list.filter((c) => c.id !== REVIEW_SAMPLE_ID);
    });
  }

  function markDone(id, field) {
    setConcepts((list) =>
      list.map((item) => (item.id === id ? { ...item, [field]: Date.now() } : item)),
    );
  }

  function deleteBook(id) {
    if (categories.length <= 1) {
      window.alert(t.needOneCategory);
      return;
    }
    const count = concepts.filter((c) => c.categoryId === id).length;
    const name = categoryLabel(categories, id, lang) ?? "";
    if (!window.confirm(t.confirmDeleteBook(name, count))) return;
    const remaining = categories.filter((c) => c.id !== id);
    setCategories(remaining);
    setConcepts((list) =>
      list.map((item) =>
        item.categoryId === id ? { ...item, categoryId: null, nodeId: null } : item,
      ),
    );
    if (bookId === id) {
      setBookId(null);
      setBookMode(null);
    }
  }

  function saveBookDocument(id, doc, name) {
    if (name.trim()) {
      setCategories((list) =>
        list.map((c) => (c.id === id ? renameCategory(c, name) : c)),
      );
    }
    const parsed = parseBookDocument(doc);
    const existing = concepts
      .filter(
        (item) =>
          item.categoryId === id &&
          isPalacePageConcept(item, now) &&
          !isForgotten(item.createdAt, now),
      )
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
    const removeIds = new Set(existing.slice(parsed.length).map((p) => p.id));
    setConcepts((list) => {
      let next = list.filter((item) => !removeIds.has(item.id));
      parsed.forEach((block, index) => {
        const page = existing[index];
        if (page) {
          next = next.map((item) =>
            item.id === page.id
              ? {
                  ...item,
                  title: "",
                  text: "",
                  answer: block.answer,
                  chapter: block.chapter ?? "",
                }
              : item,
          );
        } else {
          next.push(
            newConcept({
              title: "",
              text: "",
              answer: block.answer,
              chapter: block.chapter ?? "",
              categoryId: id,
            }),
          );
        }
      });
      return next;
    });
  }

  function closeBook() {
    setBookId(null);
    setBookMode(null);
  }

  const live = useMemo(
    () => concepts.filter((item) => !isForgotten(item.createdAt, now)),
    [concepts, now],
  );
  const forgotten = useMemo(
    () => concepts.filter((item) => isForgotten(item.createdAt, now)),
    [concepts, now],
  );

  const groupedConcept = useMemo(() => {
    const buckets = Object.fromEntries(
      CURVE.filter((p) => CONCEPT_TAB_BAND_IDS.has(p.id)).map((p) => [p.id, []]),
    );
    for (const item of live) {
      const band = conceptTabBandId(item.createdAt, now);
      if (band) buckets[band]?.push(item);
    }
    return buckets;
  }, [live, now]);

  const groupedReview = useMemo(() => {
    const buckets = Object.fromEntries(
      CURVE.filter((p) => REVIEW_STAGE_IDS.has(p.id)).map((p) => [p.id, []]),
    );
    for (const item of live) {
      if (item.palaceOnly) continue;
      const stage = stageOf(item.createdAt, now);
      if (REVIEW_STAGE_IDS.has(stage.id)) buckets[stage.id]?.push(item);
    }
    return buckets;
  }, [live, now]);

  const due = live.filter((item) => {
    if (item.palaceOnly) return false;
    const stage = stageOf(item.createdAt, now);
    if (!REVIEW_STAGE_IDS.has(stage.id)) return false;
    if (item.monthDoneAt) return false;
    return CONSOLIDATION.some((c) => now - item.createdAt >= c.afterMs && !item[c.field]);
  });

  const conceptTabLive = useMemo(
    () =>
      live.filter(
        (item) => !item.palaceOnly && conceptTabBandId(item.createdAt, now) != null,
      ),
    [live, now],
  );

  const hasConceptItems = conceptTabLive.length > 0;

  const hasGroupedConceptVisible = useMemo(
    () => CURVE.some((p) => CONCEPT_TAB_BAND_IDS.has(p.id) && groupedConcept[p.id]?.length),
    [groupedConcept],
  );

  const conceptFormExpanded = !hasConceptItems || conceptFormOpen;

  useEffect(() => {
    if (!hasConceptItems) {
      setConceptFormOpen(true);
      hadConceptItemsRef.current = false;
      return;
    }
    if (!hadConceptItemsRef.current) setConceptFormOpen(false);
    hadConceptItemsRef.current = true;
  }, [hasConceptItems]);

  const hasReviewItems = useMemo(
    () =>
      CURVE.some((p) => REVIEW_STAGE_IDS.has(p.id) && groupedReview[p.id]?.length) ||
      forgotten.length > 0,
    [groupedReview, forgotten.length],
  );

  const openBook = categories.find((c) => c.id === bookId) ?? null;
  const pages = useMemo(() => {
    if (!bookId) return [];
    return live
      .filter((item) => item.categoryId === bookId && isPalacePageConcept(item, now))
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [live, bookId, now]);

  function pagesForBook(id) {
    return live
      .filter((item) => item.categoryId === id && isPalacePageConcept(item, now))
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function exportBook(id) {
    const book = categories.find((c) => c.id === id);
    if (!book) return;
    exportBookFiles({ book, pages: pagesForBook(id), lang, categories });
  }

  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages.length, pageIndex]);

  const palaceBookOpen = tab === "palace" && Boolean(bookId);
  const immersiveRead = palaceBookOpen && bookMode === "read" && openBook;
  const immersiveEdit = palaceBookOpen && bookMode === "edit" && openBook;
  const bookFocus = immersiveRead || immersiveEdit;
  const hideAppChrome = palaceBookOpen;

  function exportAppBackup() {
    try {
      downloadBackup();
    } catch (e) {
      if (e?.message === "no_state") window.alert(t.backupExportFail);
      else window.alert(t.backupExportFail);
    }
  }

  async function onBackupFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await importBackupFromFile(file);
      window.alert(t.backupImportOk);
      window.location.reload();
    } catch {
      window.alert(t.backupImportFail);
    }
  }

  function toggleConceptFormFab() {
    closeBook();
    const formShowing = !hasConceptItems || conceptFormOpen;
    if (tab === "home" && formShowing && hasConceptItems) {
      setConceptFormOpen(false);
      return;
    }
    setTab("home");
    setConceptFormOpen(true);
  }

  const conceptFabActive = tab === "home" && conceptFormExpanded;

  return (
    <div className={`app ${bookFocus ? "app-immersive" : ""}`}>
      {tab === "home" && !bookId && (
        <>
          {conceptFormExpanded && (
            <form className="card concept-form" onSubmit={addConcept}>
              <input
                value={conceptTitle}
                onChange={(e) => setConceptTitle(e.target.value)}
                placeholder={t.conceptTitlePh}
              />
              <div className="concept-text-block">
                <textarea
                  ref={conceptTextRef}
                  className="concept-textarea"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    syncConceptTextareaHeight();
                  }}
                  placeholder={t.placeholder}
                />
                <ConceptImageOcr
                  t={t}
                  onApply={(ocrText) => {
                    const filled = formatConceptFill(ocrText);
                    setText(filled);
                    setConceptFormOpen(true);
                    if (!conceptTitle.trim()) {
                      const head = filled.split("\n")[0]?.slice(0, 80) ?? "";
                      if (head) setConceptTitle(head);
                    }
                    requestAnimationFrame(syncConceptTextareaHeight);
                  }}
                />
              </div>
              <button className="primary" type="submit" style={{ marginTop: 8 }}>
                {t.startTimer}
              </button>
            </form>
          )}

          {!hasConceptItems && <div className="empty">{t.emptyConcepts}</div>}

          {CURVE.filter((p) => CONCEPT_TAB_BAND_IDS.has(p.id)).map((point) => {
            const items = groupedConcept[point.id];
            if (!items?.length) return null;
            const label = CURVE_LABEL[point.id][lang];
            return (
              <section className="group" key={point.id}>
                <h2 className="group-title">{label}</h2>
                <p className="tiny group-curve-hint">{t.stageRetainHint(point.retain)}</p>
                {items.map((item) => (
                  <ConceptCard
                    key={item.id}
                    item={item}
                    now={now}
                    lang={lang}
                    t={t}
                    categories={categories}
                    compact
                  />
                ))}
              </section>
            );
          })}

          {hasConceptItems && !hasGroupedConceptVisible && (
            <section className="group">
              {conceptTabLive.map((item) => (
                <ConceptCard
                  key={item.id}
                  item={item}
                  now={now}
                  lang={lang}
                  t={t}
                  categories={categories}
                  compact
                />
              ))}
            </section>
          )}
        </>
      )}

      {tab === "review" && !bookId && (
        <>
          {live.some((c) => c.isSample) && (
            <p className="tiny review-sample-note">{t.reviewSampleNote}</p>
          )}

          {!hasReviewItems && <div className="empty">{t.emptyReview}</div>}

          {CURVE.filter((p) => REVIEW_STAGE_IDS.has(p.id)).map((point) => {
            const items = groupedReview[point.id];
            if (!items?.length) return null;
            const label = CURVE_LABEL[point.id][lang];
            return (
              <section className="group" key={point.id}>
                <h2>{t.stageBand(label, point.retain)}</h2>
                {items.map((item) => (
                  <ConceptCard
                    key={item.id}
                    item={item}
                    now={now}
                    lang={lang}
                    t={t}
                    categories={categories}
                    showConsolidation
                    showCategory
                    onDone={markDone}
                    onCategoryChange={assignConceptCategory}
                    onAddCategory={(name) => {
                      const newId = addCategoryFromInput(name);
                      if (newId) assignConceptCategory(item.id, newId);
                    }}
                    onRemoveSample={item.isSample ? removeReviewSample : undefined}
                  />
                ))}
              </section>
            );
          })}

          <section className="group">
            <h2>{t.forgotten}</h2>
            <p className="tiny">{t.forgottenHint}</p>
            {forgotten.length === 0 ? (
              <div className="empty">{t.emptyForgotten}</div>
            ) : (
              forgotten.map((item) => (
                <ForgottenCard
                  key={item.id}
                  item={item}
                  now={now}
                  lang={lang}
                  t={t}
                  categories={categories}
                  onCategoryChange={assignConceptCategory}
                  onAddCategory={(name) => {
                    const newId = addCategoryFromInput(name);
                    if (newId) assignConceptCategory(item.id, newId);
                  }}
                />
              ))
            )}
          </section>
        </>
      )}

      {tab === "palace" && !bookId && (
        <MemoryPalace
          concepts={live}
          now={now}
          categories={categories}
          lang={lang}
          t={t}
          onAddBook={(name) => {
            const book = newCategory(name);
            setCategories((list) => [...list, book]);
          }}
          onOpen={(id) => {
            setBookId(id);
            setBookMode("read");
            setPageIndex(0);
          }}
          onDeleteBook={deleteBook}
        />
      )}

      {tab === "palace" && bookId && bookMode === "read" && openBook && (
        <BookReader
          t={t}
          lang={lang}
          book={openBook}
          pages={pages}
          pageIndex={pageIndex}
          onClose={closeBook}
          onEnterEdit={() => setBookMode("edit")}
          onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
          onNext={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
        />
      )}

      {tab === "palace" && bookId && bookMode === "edit" && openBook && (
        <BookWordEditor
          t={t}
          lang={lang}
          book={openBook}
          pages={pages}
          onClose={closeBook}
          onSave={(doc, name) => saveBookDocument(openBook.id, doc, name)}
        />
      )}

      {tab === "settings" && (
        <section className="card">
          <div className="subject">{t.language}</div>
          <div className="lang-row">
            <button className={lang === "zh" ? "primary" : "ghost"} type="button" onClick={() => setLang("zh")}>
              {t.langZh}
            </button>
            <button className={lang === "en" ? "primary" : "ghost"} type="button" onClick={() => setLang("en")}>
              {t.langEn}
            </button>
          </div>
          <div className="subject" style={{ marginTop: 16 }}>
            {t.autoTitle}
          </div>
          <p className="sub">{t.autoBody}</p>
          <p className="sub">{t.autoRam}</p>
          <div className="subject" style={{ marginTop: 16 }}>
            {t.backupTitle}
          </div>
          <p className="sub">{t.backupBody}</p>
          <div className="lang-row backup-row">
            <button className="primary" type="button" onClick={exportAppBackup}>
              {t.backupExport}
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => backupInputRef.current?.click()}
            >
              {t.backupImport}
            </button>
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={onBackupFileSelected}
            />
          </div>
        </section>
      )}

      {!hideAppChrome && (
        <nav className="tabs tabs-with-fab">
          <button
            className={tab === "home" ? "on" : ""}
            onClick={() => {
              setTab("home");
              closeBook();
            }}
          >
            {t.tabHome}
          </button>
          <button
            className={tab === "review" ? "on" : ""}
            onClick={() => {
              setTab("review");
              closeBook();
            }}
          >
            {t.tabReview}
            {due.length ? ` (${due.length})` : ""}
          </button>
          <button
            className={`tab-fab ${conceptFabActive ? "tab-fab-on" : ""}`}
            type="button"
            aria-label={conceptFabActive ? t.conceptFormCollapse : t.conceptFormExpand}
            title={conceptFabActive ? t.conceptFormCollapse : t.conceptFormExpand}
            aria-expanded={conceptFabActive}
            onClick={toggleConceptFormFab}
          >
            +
          </button>
          <button
            className={tab === "palace" ? "on" : ""}
            onClick={() => {
              setTab("palace");
              closeBook();
            }}
          >
            {t.tabPalace}
          </button>
          <button
            className={tab === "settings" ? "on" : ""}
            onClick={() => {
              setTab("settings");
              closeBook();
            }}
          >
            {t.tabSettings}
          </button>
        </nav>
      )}
    </div>
  );
}

function conceptHasReveal(item) {
  const text = (item.text || "").trim();
  const answer = (item.answer || "").trim();
  const title = (item.title || "").trim();
  return Boolean(answer || text || title);
}

function ConceptRevealToggle({ item, t, open, onToggle }) {
  if (!conceptHasReveal(item)) return null;
  return (
    <button className="ghost reveal-btn" type="button" onClick={onToggle}>
      {open ? t.hideAnswer : t.showAnswer}
    </button>
  );
}

function ConceptRevealBody({ item, t, open }) {
  if (!open) return null;
  const text = (item.text || "").trim();
  const answer = (item.answer || "").trim();
  const title = (item.title || "").trim();
  const showText = text && text !== title;
  return (
    <div className="reveal-body">
      {showText ? (
        <p className="page-body">{text}</p>
      ) : (
        !answer && text && <p className="page-body">{text}</p>
      )}
      {answer && (
        <p className="page-body">
          <span className="tiny">{t.answer}：</span>
          {answer}
        </p>
      )}
    </div>
  );
}

function ConceptCard({
  item,
  now,
  lang,
  t,
  categories,
  showConsolidation = false,
  showCategory = false,
  onDone,
  onCategoryChange,
  onAddCategory,
  onRemoveSample,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const retain = retentionAt(item.createdAt, now);
  const stage = stageOf(item.createdAt, now);
  const next = nextPoint(item.createdAt, now);
  const age = Math.max(0, now - item.createdAt);
  const stageLabel = CURVE_LABEL[stage.id][lang];
  const palaceName = categoryLabel(categories, item.categoryId, lang);

  if (item.isSample) {
    return (
      <article className="card card-sample">
        <div className="row">
          <strong>{conceptDisplayTitle(item)}</strong>
          <span className="row" style={{ gap: 6 }}>
            <span className="sample-badge">{t.reviewSampleBadge}</span>
            <ConceptRevealToggle item={item} t={t} open={open} onToggle={() => setOpen((v) => !v)} />
          </span>
        </div>
        <ConceptRevealBody item={item} t={t} open={open} />
        {item.categoryId && palaceName ? (
          <>
            <p className="tiny sample-in-palace">{t.sampleInPalace(palaceName)}</p>
            {onRemoveSample && (
              <button className="primary sample-remove" type="button" onClick={onRemoveSample}>
                {t.removeSample}
              </button>
            )}
          </>
        ) : (
          showCategory &&
          onCategoryChange && (
            <div className="row category-row">
              <label className="tiny">{t.assignSkill}</label>
              <CategorySelect
                allowEmpty
                value={item.categoryId}
                lang={lang}
                categories={categories}
                t={t}
                onAddCategory={onAddCategory}
                onChange={(id) => onCategoryChange(item.id, id)}
              />
            </div>
          )
        )}
      </article>
    );
  }

  return (
    <article className="card">
      <div className="row">
        <strong>{conceptDisplayTitle(item)}</strong>
        <ConceptRevealToggle item={item} t={t} open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
      <ConceptRevealBody item={item} t={t} open={open} />
      {showCategory && onCategoryChange && (
        <div className="row category-row">
          <label className="tiny">{t.assignSkill}</label>
          <CategorySelect
            allowEmpty
            value={item.categoryId}
            lang={lang}
            categories={categories}
            t={t}
            onAddCategory={onAddCategory}
            onChange={(id) => onCategoryChange(item.id, id)}
          />
        </div>
      )}
      <div className="meta">{t.elapsed(formatAge(age, lang))}</div>
      <Bar value={retain} t={t} />
      {!compact && (
        <>
          <div className="row meta">
            <span>{t.retain(retain.toFixed(1))}</span>
            <span>
              {t.currentStage(stageLabel)}
              {next && next.id !== "31d"
                ? t.nextStage(CURVE_LABEL[next.id][lang], next.retain)
                : t.lastStage}
            </span>
          </div>
          {CURVE.filter((p) => p.afterMs > 0).map((p) => (
            <div className="tiny" key={p.id}>
              {CURVE_LABEL[p.id][lang]}：{p.retain}% {age >= p.afterMs ? t.reached : t.notYet}
            </div>
          ))}
        </>
      )}
      {showConsolidation &&
        CONSOLIDATION.map((c) => {
          const ready = age >= c.afterMs;
          const done = Boolean(item[c.field]);
          const status = done ? t.done : ready ? t.ready : t.waiting;
          return (
            <div className="row" key={c.id} style={{ marginTop: 8 }}>
              <span className={done ? "ok" : ready ? "warn" : "meta"}>
                {CONS_LABEL[c.id][lang]} · {status}
              </span>
              {!done && ready && onDone && (
                <button className="ghost" type="button" onClick={() => onDone(item.id, c.field)}>
                  {t.consolidateOk}
                </button>
              )}
            </div>
          );
        })}
    </article>
  );
}

function ForgottenCard({ item, now, lang, t, categories, onCategoryChange, onAddCategory }) {
  const [open, setOpen] = useState(false);
  const left = forgetPurgeLeft(item.createdAt, now);
  return (
    <article className="card">
      <div className="row">
        <strong>{conceptDisplayTitle(item)}</strong>
        <ConceptRevealToggle item={item} t={t} open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
      <ConceptRevealBody item={item} t={t} open={open} />
      {onCategoryChange && (
        <div className="row category-row">
          <label className="tiny">{t.assignSkill}</label>
          <CategorySelect
            allowEmpty
            value={item.categoryId}
            lang={lang}
            categories={categories}
            t={t}
            onAddCategory={onAddCategory}
            onChange={(id) => onCategoryChange(item.id, id)}
          />
        </div>
      )}
      <div className="meta">{t.purgeIn(formatAge(left, lang))}</div>
      <Bar value={21} t={t} />
    </article>
  );
}

function SwipeBookRow({ t, onDelete, children }) {
  const [x, setX] = useState(0);
  const xRef = useRef(0);
  const start = useRef(null);
  const open = 88;

  function slideTo(next) {
    xRef.current = next;
    setX(next);
  }

  return (
    <div className="swipe">
      <div className="swipe-actions one">
        <button className="act del" type="button" onClick={onDelete}>
          {t.del}
        </button>
      </div>
      <div
        className="swipe-front book-swipe-front"
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          if (e.target.closest("button")) return;
          start.current = { x: e.clientX, from: xRef.current };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const dx = e.clientX - start.current.x + start.current.from;
          slideTo(Math.min(0, Math.max(-open, dx)));
        }}
        onPointerUp={() => {
          if (!start.current) return;
          slideTo(xRef.current < -open / 2 ? -open : 0);
          start.current = null;
        }}
        onPointerCancel={() => {
          if (!start.current) return;
          slideTo(xRef.current < -open / 2 ? -open : 0);
          start.current = null;
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MemoryPalace({ concepts, now, categories, lang, t, onAddBook, onOpen, onDeleteBook }) {
  const ranked = useMemo(() => {
    return categories
      .map((book) => {
        const pages = concepts.filter(
          (c) => c.categoryId === book.id && isPalacePageConcept(c, now),
        );
        const withAnswer = pages.filter((c) => (c.answer || "").trim()).length;
        return { book, pages: pages.length, withAnswer };
      })
      .sort((a, b) => b.pages - a.pages);
  }, [categories, concepts, now]);

  function promptAddBook() {
    const name = window.prompt(t.bookPh);
    if (name?.trim()) onAddBook(name.trim());
  }

  return (
    <div className="tree">
      {ranked.map(({ book, pages, withAnswer }) => (
        <SwipeBookRow key={book.id} t={t} onDelete={() => onDeleteBook(book.id)}>
          <article className="card book-row">
            <div className="row book-head">
              <button className="book-open-inline" type="button" onClick={() => onOpen(book.id)}>
                <div className="subject">{categoryLabel(categories, book.id, lang)}</div>
                <div className="n">{t.bookStats(pages, withAnswer)}</div>
              </button>
            </div>
            <div className="tiny book-tap-hint">{t.openBook}</div>
          </article>
        </SwipeBookRow>
      ))}
      <button
        className="palace-add-book"
        type="button"
        onClick={promptAddBook}
        aria-label={t.addBook}
        title={t.addBook}
      >
        +
      </button>
    </div>
  );
}

const BOOK_EDITOR_FONT_KEY = "memory-palace-book-editor-font";
const BOOK_FONT_MIN = 14;
const BOOK_FONT_MAX = 26;
const BOOK_FONT_DEFAULT = 17;

function loadBookEditorFontSize() {
  const n = Number(localStorage.getItem(BOOK_EDITOR_FONT_KEY));
  if (Number.isFinite(n) && n >= BOOK_FONT_MIN && n <= BOOK_FONT_MAX) return n;
  return BOOK_FONT_DEFAULT;
}

function BookWordEditor({ t, lang, book, pages, onClose, onSave }) {
  const bookTitle =
    typeof book.name === "string" ? book.name : book.name[lang] ?? book.name.zh ?? "";
  const [name, setName] = useState(bookTitle);
  const [doc, setDoc] = useState(() => composeBookDocument(pages));
  const [exitPrompt, setExitPrompt] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [fontSize, setFontSize] = useState(loadBookEditorFontSize);
  const docRef = useRef(null);

  const savedDoc = useMemo(() => composeBookDocument(pages), [pages]);
  const dirty = doc !== savedDoc || name.trim() !== bookTitle.trim();

  useEffect(() => {
    setName(bookTitle);
    setDoc(composeBookDocument(pages));
  }, [book.id, bookTitle, pages]);

  useEffect(() => {
    localStorage.setItem(BOOK_EDITOR_FONT_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (!ctxMenu) return undefined;
    function dismiss() {
      setCtxMenu(null);
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [ctxMenu]);

  function persistAndClose() {
    onSave(doc, name);
    setExitPrompt(false);
    onClose();
  }

  function requestClose() {
    if (!dirty) {
      onClose();
      return;
    }
    setExitPrompt(true);
  }

  function insertSnippet(snippet) {
    const el = docRef.current;
    if (el) {
      const start = el.selectionStart ?? doc.length;
      const end = el.selectionEnd ?? start;
      const next = doc.slice(0, start) + snippet + doc.slice(end);
      setDoc(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    setDoc(doc ? `${doc}\n\n---\n\n${snippet}` : snippet);
  }

  function openContextMenu(clientX, clientY) {
    const pad = 8;
    const menuW = 220;
    const menuH = 200;
    const x = Math.min(clientX, window.innerWidth - menuW - pad);
    const y = Math.min(clientY, window.innerHeight - menuH - pad);
    setCtxMenu({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }

  function onEditorContextMenu(e) {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY);
  }

  function menuInsertChapter() {
    insertSnippet(`# ${t.newChapterDefault}\n\n`);
    setCtxMenu(null);
  }

  function menuInsertSection() {
    insertSnippet(`## ${t.newSectionDefault}\n\n`);
    setCtxMenu(null);
  }

  return (
    <section className="book-editor-wrap">
      <div className="book-doc-frame" onContextMenu={onEditorContextMenu}>
        <div className="book-doc-toolbar">
          <div className="book-doc-toolbar-start">
            <button className="primary book-doc-tool" type="button" onClick={() => onSave(doc, name)}>
              {t.save}
            </button>
            <span className="book-font-badge" aria-live="polite">
              {fontSize}px
            </span>
          </div>
          <button
            className="icon-close-btn book-doc-close"
            type="button"
            onClick={requestClose}
            aria-label={t.backToList}
            title={t.backToList}
          >
            ×
          </button>
        </div>
        <label className="book-doc-label">{t.categoryName}</label>
        <input
          className="book-doc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.bookPh}
        />
        <p className="tiny book-doc-hint">{t.bookDocHint}</p>
        <textarea
          ref={docRef}
          className="doc-editor"
          style={{ fontSize: `${fontSize}px` }}
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          onContextMenu={onEditorContextMenu}
        />
      </div>

      {ctxMenu && (
        <div
          className="book-ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="book-ctx-title">{t.editorMenuInsert}</div>
          <button className="book-ctx-item" type="button" role="menuitem" onClick={menuInsertChapter}>
            {t.insertChapter}
          </button>
          <button className="book-ctx-item" type="button" role="menuitem" onClick={menuInsertSection}>
            {t.insertSection}
          </button>
          <div className="book-ctx-divider" />
          <div className="book-ctx-title">{t.editorFontSize}</div>
          <div className="book-ctx-font-row">
            <button
              className="book-ctx-item"
              type="button"
              disabled={fontSize <= BOOK_FONT_MIN}
              onClick={() => setFontSize((n) => Math.max(BOOK_FONT_MIN, n - 1))}
            >
              {t.editorFontSmaller}
            </button>
            <span className="book-ctx-font-val">{fontSize}px</span>
            <button
              className="book-ctx-item"
              type="button"
              disabled={fontSize >= BOOK_FONT_MAX}
              onClick={() => setFontSize((n) => Math.min(BOOK_FONT_MAX, n + 1))}
            >
              {t.editorFontLarger}
            </button>
          </div>
          <button
            className="book-ctx-item ghost"
            type="button"
            onClick={() => setFontSize(BOOK_FONT_DEFAULT)}
          >
            {t.editorFontReset}
          </button>
        </div>
      )}

      {exitPrompt && (
        <div className="book-exit-backdrop" role="dialog" aria-modal="true" aria-label={t.saveBeforeLeave}>
          <div className="book-exit-sheet card">
            <p className="subject">{t.saveBeforeLeave}</p>
            <p className="tiny">{t.saveBeforeLeaveHint}</p>
            <div className="book-exit-actions">
              <button className="primary" type="button" onClick={persistAndClose}>
                {t.saveAndLeave}
              </button>
              <button className="ghost" type="button" onClick={() => {
                setExitPrompt(false);
                onClose();
              }}>
                {t.leaveWithoutSave}
              </button>
              <button className="ghost" type="button" onClick={() => setExitPrompt(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function BookReader({
  t,
  lang,
  book,
  pages,
  pageIndex,
  onClose,
  onEnterEdit,
  onPrev,
  onNext,
}) {
  const page = pages[pageIndex];
  const bookTitle = typeof book.name === "string" ? book.name : book.name[lang] ?? book.name.zh;
  const touchStart = useRef(null);
  const pageToastTimer = useRef(null);
  const pageIndexBoot = useRef(true);
  const [speaking, setSpeaking] = useState(false);
  const [pageToast, setPageToast] = useState(null);

  const bodyRaw = page ? bookPageAnswer(page) : "";
  const speechBlocks = useMemo(
    () => (bodyRaw ? parseBookMarkup(bodyRaw, lang) : []),
    [bodyRaw, lang],
  );

  useEffect(() => {
    stopReaderSpeech();
    setSpeaking(false);
  }, [pageIndex]);

  useEffect(() => {
    return () => {
      stopReaderSpeech();
      clearTimeout(pageToastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (pageIndexBoot.current) {
      pageIndexBoot.current = false;
      return;
    }
    setPageToast(t.pageOf(pageIndex + 1, pages.length));
    clearTimeout(pageToastTimer.current);
    pageToastTimer.current = setTimeout(() => setPageToast(null), 1500);
  }, [pageIndex, pages.length, t]);

  function onTouchStart(e) {
    if (e.target.closest("button, textarea, input, a")) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }

  function onTouchEnd(e) {
    if (!touchStart.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    touchStart.current = null;
    if (dt > 600) return;
    if (Math.abs(dx) < 48) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.35) return;
    if (dx < 0) {
      if (pageIndex < pages.length - 1) onNext();
    } else if (pageIndex > 0) onPrev();
  }

  function toggleSpeech() {
    if (!readerSpeechSupported()) {
      window.alert(t.readerNoTts);
      return;
    }
    if (speaking) {
      stopReaderSpeech();
      setSpeaking(false);
      return;
    }
    const ok = speakReaderText(markupToPlainText(speechBlocks), lang, {
      onEnd: () => setSpeaking(false),
    });
    if (!ok) {
      window.alert(t.readerNoTts);
      return;
    }
    setSpeaking(true);
    window.speechSynthesis.getVoices();
  }

  async function exportWord() {
    try {
      await exportBookToWord({ pages, bookTitle, lang });
    } catch {
      window.alert(t.exportWordFail);
    }
  }

  return (
    <section
      className="reader-immersive"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="reader-topbar">
        <h2 className="reader-book-name">{bookTitle}</h2>
        <div className="reader-topbar-actions">
          <button
            className={`reader-icon-btn ${speaking ? "on" : ""}`}
            type="button"
            onClick={toggleSpeech}
            aria-label={speaking ? t.readerStop : t.readerSpeak}
            title={speaking ? t.readerStop : t.readerSpeak}
          >
            {speaking ? "■" : "▶"}
          </button>
          <button className="reader-export" type="button" onClick={onEnterEdit}>
            {t.editBook}
          </button>
          <button className="reader-export" type="button" onClick={exportWord}>
            {t.exportWord}
          </button>
          <button
            className="icon-close-btn reader-close"
            type="button"
            onClick={() => {
              stopReaderSpeech();
              onClose();
            }}
            aria-label={t.closeBook}
            title={t.closeBook}
          >
            ×
          </button>
        </div>
      </header>

      {pages.length === 0 || !page ? (
        <div className="empty">{t.bookEmpty}</div>
      ) : (
        <div className="reader-swipe-surface">
          <article className="reader-article">
            <BookMarkupView text={bodyRaw} lang={lang} emptyLabel={t.bookEmptyPage} />
          </article>
        </div>
      )}

      {pageToast && <div className="reader-page-toast" aria-live="polite">{pageToast}</div>}
    </section>
  );
}
