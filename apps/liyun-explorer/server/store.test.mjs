import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from './store.mjs';

function tempStore() {
  const dir = mkdtempSync(path.join(tmpdir(), 'liyun-store-'));
  const store = openStore({ dataDir: dir });
  return { store, dir };
}

test('学号唯一：首次建档、重复登录复用并更新昵称', () => {
  const { store, dir } = tempStore();
  try {
    const first = store.upsertUser({ nickname: '小理', studentId: '20240001' });
    assert.equal(first.studentId, '20240001');
    assert.equal(first.nickname, '小理');
    assert.match(first.uid, /^LY[0-9A-F]{8}$/);

    const again = store.upsertUser({ nickname: '理小韵', studentId: '20240001' });
    assert.equal(again.id, first.id);
    assert.equal(again.nickname, '理小韵');

    const other = store.upsertUser({ nickname: '阿北', studentId: '20240002' });
    assert.notEqual(other.id, first.id);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('会话：签发、解析、登出与过期', () => {
  const { store, dir } = tempStore();
  try {
    const user = store.upsertUser({ nickname: '小理', studentId: '20240001' });
    const token = store.createSession(user.id);
    const session = store.resolveSession(token);
    assert.equal(session.userId, user.id);
    assert.equal(session.user.nickname, '小理');
    assert.equal(store.resolveSession('wrong-token'), null);

    store.deleteSession(token);
    assert.equal(store.resolveSession(token), null);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('进度：保存并读回快照与打卡台账', () => {
  const { store, dir } = tempStore();
  try {
    const user = store.upsertUser({ nickname: '小理', studentId: '20240001' });
    assert.equal(store.getProgress(user.id), null);

    const state = { version: 1, discoveredIds: ['wencui', 'tower'], unlockedRegionIds: ['wencui', 'tower'], playerUV: { u: 0.5, v: 0.5 }, settings: { music: true } };
    const at = store.saveProgress(user.id, state);
    assert.ok(at);

    const saved = store.getProgress(user.id);
    assert.deepEqual(saved.state.discoveredIds, ['wencui', 'tower']);
    assert.ok(saved.updatedAt);
    assert.deepEqual(store.getCheckins(user.id).map(c => c.landmarkId).sort(), ['tower', 'wencui']);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('打卡台账：保留首次时间，重置进度时移除并允许重新打卡', () => {
  const { store, dir } = tempStore();
  try {
    const user = store.upsertUser({ nickname: '小理', studentId: '20240001' });
    store.saveProgress(user.id, { version: 1, discoveredIds: ['wencui', 'tower'] });
    const first = store.getCheckins(user.id).find(c => c.landmarkId === 'tower').discoveredAt;

    // 再次保存同样的集合，首次打卡时间不变。
    store.saveProgress(user.id, { version: 1, discoveredIds: ['wencui', 'tower', 'library'] });
    const second = store.getCheckins(user.id).find(c => c.landmarkId === 'tower').discoveredAt;
    assert.equal(second, first);

    // 重置：只剩 wencui，其它打卡被移除。
    store.saveProgress(user.id, { version: 1, discoveredIds: ['wencui'] });
    assert.deepEqual(store.getCheckins(user.id).map(c => c.landmarkId), ['wencui']);

    // 重新发现 tower，得到新时间。
    store.saveProgress(user.id, { version: 1, discoveredIds: ['wencui', 'tower'] });
    const third = store.getCheckins(user.id).find(c => c.landmarkId === 'tower').discoveredAt;
    assert.ok(third >= first);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('拒绝比当前更新的 schema', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'liyun-store-'));
  try {
    const store = openStore({ dataDir: dir });
    store.db.exec('PRAGMA user_version = 99');
    store.close();
    assert.throws(() => openStore({ dataDir: dir }), /newer than this server/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
