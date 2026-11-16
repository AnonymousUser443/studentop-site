import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../apps/liyun-explorer/public/sw.js', import.meta.url), 'utf8');
const origin = 'https://liyun.test';
const version = '1234567890abcdef12345678';
const asset = '/assets/releases/' + version + '/test.opus';
function harness() {
  const stores = new Map(), handlers = {}, calls = [];
  let network = () => new Response('0123456789', { headers: { 'Content-Type': 'audio/ogg' } });
  const key = r => new URL(typeof r === 'string' ? r : r.url, origin).href;
  const caches = {
    async match(request, { cacheName }) { return stores.get(cacheName)?.get(key(request))?.clone(); },
  };
  const self = { location: { origin }, addEventListener(name, fn) { handlers[name] = fn; },
    clients: { claim: async () => {} }, skipWaiting: async () => {} };
  const fetch = async r => { calls.push(r); return network(r); };
  vm.runInNewContext(source, { self, caches, fetch, URL, Request, Response, Headers });
  return {
    calls, stores,
    seed(cache, url, body, headers = {}) {
      if (!stores.has(cache)) stores.set(cache, new Map());
      stores.get(cache).set(key(url), new Response(body, { headers }));
    },
    network(fn) { network = fn; },
    async request(url, options = {}) {
      let response;
      const request = options.mode === 'navigate'
        ? { url: key(url), method: 'GET', mode: 'navigate' }
        : new Request(key(url), options);
      handlers.fetch({ request, respondWith(r) { response = r; } });
      return response ? await response : undefined;
    },
  };
}

test('immutable pack has a single writer; verified entries support audio ranges', async () => {
  const h = harness();
  for (let i = 0; i < 2; i++) assert.equal(await (await h.request(asset)).text(), '0123456789');
  assert.equal(h.calls.length, 2);
  assert.equal(h.stores.size, 0, 'the worker never persists unverified bytes');
  h.seed('liyun-assets-' + version, asset, '0123456789');
  const r = await h.request(asset, { headers: { Range: 'bytes=2-5' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(await r.text(), '2345');
  assert.equal((await h.request(asset, { headers: { Range: 'bytes=99-' } })).status, 416);
  assert.equal(h.calls.length, 2);
});

test('precache and forced reload bypass a corrupt cache entry', async () => {
  const h = harness();
  h.seed('liyun-assets-' + version, asset, 'corrupt');
  assert.equal(await h.request(asset, { cache: 'reload' }), undefined);
  assert.equal(await h.request(asset, { headers: { 'X-Liyun-Precache': '1' } }), undefined);
  assert.equal(await (await h.request(asset)).text(), 'corrupt');
  assert.equal(h.calls.length, 0);
});

test('account/editor/publication and other origins are never intercepted', async () => {
  const h = harness();
  for (const url of ['/api/progress', '/api/session', '/api/editor/snapshot', '/api/content/published', '/version.json', '/studio/', 'https://else.test' + asset]) assert.equal(await h.request(url), undefined);
  assert.equal(h.calls.length, 0);
});

test('distinct version URLs and private media cannot read earlier cached responses', async () => {
  const h = harness();
  h.seed('liyun-assets-' + version, asset, 'old');
  assert.equal(await (await h.request(asset.replace(version, 'abcdef1234567890abcdef12'))).text(), '0123456789');
  const photo = '/api/content/media/' + 'a'.repeat(64) + '.webp';
  h.seed('liyun-public-media-v1', photo, 'private', { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store' });
  assert.equal(await (await h.request(photo)).text(), '0123456789');
  assert.equal(h.calls.length, 2);
});

test('incomplete online shell update leaves the last offline release navigable', async () => {
  const h = harness();
  h.seed('liyun-shell-v1', '/', 'verified old shell');
  h.network(() => new Response('new shell'));
  assert.equal(await (await h.request('/', { mode: 'navigate' })).text(), 'new shell');
  h.network(() => { throw Error('offline'); });
  assert.equal(await (await h.request('/', { mode: 'navigate' })).text(), 'verified old shell');
});
