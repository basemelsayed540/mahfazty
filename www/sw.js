/* محفظتي - تحديث تلقائي: يجيب النسخة الجديدة من النت أولاً، ولو مفيش نت يفتح من النسخة المحفوظة */
const CACHE = 'mahfazty-cache';
const CORE = ['./', 'index.html', 'style.css', 'assistant.js', 'payments.js', 'app.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== location.origin) return; if (u.pathname.endsWith('changelog.json')) return; /* دايماً من النت، عشان فحص الاتصال والتحديث يبقى حقيقي */
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(req).then((r) => r || caches.match('index.html'));
    const timer = setTimeout(() => { if (!done) fromCache().then((r) => { if (r && !done) { done = true; resolve(r); } }); }, 4000);
    fetch(req, { cache: 'no-cache' }).then((res) => {
      clearTimeout(timer); const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); if (!done) { done = true; resolve(res); }
    }).catch(() => { clearTimeout(timer); if (!done) fromCache().then((r) => { done = true; resolve(r || Response.error()); }); });
  }));
});
