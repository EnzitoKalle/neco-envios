/* NECO ENVÍOS - Service worker. Sube el número de VERSION cuando cambies archivos. */
const VERSION = 'ne-v5';
const SHELL = ['/', '/index.html', '/repartidor.js', '/admin.js', '/push.js', '/manifest.json', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre lo más nuevo); si no hay internet, usa lo guardado. Solo archivos propios.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
// Notificaciones push (las envía la Edge Function de la Parte 3)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (x) { d = { title: 'Neco Envíos', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Neco Envíos', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag || 'neco', renotify: true, requireInteraction: true, vibrate: [300, 120, 300, 120, 300], data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const lista = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of lista) { if ('focus' in c) { await c.focus(); c.postMessage({ url }); return; } }
    await clients.openWindow(url);
  })());
});
