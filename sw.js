"use strict";

// Nueva versión: bienvenida azul y logo rectangular.
const CACHE_PREFIX = "hilda-pwa:" + self.registration.scope + ":";
const CACHE_NAME = CACHE_PREFIX + "v20261024-01";

const BASE = new URL(self.registration.scope);
const INDEX = new URL("index.html", BASE).href;
const INDEX_PATH = new URL(INDEX).pathname;
const LOGO = new URL("logo.png", BASE).href;
const PRECIOS_PATH = new URL("precios.json", BASE).pathname;

const REQUIRED_ASSETS = [
  INDEX
];

// Si falta un recurso opcional, no bloquea la instalación.
const OPTIONAL_ASSETS = [
  LOGO,
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
        // Un recurso opcional ausente no bloquea la actualización.
      }
    }));

    // Espera autorización desde "Actualizar aplicación".
    // No fuerza una recarga durante un pedido.
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

    // Esto no elimina los datos recordados en localStorage.
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

  // No interceptar pedidos POST ni solicitudes externas.
  if (request.method !== "GET" || url.origin !== BASE.origin) return;
  if (!url.pathname.startsWith(BASE.pathname)) return;

  // Los precios siempre se consultan en línea.
  if (url.pathname === PRECIOS_PATH) {
    event.respondWith(fetch(request, {cache:"no-store"}));
    return;
  }

  const home =
    url.pathname === BASE.pathname ||
    url.pathname === INDEX_PATH;

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

  // Logo: red primero para evitar mostrar uno antiguo.
  if (canonical === LOGO) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, {cache:"no-store"});

        if (response.ok) return response;

        const saved = await caches.match(LOGO, {
          cacheName:CACHE_NAME
        });

        return saved || response;
      } catch (_) {
        const saved = await caches.match(LOGO, {
          cacheName:CACHE_NAME
        });

        if (saved) return saved;

        return new Response("", {
          status:503,
          statusText:"Logo no disponible"
        });
      }
    })());

    return;
  }

  if (!ASSETS.includes(canonical)) return;

  event.respondWith((async () => {
    const saved = await caches.match(canonical, {
      cacheName:CACHE_NAME
    });

    return saved || fetch(request, {cache:"no-cache"});
  })());
});
