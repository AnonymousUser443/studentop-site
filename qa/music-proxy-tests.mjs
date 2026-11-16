/** Isolated HTTP contract tests: synthetic desktop auth and a fake loopback music service. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createDesktopAuth, makeConfig, savePrivate} from '../tools/desktop-auth.mjs';
import {createMusicProxy} from '../tools/music-proxy.mjs';

const require = createRequire(import.meta.url);
const {listenBrowserSafe} = require('./ports.cjs');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PREFIX = '/__desktop/music/v1/';
const ANSWER = 'Synthetic music proxy visitor, QA only';
const GATEWAY_KEY = 'synthetic-music-gateway-key-0123456789';
const PRIVATE_MARKER = 'private-upstream-trace-must-not-escape';

function envelope(res, status = 200, data = {value: 'synthetic'}, headers = {}) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', ...headers});
  res.end(JSON.stringify({ok: true, data}));
}

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'music-proxy-test-'));
  const configFile = path.join(directory, 'auth.json');
  const stateFile = path.join(directory, 'rate-state.json');
  await savePrivate(configFile, await makeConfig(ANSWER));
  let auth, bridge, origin, behavior = (_req, res) => envelope(res);
  let clock = 1_800_000_000_000;
  const received = [];
  const upstream = http.createServer((req, res) => {
    void (async () => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const record = {path: req.url, method: req.method, headers: {...req.headers}, body: Buffer.concat(chunks).toString('utf8')};
      received.push(record);
      behavior(record, res);
    })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  await listenBrowserSafe(upstream);
  const server = http.createServer((req, res) => {
    void (async () => {
      if (req.headers.host !== new URL(origin).host) { res.writeHead(403); res.end(); return; }
      if (await auth.handle(req, res)) return;
      if (await bridge.handle(req, res)) return;
      res.writeHead(404); res.end();
    })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  await listenBrowserSafe(server);
  origin = 'http://127.0.0.1:' + server.address().port;
  auth = await createDesktopAuth({root: ROOT, configFile, stateFile, origin, now: () => clock});
  bridge = createMusicProxy({
    auth, port: upstream.address().port, gatewayKey: options.gatewayKey ?? GATEWAY_KEY, origin,
  });
  t.after(async () => {
    await bridge.drain();
    await auth.drain();
    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([
      new Promise(resolve => server.close(resolve)),
      new Promise(resolve => upstream.close(resolve)),
    ]);
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()), 'cleanup stays in the temporary root');
    assert.ok(path.basename(target).startsWith('music-proxy-test-'));
    await rm(target, {recursive: true, force: true});
  });

  function request(endpoint, {method = 'GET', headers = {}, body, timeoutMs = 2_000} = {}) {
    const target = endpoint.startsWith('/') ? endpoint : PREFIX + endpoint;
    return new Promise((resolve, reject) => {
      const req = http.request(origin, {
        path: target, method, agent: false,
        headers: {...(body !== undefined ? {'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body))} : {}), ...headers},
      }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try { data = JSON.parse(text); } catch { /* malformed responses remain visible to assertions */ }
          resolve({status: res.statusCode, headers: res.headers, text, data});
        });
      });
      req.setTimeout(timeoutMs, () => req.destroy(new Error('Bounded music proxy request timed out')));
      req.on('error', reject);
      req.end(body);
    });
  }

  async function login() {
    const initial = await request('/__desktop/auth');
    const before = initial.headers['set-cookie'][0].split(';')[0];
    const signed = await request('/__desktop/auth', {
      method: 'POST',
      headers: {Cookie: before, Origin: origin, 'X-Desktop-CSRF': initial.data.csrfToken},
      body: JSON.stringify({answer: ANSWER}),
    });
    assert.equal(signed.status, 200);
    assert.equal(signed.data.authenticated, true);
    return {Cookie: signed.headers['set-cookie'][0].split(';')[0], Origin: origin, 'X-Desktop-CSRF': signed.data.csrfToken};
  }

  async function revoke(signed) {
    const response = await request('/__desktop/auth', {method: 'DELETE', headers: signed});
    assert.equal(response.status, 200);
    assert.equal(response.data.authenticated, false);
  }

  return {
    auth, bridge, upstream, origin, received, request, login, revoke,
    behavior(handler) { behavior = handler; },
    advance(ms) { clock += ms; },
  };
}

