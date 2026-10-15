// Service Worker der Web-App. Macht die App installierbar und lädt sie auch bei schlechtem oder
// fehlendem Netz (z. B. im Studio-Keller).
//
// Gecacht wird nur die App selbst (HTML, JS, CSS, Schriften, Icons), nie Antworten der API:
// Gesundheitsdaten bleiben nicht auf dem Gerät liegen (siehe auch `Cache-Control: no-store` der
// API). Ungesendete Trainingseinträge puffert die App separat im localStorage.
//
// Diese Datei ist eine Vorlage: Beim Build setzt das Vite-Plugin `serviceWorker` (vite.config.ts)
// die Liste der Dateien und eine Version ein. Jede neue Version legt einen neuen Cache an und
// löscht die alten.

const VERSION = "__SW_VERSION__";
const PRECACHE = /** @type {string[]} */ (__SW_PRECACHE__);
const CACHE = `athletept-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Neue Version sofort aktivieren. Unkritisch, weil index.html immer zuerst frisch aus dem
      // Netz kommt und nur auf Dateien mit Hash im Namen verweist.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("athletept-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // API nie anfassen: kein Cache, Fehler sieht die App selbst.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Seiten: immer zuerst das Netz (neue Version nach Deployment), offline die gecachte App.
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match("/index.html", { ignoreVary: true })) ?? Response.error(),
      ),
    );
    return;
  }

  // Dateien: aus dem Cache, sonst aus dem Netz. Dateien unter /assets tragen einen Hash im Namen
  // und ändern sich nie; nachgeladene kommen für das nächste Mal mit in den Cache. `ignoreVary`:
  // Server antworten mit `Vary: Origin` bzw. `Accept-Encoding`; Modul-Imports schicken andere
  // Header als das Vorladen, der Inhalt ist aber derselbe.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith("/assets/")) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
