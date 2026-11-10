import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function openShowDatabase(dataDir) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'audience.sqlite'), { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA temp_store = MEMORY;
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL, visitor_id TEXT NOT NULL,
      request_id TEXT, text TEXT NOT NULL, emoji TEXT NOT NULL, created_at INTEGER NOT NULL,
      private INTEGER NOT NULL, selected INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0,
      UNIQUE(visitor_id, interaction_id, request_id)
    );
    CREATE TABLE IF NOT EXISTS votes (
      interaction_id TEXT NOT NULL, visitor_id TEXT NOT NULL, choice INTEGER NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY(interaction_id, visitor_id)
    );
    CREATE TABLE IF NOT EXISTS raffle_draw (
      id INTEGER PRIMARY KEY CHECK(id = 1), record TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      seq INTEGER PRIMARY KEY, at INTEGER NOT NULL, event TEXT NOT NULL, interaction_id TEXT NOT NULL, target TEXT NOT NULL
    );
  `);
  const insertMessage = db.prepare('INSERT INTO messages (id, interaction_id, visitor_id, request_id, text, emoji, created_at, private) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertVote = db.prepare('INSERT INTO votes VALUES (?, ?, ?, ?)');
  const updateMessage = db.prepare('UPDATE messages SET selected = ?, hidden = ? WHERE id = ?');
  const insertAudit = db.prepare('INSERT INTO audit (at, event, interaction_id, target) VALUES (?, ?, ?, ?)');
  const findReceipt = db.prepare('SELECT id FROM messages WHERE visitor_id = ? AND interaction_id = ? AND request_id = ?');
  function transaction(write, event, interactionId, target) {
    db.exec('BEGIN IMMEDIATE');
    try {
      write();
      insertAudit.run(Date.now(), event, interactionId, target);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const tally = db.prepare(`SELECT visitor_id AS visitorId, COUNT(*) AS score FROM (
    SELECT visitor_id, interaction_id FROM votes
    UNION SELECT visitor_id, interaction_id FROM messages WHERE hidden = 0
  ) GROUP BY visitor_id`);
  const readDraw = db.prepare('SELECT record FROM raffle_draw WHERE id = 1');
  const insertDraw = db.prepare('INSERT INTO raffle_draw (id, record) VALUES (1, ?)');
  return {
    activity: () => tally.all(),
    readDraw: () => { const row = readDraw.get(); return row ? JSON.parse(row.record) : null; },
    saveDraw: row => transaction(() => insertDraw.run(JSON.stringify(row)), 'raffle-draw', 'postshow-raffle', String(row.startedAt)),
    messages: () => db.prepare('SELECT id, interaction_id AS interactionId, text, emoji, created_at AS createdAt, private, selected, hidden FROM messages ORDER BY rowid').all()
      .map(row => ({ ...row, private: Boolean(row.private), selected: Boolean(row.selected), hidden: Boolean(row.hidden) })),
    votes: () => db.prepare('SELECT interaction_id AS interactionId, visitor_id AS visitorId, choice FROM votes').all(),
    receipt: (visitorId, interactionId, requestId) => findReceipt.get(visitorId, interactionId, requestId),
    message: (row, visitorId, requestId) => transaction(
      () => insertMessage.run(row.id, row.interactionId, visitorId, requestId, row.text, row.emoji, row.createdAt, Number(row.private)),
      'message', row.interactionId, row.id,
    ),
    vote: (interactionId, visitorId, choice) => transaction(
      () => insertVote.run(interactionId, visitorId, choice, Date.now()), 'vote', interactionId, visitorId,
    ),
    moderate: (row, action, selected, hidden) => transaction(
      () => updateMessage.run(Number(selected), Number(hidden), row.id), action, row.interactionId, row.id,
    ),
    close: () => db.close(),
  };
}
