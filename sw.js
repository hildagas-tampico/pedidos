
  "use strict";
  const CACHE_PREFIX = "hilda-pwa:" + self.registration.scope + ":";
  const CACHE_NAME = CACHE_PREFIX + "v1792709832446";
  const BASE = new URL(self.registration.scope);
  const INDEX = new URL("index.html", BASE).href;
  const ASSETS = [
    INDEX,
    new URL("logo.png", BASE).href,
    new URL("manifest.webmanifest", BASE).href,
    new URL("icons/icon-192.png", BASE).href,
    new URL("icons/icon-512.png", BASE).href,
    new URL("icons/icon-maskable-512.png", BASE).href,
    new URL("icons/apple-touch-icon.png", BASE).href
  ];

  self.addEventListener("install", event => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(ASSETS.map(async url => {
        const response = await fetch(url, {cache:"reload"});
        if (!response.ok) throw new Error("No se pudo cargar " + url);
        await cache.put(url, response);
      }));
    })());
    // No se fuerza una actualización mientras el cliente llena el formulario.
  });

  self.addEventListener("activate", event => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key)));
      await self.clients.claim();
    })());
  });

  self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  });

  self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // Nunca interceptar POST, Apps Script ni otros servicios externos.
    if (request.method !== "GET" || url.origin !== BASE.origin) return;
    if (!url.href.startsWith(BASE.href)) return;

    // Precios: exclusivamente red. No aceptar una copia sin conexión.
    if (url.pathname === new URL("precios.json", BASE).pathname) {
      event.respondWith(fetch(request, {cache:"no-store"}));
      return;
    }

    const home = url.pathname === BASE.pathname ||
      url.pathname === new URL("index.html", BASE).pathname;

    if (request.mode === "navigate" && home) {
      event.respondWith((async () => {
        try {
          const response = await fetch(request, {cache:"no-cache"});
          if (response.ok) return response;
          const saved = await caches.match(INDEX, {cacheName:CACHE_NAME});
          return saved || response;
        } catch (error) {
          const saved = await caches.match(INDEX, {cacheName:CACHE_NAME});
          if (saved) return saved;
          return new Response("Sin conexión. Conéctate a internet para abrir Hilda Gas.", {
            status:503,
            headers:{"Content-Type":"text/plain;charset=utf-8"}
          });
        }
      })());
      return;
    }

    const canonical = url.origin + url.pathname;
    if (!ASSETS.includes(canonical)) return;
    event.respondWith((async () => {
      const saved = await caches.match(canonical, {cacheName:CACHE_NAME});
      return saved || fetch(request);
    })());
  });
  