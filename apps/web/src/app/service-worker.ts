/**
 * Registriert den Service Worker (`sw/service-worker.js`, beim Build zu `/sw.js`). Nur im
 * Produktions-Build: Im Dev-Server würde er alte Stände aus dem Cache ausliefern.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ohne Service Worker läuft die App normal weiter, nur nicht offline.
    });
  });
}
