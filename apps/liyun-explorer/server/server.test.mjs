import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from './store.mjs';
import { createApiServer } from './server.mjs';
import { START_UV } from './progress.mjs';
const PASSWORD = 'synthetic-passphrase-24';

function withServer(fn, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'liyun-api-'));
  const store = openStore({ dataDir: dir });
  const server = createApiServer(store, { production: false, publicOrigin: null, ...options });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      const request = async (p, { method = 'GET', token, body, headers = {} } = {}) => {
        const res = await fetch(base + p, {
          method,
          headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        return { status: res.status, data, headers: res.headers };
      };
      Promise.resolve(fn({ request, base, store })).then(
        () => server.close(() => { store.close(); rmSync(dir, { recursive: true, force: true }); resolve(); }),
        err => server.close(() => { store.close(); rmSync(dir, { recursive: true, force: true }); reject(err); }),
      );
    });
  });
}

test('登录 → 读我 → 保存进度 → 读回 → 登出', async () => {
  await withServer(async ({ request }) => {
    const login = await request('/api/auth/login', { method: 'POST', body: { nickname: '小理', studentId: '20240001', password: PASSWORD } });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);
    assert.equal(login.data.user.nickname, '小理');
    assert.equal(login.data.user.studentId, '20240001');

    const me = await request('/api/auth/me', { token: login.data.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.id, login.data.user.id);

    const empty = await request('/api/progress', { token: login.data.token });
    assert.equal(empty.status, 200);
    assert.equal(empty.data.state, null);
    assert.deepEqual(empty.data.checkins, []);

    const put = await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 2, discoveredIds: ['wencui', 'tower'], unlockedRegionIds: ['wencui', 'tower'], playerUV: { u: 0.5, v: 0.5 }, settings: { music: true } } } });
    assert.equal(put.status, 200);
    assert.ok(put.data.updatedAt);

    const progress = await request('/api/progress', { token: login.data.token });
    assert.deepEqual(progress.data.state.discoveredIds, ['wencui', 'tower']);
    assert.deepEqual(progress.data.checkins.map(c => c.landmarkId).sort(), ['tower', 'wencui']);

    const logout = await request('/api/auth/logout', { method: 'POST', token: login.data.token });
    assert.equal(logout.status, 200);
    const after = await request('/api/auth/me', { token: login.data.token });
    assert.equal(after.status, 401);
  });
});

test('同学号错误口令拒绝，不返回token，不改昵称/进度；正确口令仍可登录', async () => {
  await withServer(async ({ request }) => {
    const first = await request('/api/auth/login', { method: 'POST', body: { nickname: 'fixture', studentId: 'takeover-demo', password: PASSWORD } });
    await request('/api/progress', { method: 'PUT', token: first.data.token, body: { state: { version: 2, discoveredIds: ['tower'] } } });
    const wrong = await request('/api/auth/login', { method: 'POST', body: { nickname: 'attacker', studentId: 'takeover-demo', password: 'wrong-fixture-pass' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.data.token, undefined);
    assert.equal(JSON.stringify(wrong.data).includes('wrong-fixture-pass'), false);
    const me = await request('/api/auth/me', { token: first.data.token });
    assert.equal(me.data.user.nickname, 'fixture');
    assert.deepEqual((await request('/api/progress', { token: first.data.token })).data.state.discoveredIds, ['tower']);
    const right = await request('/api/auth/login', { method: 'POST', body: { nickname: 'new-fixture', studentId: 'takeover-demo', password: PASSWORD } });
    assert.equal(right.status, 200);
    assert.equal(right.data.user.id, first.data.user.id);
    assert.equal(right.data.user.nickname, 'new-fixture');
  });
});

test('失败节流：第五次失败后返回429/Retry-After，时间窗结束可重试', async () => {
  let now = 1000000;
  await withServer(async ({ request }) => {
    const body = { nickname: 'fixture', studentId: 'throttle-demo', password: PASSWORD };
    assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 200);
    for (let n = 0; n < 5; n++) assert.equal((await request('/api/auth/login', { method: 'POST', body: { ...body, password: 'wrong-fixture-pass' } })).status, 401);
    const limited = await request('/api/auth/login', { method: 'POST', body });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    for (let n = 0; n < 40; n++) assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 429);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { nickname: 'other-fixture', studentId: 'other-account', password: PASSWORD } })).status, 200);
    now += 300001;
    assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 200);
  }, { now: () => now });
});

