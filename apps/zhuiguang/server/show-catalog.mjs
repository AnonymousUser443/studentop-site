import { randomInt } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const columns = 'id, name, created_at AS createdAt, ended_at AS endedAt, legacy';
export function publicShow({ id, name, createdAt, endedAt }) { return { id, name, createdAt, endedAt }; }

export async function openShowCatalog(dataDir) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'shows.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS shows (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL,
      ended_at INTEGER, legacy INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS legacy_show ON shows(legacy) WHERE legacy = 1;
  `);
  const getRow = db.prepare('SELECT ' + columns + ' FROM shows WHERE id = ?');
  const listRows = db.prepare('SELECT ' + columns + ' FROM shows ORDER BY created_at DESC, id DESC');
  const insert = db.prepare('INSERT INTO shows VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  const close = db.prepare('UPDATE shows SET ended_at = ? WHERE id = ? AND ended_at IS NULL');
  function create(name, archived = false) {
    const now = Date.now();
    // Codes are stored as text and never reused, including after archiving.
    for (let attempt = 0; attempt < 64; attempt++) {
      const id = String(randomInt(100000, 1000000));
      if (insert.run(id, name, now, archived ? now : null, Number(archived)).changes) return getRow.get(id);
    }
    throw new Error('Unable to reserve a show code');
  }
  if ((existsSync(path.join(dataDir, 'audience.sqlite')) || existsSync(path.join(dataDir, 'state.json'))) &&
      !db.prepare('SELECT 1 FROM shows WHERE legacy = 1').get()) {
    create('旧版演讲记录', true);
  }
  return {
    get: id => getRow.get(id),
    list: () => listRows.all().map(publicShow),
    create,
    end(id) { close.run(Date.now(), id); return getRow.get(id); },
    dataPath: show => show.legacy ? dataDir : path.join(dataDir, 'rooms', show.id),
    close: () => db.close(),
  };
}
