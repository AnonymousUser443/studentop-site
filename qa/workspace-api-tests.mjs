import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT, accountApiHealthy } from '../tools/dev-workspace.mjs';
import { makeConfig, savePrivate } from '../tools/desktop-auth.mjs';

const require = createRequire(import.meta.url);
const { listenBrowserSafe } = require('./ports.cjs');
const IDS = ['site', 'liyun-api', 'liyun', 'campus', 'voxel'];

async function portsAvailable(ports) {
  for (const port of ports) {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', error => reject(new Error(`Test requires free loopback port ${port}; no existing service was changed.`, { cause: error })));
      server.listen({ host: '127.0.0.1', port, exclusive: true }, resolve);
    });
    await new Promise(resolve => server.close(resolve));
  }
}

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'workspace-api-test-'));
  const ports = {}, reservations = [];
  try {
    for (const id of IDS) {
      const server = net.createServer();
      reservations.push(server);
      ports[id] = await listenBrowserSafe(server);
    }
  } finally { await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve)))); }
  const config = path.join(dir, 'auth.json');
  await savePrivate(config, await makeConfig('Synthetic workspace visitor 86'));
  const bootstrap = path.join(dir, 'run.mjs');
  await writeFile(bootstrap, `import {run} from ${JSON.stringify(new URL('../tools/dev-workspace.mjs', import.meta.url).href)};\nrun(process.argv.slice(2), {ports:${JSON.stringify(ports)},cacheRoot:${JSON.stringify(path.join(dir, 'vite-cache'))}}).catch(error=>{console.error(error.message);process.exitCode=1;});\n`);
  const base = id => 'http://127.0.0.1:' + ports[id];
  return { dir, ports, base, bootstrap, env: { DESKTOP_AUTH_CONFIG: config, LIYUN_DATA_DIR: path.join(dir, 'data') }, close: () => rm(dir, { recursive: true, force: true }) };
}

