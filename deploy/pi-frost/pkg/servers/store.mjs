import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomBytes, createHash } from 'node:crypto';

export const ART_IDS = Object.freeze(['poetry', 'leaves', 'writing', 'tea', 'incense', 'flowers']);
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function readDefaultPins(root) {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(path.join(root, 'apps/map/activities.js'), 'utf8'), context, { timeout: 1000 });
  const entries = [...context.window.ARTS, ...context.window.SERVICE_PINS];
  if (entries.length !== 8 || new Set(entries.map(pin => pin.id)).size !== 8) throw new Error('Expected the canonical eight map pins');
  return entries.map(({ id, x, y }) => ({ id, x, y }));
}

export function openStore({ dataDir, defaultPins, initialSealed = false }) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'frost.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const current = db.prepare('PRAGMA user_version').get().user_version;
  if (current > 1) { db.close(); throw new Error('Database schema is newer than this server'); }
  if (current < 1) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, student_id TEXT NOT NULL UNIQUE,
        pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL,
        inscription TEXT NOT NULL DEFAULT '', reset_hash TEXT, reset_expires INTEGER
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
      );
      CREATE INDEX session_expiry ON sessions(expires_at);
      CREATE TABLE checkins (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, art_id TEXT NOT NULL,
        photo_id TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, bytes BLOB NOT NULL,
        captured_at TEXT NOT NULL, created_at TEXT NOT NULL, operation_id TEXT NOT NULL,
        PRIMARY KEY(user_id, art_id)
      );
      CREATE TABLE postcards (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL,
        operation_id TEXT NOT NULL, representative_art TEXT
      );
      CREATE TABLE operations (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(user_id, operation_id)
      );
      CREATE TABLE events (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_id TEXT NOT NULL,
        type TEXT NOT NULL, at TEXT NOT NULL, detail_json TEXT NOT NULL, recorded_at TEXT NOT NULL,
        PRIMARY KEY(user_id, event_id)
      );
      CREATE TABLE audit (
        id INTEGER PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        type TEXT NOT NULL, at TEXT NOT NULL, detail_json TEXT NOT NULL
      );
      CREATE TABLE config (
        id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL,
        sealed INTEGER NOT NULL CHECK(sealed IN (0,1)), pins_json TEXT NOT NULL
      );
      PRAGMA user_version=1;
      COMMIT;`);
  }
  // Shared indexes keep per-participant ledgers and recent-activity reads bounded as
  // records accumulate. They are additive and readable by previous schema-v1 releases.
  db.exec(`CREATE INDEX IF NOT EXISTS audit_user_time ON audit(user_id,at);
    CREATE INDEX IF NOT EXISTS audit_time ON audit(at);
    CREATE INDEX IF NOT EXISTS events_user_recorded ON events(user_id,recorded_at);
    CREATE INDEX IF NOT EXISTS events_recorded ON events(recorded_at);`);
  // A public fresh installation starts with fixed map positions. This affects only
  // the initial row; opening an existing activity never changes its seal state.
  db.prepare('INSERT OR IGNORE INTO config(id,version,sealed,pins_json) VALUES(1,1,?,?)').run(initialSealed ? 1 : 0, JSON.stringify(defaultPins));
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const config = () => {
    const row = db.prepare('SELECT * FROM config WHERE id=1').get();
    return { version: row.version, sealed: Boolean(row.sealed), pins: JSON.parse(row.pins_json) };
  };
  const audit = (userId, type, detail = {}) => db.prepare('INSERT INTO audit(user_id,type,at,detail_json) VALUES(?,?,?,?)').run(userId, type, new Date().toISOString(), JSON.stringify(detail));
  return { db, transaction, config, audit, close: () => db.close() };
}

export function loadAdminToken(dataDir, supplied) {
  if (supplied) {
    if (!/^[\x21-\x7e]{32,256}$/.test(supplied)) throw new Error('FROST_ADMIN_TOKEN must contain 32–256 printable ASCII characters without spaces');
    return supplied;
  }
  const file = path.join(dataDir, 'admin-token.txt');
  try {
    const token = readFileSync(file, 'utf8').trim();
    if (!/^[\x21-\x7e]{32,256}$/.test(token)) throw new Error('Private admin-token.txt is invalid; restore it or set FROST_ADMIN_TOKEN');
    return token;
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const token = randomBytes(32).toString('base64url');
    try { writeFileSync(file, token + '\n', { flag: 'wx', mode: 0o600 }); return token; }
    catch (writeError) { if (writeError.code === 'EEXIST') return readFileSync(file, 'utf8').trim(); throw writeError; }
  }
}
