/* This scope owns the show only. API, websocket and private data are never cached. */
const base = new URL(self.registration.scope).pathname;
const prefix = 'light-chaser-v3:' + base + ':';
const manifest = base + 'assets/manifest.json';
const index = base + 'index.html';
const pins = new Map();

async function completeCaches() {
  const result = [];
  for (const name of (await caches.keys()).reverse()) {
    if (name.startsWith(prefix)) {
      const cache = await caches.open(name);
      if (await cache.match(manifest)) result.push({ name, cache });
    }
  }
  return result;
}
async function fromCache(request, clientId) {
  const available = await completeCaches();
  const pinned = pins.get(clientId);
  const chosen = pinned ? available.find(item => item.name === pinned) : available[0];
  return chosen?.cache.match(request, { ignoreVary: true });
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  const name = event.data?.readyCache;
  if (event.source?.id && typeof name === 'string' && name.startsWith(prefix)) pins.set(event.source.id, name);
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(base)) return;
  const path = url.pathname.slice(base.length);
  if (/^(?:api|socket\.io)(?:\/|$)/.test(path) || request.cache === 'reload') return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) {
          const release = response.headers.get('X-Presentation-Release');
          if (event.resultingClientId && release) pins.set(event.resultingClientId, prefix + release);
          return response;
        }
      } catch { /* A completed package can open independently of the server. */ }
      const ready = (await completeCaches())[0];
      const shell = ready && await ready.cache.match(index);
      if (shell) {
        if (event.resultingClientId) pins.set(event.resultingClientId, ready.name);
        return shell;
      }
      return Response.error();
    })());
    return;
  }
  if (url.pathname === manifest || (!path.startsWith('assets/') && path !== 'favicon.svg')) return;
  event.respondWith((async () => {
    const hit = await fromCache(request, event.clientId);
    if (!hit) return fetch(request);
    const range = request.headers.get('range');
    if (!range) return hit;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const body = await hit.blob();
    const start = match?.[1] ? Number(match[1]) : Math.max(0, body.size - Number(match?.[2]));
    const end = Math.min(match?.[1] && match[2] ? Number(match[2]) : body.size - 1, body.size - 1);
    if (!match || (!match[1] && !match[2]) || start > end || start >= body.size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + body.size } });
    }
    return new Response(body.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + body.size,
      'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes',
    } });
  })());
});
