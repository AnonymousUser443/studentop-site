import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDesktopAuth, makeConfig, savePrivate } from '../tools/desktop-auth.mjs';
import { createTaskManagerProxy, taskManagerPort, TASK_MANAGER_LIMITS, TASK_MANAGER_PREFIX } from '../tools/task-manager-proxy.mjs';
const require = createRequire(import.meta.url);
const { listenBrowserSafe } = require('./ports.cjs');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ANSWER = 'Synthetic monitor bridge visitor 49';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition, timeout = 2500) {
  const end = Date.now() + timeout;
  while (!condition()) { if (Date.now() >= end) assert.fail('Bounded condition did not become true'); await delay(15); }
}

function metric(seq = 1) {
  return { version: 1, seq, sampled_at: '2026-10-29T12:00:00.000Z', timestamp_ms: 1793275200000 + seq, uptime_seconds: 3600,
    host: { hostname: 'synthetic-test-board', model: 'Synthetic board', os: 'Fixture OS', kernel: 'fixture', architecture: 'test', cpu_model: 'Synthetic CPU',
      cpu_physical_cores: 2, cpu_logical_cores: 2, cpu_sockets: 1, cpu_max_mhz: 1500, cache: { l1_bytes: null, l2_bytes: null, l3_bytes: null }, gpu_name: null },
    cpu: { percent: 25, per_core_percent: [0, 50], current_mhz: 1200, load_average: [0, .1, .2], processes: 1, threads: 2, open_files: null },
    memory: { total_bytes: 1024, available_bytes: 768, used_bytes: 256, free_bytes: 512, cached_bytes: 128, buffers_bytes: 32, percent: 25, swap_total_bytes: 0, swap_used_bytes: 0, swap_percent: 0 },
    disks: [{ name: 'fixture-disk', label: 'Fixture storage', kind: 'SD', mountpoint: '/', filesystem: 'fixture', total_bytes: 4096, used_bytes: 1024, free_bytes: 3072,
      percent: 25, active_percent: 0, read_bytes_per_sec: null, write_bytes_per_sec: 0, avg_response_ms: null }],
    networks: [{ name: 'fixture-net', is_up: true, addresses: ['192.0.2.1'], speed_mbps: 100, bytes_sent_total: 10, bytes_received_total: 20, send_bytes_per_sec: null, receive_bytes_per_sec: 0 }],
    temperature: { celsius: 42, high_celsius: null, critical_celsius: null },
    power: { flags_hex: null, current_under_voltage: null, current_throttled: null, current_frequency_capped: null, current_soft_temp_limit: null, under_voltage_occurred: null, throttling_occurred: null, updated_at: null },
    sampling: { interval_seconds: 1, process_interval_seconds: 3, last_error: null } };
}
function processMetric() {
  return { sampled_at: '2026-10-29T12:00:00.000Z', total_count: 1, threads_total: 2,
    processes: [{ pid: 42, name: 'synthetic-sampler', user: 'fixture', status: 'sleeping', cpu_percent: 0, memory_bytes: 32, memory_percent: null, threads: 2 }] };
}

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'monitor-bridge-test-'));
  const configFile = path.join(directory, 'auth.json'), stateFile = path.join(directory, 'rate-state.json');
  await savePrivate(configFile, await makeConfig(ANSWER));
  let origin, auth, bridge, behavior = 'ok', clock = Date.now(), sequence = 0;
  const received = [], liveStreams = new Set(), held = new Set();
  const upstream = http.createServer((req, res) => {
    received.push({ method: req.method, path: req.url, headers: { ...req.headers } });
    if (behavior === 'hold') { held.add(res); res.once('close', () => held.delete(res)); return; }
    if (behavior === 'redirect') { res.writeHead(302, { Location: 'http://example.invalid/private' }); res.end(); return; }
    if (behavior === 'offline') { res.writeHead(503, { 'Content-Type': 'text/html' }); res.end('<html>private backend error</html>'); return; }
    if (behavior === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>private backend error</html>'); return; }
    if (behavior === 'oversized') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': TASK_MANAGER_LIMITS.jsonBytes + 1 }); res.end('x'); return; }
    if (behavior === 'encoding') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }); res.end('not-gzip'); return; }
    if (req.url === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Set-Cookie': 'private_upstream=never_forward' });
      if (req.method === 'HEAD') { res.end(); return; }
      liveStreams.add(res);
      let waiting = false;
      const send = () => {
        if (waiting) return;
        if (behavior === 'idle-stream') return;
        if (behavior === 'invalid-stream') { res.write('data: {"private_error":"do not forward"}\n\n'); return; }
        if (behavior === 'oversized-stream') { res.write('data: ' + 'x'.repeat(TASK_MANAGER_LIMITS.streamFrameBytes + 1)); return; }
        const sample = metric(++sequence);
        sample.internal_path = 'never-forward-private-path'; sample.cpu.command_line = 'never-forward-command';
        if (behavior === 'burst-stream') sample.networks = Array.from({ length: 64 }, (_, index) => ({ ...sample.networks[0], name: 'fixture-' + index, addresses: Array.from({ length: 16 }, () => 'x'.repeat(240)) }));
        if (!res.write('event: untrusted-event\nid: untrusted-id\nretry: 1\ndata: ' + JSON.stringify(sample) + '\n\n')) { waiting = true; res.once('drain', () => { waiting = false; }); }
      };
      res.write(': connected\n\n'); send();
      const timer = setInterval(send, 50);
      res.once('close', () => { clearInterval(timer); liveStreams.delete(res); });
      return;
    }
    let value = req.url === '/api/health' ? { app: 'rpi-task-manager', ok: true, ready: true, version: '1.0.0', readonly: true }
      : req.url === '/api/processes' ? processMetric() : metric(++sequence);
    if (behavior === 'wrong-app') value.app = 'another-service';
    if (behavior === 'wrong-schema') value = { version: 2, internal_error: 'never-forward-private-path' };
    if (behavior === 'private-fields') {
      value.internal_path = 'never-forward-private-path';
      if (value.cpu) { value.cpu.command_line = 'never-forward-command'; value.sampling.last_error = '/private/data/token-must-not-escape'; }
      if (value.processes?.[0]) value.processes[0].environment = 'never-forward-environment';
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': 'private_upstream=never_forward', Location: '/private', 'X-Private-Header': 'never_forward' });
    res.end(behavior === 'malformed' ? '{not-json' : behavior === 'utf8' ? Buffer.from([0xff, 0xfe]) : JSON.stringify(value));
  });
  await listenBrowserSafe(upstream);
  const server = http.createServer((req, res) => void (async () => {
    if (req.headers.host !== new URL(origin).host) { res.writeHead(403); res.end(); return; }
    if (await auth.handle(req, res)) return;
    if (await bridge.handle(req, res)) return;
    res.writeHead(404); res.end();
  })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }));
  await listenBrowserSafe(server); origin = 'http://127.0.0.1:' + server.address().port;
  auth = await createDesktopAuth({ root: ROOT, configFile, stateFile, origin, now: () => clock });
  bridge = createTaskManagerProxy({ auth, port: upstream.address().port });
  t.after(async () => {
    await bridge.drain(); await auth.drain(); server.closeAllConnections(); upstream.closeAllConnections();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
    await rm(directory, { recursive: true, force: true });
  });
  function request(endpoint, { method = 'GET', headers = {}, body } = {}) {
    const target = endpoint.startsWith('/') ? endpoint : TASK_MANAGER_PREFIX + endpoint;
    return new Promise((resolve, reject) => {
      const req = http.request(origin, { path: target, method, headers, agent: false }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk));
        res.once('error', reject); res.once('end', () => {
          const text = Buffer.concat(chunks).toString('utf8'); let data;
          try { data = JSON.parse(text); } catch { data = null; }
          resolve({ status: res.statusCode, headers: res.headers, text, data });
        });
      });
      req.once('error', reject); req.end(body);
    });
  }
  async function login() {
    const initial = await request('/__desktop/auth');
    const oldCookie = initial.headers['set-cookie'][0].split(';')[0];
    const signed = await request('/__desktop/auth', { method: 'POST', headers: { Cookie: oldCookie, Origin: origin, 'Content-Type': 'application/json', 'X-Desktop-CSRF': initial.data.csrfToken }, body: JSON.stringify({ answer: ANSWER }) });
    assert.equal(signed.status, 200);
    return { Cookie: signed.headers['set-cookie'][0].split(';')[0], Origin: origin, 'X-Desktop-CSRF': signed.data.csrfToken };
  }
  function connect(headers, endpoint = 'events') {
    let response, raw = '', ended = false, failure;
    const req = http.get(origin, { path: TASK_MANAGER_PREFIX + endpoint, headers, agent: false });
    let resolveReady, resolveClosed;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const closed = new Promise(resolve => { resolveClosed = resolve; });
    const done = () => { ended = true; resolveClosed(); };
    req.once('response', res => {
      response = res; res.on('data', chunk => { raw += chunk.toString('utf8'); });
      res.once('end', done); res.once('close', done); res.once('error', error => { failure = error; done(); });
      resolveReady();
    });
    req.once('error', error => { failure = error; resolveReady(); done(); });
    return { ready, closed, status: () => response?.statusCode, headers: () => response?.headers, text: () => raw, ended: () => ended,
      close() { response?.destroy(); req.destroy(); }, pause() { response?.pause(); }, error: () => failure };
  }
  return { origin, auth, bridge, upstream, request, login, connect, received, liveStreams, held,
    behavior(value) { behavior = value; }, advance(ms) { clock += ms; } };
}

