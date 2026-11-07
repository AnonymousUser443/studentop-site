import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { preloadAssets } from '../src/core/preload.ts';

// Exercise the browser-independent preload engine using real Fetch Responses
// and an in-memory implementation of Cache Storage. No application state is changed.
const original = { window: globalThis.window, caches: globalThis.caches, fetch: globalThis.fetch };
const cacheStores = new Map();
const fetchCounts = new Map();
let failSecond = true;
let badManifest = false;
let htmlSecond = false;
let offline = false;
let version = 0;
let corruptUpdate = false;
const hash = data => createHash('sha256').update(data).digest('hex');
const manifest = [
  { path: '/assets/a.webp', bytes: 3, variant: 'display-2560' },
  { path: '/assets/b.webp', bytes: 4, variant: 'display-2560' },
  { path: '/assets/a-full.webp', bytes: 100, variant: 'original-resolution' },
  { path: '/api/private', bytes: 100 },
];
function cacheFor(name) {
  if (!cacheStores.has(name)) cacheStores.set(name, new Map());
  const store = cacheStores.get(name);
  return { match: async (url) => store.get(url)?.clone(), put: async (url, response) => store.set(url, response.clone()), delete: async (url) => store.delete(url) };
}
try {
  globalThis.caches = { open: async (name) => cacheFor(name), keys: async () => [...cacheStores.keys()], delete: async (name) => cacheStores.delete(name), match: async (url) => { for (const store of cacheStores.values()) { const response = store.get(url); if (response) return response.clone(); } } };
  globalThis.window = globalThis;
  globalThis.fetch = async (url, options = {}) => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    fetchCounts.set(url, (fetchCounts.get(url) || 0) + 1);
    if (offline) throw new Error('Simulated complete offline');
    if (url === '/assets/manifest.json') return badManifest ? new Response('missing', { status: 404 }) : new Response(JSON.stringify(version ? manifest.map(asset => asset.bytes <= 4 ? { ...asset, sha256: hash(new Uint8Array(asset.bytes).fill(asset.bytes === 4 ? version - 1 : 0)) } : asset) : manifest), { headers: { 'Content-Type': 'application/json' } });
    if (url === '/assets/b.webp' && failSecond) { failSecond = false; throw new Error('Simulated network failure'); }
    if (url === '/assets/b.webp' && htmlSecond) return new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } });
    return new Response(new Uint8Array(url === '/assets/a.webp' ? 3 : 4).fill(url === '/assets/b.webp' && version ? version - 1 + Number(corruptUpdate) : 0), { headers: { 'Content-Type': 'image/webp' } });
  };
  const frames = [];
  const first = await preloadAssets((progress) => frames.push(progress), { concurrency: 1 });
  assert.equal(first.ready, false); assert.equal(first.total, 2); assert.equal(first.loaded, 1); assert.equal(first.percent, 50); assert.deepEqual(first.failed, ['/assets/b.webp']);
  assert.equal(fetchCounts.has('/assets/a-full.webp'), false); assert.equal(fetchCounts.has('/api/private'), false);
  const second = await preloadAssets(() => {}, { concurrency: 1 });
  assert.equal(second.ready, true); assert.equal(second.loaded, 2); assert.equal(second.percent, 100); assert.equal(second.bytesLoaded, 7); assert.equal(fetchCounts.get('/assets/a.webp'), 1);
  assert.ok((await cacheFor(second.cacheName).match('/assets/manifest.json')), 'Manifest cached before the first SW controls the page');
  offline = true;
  const offlineReload = await preloadAssets(() => {}, { concurrency: 1 });
  assert.equal(offlineReload.ready, true); assert.equal(offlineReload.loaded, 2); assert.equal(offlineReload.total, 2); assert.equal(offlineReload.percent, 100); assert.equal(offlineReload.bytesLoaded, 7);
  offline = false;
  cacheStores.clear();
  const aborter = new AbortController();
  await assert.rejects(preloadAssets((progress) => { if (progress.loaded === 1) aborter.abort(); }, { signal: aborter.signal, concurrency: 1 }), { name: 'AbortError' });
  const recovered = await preloadAssets(() => {}, { concurrency: 1 });
  assert.equal(recovered.ready, true);
  badManifest = true; cacheStores.clear();
  const missing = await preloadAssets(() => {});
  assert.equal(missing.ready, false); assert.equal(missing.percent, 0); assert.deepEqual(missing.failed, ['/assets/manifest.json']);
  badManifest = false; htmlSecond = true; cacheStores.clear();
  const wrongContent = await preloadAssets(() => {}, { concurrency: 1 });
  assert.equal(wrongContent.ready, false); assert.deepEqual(wrongContent.failed, ['/assets/b.webp']);
  htmlSecond = false;
  const restored = await preloadAssets(() => {}, { concurrency: 1 });
  assert.equal(restored.ready, true);

  version = 1;
  const baseline = await preloadAssets(() => {});
  assert.equal(baseline.ready, true);
  const downloaded = new Map(fetchCounts);
  version = 2;
  corruptUpdate = true;
  const failedUpdate = await preloadAssets(() => {});
  assert.equal(failedUpdate.ready, false);
  assert.deepEqual(failedUpdate.failed, ['/assets/b.webp']);
  offline = true;
  assert.equal((await preloadAssets(() => {})).cacheName, baseline.cacheName);
  offline = false;
  corruptUpdate = false;
  const updated = await preloadAssets(() => {});
  assert.equal(updated.ready, true);
  assert.notEqual(updated.cacheName, baseline.cacheName);
  assert.equal(fetchCounts.get('/assets/a.webp'), downloaded.get('/assets/a.webp'));
  assert.equal(fetchCounts.get('/assets/b.webp'), downloaded.get('/assets/b.webp') + 2);
  const updatedBody = await (await cacheFor(updated.cacheName).match('/assets/b.webp')).arrayBuffer();
  assert.deepEqual([...new Uint8Array(updatedBody)], [1, 1, 1, 1]);
  console.log(JSON.stringify({ ok: true, checks: ['failed file does not count as loaded', 'failure remains below 100%', 'retry uses completed Cache Storage entries', 'original-resolution files skipped', 'API/private paths excluded', 'manifest cached independently of SW control', 'complete offline reload uses manifest plus assets cache', 'manifest is excluded from resource progress', 'AbortSignal cancels work', 'retry after cancellation', 'missing uncached manifest blocks readiness', 'HTML fallback rejected', 'recovery after invalid response', 'identical file fingerprint reuses cache; same-size update is downloaded; failed update preserves last offline-ready build'] }, null, 2));
} finally {
  for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
