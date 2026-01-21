const CACHE_NAME = "turnos-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./service-worker.js",

  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",

  "./assets/heroes/axiol.png",
  "./assets/heroes/kaelis.png",
  "./assets/heroes/renji.png",
  "./assets/heroes/noira.png",
  "./assets/heroes/sylvara.png",
  "./assets/heroes/viren.png",
  "./assets/heroes/elynnar.png",
  "./assets/heroes/tovahn.png",

  "./assets/bosses/colossus.png",
  "./assets/bosses/hive.png",
  "./assets/bosses/oracle.png",
  "./assets/bosses/bastion.png",
  "./assets/bosses/knight.png",
  "./assets/heroes/comodin.png"
  ]


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
