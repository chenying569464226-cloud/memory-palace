import { useEffect, useRef, useState } from "react";
import { formatConceptFill, formatOcrText } from "../lib/formatText.js";
import ImageCropModal from "./ImageCropModal.jsx";
import { isSupportedImage, recognizeImageBlob } from "../lib/imageOcr.js";

export default function ConceptImageOcr({ t, onApply }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [cropUrl, setCropUrl] = useState(null);
  const inputRef = useRef(null);
  const recognizeLock = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function closeCrop() {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
  }

  function clearImage() {
    closeCrop();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCompressedBlob(null);
    setDraft("");
    setProgress(0);
    setPhase("");
    setError("");
    setPanelOpen(false);
    setBusy(false);
    recognizeLock.current = false;
  }

  function handleFile(file) {
    if (!file) return;
    setError("");
    if (!isSupportedImage(file)) {
      setError(t.ocrUnsupported);
      return;
    }
    closeCrop();
    setCropUrl(URL.createObjectURL(file));
    setDraft("");
    setPanelOpen(false);
  }

  async function handleCropConfirm(blob) {
    setBusy(true);
    setPhase(t.ocrCompressing);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setCompressedBlob(blob);
      closeCrop();
    } catch {
      setError(t.ocrFailed);
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  async function runRecognize() {
    if (!compressedBlob || recognizeLock.current) return;
    recognizeLock.current = true;
    setPanelOpen(true);
    setBusy(true);
    setError("");
    setProgress(0);
    setPhase(t.ocrLoadingLang);
    try {
      const text = await recognizeImageBlob(compressedBlob, (p) => {
        setProgress(Math.round((p.progress ?? 0) * 100));
        setPhase(p.phase === "load" ? t.ocrLoadingLang : t.ocrRecognizing);
      });
      const cleaned = formatOcrText(text);
      if (!cleaned) setError(t.ocrEmpty);
      else setDraft(cleaned);
    } catch (err) {
      console.error("OCR failed:", err);
      setError(t.ocrFailed);
    } finally {
      setBusy(false);
      setPhase("");
      recognizeLock.current = false;
    }
  }

  function applyText() {
    const cleaned = formatConceptFill(draft);
    if (!cleaned) {
      setError(t.ocrEmpty);
      setPanelOpen(true);
      return;
    }
    onApply(cleaned);
    clearImage();
  }

  const hasImage = Boolean(previewUrl && compressedBlob);

  return (
    <div className="concept-ocr-anchor">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="ocr-fab-row">
        {hasImage && (
          <>
            <img className="ocr-thumb" src={previewUrl} alt="" />
            <button className="ghost ocr-fab" type="button" disabled={busy} onClick={runRecognize}>
              {busy ? t.ocrWorking : t.ocrFab}
            </button>
            <button className="ghost ocr-fab ocr-remove" type="button" onClick={clearImage} title={t.ocrRemove}>
              ×
            </button>
          </>
        )}
        {!hasImage && (
          <button
            className="ghost ocr-fab"
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t.ocrCompressing : t.ocrAddImage}
          </button>
        )}
      </div>

      {cropUrl && (
        <ImageCropModal
          imageUrl={cropUrl}
          t={t}
          busy={busy}
          onCancel={closeCrop}
          onConfirm={handleCropConfirm}
        />
      )}

      {error && !panelOpen && !cropUrl && <p className="ocr-error ocr-error-inline">{error}</p>}

      {panelOpen && hasImage && (
        <div className="ocr-panel card">
          <div className="row">
            <span className="subject">{t.ocrTitle}</span>
            <button className="ghost" type="button" onClick={() => setPanelOpen(false)}>
              {t.cancel}
            </button>
          </div>
          <p className="tiny">{t.ocrHint}</p>
          <img className="ocr-preview" src={previewUrl} alt="" />

          {busy && (
            <div className="ocr-progress-wrap">
              <div className="meta">{phase || t.ocrWorking}</div>
              <div className="bar">
                <span className="bar-ok" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="ocr-error">{error}</p>}

          {!busy && (
            <button className="ghost" type="button" onClick={runRecognize}>
              {t.ocrRun}
            </button>
          )}

          <textarea
            className="ocr-result"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.ocrResultPh}
          />
          <button className="primary" type="button" disabled={!draft.trim() || busy} onClick={applyText}>
            {t.ocrApply}
          </button>
        </div>
      )}
    </div>
  );
}