function launch(t, fixture, args = [], overrides = {}) {
  const child = spawn(process.execPath, [fixture.bootstrap, ...args], {
    cwd: ROOT, env: { ...process.env, ...fixture.env, ...overrides }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '', done = false;
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-12000); });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => { done = true; resolve({ code, signal }); }));
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.on('message', message => { if (message?.event === 'ready' || message?.type === 'ready') resolve(message); });
    child.once('exit', code => reject(new Error(`Runner exited before ready (${code}): ${output}`)));
  });
  ready.catch(() => {}); // Failure tests intentionally wait for exit instead of ready.
  async function bounded(promise, timeout = 20000) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Runner timeout: ${output}`)), timeout); })]); }
    finally { clearTimeout(timer); }
  }
  async function stop() {
    if (!done && child.connected) child.send({ type: 'shutdown' });
    try { return await bounded(exited, 8000); }
    catch (error) {
      if (!done) child.kill(); // This exact process only; IPC loss makes its children close.
      await bounded(exited, 5000);
      throw error;
    }
  }
  t.after(async () => { try { await stop(); } finally { await fixture.close(); } });
  return { child, stop, ready: () => bounded(ready), exited: () => bounded(exited), output: () => output };
}

async function sentinel(t, port) {
  const server = http.createServer((req, res) => res.end('unrelated-test-service'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, resolve);
  });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return server;
}

test('account health requires actual JSON success and bounds failures and timeouts', async t => {
  let behavior = 'ok';
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/api/health');
    assert.equal(req.headers.authorization, undefined);
    if (behavior === 'hang') return;
    if (behavior === 'redirect') { res.writeHead(302, { Location: '/elsewhere' }); res.end(); return; }
    res.writeHead(behavior === 'unavailable' ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(behavior === 'ok' ? '{"ok":true}' : behavior === 'bad-json' ? '<html>bad</html>' : behavior === 'oversized' ? 'x'.repeat(2048) : '{"ok":false}');
  });
  await listenBrowserSafe(server);
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const port = server.address().port;
  assert.equal(await accountApiHealthy(port), true);
  for (behavior of ['false', 'unavailable', 'redirect', 'bad-json', 'oversized', 'hang']) {
    assert.equal(await accountApiHealthy(port, 100), false, behavior);
  }
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  assert.equal(await accountApiHealthy(port, 100), false);
});

test('full launcher owns five healthy services and proxies persisted account progress through Vite', async t => {
  const f = await fixture(t);
  const run = launch(t, f, [], {
    // The managed companion must retain the fixed development contract despite standalone overrides.
    LIYUN_API_HOST: '0.0.0.0', LIYUN_API_PORT: '9999', PORT: '9998',
    LIYUN_PUBLIC_ORIGIN: 'https://unused-production.example.test',
  });
  const ready = await run.ready();
  assert.equal(ready.ok, true);
  assert.deepEqual(ready.services.map(({ id, port, status }) => [id, port, status]), IDS.map(id => [id, f.ports[id], 'ready']));
  const health = await fetch(f.base('site') + '/__workspace/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).services.length, 5);
  const proxiedHealth = await fetch(f.base('liyun') + '/api/health');
  assert.equal(proxiedHealth.status, 200);
  assert.deepEqual(await proxiedHealth.json(), { ok: true });
  const request = async (route, { method = 'GET', body, token } = {}) => {
    const response = await fetch(f.base('liyun') + '/api' + route, {
      method, headers: { Origin: f.base('liyun'), 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 200, route);
    return response.json();
  };
  const login = await request('/auth/login', { method: 'POST', body: { nickname: 'QA-WORKSPACE', studentId: 'qa-unified-runner', password: 'synthetic-passphrase-86' } });
  assert.equal((await request('/auth/me', { token: login.token })).user.id, login.user.id);
  await request('/progress', { method: 'PUT', token: login.token, body: { state: { version: 2, discoveredIds: ['beihu'], settings: { music: false } } } });
  assert.deepEqual((await request('/progress', { token: login.token })).state.discoveredIds, ['beihu']);
  assert((await stat(path.join(f.dir, 'data/liyun.sqlite'))).isFile());
  assert.deepEqual(await run.stop(), { code: 0, signal: null });
  await portsAvailable(Object.values(f.ports));
  const { openStore } = await import('../apps/liyun-explorer/server/store.mjs');
  const store = openStore({ dataDir: path.join(f.dir, 'data') });
  try { assert.deepEqual(store.getProgress(login.user.id).state.discoveredIds, ['beihu']); }
  finally { store.close(); }
});

test('site-only ignores the account API and its occupied port without opening a database', async t => {
  const f = await fixture(t);
  const external = await sentinel(t, f.ports['liyun-api']);
  const run = launch(t, f, ['--site-only']);
  const ready = await run.ready();
  assert.deepEqual(ready.services.map(s => s.id), ['site']);
  const health = await fetch(f.base('site') + '/__workspace/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).services.length, 1);
  await assert.rejects(stat(path.join(f.dir, 'data')), { code: 'ENOENT' });
  assert.deepEqual(await run.stop(), { code: 0, signal: null });
  assert.equal(external.listening, true);
  assert.equal(await fetch(f.base('liyun-api') + '/').then(r => r.text()), 'unrelated-test-service');
});

test('occupied API port fails startup and never reuses or closes the existing service', async t => {
  const f = await fixture(t);
  const external = await sentinel(t, f.ports['liyun-api']);
  const run = launch(t, f);
  assert.deepEqual(await run.exited(), { code: 1, signal: null });
  assert.match(run.output(), /liyun-api: exited/);
  assert.equal(external.listening, true);
  assert.equal(await fetch(f.base('liyun-api') + '/').then(r => r.text()), 'unrelated-test-service');
  await portsAvailable(IDS.filter(id => id !== 'liyun-api').map(id => f.ports[id]));
});

test('later Vite startup failure closes the owned API and earlier frontend, preserving the conflicting service', async t => {
  const f = await fixture(t);
  const external = await sentinel(t, f.ports.campus);
  const run = launch(t, f);
  assert.deepEqual(await run.exited(), { code: 1, signal: null });
  assert.match(run.output(), /campus: exited/);
  assert.equal(external.listening, true);
  assert.equal(await fetch(f.base('campus') + '/').then(r => r.text()), 'unrelated-test-service');
  await portsAvailable(IDS.filter(id => id !== 'campus').map(id => f.ports[id]));
});

test('IPC loss stops the full workspace and releases every owned listener', async t => {
  const f = await fixture(t);
  const run = launch(t, f);
  await run.ready();
  run.child.disconnect();
  assert.deepEqual(await run.exited(), { code: 0, signal: null });
  await portsAvailable(Object.values(f.ports));
});

test('an owned account process exiting after startup fails the workspace and closes its siblings', async t => {
  const f = await fixture(t);
  const run = launch(t, f);
  const ready = await run.ready();
  const api = ready.children.find(child => child.id === 'liyun-api');
  assert(Number.isInteger(api?.pid) && api.pid > 0);
  process.kill(api.pid, 'SIGTERM'); // PID reported over this test instance's private IPC.
  assert.deepEqual(await run.exited(), { code: 1, signal: null });
  assert.match(run.output(), /liyun-api: exited/);
  await portsAvailable(Object.values(f.ports));
});
