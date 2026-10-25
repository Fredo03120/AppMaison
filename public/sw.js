/* Garde l'appli et les photos en cache pour qu'elle s'ouvre vite, même avec peu de réseau.
   Les données (Supabase) passent toujours par le réseau. */
const VERSION = 'v48';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/shim.js', '/start.js', '/social.js', '/importer.js', '/config.js',
  '/vendor/supabase-2.45.4.js', '/manifest.webmanifest', '/icons/icon-192.png', '/fonts/nunito.woff2', '/fonts/nunito-italic.woff2'];
// Photos et police ne changent pas d'une version à l'autre : leur cache est gardé lors des mises à jour.
const KEEP = 'photos';
const fromCopy = new Set(); // pages ouvertes depuis la copie gardée (réseau trop lent)

self.addEventListener('install', e => {
  e.waitUntil(caches.open('shell-' + VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(async keys => {
    // Les photos déjà téléchargées par une ancienne version passent dans le cache gardé, sans les retélécharger.
    const keep = await caches.open(KEEP);
    for (const k of keys.filter(k => k.startsWith('photos-'))) {
      const old = await caches.open(k);
      for (const req of await old.keys()) { const r = await old.match(req); if (r) await keep.put(req, r); }
    }
    await Promise.all(keys.filter(k => k !== KEEP && !k.endsWith(VERSION)).map(k => caches.delete(k)));
  }).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Photos et police : le cache d'abord, le réseau seulement la première fois.
  if (url.pathname.startsWith('/photos/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.open(KEEP).then(async c => {
      const hit = await c.match(e.request) || await caches.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // Appli : le réseau d'abord pour avoir la dernière version ; s'il ne répond pas en 3 s
  // (fond de magasin), la copie gardée s'affiche, et la réponse du réseau met le cache à jour quand elle arrive.
  // Une page ouverte depuis la copie gardée prend aussi ses scripts dans la copie, pour rester d'une seule version.
  if (e.request.mode !== 'navigate' && fromCopy.has(e.clientId)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(new Promise(resolve => {
    let done = false;
    // La page d'accueil sert de secours pour une page, jamais pour un script ou une feuille de style.
    const fromCache = () => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('/index.html') : undefined));
    const net = fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open('shell-' + VERSION).then(c => c.put(e.request, copy)); }
      return res;
    });
    const timer = setTimeout(() => fromCache().then(r => {
      if (r && !done) { done = true; if (e.request.mode === 'navigate' && e.resultingClientId) fromCopy.add(e.resultingClientId); resolve(r); }
    }), 3000);
    net.then(res => { clearTimeout(timer); if (!done) { done = true; resolve(res); } })
      .catch(() => { clearTimeout(timer); if (!done) fromCache().then(r => { done = true; resolve(r || Response.error()); }); });
  }));
});