test('locked normal music endpoints deny access before reaching the backend', async t => {
  const f = await fixture(t);
  for (const operation of ['session', 'home', 'library', 'cloud?offset=0', 'comments/123?offset=0', 'heart-mode?trackId=1&playlistId=101', 'search?q=moon&type=tracks', 'playlists/123', 'lyrics/123']) {
    const response = await f.request(operation);
    assert.equal(response.status, 401, operation);
    assert.equal(response.data.error.code, 'authentication_required');
    assert.equal(response.headers['set-cookie'], undefined);
  }
  assert.equal((await f.request('likes', {method: 'POST', headers: {Origin: f.origin}, body: '{"trackId":"1","liked":true}'})).status, 401);
  assert.equal(f.received.length, 0);
});

test('community and cloud routes use the desktop gate and comment writes require current CSRF', async t => {
  const f = await fixture(t), signed = await f.login();
  for (const endpoint of ['cloud?offset=50', 'comments/123?offset=20', 'heart-mode?trackId=1&playlistId=101']) {
    const response = await f.request(endpoint, {headers:signed});
    assert.equal(response.status, 200, endpoint);
    assert.equal(f.received.at(-1).headers['x-music-access'], 'desktop');
  }
  for (const endpoint of ['comments/123', 'comments/123/like']) {
    const count=f.received.length;
    assert.equal((await f.request(endpoint, {method:'POST',headers:{Cookie:signed.Cookie,Origin:f.origin},body:'{}'})).status,403);
    assert.equal(f.received.length,count);
    assert.equal((await f.request(endpoint, {method:'POST',headers:signed,body:'{}'})).status,200);
    assert.equal(f.received.at(-1).headers['x-music-access'],'desktop');
  }
  for (const endpoint of ['cloud/upload', 'comments/123/delete', 'comments/all', 'heart-mode/resolve']) {
    assert.equal((await f.request(endpoint,{headers:signed})).status,404,endpoint);
  }
  await f.revoke(signed);
  assert.equal((await f.request('comments/123',{method:'POST',headers:signed,body:'{}'})).status,401);
});

test('authorizeWrite shares the current desktop lease and demands exact origin plus current CSRF', async t => {
  const f = await fixture(t), signed = await f.login();
  const headers = {cookie: signed.Cookie, origin: signed.Origin, 'x-desktop-csrf': signed['X-Desktop-CSRF'], 'sec-fetch-site': 'same-origin'};
  assert.equal(f.auth.authorizeWrite({method: 'GET', headers}).status, 405);
  assert.equal(f.auth.authorizeWrite({method: 'POST', headers: {...headers, cookie: ''}}).status, 401);
  assert.equal(f.auth.authorizeWrite({method: 'POST', headers: {...headers, origin: undefined}}).status, 403);
  assert.equal(f.auth.authorizeWrite({method: 'POST', headers: {...headers, 'x-desktop-csrf': 'wrong'}}).status, 403);
  const lease = f.auth.authorizeWrite({method: 'POST', headers});
  assert.equal(lease.ok, true);
  assert.equal(lease.isValid(), true);
  await f.revoke(signed);
  assert.equal(lease.isValid(), false);
  assert.equal(f.auth.authorizeWrite({method: 'DELETE', headers}).status, 401);
});

