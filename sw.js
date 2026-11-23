// Кэширует только файлы приложения, данные клиентов не кэшируются.
// Чужие кэши не трогаем: на этом же адресе живёт EXDED CRM.
const VERSION = 'crm-l-81aac63afe';
const SHELL = ["./", "assets/app.css", "assets/app.js", "assets/logic.js", "assets/supabase.js", "config.js", "fonts/onest-cyrillic-400-normal.woff2", "fonts/onest-cyrillic-500-normal.woff2", "fonts/onest-cyrillic-700-normal.woff2", "fonts/onest-cyrillic-ext-400-normal.woff2", "fonts/onest-cyrillic-ext-500-normal.woff2", "fonts/onest-cyrillic-ext-700-normal.woff2", "fonts/onest-latin-400-normal.woff2", "fonts/onest-latin-500-normal.woff2", "fonts/onest-latin-700-normal.woff2", "fonts/onest-latin-ext-400-normal.woff2", "fonts/onest-latin-ext-500-normal.woff2", "fonts/onest-latin-ext-700-normal.woff2", "fonts/onest.css", "icons/apple-touch-icon.png", "icons/badge-96.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "manifest.webmanifest"];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('crm-l-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  e.respondWith(fetch(req).catch(() => caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 })))));
});
// уведомления приходят и при закрытом приложении; нажатие открывает клиента
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { /* пустое уведомление */ }
  e.waitUntil(self.registration.showNotification(d.title || 'CRM L', { body: d.body || '', tag: d.tag || 'crm-l', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { lead: d.lead || '' } }));
});
self.addEventListener('notificationclick', (e) => {
  const lead = (e.notification.data || {}).lead;
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
    const open = all.find((c) => c.url.startsWith(self.registration.scope));
    if (!open) return self.clients.openWindow('./' + (lead ? '?lead=' + encodeURIComponent(lead) : ''));
    if (lead) open.postMessage({ lead });
    return open.focus();
  }));
});