test('monitor configuration only accepts a fixed loopback integer port', () => {
  assert.equal(taskManagerPort(8765), 8765); assert.equal(taskManagerPort('23456'), 23456);
  for (const value of [0, -1, 65536, 1.5, 'http://127.0.0.1:8765', 'example.com:8765', '08765', ' 8765', '8765\n', {}, null]) assert.throws(() => taskManagerPort(value));
  assert.equal(TASK_MANAGER_LIMITS.streams, 8); assert.equal(TASK_MANAGER_LIMITS.authorizationCheckMs, 1000);
});

test('anonymous, forged, duplicate and pre-login cookies cannot read metrics or allocate monitor streams', async t => {
  const f = await fixture(t);
  for (const endpoint of ['health', 'snapshot', 'processes', 'events']) {
    for (const headers of [{}, { Cookie: 'aiden_desktop=' + '0'.repeat(64) }]) {
      const response = await f.request(endpoint, { headers });
      assert.equal(response.status, 401); assert.equal(response.headers['set-cookie'], undefined); assert.equal(response.data.readonly, true);
    }
  }
  const anonymous = await f.request('/__desktop/auth');
  assert.equal((await f.request('snapshot', { headers: { Cookie: anonymous.headers['set-cookie'][0].split(';')[0] } })).status, 401);
  const signed = await f.login();
  assert.equal((await f.request('health', { headers: { ...signed, Cookie: signed.Cookie + '; ' + signed.Cookie } })).status, 401);
  assert.equal(f.received.length, 0);
});

