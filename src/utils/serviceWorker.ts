import type { AppId } from '../types/pwa';

// Source for the per-app service workers. Deploy the output as /sw.js (consumer, scope "/")
// and /admin/sw.js (admin, scope "/admin/"). Each app gets its own caches and update cycle.
//
// Caching strategy
// - App shell:       cache-first, versioned
// - Static assets:   cache-first, versioned (hashed filenames)
// - Public content:  stale-while-revalidate
// - User data:       network-only here; the app stores permitted results itself, per user
// - Private files, auth, payments: never cached
export function buildServiceWorkerSource(app: AppId, version: string, scope: string): string {
  const shareHandler =
  app === 'consumer' ?
  `
async function handleShare(request) {
  const form = await request.formData();
  const files = form.getAll('files').filter((f) => typeof f !== 'string');
  const inbox = await caches.open('pc-share-inbox');
  await Promise.all(files.map((file, i) => inbox.put('/share-inbox/' + i, new Response(file, {
    headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }
  }))));
  const params = new URLSearchParams();
  ['title', 'text', 'url'].forEach((k) => { const v = form.get(k); if (v) params.set(k, v); });
  if (files.length) params.set('files', String(files.length));
  return Response.redirect('/share-target?' + params.toString(), 303);
}` :
  '';

  return `
const VERSION = '${version}';
const SCOPE = '${scope}';
const PREFIX = 'pc-${app}-';
const SHELL_CACHE = PREFIX + 'shell-' + VERSION;
const STATIC_CACHE = PREFIX + 'static-' + VERSION;
const PUBLIC_CACHE = PREFIX + 'public';
const NEVER_CACHE = [/\\/api\\/auth/, /\\/api\\/payments/, /\\/api\\/admin/, /\\/files\\/private/, /\\/api\\/me/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll([SCOPE])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith(PREFIX) && k !== PUBLIC_CACHE && !k.endsWith(VERSION))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  ${app === 'consumer' ? "if (request.method === 'POST' && url.pathname === '/share-target') { event.respondWith(handleShare(request)); return; }" : ''}
  if (request.method !== 'GET' || NEVER_CACHE.some((rule) => rule.test(url.pathname))) return;
  if (request.headers.get('Authorization') || request.credentials === 'include') return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match(SCOPE).then((shell) => shell || fetch(request)));
    return;
  }
  if (/\\.(js|css|woff2?|png|svg|webp|jpg|ico)$/.test(url.pathname)) {
    event.respondWith(caches.open(STATIC_CACHE).then((cache) => cache.match(request).then((hit) =>
      hit || fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }))));
    return;
  }
  if (url.pathname.startsWith('/api/public/')) {
    event.respondWith(caches.open(PUBLIC_CACHE).then((cache) => cache.match(request).then((hit) => {
      const network = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
      return hit || network;
    })));
  }
});
${shareHandler}

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || '${app === 'admin' ? 'PadiCheck Admin' : 'PadiCheck'}', {
    body: data.body,
    tag: data.tag,
    icon: data.icon,
    data: { url: data.url || SCOPE },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((c) => c.url.includes(SCOPE));
    if (existing) { existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
`;
}