test('unlocked writes require CSRF and ignore caller-supplied gateway access headers', async t => {
  const f = await fixture(t), signed = await f.login();
  const body = '{"trackId":"123","liked":true}';
  for (const headers of [
    {Cookie: signed.Cookie, Origin: f.origin},
    {...signed, 'X-Desktop-CSRF': 'wrong'},
    {...signed, Origin: 'https://foreign.invalid'},
    {...signed, 'Sec-Fetch-Site': 'cross-site'},
  ]) {
    assert.equal((await f.request('likes', {method: 'POST', headers, body})).status, 403);
  }
  assert.equal(f.received.length, 0);
  const good = await f.request('likes', {
    method: 'POST', body,
    headers: {...signed, 'X-Music-Access': 'playback', 'X-Music-Gateway': 'forged', Authorization: 'must-not-forward'},
  });
  assert.equal(good.status, 200);
  assert.equal(f.received[0].headers['x-music-access'], 'desktop');
  assert.equal(f.received[0].headers['x-music-gateway'], GATEWAY_KEY);
  assert.equal(f.received[0].headers.authorization, undefined);
  assert.equal(f.received[0].headers['x-desktop-csrf'], undefined);
  assert.equal(f.received[0].body, body);
});

test('locked playback resolution enforces origin and delegates its music-cookie/CSRF checks to the backend', async t => {
  const f = await fixture(t);
  f.behavior((record, res) => {
    const accepted = record.headers['x-music-access'] === 'playback'
      && record.headers['x-music-playback-csrf'] === 'synthetic-playback-csrf'
      && /AidenMusicPlayback=synthetic-lease/.test(record.headers.cookie ?? '');
    if (accepted) envelope(res, 200, {url: 'https://m1.music.126.net/synthetic.mp3'});
    else {
      res.writeHead(401, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ok: false, error: {code: 'lease_expired', message: 'synthetic lease rejected', retryable: false}}));
    }
  });
  const body = '{"id":"123","quality":"standard"}';
  for (const headers of [{}, {Origin: 'null'}, {Origin: 'https://foreign.invalid'}, {Origin: f.origin, 'Sec-Fetch-Site': 'same-site'}]) {
    assert.equal((await f.request('playback/resolve', {method: 'POST', headers, body})).status, 403);
  }
  assert.equal(f.received.length, 0);
  const rejected = await f.request('playback/resolve', {method: 'POST', headers: {Origin: f.origin}, body});
  assert.equal(rejected.status, 401);
  assert.equal(rejected.data.error.code, 'lease_expired');
  const accepted = await f.request('playback/resolve', {
    method: 'POST', body, headers: {
      Origin: f.origin, Cookie: 'AidenMusicSession=synthetic-session; AidenMusicPlayback=synthetic-lease',
      'X-Music-Playback-CSRF': 'synthetic-playback-csrf', 'X-Music-Access': 'desktop',
    },
  });
  assert.equal(accepted.status, 200);
  assert.equal(f.received.at(-1).headers['x-music-access'], 'playback');
  assert.equal(f.received.at(-1).headers['x-music-gateway'], GATEWAY_KEY);
  assert.equal((await f.request('playback/lease', {method: 'POST', headers: {Origin: f.origin}, body: '{}'})).status, 401);
});

test('raw SDK routes, encoded traversal, ambiguous paths and wrong methods never reach the backend', async t => {
  const f = await fixture(t), signed = await f.login();
  const invalid = [
    '/__desktop/music', '/__desktop/music/v1', '/__desktop/music/v1/',
    '/__desktop/music/v1/song/url', '/__desktop/music/v1/home/', '/__desktop/music/v1//home',
    '/__desktop/music/v1/%68ome', '/__desktop/music/v1/%2e%2e/auth', '/__desktop/music/v1/../auth',
    '/__desktop/music/v1/playlists/123%2ftracks', '/__desktop/music/v1/playlists/123/../session',
    '/__desktop/music/v1/https://foreign.invalid', '/__desktop/music/v1/home%3fsearch',
    '/__desktop/music/v1/playlists/1;session', '/__desktop/music/v1/home%00',
  ];
  for (const operation of invalid) {
    assert.equal((await f.request(operation, {headers: signed})).status, 404, operation);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    assert.equal((await f.request('home', {method, headers: signed, ...(method !== 'HEAD' ? {body: '{}'} : {})})).status, 404, method);
  }
  assert.equal(f.received.length, 0);
});

