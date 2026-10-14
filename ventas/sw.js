// Service worker de SSPV web (generado por tools/web/postbuild.py).
//
// Guarda la app completa (JS, CanvasKit, assets) para que abra sin internet.
// Los datos NO pasan por aquí: viven en IndexedDB (Hive) y se sincronizan
// con el backend desde la app. Las peticiones al backend nunca se cachean.
'use strict';

const CACHE = 'sspv-sales-05078093139ae0f3';
const PREFIX = 'sspv-sales-';
const PRECACHE = [
  "./",
  "assets/AssetManifest.bin",
  "assets/AssetManifest.bin.json",
  "assets/FontManifest.json",
  "assets/assets/fonts/Poppins-Bold.ttf",
  "assets/assets/fonts/Poppins-Light.ttf",
  "assets/assets/fonts/Poppins-Medium.ttf",
  "assets/assets/fonts/Poppins-Regular.ttf",
  "assets/assets/fonts/Poppins-SemiBold.ttf",
  "assets/assets/icon/logo_admin.png",
  "assets/assets/icon/logo_master.png",
  "assets/assets/icon/logo_ventas.png",
  "assets/assets/icon/splash.png",
  "assets/fonts/MaterialIcons-Regular.otf",
  "assets/packages/cupertino_icons/assets/CupertinoIcons.ttf",
  "assets/shaders/ink_sparkle.frag",
  "assets/shaders/stretch_effect.frag",
  "favicon.png",
  "flutter.js",
  "flutter_bootstrap.js",
  "icons/Icon-192.png",
  "icons/Icon-512.png",
  "icons/Icon-maskable-192.png",
  "icons/Icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "index.html",
  "main.dart.js",
  "manifest.json",
  "splash/img/dark-1x.png",
  "splash/img/dark-2x.png",
  "splash/img/dark-3x.png",
  "splash/img/dark-4x.png",
  "splash/img/light-1x.png",
  "splash/img/light-2x.png",
  "splash/img/light-3x.png",
  "splash/img/light-4x.png",
  "version.json"
];
const FONT_CACHE = 'sspv-fonts';

// El loader de Flutter usa la variante "chromium" de CanvasKit en Chrome/Edge
// (que exponen userAgentData) y la normal en Safari/Firefox. Si se equivoca,
// la otra se guarda igual la primera vez que se pide (ver fetch).
const CANVASKIT = self.navigator.userAgentData
  ? ["canvaskit/chromium/canvaskit.js", "canvaskit/chromium/canvaskit.wasm"]
  : ["canvaskit/canvaskit.js", "canvaskit/canvaskit.wasm"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: 'reload' evita copiar lo que el navegador tenga en su caché
      // HTTP de una versión anterior.
      await cache.addAll(
        PRECACHE.concat(CANVASKIT).map((url) => new Request(url, { cache: 'reload' }))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Fuentes de respaldo que Flutter baja de Google (emojis, símbolos).
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(FONT_CACHE, request));
    return;
  }

  // Solo archivos de esta app (mismo origen y dentro del scope). El backend
  // es otro origen y pasa directo a la red.
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  // La app pide `cache: 'no-store'` para saber qué versión está publicada
  // (ver fetchPublishedVersion): esas van siempre a la red.
  if (request.cache === 'no-store') return;

  // Abrir la app (index.html): red primero para recibir versiones nuevas;
  // sin red, la copia guardada.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (_) {
          const cache = await caches.open(CACHE);
          return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreSearch: version.json se pide con ?cachebuster=...
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Lo que no se guardó al instalar queda guardado al usarlo.
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (e) {
        return Response.error();
      }
    })()
  );
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone());
  }
  return response;
}
