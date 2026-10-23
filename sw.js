
  "use strict";
  const CACHE_PREFIX = "hilda-pwa:" + self.registration.scope + ":";
  const CACHE_NAME = CACHE_PREFIX + "v1792716042887-twrinl";
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
    if (request.method !== "GET" || url.origin !== BASE.origin) return;
    if (!url.href.startsWith(BASE.href)) return;

    // Nunca guardar precios ni interceptar pedidos POST o Apps Script.
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
        } catch (_) {
          const saved = await caches.match(INDEX, {cacheName:CACHE_NAME});
          if (saved) return saved;
          return new Response("Sin conexión. Conéctate a internet para abrir el catálogo.", {
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
  