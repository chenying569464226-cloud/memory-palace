/** Works on HTTP LAN and older WebViews where crypto.randomUUID needs a secure context. */
export function createId() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    try {
      return cryptoObj.randomUUID();
    } catch {
      /* insecure context or blocked API */
    }
  }
  const rand = Math.random().toString(36).slice(2, 11);
  return `${Date.now().toString(36)}-${rand}`;
}