test('same-origin reads share the existing lease and never forward visitor identity or upstream headers', async t => {
  const f = await fixture(t), signed = await f.login();
  const headers = { ...signed, Authorization: 'never-forward', 'X-Real-IP': '192.0.2.9', 'X-Forwarded-For': '192.0.2.9', 'Sec-Fetch-Site': 'same-origin' };
  const response = await f.request('health', { headers });
  assert.equal(response.status, 200); assert.equal(response.data.app, 'rpi-task-manager');
  assert.equal(response.headers['cache-control'], 'no-store, private'); assert.equal(response.headers['set-cookie'], undefined);
  assert.equal(response.headers.location, undefined); assert.equal(response.headers['x-private-header'], undefined);
  const upstream = f.received[0];
  assert.equal(upstream.path, '/api/health'); assert.equal(upstream.headers.host, '127.0.0.1:' + f.upstream.address().port);
  for (const key of ['cookie', 'origin', 'authorization', 'x-real-ip', 'x-forwarded-for', 'x-desktop-csrf', 'sec-fetch-site']) assert.equal(upstream.headers[key], undefined, key);
  const head = await f.request('snapshot', { method: 'HEAD', headers: signed }); assert.equal(head.status, 200); assert.equal(head.text, '');
  const streamHead = await f.request('events', { method: 'HEAD', headers: signed }); assert.equal(streamHead.status, 200); assert.equal(streamHead.text, ''); assert.equal(f.liveStreams.size, 0);
  for (const fetchSite of ['same-origin', 'none', undefined]) {
    const read = { Cookie: signed.Cookie, ...(fetchSite ? { 'Sec-Fetch-Site': fetchSite } : {}) };
    assert.equal((await f.request('health', { headers: read })).status, 200);
  }
});

