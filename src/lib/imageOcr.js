export const MAX_SIDE = 1600;
const ACCEPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);

export function isSupportedImage(file) {
  if (!file) return false;
  if (ACCEPT_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || "");
}

export async function canvasToJpegBlob(canvas, maxSide = MAX_SIDE) {
  let target = canvas;
  const maxDim = Math.max(canvas.width, canvas.height);
  if (maxDim > maxSide) {
    const scale = maxSide / maxDim;
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));
    const scaled = document.createElement("canvas");
    scaled.width = w;
    scaled.height = h;
    const ctx = scaled.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.drawImage(canvas, 0, 0, w, h);
    target = scaled;
  }
  return new Promise((resolve, reject) => {
    target.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("compress_failed"))),
      "image/jpeg",
      0.88,
    );
  });
}

export async function compressImageFile(file, maxSide = MAX_SIDE) {
  if (!isSupportedImage(file)) {
    throw new Error("unsupported_format");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("compress_failed"))),
        "image/jpeg",
        0.88,
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}

function reportProgress(onProgress, msg) {
  if (typeof onProgress !== "function" || !msg) return;
  const status = msg.status || "";
  const progress = msg.progress ?? 0;
  if (status.includes("loading") || status.includes("initializing")) {
    onProgress({ phase: "load", progress });
  } else if (status.includes("recognizing")) {
    onProgress({ phase: "recognize", progress });
  }
}

export async function recognizeImageBlob(blob, onProgress) {
  const Tesseract = await import("tesseract.js");
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(blob, "chi_sim+eng", {
      logger: (msg) => reportProgress(onProgress, msg),
    });
    return (text || "").trim();
  } catch {
    const { createWorker } = Tesseract;
    const worker = await createWorker("chi_sim+eng", 1, {
      logger: (msg) => reportProgress(onProgress, msg),
    });
    try {
      const {
        data: { text },
      } = await worker.recognize(blob);
      return (text || "").trim();
    } finally {
      await worker.terminate();
    }
  }
}