test('only the two opaque music cookies cross the gateway in either direction', async t => {
  const f = await fixture(t), signed = await f.login();
  f.behavior((_record, res) => envelope(res, 200, {authenticated: false}, {
    'Set-Cookie': [
      'AidenMusicSession=synthetic-session; Path=/__desktop/music/v1/; HttpOnly; SameSite=Strict',
      'AidenMusicPlayback=synthetic-playback; Path=/__desktop/music/v1/; HttpOnly; SameSite=Strict',
      'MUSIC_U=must-not-forward; Path=/',
      'aiden_desktop=must-not-replace; Path=/',
      'AidenMusicSessionOther=must-not-forward; Path=/',
    ],
    'X-Upstream-Private': PRIVATE_MARKER,
    Location: 'https://foreign.invalid/private',
  }));
  const response = await f.request('session', {
    headers: {...signed, Cookie: signed.Cookie + '; AidenMusicSession=synthetic-session; AidenMusicPlayback=synthetic-playback; unrelated_session=must-not-forward'},
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store, private');
  assert.equal(response.headers.vary, 'Cookie');
  assert.equal(response.headers.location, undefined);
  assert.equal(response.headers['x-upstream-private'], undefined);
  assert.deepEqual(response.headers['set-cookie']?.map(value => value.split('=')[0]), ['AidenMusicSession', 'AidenMusicPlayback']);
  assert.equal(f.received[0].headers.cookie, 'AidenMusicSession=synthetic-session; AidenMusicPlayback=synthetic-playback');
});

test('revocation while awaiting a normal upstream reply suppresses its data and Set-Cookie', async t => {
  const f = await fixture(t), signed = await f.login();
  let ready;
  const arrived = new Promise(resolve => { ready = resolve; });
  let held;
  f.behavior((_record, res) => { held = res; ready(); });
  const pending = f.request('library', {headers: signed});
  await arrived;
  await f.revoke(signed);
  envelope(held, 200, {privateLibrary: PRIVATE_MARKER}, {'Set-Cookie': 'AidenMusicSession=late-session; Path=/__desktop/music/v1/; HttpOnly; SameSite=Strict'});
  const response = await pending;
  assert.equal(response.status, 401);
  assert.equal(response.data.error.code, 'authentication_required');
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal(response.text.includes(PRIVATE_MARKER), false);
});

test('a write whose body finishes after desktop revocation never reaches the music service', async t => {
  const f = await fixture(t), signed = await f.login();
  let accepted;
  const checked = new Promise(resolve => { accepted = resolve; });
  const authorize = f.auth.authorizeWrite;
  f.auth.authorizeWrite = req => {
    const lease = authorize(req);
    if (req.url === PREFIX + 'likes') accepted();
    return lease;
  };
  const body = '{"trackId":"123","liked":true}';
  let client;
  const pending = new Promise((resolve, reject) => {
    client = http.request(f.origin, {
      path: PREFIX + 'likes', method: 'POST', agent: false,
      headers: {...signed, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body))},
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    client.setTimeout(2_000, () => client.destroy(new Error('Bounded slow-body test timed out')));
    client.on('error', reject);
    client.write(body.slice(0, 8));
  });
  await checked;
  await f.revoke(signed);
  client.end(body.slice(8));
  const result = await pending;
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'authentication_required');
  assert.equal(f.received.length, 0);
});

test('unreachable upstream fails with a bounded public JSON error', async t => {
  const f = await fixture(t), signed = await f.login();
  f.upstream.closeAllConnections();
  await new Promise(resolve => f.upstream.close(resolve));
  const response = await f.request('session', {headers: signed});
  assert.equal(response.status, 503);
  assert.equal(response.data.ok, false);
  assert.equal(response.data.error.code, 'upstream_error');
  assert.equal(response.text.includes('ECONNREFUSED'), false);
});

test('HTML, redirect and malformed upstream responses fail closed without forwarding private text or cookies', async t => {
  const f = await fixture(t), signed = await f.login();
  const cases = [
    {status: 503, headers: {'Content-Type': 'text/html'}, body: '<html>' + PRIVATE_MARKER + '</html>'},
    {status: 302, headers: {'Content-Type': 'text/html', Location: 'https://foreign.invalid'}, body: PRIVATE_MARKER},
    {status: 200, headers: {'Content-Type': 'application/json'}, body: '{bad-json-' + PRIVATE_MARKER},
  ];
  for (const value of cases) {
    f.behavior((_record, res) => { res.writeHead(value.status, {...value.headers, 'Set-Cookie': 'AidenMusicSession=bad-upstream; Path=/'}); res.end(value.body); });
    const response = await f.request('session', {headers: signed});
    assert.equal(response.status, 502);
    assert.equal(response.data?.ok, false);
    assert.equal(response.data?.error?.code, 'upstream_error');
    assert.equal(response.text.includes(PRIVATE_MARKER), false);
    assert.equal(response.headers['set-cookie'], undefined);
  }
});

test('oversized upstream responses terminate with a controlled error rather than hanging', async t => {
  const f = await fixture(t), signed = await f.login();
  f.behavior((_record, res) => {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ok: true, data: 'x'.repeat(4 * 1024 * 1024)}));
  });
  const response = await f.request('session', {headers: signed, timeoutMs: 3_000});
  assert.equal(response.status, 503);
  assert.equal(response.data?.error?.code, 'upstream_error');
});

