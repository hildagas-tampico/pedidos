"use strict";

// Nueva versión: logo original más grande.
const CACHE_PREFIX = "hilda-pwa:" + self.registration.scope + ":";
const CACHE_NAME = CACHE_PREFIX + "v20261023-04";

const BASE = new URL(self.registration.scope);
const INDEX = new URL("index.html", BASE).href;
const PRECIOS_PATH = new URL("precios.json", BASE).pathname;

const REQUIRED_ASSETS = [
  INDEX
];

// Si falta un recurso opcional, no bloquea la actualización.
const OPTIONAL_ASSETS = [
  new URL("logo.png", BASE).href,
  new URL("manifest.webmanifest", BASE).href,
  new URL("icons/icon-192.png", BASE).href,
  new URL("icons/icon-512.png", BASE).href,
  new URL("icons/icon-maskable-512.png", BASE).href,
  new URL("icons/apple-touch-icon.png", BASE).href
];

const ASSETS = [...REQUIRED_ASSETS, ...OPTIONAL_ASSETS];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const url of REQUIRED_ASSETS) {
      const response = await fetch(url, {cache:"reload"});

      if (!response.ok) {
        throw new Error("No se pudo cargar el catálogo: " + url);
      }

      await cache.put(url, response);
    }

    await Promise.all(OPTIONAL_ASSETS.map(async url => {
      try {
        const response = await fetch(url, {cache:"reload"});

        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (_) {
        // Un recurso opcional ausente no impide instalar la actualización.
      }
    }));

    // Espera autorización desde el botón "Actualizar aplicación".
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar pedidos POST ni solicitudes externas a Apps Script.
  if (request.method !== "GET" || url.origin !== BASE.origin) return;
  if (!url.href.startsWith(BASE.href)) return;

  // Los precios se consultan en línea y no se guardan en caché.
  if (url.pathname === PRECIOS_PATH) {
    event.respondWith(fetch(request, {cache:"no-store"}));
    return;
  }

  const home =
    url.pathname === BASE.pathname ||
    url.pathname === new URL("index.html", BASE).pathname;

  if (request.mode === "navigate" && home) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, {cache:"no-cache"});

        if (response.ok) return response;

        const saved = await caches.match(INDEX, {
          cacheName:CACHE_NAME
        });

        return saved || response;
      } catch (_) {
        const saved = await caches.match(INDEX, {
          cacheName:CACHE_NAME
        });

        if (saved) return saved;

        return new Response(
          "Sin conexión. Conéctate a internet para abrir el catálogo.",
          {
            status:503,
            headers:{
              "Content-Type":"text/plain;charset=utf-8"
            }
          }
        );
      }
    })());

    return;
  }

  const canonical = url.origin + url.pathname;

  if (!ASSETS.includes(canonical)) return;

  event.respondWith((async () => {
    const saved = await caches.match(canonical, {
      cacheName:CACHE_NAME
    });

    return saved || fetch(request);
  })());
});