test('cross-origin, cross-site and ambiguous routes or write methods are rejected before upstream access', async t => {
  const f = await fixture(t), signed = await f.login();
  for (const headers of [{ ...signed, Origin: 'https://foreign.invalid' }, { ...signed, 'Sec-Fetch-Site': 'cross-site' }, { Cookie: signed.Cookie, 'Sec-Fetch-Site': 'same-site' }, { Cookie: signed.Cookie, Origin: 'null' }]) {
    assert.equal((await f.request('health', { headers })).status, 403);
  }
  for (const raw of ['/__desktop/task-manager', '/__desktop/task-manager/health?', '/__desktop/task-manager/health?x=1', '/__desktop/task-manager/%68ealth', '/__desktop/task-manager/health/', '/__desktop/task-manager//health', '/__desktop/task-manager/../auth', '/__desktop/task-manager/%2e%2e/auth', '/__desktop/task-manager/https://foreign.invalid']) {
    assert.equal((await f.request(raw, { headers: signed })).status, 404, raw);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const response = await f.request('snapshot', { method, headers: signed }); assert.equal(response.status, 405); assert.equal(response.headers.allow, 'GET, HEAD');
  }
  assert.equal(f.received.length, 0);
});

test('JSON contract keeps real nullable metrics while dropping unknown fields and internal errors', async t => {
  const f = await fixture(t), signed = await f.login(); f.behavior('private-fields');
  const snapshot = await f.request('snapshot', { headers: signed });
  assert.equal(snapshot.status, 200); assert.equal(snapshot.data.cpu.per_core_percent[0], 0); assert.equal(snapshot.data.cpu.open_files, null); assert.equal(snapshot.data.host.gpu_name, null);
  assert.equal(snapshot.data.internal_path, undefined); assert.equal(snapshot.data.cpu.command_line, undefined); assert.equal(snapshot.data.sampling.last_error, '只读采样暂时不可用');
  assert(!snapshot.text.includes('/private/')); assert(!snapshot.text.includes('never-forward'));
  const processes = await f.request('processes', { headers: signed });
  assert.equal(processes.status, 200); assert.equal(processes.data.processes[0].environment, undefined); assert.equal(processes.data.processes[0].memory_percent, null);
});

