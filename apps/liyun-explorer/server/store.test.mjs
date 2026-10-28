import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from './store.mjs';
import { LANDMARK_UVS, START_UV } from './progress.mjs';
const PASSWORD = 'synthetic-passphrase-24';

function tempStore() {
  const dir = mkdtempSync(path.join(tmpdir(), 'liyun-store-'));
  const store = openStore({ dataDir: dir });
  return { store, dir };
}

test('学号唯一：首次建档、重复登录复用并更新昵称', () => {
  const { store, dir } = tempStore();
  try {
    const first = store.upsertUser({ nickname: '小理', studentId: '20240001', password: PASSWORD });
    assert.equal(first.studentId, '20240001');
    assert.equal(first.nickname, '小理');
    assert.match(first.uid, /^LY[0-9A-F]{8}$/);

    const again = store.upsertUser({ nickname: '理小韵', studentId: '20240001', password: PASSWORD });
    assert.equal(again.id, first.id);
    assert.equal(again.nickname, '理小韵');

    const other = store.upsertUser({ nickname: '阿北', studentId: '20240002', password: PASSWORD });
    assert.notEqual(other.id, first.id);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('会话：签发、解析、登出与过期', () => {
  const { store, dir } = tempStore();
  try {
    const user = store.upsertUser({ nickname: '小理', studentId: '20240001', password: PASSWORD });
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
    const user = store.upsertUser({ nickname: '小理', studentId: '20240001', password: PASSWORD });
    assert.equal(store.getProgress(user.id), null);

    const state = { version: 2, discoveredIds: ['wencui', 'tower'], unlockedRegionIds: ['wencui', 'tower'], playerUV: { u: 0.5, v: 0.5 }, settings: { music: true } };
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
    const user = store.upsertUser({ nickname: '小理', studentId: '20240001', password: PASSWORD });
    store.saveProgress(user.id, { version: 2, discoveredIds: ['wencui', 'tower'] });
    const first = store.getCheckins(user.id).find(c => c.landmarkId === 'tower').discoveredAt;

    // 再次保存同样的集合，首次打卡时间不变。
    store.saveProgress(user.id, { version: 2, discoveredIds: ['wencui', 'tower', 'library'] });
    const second = store.getCheckins(user.id).find(c => c.landmarkId === 'tower').discoveredAt;
    assert.equal(second, first);

    // 重置：只剩 wencui，其它打卡被移除。
    store.saveProgress(user.id, { version: 2, discoveredIds: ['wencui'] });
    assert.deepEqual(store.getCheckins(user.id).map(c => c.landmarkId), ['wencui']);

    // 重新发现 tower，得到新时间。
    store.saveProgress(user.id, { version: 2, discoveredIds: ['wencui', 'tower'] });
    const third = store.getCheckins(user.id).find(c => c.landmarkId === 'tower').discoveredAt;
    assert.ok(third >= first);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('错误口令不能接管同一学号，身份、进度、会话均不改变；盐随机且不暴露凭证', () => {
  const { store, dir } = tempStore();
  try {
    const user = store.upsertUser({ nickname: 'fixture-one', studentId: 'demo-one', password: PASSWORD });
    store.saveProgress(user.id, { version: 2, discoveredIds: ['tower'], playerUV: LANDMARK_UVS.tower });
    const before = store.getProgress(user.id);
    const row = store.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    assert.throws(() => store.upsertUser({ nickname: 'attacker', studentId: 'demo-one', password: 'wrong-passphrase' }), e => e.status === 401);
    assert.equal(store.publicUser(user.id).nickname, 'fixture-one');
    assert.deepEqual(store.getProgress(user.id), before);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    assert.equal(store.db.prepare('SELECT last_login_at FROM users WHERE id = ?').get(user.id).last_login_at, row.last_login_at);
    const other = store.upsertUser({ nickname: 'fixture-two', studentId: 'demo-two', password: PASSWORD });
    const second = store.db.prepare('SELECT password_salt, password_hash FROM users WHERE id = ?').get(other.id);
    assert.match(row.password_salt, /^[a-f0-9]{32}$/);
    assert.match(row.password_hash, /^[a-f0-9]{128}$/);
    assert.notEqual(row.password_salt, second.password_salt);
    assert.notEqual(row.password_hash, second.password_hash);
    assert.deepEqual(Object.keys(user).sort(), ['id', 'nickname', 'studentId', 'uid']);
    assert.equal(JSON.stringify(row).includes(PASSWORD), false);
    const authenticated = store.upsertUser({ nickname: 'new-name', studentId: 'demo-one', password: PASSWORD });
    assert.equal(authenticated.id, user.id);
    assert.equal(authenticated.nickname, 'new-name');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('口令类型与长度、会话高熵和过期', () => {
  const { store, dir } = tempStore();
  try {
    for (const password of [undefined, null, 12345678, {}, 'short', 'x'.repeat(129)]) {
      assert.throws(() => store.upsertUser({ nickname: 'fixture', studentId: 'demo', password }), e => e.status === 400);
    }
    for (const n of [8, 128]) {
      const user = store.upsertUser({ nickname: 'fixture', studentId: 'demo-' + n, password: 'x'.repeat(n) });
      const token = store.createSession(user.id);
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(JSON.stringify(store.db.prepare('SELECT * FROM sessions').all()).includes(token), false);
      store.db.prepare('UPDATE sessions SET expires_at = 0 WHERE user_id = ?').run(user.id);
      assert.equal(store.resolveSession(token), null);
    }
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('schema1 自动锁定、旧令牌失效，只有离线管理员可迁移，旧演示记录不升级', () => {
  const { store: original, dir } = tempStore();
  let migrated;
  try {
    const user = original.upsertUser({ nickname: 'old-fixture', studentId: 'old-demo', password: PASSWORD });
    const token = original.createSession(user.id);
    original.saveProgress(user.id, { version: 2, discoveredIds: ['tower'] });
    original.db.prepare('UPDATE progress SET state_json = ? WHERE user_id = ?').run(JSON.stringify({ version: 1, discoveredIds: ['tower'], rawGPS: 'private-gps-marker', password: 'private-password-marker', settings: { volume: 0.7, secret: 'private-setting-marker' } }), user.id);
    original.db.exec('ALTER TABLE users DROP COLUMN password_salt; ALTER TABLE users DROP COLUMN password_hash; PRAGMA user_version=1;');
    original.close();
    migrated = openStore({ dataDir: dir });
    assert.equal(migrated.db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(migrated.resolveSession(token), null);
    assert.throws(() => migrated.upsertUser({ nickname: 'takeover', studentId: 'old-demo', password: PASSWORD }), e => e.status === 423);
    assert.equal(migrated.publicUser(user.id).nickname, 'old-fixture');
    assert.throws(() => migrated.createSession(user.id), e => e.status === 423);
    assert.deepEqual(migrated.getProgress(user.id).state.discoveredIds, []);
    assert.equal(migrated.getProgress(user.id).state.settings.volume, 0.7);
    assert.deepEqual(migrated.getCheckins(user.id), []);
    const disk = migrated.db.prepare('SELECT state_json FROM progress').get().state_json;
    assert.equal(disk.includes('private-'), false);
    migrated.migrateLegacyPassword(user.id, 'migrated-fixture-pass');
    assert.equal(migrated.upsertUser({ nickname: 'recovered', studentId: 'old-demo', password: 'migrated-fixture-pass' }).id, user.id);
    assert.throws(() => migrated.migrateLegacyPassword(user.id, PASSWORD), e => e.status === 409);
  } finally { if (migrated) migrated.close(); else { try { original.close(); } catch {} } rmSync(dir, { recursive: true, force: true }); }
});

test('严格白名单：敏感字段不落盘，UV仅允许起点或已发现固定地标', () => {
  const { store, dir } = tempStore();
  try {
    const user = store.upsertUser({ nickname: 'fixture', studentId: 'privacy-demo', password: PASSWORD });
    const state = { version: 2, discoveredIds: ['tower', 'tower', 'private-id-marker'], unlockedRegionIds: ['private-region-marker'], playerUV: { u: 0.123456, v: 0.654321, rawGPS: 'private-uv-marker' }, rawGPS: { latitude: 'private-gps-marker' }, password: 'private-password-marker', settings: { volume: 5, quality: 'unknown', track: 99, secret: 'private-setting-marker' } };
    store.saveProgress(user.id, state);
    const raw = store.db.prepare('SELECT state_json FROM progress WHERE user_id = ?').get(user.id).state_json;
    assert.equal(raw.includes('private-'), false);
    const saved = JSON.parse(raw);
    assert.deepEqual(Object.keys(saved).sort(), ['discoveredIds', 'playerUV', 'settings', 'unlockedRegionIds', 'version']);
    assert.deepEqual(Object.keys(saved.settings).sort(), ['music', 'quality', 'reducedMotion', 'track', 'volume']);
    assert.deepEqual(saved.discoveredIds, ['tower']);
    assert.deepEqual(saved.unlockedRegionIds, ['tower']);
    assert.deepEqual(saved.playerUV, START_UV);
    assert.equal(saved.settings.volume, 1);
    assert.equal(saved.settings.track, 0);
    store.saveProgress(user.id, { version: 2, discoveredIds: ['tower'], playerUV: LANDMARK_UVS.tower });
    assert.deepEqual(store.getProgress(user.id).state.playerUV, LANDMARK_UVS.tower);
    store.saveProgress(user.id, { version: 2, discoveredIds: [], playerUV: LANDMARK_UVS.tower });
    assert.deepEqual(store.getProgress(user.id).state.playerUV, START_UV);
    store.saveProgress(user.id, { version: 1, discoveredIds: ['tower'], settings: { music: false } });
    assert.deepEqual(store.getCheckins(user.id), []);
    assert.equal(store.getProgress(user.id).state.settings.music, false);
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
