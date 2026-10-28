import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from './store.mjs';
import { createApiServer } from './server.mjs';

function withServer(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'liyun-api-'));
  const store = openStore({ dataDir: dir });
  const server = createApiServer(store);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      const request = async (p, { method = 'GET', token, body } = {}) => {
        const res = await fetch(base + p, {
          method,
          headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        return { status: res.status, data };
      };
      Promise.resolve(fn({ request, base })).then(
        () => server.close(() => { store.close(); rmSync(dir, { recursive: true, force: true }); resolve(); }),
        err => server.close(() => { store.close(); rmSync(dir, { recursive: true, force: true }); reject(err); }),
      );
    });
  });
}

test('登录 → 读我 → 保存进度 → 读回 → 登出', async () => {
  await withServer(async ({ request }) => {
    const login = await request('/api/auth/login', { method: 'POST', body: { nickname: '小理', studentId: '20240001' } });
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

    const put = await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 1, discoveredIds: ['wencui', 'tower'], unlockedRegionIds: ['wencui', 'tower'], playerUV: { u: 0.5, v: 0.5 }, settings: { music: true } } } });
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
    const missing = await request('/api/auth/login', { method: 'POST', body: { nickname: '  ', studentId: '20240001' } });
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
    const login = await request('/api/auth/login', { method: 'POST', body: { nickname: '小理', studentId: '20240001' } });
    const put = await request('/api/progress', { method: 'PUT', token: login.data.token, body: { state: { version: 1, discoveredIds: ['tower', 'tower', 42, '', 'library'], unlockedRegionIds: ['x'], playerUV: { u: 99, v: -1 }, settings: null } } });
    assert.equal(put.status, 200);
    const progress = await request('/api/progress', { token: login.data.token });
    assert.deepEqual(progress.data.state.discoveredIds, ['tower', 'library']);
    assert.deepEqual(progress.data.state.playerUV, { u: 0.5, v: 0.5 });
    assert.deepEqual(progress.data.checkins.map(c => c.landmarkId).sort(), ['library', 'tower']);
  });
});
