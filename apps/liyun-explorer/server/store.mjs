import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

// 理韵寻踪账号与进度存储层。零 npm 依赖，只用 Node 内置 SQLite（与北湖霜降雅集一致）。
// 数据落在 dataDir/liyun.sqlite（建议目录权限 0700，仅服务进程可读写）。

export const sha256 = value => createHash('sha256').update(value).digest('hex');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const SCHEMA_VERSION = 1;

const iso = () => new Date().toISOString();

// 把数据库行转成对外公开的用户对象（不暴露内部主键以外的冗余字段）。
const toPublicUser = row => ({
  id: row.id,
  nickname: row.nickname,
  studentId: row.student_id,
  uid: 'LY' + row.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
});

export function openStore({ dataDir }) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'liyun.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');

  const current = db.prepare('PRAGMA user_version').get().user_version;
  if (current > SCHEMA_VERSION) { db.close(); throw new Error('Database schema is newer than this server'); }
  if (current < SCHEMA_VERSION) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        student_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX session_expiry ON sessions(expires_at);
      CREATE TABLE checkins (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        landmark_id TEXT NOT NULL,
        discovered_at TEXT NOT NULL,
        PRIMARY KEY(user_id, landmark_id)
      );
      CREATE INDEX checkins_user_time ON checkins(user_id, discovered_at);
      CREATE TABLE progress (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version=${SCHEMA_VERSION};
      COMMIT;`);
  }

  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };

  const getUser = id => db.prepare('SELECT id, nickname, student_id, created_at, last_login_at FROM users WHERE id = ?').get(id);
  const publicUser = id => { const row = getUser(id); return row ? toPublicUser(row) : null; };

  // 学号是稳定身份；昵称仅作展示，重复登录时以本次输入覆盖。
  const upsertUser = ({ nickname, studentId }) => {
    const at = iso();
    const existing = db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId);
    if (existing) {
      db.prepare('UPDATE users SET nickname = ?, last_login_at = ? WHERE id = ?').run(nickname, at, existing.id);
      return publicUser(existing.id);
    }
    const id = randomUUID();
    db.prepare('INSERT INTO users(id, nickname, student_id, created_at, last_login_at) VALUES(?,?,?,?,?)').run(id, nickname, studentId, at, at);
    return publicUser(id);
  };

  const createSession = userId => {
    const token = randomBytes(32).toString('base64url');
    const created = Date.now();
    db.prepare('INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES(?,?,?,?)')
      .run(sha256(token), userId, created, created + SESSION_TTL_MS);
    return token;
  };

  // 会话只在服务端存哈希，令牌原文只交给客户端一次。
  const resolveSession = token => {
    if (typeof token !== 'string' || !token) return null;
    const row = db.prepare(`SELECT s.user_id, s.expires_at, u.id, u.nickname, u.student_id
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(token));
    if (!row) return null;
    if (row.expires_at <= Date.now()) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token)); return null; }
    return { userId: row.user_id, user: toPublicUser(row) };
  };

  const deleteSession = token => { if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token)); };

  const getProgress = userId => {
    const row = db.prepare('SELECT state_json, updated_at FROM progress WHERE user_id = ?').get(userId);
    if (!row) return null;
    return { state: JSON.parse(row.state_json), updatedAt: row.updated_at };
  };

  const getCheckins = userId => db.prepare('SELECT landmark_id, discovered_at FROM checkins WHERE user_id = ? ORDER BY discovered_at ASC')
    .all(userId).map(r => ({ landmarkId: r.landmark_id, discoveredAt: r.discovered_at }));

  // 保存收集进度快照，并把打卡台账对齐到当前 discoveredIds：
  // 仍在集合里的保留首次打卡时间，被移除的（如重置进度）一并删除，重新发现时记录新时间。
  const saveProgress = (userId, state) => {
    const ids = (Array.isArray(state?.discoveredIds) ? state.discoveredIds : [])
      .filter(x => typeof x === 'string' && x.length > 0 && x.length <= 64);
    const idSet = new Set(ids);
    const at = iso();
    transaction(() => {
      db.prepare(`INSERT INTO progress(user_id, state_json, updated_at) VALUES(?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`)
        .run(userId, JSON.stringify(state), at);
      for (const id of idSet) {
        db.prepare('INSERT OR IGNORE INTO checkins(user_id, landmark_id, discovered_at) VALUES(?,?,?)').run(userId, id, at);
      }
      for (const existing of getCheckins(userId)) {
        if (!idSet.has(existing.landmarkId)) db.prepare('DELETE FROM checkins WHERE user_id = ? AND landmark_id = ?').run(userId, existing.landmarkId);
      }
    });
    return at;
  };

  return {
    db, transaction, upsertUser, createSession, resolveSession, deleteSession,
    getProgress, getCheckins, saveProgress, publicUser,
    close: () => db.close(),
  };
}
