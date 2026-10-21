export function stopReaderSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speakReaderText(text, lang, { onEnd } = {}) {
  if (!text?.trim()) return false;
  if (typeof window === "undefined" || !window.speechSynthesis) return false;

  stopReaderSpeech();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = lang === "en" ? "en-US" : "zh-CN";
  utterance.rate = lang === "en" ? 0.95 : 0.9;

  const voices = window.speechSynthesis.getVoices();
  const prefer = voices.find((v) => v.lang?.startsWith(utterance.lang.slice(0, 2)));
  if (prefer) utterance.voice = prefer;

  const finish = () => onEnd?.();
  utterance.onend = finish;
  utterance.onerror = finish;

  window.speechSynthesis.speak(utterance);
  return true;
}

export function readerSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
