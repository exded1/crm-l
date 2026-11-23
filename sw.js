// Кэширует только файлы приложения, данные клиентов не кэшируются.
// Чужие кэши не трогаем: на этом же адресе живёт EXDED CRM.
const VERSION = 'crm-l-5bb2eecc56';
const SHELL = ["./", "assets/app.css", "assets/app.js", "assets/logic.js", "assets/supabase.js", "config.js", "fonts/onest-cyrillic-400-normal.woff2", "fonts/onest-cyrillic-500-normal.woff2", "fonts/onest-cyrillic-700-normal.woff2", "fonts/onest-cyrillic-ext-400-normal.woff2", "fonts/onest-cyrillic-ext-500-normal.woff2", "fonts/onest-cyrillic-ext-700-normal.woff2", "fonts/onest-latin-400-normal.woff2", "fonts/onest-latin-500-normal.woff2", "fonts/onest-latin-700-normal.woff2", "fonts/onest-latin-ext-400-normal.woff2", "fonts/onest-latin-ext-500-normal.woff2", "fonts/onest-latin-ext-700-normal.woff2", "fonts/onest.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "manifest.webmanifest"];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('crm-l-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  e.respondWith(fetch(req).catch(() => caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 })))));
});
