/* Static/public resources only. Account, editor and GPS APIs always go to the network. */
const SHELL = 'liyun-shell-v1', PUBLIC = 'liyun-public-media-v1';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function stored(request, cacheName) {
  // CacheStorage can be unavailable under some browser storage policies.
  try { return await caches.match(request, { cacheName }); } catch { return undefined; }
}

function eligiblePhoto(response, immutable) {
  if (response.status !== 200 || !/^image\/webp(?:;|$)/i.test(response.headers.get('Content-Type') || '')) return false;
  const control = response.headers.get('Cache-Control') || '';
  return !/\b(?:private|no-store)\b/i.test(control) &&
    (!immutable || (/\bpublic\b/i.test(control) && /\bimmutable\b/i.test(control)));
}

async function withRange(response, range) {
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return response;
  // Slice an immutable Blob, not a whole decoded file copied through a JS ArrayBuffer
  // for each small media probe or seek.
  const body = await response.blob(), length = body.size;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (start >= length || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + length } });
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + length);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    if (url.pathname !== '/' && url.pathname !== '/index.html') return;
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch (error) {
        const saved = await stored('/', SHELL);
        if (saved) return saved;
        throw error;
      }
    })());
    return;
  }

  const release = /^\/assets\/releases\/([a-f0-9]{24})\//.exec(url.pathname);
  const media = /^\/api\/content\/media\/[a-f0-9]{64}\.webp$/.test(url.pathname);
  const seed = /^\/api\/content\/seed-media\/(?:wencui|beihu|library|teaching|wenbo|sports|tower|park)\.webp$/.test(url.pathname);
  if (!release && !media && !seed) return;
  // One owner writes the verified pack. A precache fetch already looked up the entry
  // itself and must reach the browser's HTTP cache or network without another clone/write.
  if (request.cache === 'reload' || request.headers.get('X-Liyun-Precache') === '1') return;
  event.respondWith((async () => {
    const saved = await stored(url.href, release ? 'liyun-assets-' + release[1] : PUBLIC);
    if (saved && (release || eligiblePhoto(saved, media))) {
      try { return await withRange(saved, request.headers.get('Range')); }
      catch { /* Damaged offline entry: try the network. */ }
    }
    return fetch(request);
  })());
});
