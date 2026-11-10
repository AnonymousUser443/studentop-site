import { backup, DatabaseSync } from 'node:sqlite';
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const stateDir = process.env.PRESENTATION_DATA_DIR;
const backups = process.env.PRESENTATION_BACKUP_DIR;
if (!stateDir || !backups) throw new Error('Backup paths are required');
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const target = path.join(backups, stamp);
const temporary = target + '.incomplete';
await mkdir(temporary, { recursive: true, mode: 0o700 });
let copiedDatabases = 0;

async function exists(file) {
  try { return (await stat(file)).isFile(); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function snapshot(source, target) {
  if (!await exists(source)) return;
  const db = new DatabaseSync(source, { readOnly: true });
  try { await backup(db, target); } finally { db.close(); }
  const copy = new DatabaseSync(target, { readOnly: true });
  try {
    if (copy.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup integrity check failed');
  } finally { copy.close(); }
  copiedDatabases += 1;
}
async function copyShow(source, destination) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  await snapshot(path.join(source, 'audience.sqlite'), path.join(destination, 'audience.sqlite'));
  for (const name of ['state.json', 'audience-secret', 'audience-admissions.ndjson']) {
    try { await copyFile(path.join(source, name), path.join(destination, name)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
try {
  await snapshot(path.join(stateDir, 'shows.sqlite'), path.join(temporary, 'shows.sqlite'));
  await copyShow(stateDir, temporary);
  const roomRoot = path.join(stateDir, 'rooms');
  const rooms = await readdir(roomRoot, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const entry of rooms) if (entry.isDirectory() && /^\d{6}$/.test(entry.name)) {
    await copyShow(path.join(roomRoot, entry.name), path.join(temporary, 'rooms', entry.name));
  }
  if (!copiedDatabases) throw new Error('No presentation database found');
  await rename(temporary, target);
} finally { await rm(temporary, { recursive: true, force: true }); }
const retained = (await readdir(backups)).filter(name => /^\d{8}T\d{9}Z$/.test(name)).sort().reverse();
for (const name of retained.slice(14)) await rm(path.join(backups, name), { recursive: true, force: true });
console.log('Verified SQLite snapshot ' + stamp + ' (' + copiedDatabases + ' databases)');
