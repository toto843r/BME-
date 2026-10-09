/* Lightweight, privacy-first BME offline shell. No API, PDF, Supabase, or admin caching. */
const VERSION = 'bme-safe-v3';
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE = '/offline.html';
const MAX_PAGES = 22;
const MAX_ASSETS = 100;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(['/', OFFLINE, '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']);
    // A first-time install should work offline without needing a second page reload:
    // warm only root HTML's own hashed Next.js scripts/styles, NOT PDF or other pages.
    try {
      const root = await cache.match('/');
      const html = root ? await root.text() : '';
      const matches = [...html.matchAll(/\/_next\/static\/[^"'<>\s]+/g)].map((m) => m[0].replaceAll('&amp;', '&'));
      const paths = [...new Set(matches)].filter((path) => /^\/_next\/static\/[\w./%-]+(?:\?[\w=&%-]+)?$/.test(path)).slice(0, 35);
      const assets = await caches.open(ASSETS);
      await Promise.all(paths.map((path) => assets.add(path).catch(() => {})));
    } catch { /* offline fallback still installs */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith('bme-') && ![SHELL, PAGES, ASSETS].includes(name))
      .map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()));
});
async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}
const forbidden = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') ||
  url.pathname.startsWith('/upload') ||
  url.pathname.startsWith('/_next/image') || /\.(?:pdf|docx?|pptx?|zip)$/i.test(url.pathname);
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || forbidden(url)) return;
  // Next RSC and prefetch data must never enter the HTML cache.
  if (request.headers.get('RSC') === '1' || request.headers.has('Next-Router-Prefetch') ||
      url.searchParams.has('_rsc') || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic' && /text\/html/i.test(response.headers.get('content-type') || '') &&
            !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
          const cache = await caches.open(PAGES);
          await cache.put(request, response.clone());
          await trim(cache, MAX_PAGES);
        }
        return response;
      } catch {
        return await caches.match(request, { ignoreSearch: false }) ||
          (url.pathname === '/' ? await caches.match('/') : null) || await caches.match(OFFLINE);
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') ||
      /\.(?:css|js|woff2?|png|svg)$/i.test(url.pathname) && url.pathname.startsWith('/static/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(ASSETS);
        await cache.put(request, response.clone());
        await trim(cache, MAX_ASSETS);
      }
      return response;
    })());
  }
});