test('生产须显式HTTPS origin，修改请求校验Origin，跨源/无Origin不写入', async () => {
  assert.throws(() => createApiServer({}, { production: true, publicOrigin: null }), /LIYUN_PUBLIC_ORIGIN/);
  assert.throws(() => createApiServer({}, { production: true, publicOrigin: 'http://localhost:8081' }), /HTTPS/);
  const origin = 'https://liyun.example.test:14355';
  await withServer(async ({ request, store }) => {
    const body = { nickname: 'fixture', studentId: 'origin-demo', password: PASSWORD };
    assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 403);
    assert.equal((await request('/api/auth/login', { method: 'POST', body, headers: { Origin: 'https://other.example.test' } })).status, 403);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
    const login = await request('/api/auth/login', { method: 'POST', body, headers: { Origin: origin } });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('cache-control'), 'no-store');
    assert.equal((await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 2 } }, headers: { Origin: 'null' } })).status, 403);
    assert.equal((await request('/api/auth/me', { token: login.data.token, headers: { Origin: 'https://other.example.test' } })).status, 403);
    assert.equal((await request('/api/auth/logout', { method: 'POST', token: login.data.token, headers: { Origin: origin } })).status, 200);
  }, { production: true, publicOrigin: origin });
});

test('拒绝非对象JSON/错误字段类型/非法口令，敏感字段不落盘', async () => {
  await withServer(async ({ request, base, store }) => {
    for (const body of [null, [], 'bad', 42, { nickname: {}, studentId: 'demo', password: PASSWORD }, { nickname: 'fixture', studentId: [], password: PASSWORD }, { nickname: 'fixture', studentId: 'demo', password: 'short' }]) {
      assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 400);
    }
    const malformed = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400); await malformed.text();
    const wrongType = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(wrongType.status, 415); await wrongType.text();
    const oversized = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(9000) }) });
    assert.equal(oversized.status, 413); await oversized.text();
    const login = await request('/api/auth/login', { method: 'POST', body: { nickname: 'fixture', studentId: 'privacy-demo', password: PASSWORD } });
    const put = await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 2, discoveredIds: ['tower'], rawGPS: 'private-gps-marker', password: 'private-password-marker', playerUV: { u: 0.12345, v: 0.54321 }, settings: { secret: 'private-settings-marker' } } } });
    assert.equal(put.status, 200);
    const raw = store.db.prepare('SELECT state_json FROM progress').get().state_json;
    assert.equal(raw.includes('private-'), false);
    assert.deepEqual(JSON.parse(raw).playerUV, START_UV);
    assert.equal((await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: null } })).status, 400);
    await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 1, discoveredIds: ['tower'], settings: { music: false } } } });
    const old = await request('/api/progress', { token: login.data.token });
    assert.deepEqual(old.data.state.discoveredIds, []); assert.deepEqual(old.data.checkins, []);
    assert.equal(old.data.state.settings.music, false);
  });
});

test('未登录访问受保护接口返回 401', async () => {
  await withServer(async ({ request }) => {
    for (const [method, p] of [['GET', '/api/progress'], ['PUT', '/api/progress'], ['GET', '/api/auth/me'], ['POST', '/api/auth/logout']]) {
      const res = await request(p, { method });
      assert.equal(res.status, 401, `${method} ${p}`);
    }
  });
});

test('校验入参：空昵称/学号、非法 JSON、超大 body', async () => {
  await withServer(async ({ request }) => {
    const missing = await request('/api/auth/login', { method: 'POST', body: { nickname: '  ', studentId: '20240001', password: PASSWORD } });
    assert.equal(missing.status, 400);

    const badJson = await request('/api/auth/login', { method: 'POST', body: '{' });
    assert.equal(badJson.status, 400);

    const health = await request('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);
  });
});

test('进度清洗：非法 discoveredIds 被过滤，非法坐标回落默认', async () => {
  await withServer(async ({ request }) => {
    const login = await request('/api/auth/login', { method: 'POST', body: { nickname: '小理', studentId: '20240001', password: PASSWORD } });
    const put = await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 2, discoveredIds: ['tower', 'tower', 42, '', 'library'], unlockedRegionIds: ['x'], playerUV: { u: 99, v: -1 }, settings: null } } });
    assert.equal(put.status, 200);
    const progress = await request('/api/progress', { token: login.data.token });
    assert.deepEqual(progress.data.state.discoveredIds, ['tower', 'library']);
    assert.deepEqual(progress.data.state.playerUV, START_UV);
    assert.deepEqual(progress.data.checkins.map(c => c.landmarkId).sort(), ['library', 'tower']);
  });
});
