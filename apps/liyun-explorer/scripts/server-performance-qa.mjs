// Loopback only. Synthetic accounts and a temporary SQLite database.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { openStore } from '../server/store.mjs';
import { createApiServer } from '../server/server.mjs';

const dir = await mkdtemp(join(tmpdir(), 'liyun-perf-'));
const store = openStore({ dataDir: dir });
const server = createApiServer(store, { production: false, publicOrigin: null });
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const login = async n => {
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'fixture', studentId: 'perf-fixture-' + n, password: 'synthetic-perf-only' }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).token;
  };
  const token = await login(0);
  for (let n = 1; n < 5; n++) await login(n);
  const run = [];
  for (let batch = 0; batch < 5; batch++) {
    const timer = monitorEventLoopDelay({ resolution: 5 });
    timer.enable();
    await pause(20);
    timer.reset();
    const began = performance.now();
    const pending = [1, 2, 3, 4].map(login);
    const probe = async () => {
      const t = performance.now();
      const response = await fetch(base + '/api/progress', { headers: { 'Authorization': 'Bearer ' + token } });
      assert.equal(response.status, 200);
      await response.json();
      return performance.now() - t;
    };
    const probes = [];
    // A timer-driven client request measures both the blocked scheduling and the HTTP response.
    for (let n = 1; n <= 6; n++) {
      probes.push((async () => {
        const deadline = began + n * 10;
        await pause(Math.max(1, deadline - performance.now()));
        return performance.now() - deadline + await probe();
      })());
    }
    try {
      const [loginMs, delays] = await Promise.all([Promise.all(pending).then(() => performance.now() - began), Promise.all(probes)]);
      await pause(15);
      run.push({ loginBatchMs: +loginMs.toFixed(1), maxProgressDelayMs: +Math.max(...delays).toFixed(1), eventLoopMaxMs: +(timer.max / 1e6).toFixed(1) });
    } finally { timer.disable(); }
  }
  console.log(JSON.stringify({ method: '5 loopback runs; 4 simultaneous logins against a temporary account store plus 6 timed progress reads', run }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
  store.close();
  await rm(dir, { recursive: true, force: true });
}
