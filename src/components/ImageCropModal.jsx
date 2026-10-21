import { useEffect, useRef } from "react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { MAX_SIDE, canvasToJpegBlob } from "../lib/imageOcr.js";

const CROPPER_OPTS = {
  viewMode: 1,
  dragMode: "crop",
  aspectRatio: NaN,
  autoCropArea: 0.9,
  responsive: true,
  restore: false,
  guides: true,
  center: true,
  highlight: true,
  cropBoxMovable: true,
  cropBoxResizable: true,
  toggleDragModeOnDblclick: false,
  zoomOnWheel: false,
  zoomOnTouch: true,
  movable: true,
  scalable: true,
  minContainerWidth: 200,
  minContainerHeight: 120,
};

export default function ImageCropModal({ imageUrl, t, busy, onConfirm, onCancel }) {
  const imgRef = useRef(null);
  const cropperRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const el = imgRef.current;
    if (!el || !imageUrl) return undefined;

    let cropper = null;
    const onReady = () => {
      cropper = new Cropper(el, CROPPER_OPTS);
      cropperRef.current = cropper;
    };

    if (el.complete && el.naturalWidth > 0) onReady();
    else el.addEventListener("load", onReady, { once: true });

    return () => {
      el.removeEventListener("load", onReady);
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [imageUrl]);

  async function handleConfirm() {
    const cropper = cropperRef.current;
    if (!cropper || busy) return;
    try {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: MAX_SIDE,
        maxHeight: MAX_SIDE,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });
      if (!canvas) return;
      const blob = await canvasToJpegBlob(canvas);
      await onConfirm(blob);
    } catch {
      /* parent shows error */
    }
  }

  return (
    <div className="ocr-crop-backdrop" role="dialog" aria-modal="true" aria-label={t.ocrCropTitle}>
      <div className="ocr-crop-sheet">
        <div className="ocr-crop-head">
          <span className="subject">{t.ocrCropTitle}</span>
          <button className="ghost" type="button" disabled={busy} onClick={onCancel}>
            {t.cancel}
          </button>
        </div>
        <p className="tiny ocr-crop-hint">{t.ocrCropHint}</p>
        <div className="ocr-crop-stage">
          <img ref={imgRef} className="ocr-crop-img" src={imageUrl} alt="" />
        </div>
        <div className="ocr-crop-actions">
          <button className="ghost" type="button" disabled={busy} onClick={onCancel}>
            {t.ocrCropCancel}
          </button>
          <button className="primary" type="button" disabled={busy} onClick={handleConfirm}>
            {busy ? t.ocrCompressing : t.ocrCropConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