test('truncated upstream replies terminate with a controlled error before the client deadline', async t => {
  const f = await fixture(t), signed = await f.login();
  f.behavior((_record, res) => {
    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': '512', Connection: 'close'});
    res.end('{"ok":true,');
  });
  const response = await f.request('session', {headers: signed, timeoutMs: 3_000});
  assert.equal(response.status, 503);
  assert.equal(response.data?.error?.code, 'upstream_error');
});

test('aborting partial replies releases gateway capacity for subsequent music requests', {timeout: 5_000}, async t => {
  const f = await fixture(t), signed = await f.login();
  let ready;
  let chunksSent = 0;
  const partials = new Promise(resolve => { ready = resolve; });
  f.behavior((_record, res) => {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write('{"ok":true,"data":', () => { if (++chunksSent === 24) ready(); });
  });
  const clients = Array.from({length: 24}, () => {
    const client = http.get(f.origin, {path: PREFIX + 'home', headers: signed, agent: false});
    client.on('error', () => {}); // These client-side aborts are the event under test.
    return client;
  });
  t.after(() => clients.forEach(client => client.destroy()));
  await partials;
  await new Promise(resolve => setTimeout(resolve, 30));
  clients.forEach(client => client.destroy());
  await new Promise(resolve => setTimeout(resolve, 30));
  f.behavior((_record, res) => envelope(res));
  const response = await f.request('home', {headers: signed});
  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);
});

test('request content type and size are bounded before SDK delegation', async t => {
  const f = await fixture(t), signed = await f.login();
  assert.equal((await f.request('likes', {method: 'POST', headers: {...signed, 'Content-Type': 'text/plain'}, body: '{}'})).status, 415);
  assert.equal((await f.request('likes', {method: 'POST', headers: signed, body: JSON.stringify({ids: 'x'.repeat(33_000)})})).status, 413);
  assert.equal(f.received.length, 0);
});