test('wrong monitor, HTML, redirects, invalid UTF-8, schemas, compressed and oversized bodies fail closed', async t => {
  const f = await fixture(t), signed = await f.login();
  for (const behavior of ['wrong-app', 'html', 'redirect', 'wrong-schema', 'malformed', 'utf8', 'encoding', 'oversized']) {
    f.behavior(behavior);
    const response = await f.request(behavior === 'wrong-app' ? 'health' : 'snapshot', { headers: signed });
    assert.equal(response.status, 502, behavior); assert.equal(response.data.readonly, true);
    assert(!response.text.includes('private backend error')); assert(!response.text.includes('never-forward-private-path'));
  }
  f.behavior('offline'); assert.equal((await f.request('health', { headers: signed })).status, 503);
});

test('read authorization does not refresh TTL and is rechecked before delayed JSON delivery', async t => {
  const f = await fixture(t), signed = await f.login();
  const request = { method: 'GET', headers: { cookie: signed.Cookie, origin: f.origin } };
  const lease = f.auth.authorizeRead(request); assert.equal(lease.ok, true);
  f.advance(8 * 60 * 60 * 1000 - 1); assert.equal(f.auth.authorizeRead(request).ok, true);
  assert.equal((await f.request('health', { headers: signed })).status, 200);
  f.behavior('hold'); const pending = f.request('snapshot', { headers: signed });
  await until(() => f.held.size === 1); f.advance(2);
  for (const res of f.held) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(metric())); }
  const result = await pending; assert.equal(result.status, 401); assert(!result.text.includes('synthetic-test-board'));
  assert.equal(lease.isValid(), false); assert.equal((await f.request('health', { headers: signed })).status, 401);
});

test('SSE proxies validated samples and strips untrusted SSE fields and cookies', async t => {
  const f = await fixture(t), signed = await f.login(), stream = f.connect(signed); t.after(() => stream.close());
  await stream.ready; await until(() => stream.text().includes('data: '));
  assert.equal(stream.status(), 200); assert.equal(stream.headers()['x-accel-buffering'], 'no'); assert.equal(stream.headers()['set-cookie'], undefined);
  assert(stream.text().includes('retry: 3000')); assert(!stream.text().includes('untrusted-event')); assert(!stream.text().includes('untrusted-id')); assert(!stream.text().includes('never-forward'));
  const value = JSON.parse(stream.text().split('\n').find(line => line.startsWith('data: ')).slice(6));
  assert.equal(value.version, 1); assert.deepEqual(value.cpu.per_core_percent, [0, 50]);
  stream.close(); await until(() => f.liveStreams.size === 0);
});

test('logout revokes an open stream and destroys its upstream connection', async t => {
  const f = await fixture(t), signed = await f.login(), stream = f.connect(signed); t.after(() => stream.close());
  await stream.ready; await until(() => stream.text().includes('data: '));
  const logout = await f.request('/__desktop/auth', { method: 'DELETE', headers: signed }); assert.equal(logout.status, 200);
  await until(stream.ended, 1400); await until(() => f.liveStreams.size === 0);
  const stoppedAt = stream.text(); await delay(100); assert.equal(stream.text(), stoppedAt);
  assert.equal((await f.request('snapshot', { headers: signed })).status, 401);
});

test('expiry and auth drain revoke idle streams within the one-second lease check', async t => {
  const f = await fixture(t), signed = await f.login(); f.behavior('idle-stream');
  const first = f.connect(signed); t.after(() => first.close()); await first.ready;
  f.advance(8 * 60 * 60 * 1000 + 1); await until(first.ended, 1400); await until(() => f.liveStreams.size === 0);
  const fresh = await f.login(), second = f.connect(fresh); t.after(() => second.close()); await second.ready;
  await f.auth.drain(); await until(second.ended, 1400); await until(() => f.liveStreams.size === 0);
  assert.equal((await f.request('health', { headers: fresh })).status, 503);
});

