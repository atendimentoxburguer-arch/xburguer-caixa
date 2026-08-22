const CACHE_NAME = "xburguer-caixa-native-v4";
const APP_PATH = "/xburguer-caixa/";
const PRECACHE = [
  "./",
  "./index.html",
  "./caixa.html",
  "./manifest.webmanifest",
  "./pwa-register.js",

  "./style1.css",
  "./style2.css",
  "./style3.css",
  "./style4.css",
  "./style5.css",
  "./responsive.css",
  "./responsive-polish.css",
  "./mobile-menu-hotfix.css",
  "./mobile-readable.css",
  "./currency-format.css",
  "./page-transitions.css",
  "./login-transitions.css",
  "./system-final.css",
  "./cash-conference-help.css",
  "./version.css",
  "./bread-summary.css",
  "./online-orders-equal.css",

  "./shell1.js",
  "./shell2.js",
  "./shell3.js",
  "./shell4.js",
  "./shell5.js",
  "./shell6.js",
  "./shell7.js",
  "./shell8.js",
  "./shell-end.js",
  "./logo1.js",
  "./logo2.js",
  "./logo3.js",
  "./logo4.js",
  "./logo5.js",
  "./logo-end.js",
  "./identity-guard.js",
  "./storage-namespace.js",
  "./app1.js",
  "./app2.js",
  "./app3.js",
  "./app4.js",
  "./system-hardening.js",
  "./data-consistency.js",
  "./app5.js",
  "./system-guard.js",
  "./realtime.js",
  "./mobile-menu-fix.js",
  "./currency-format.js",
  "./automatic-conference.js",
  "./bread-summary.js",
  "./bread-start-final.js",
  "./cash-conference-help.js",

  "./icons/xburguer-caixa-rounded-32-v3.png",
  "./icons/xburguer-caixa-rounded-48-v3.png",
  "./icons/xburguer-caixa-rounded-192-v3.png",
  "./icons/xburguer-caixa-maskable-512-v4150.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("xburguer-caixa-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const response = await fetch(new Request(request, { cache: "no-store" }));
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;

      if (request.mode === "navigate") {
        return (
          await cache.match("./caixa.html", { ignoreSearch: true }) ||
          await cache.match("./index.html", { ignoreSearch: true })
        );
      }

      return Response.error();
    }
  })());
});