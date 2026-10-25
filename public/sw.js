/* Garde l'appli et les photos en cache pour qu'elle s'ouvre vite, même avec peu de réseau.
   Les données (Supabase) passent toujours par le réseau. */
const VERSION = 'v36';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/shim.js', '/start.js', '/social.js', '/importer.js', '/config.js',
  '/vendor/supabase-2.45.4.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open('shell-' + VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/photos/')) {
    e.respondWith(caches.open('photos-' + VERSION).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // Réseau d'abord pour l'appli, cache en secours hors ligne.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) caches.open('shell-' + VERSION).then(c => c.put(e.request, res.clone()));
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