test('stream quotas bound each session and the entire proxy and are released on disconnect', async t => {
  const f = await fixture(t), sessions = [], streams = []; t.after(() => streams.forEach(stream => stream.close()));
  for (let i = 0; i < 5; i++) sessions.push(await f.login());
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const stream = f.connect(sessions[i]); streams.push(stream); await stream.ready; assert.equal(stream.status(), 200); }
  assert.equal(f.liveStreams.size, 8);
  const perSession = f.connect(sessions[0]); streams.push(perSession); await perSession.ready; assert.equal(perSession.status(), 429);
  const global = f.connect(sessions[4]); streams.push(global); await global.ready; assert.equal(global.status(), 429);
  streams[0].close(); await until(() => f.liveStreams.size === 7);
  const replacement = f.connect(sessions[4]); streams.push(replacement); await replacement.ready; assert.equal(replacement.status(), 200);
  for (const stream of streams) stream.close(); await until(() => f.liveStreams.size === 0);
});

test('concurrent JSON requests are bounded and upstream timeout is finite', async t => {
  const f = await fixture(t), signed = await f.login(); f.behavior('hold');
  const pending = Array.from({ length: 4 }, () => f.request('snapshot', { headers: signed }));
  await until(() => f.held.size === 4);
  const limited = await f.request('snapshot', { headers: signed }); assert.equal(limited.status, 429);
  const replies = await Promise.all(pending); assert(replies.every(reply => reply.status === 503));
  await until(() => f.held.size === 0);
});

test('invalid and oversized SSE frames end the stream without forwarding an error body', async t => {
  const f = await fixture(t), signed = await f.login();
  for (const behavior of ['invalid-stream', 'oversized-stream']) {
    f.behavior(behavior); const stream = f.connect(signed); t.after(() => stream.close());
    await stream.ready; await until(stream.ended);
    assert(!stream.text().includes('private_error')); assert(!stream.text().includes('do not forward'));
    await until(() => f.liveStreams.size === 0);
  }
});

test('bridge drain closes active streams and pending reads without affecting authentication', async t => {
  const f = await fixture(t), signed = await f.login(), stream = f.connect(signed); t.after(() => stream.close()); await stream.ready;
  f.behavior('hold'); const pending = f.request('processes', { headers: signed }); await until(() => f.held.size === 1);
  await f.bridge.drain(); await f.bridge.drain();
  assert.equal((await pending).status, 503); await until(stream.ended); await until(() => f.liveStreams.size === 0 && f.held.size === 0);
  assert.equal((await f.request('health', { headers: signed })).status, 503);
  assert.equal((await f.request('/__desktop/auth', { headers: signed })).data.authenticated, true);
});

test('an absent loopback monitor produces a redacted unavailable response', async t => {
  const f = await fixture(t), signed = await f.login();
  await new Promise(resolve => f.upstream.close(resolve));
  const response = await f.request('snapshot', { headers: signed });
  assert.equal(response.status, 503); assert.equal(response.data.error, 'monitor_unavailable');
  assert(!response.text.includes('ECONNREFUSED')); assert(!response.text.includes('127.0.0.1'));
});

test('SSE heartbeat does not hide a stalled upstream and the read deadline releases the slot', async t => {
  const f = await fixture(t), signed = await f.login(); f.behavior('idle-stream');
  const stream = f.connect(signed); t.after(() => stream.close()); await stream.ready;
  await until(stream.ended, TASK_MANAGER_LIMITS.upstreamIdleMs + 1500);
  assert(stream.text().includes(': heartbeat')); assert(!stream.text().includes('data: '));
  await until(() => f.liveStreams.size === 0);
});

test('a client that stops reading cannot retain an unbounded upstream stream', async t => {
  const f = await fixture(t), signed = await f.login(); f.behavior('burst-stream');
  const stream = f.connect(signed); t.after(() => stream.close()); await stream.ready; stream.pause();
  await until(() => f.liveStreams.size === 0, 12000);
  assert.equal(stream.status(), 200);
  stream.close();
  f.behavior('ok'); const replacement = f.connect(signed); t.after(() => replacement.close()); await replacement.ready;
  assert.equal(replacement.status(), 200); await until(() => replacement.text().includes('data: '));
});
