const CACHE = "cubomatch-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/competitor.html",
  "/app.js",
  "/pwa.js",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

