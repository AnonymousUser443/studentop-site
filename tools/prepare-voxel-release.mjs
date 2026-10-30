#!/usr/bin/env node
// Stage only the voxel build; never connects to or modifies production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== commit) throw new Error('HEAD differs from reviewed commit.');
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--'], { cwd: root, stdio: 'pipe' });
// Rebuild here so stale or manually modified dist files cannot be released.
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: path.join(root, 'apps/liangxiang-cloudwalk'), stdio: 'inherit' });
const id = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '-' + commit.slice(0, 10);
const out = path.join(root, '.release-local', 'voxel-' + id);
const publicDir = path.join(out, 'public');
fs.mkdirSync(out, { recursive: false });
fs.mkdirSync(publicDir);
const files = [];
const extensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.webp', '.jpg', '.jpeg', '.ico', '.woff2', '.txt', '.opus']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function copy(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(entry.name) || entry.isSymbolicLink()) throw new Error('Unsafe build member');
    const name = prefix + entry.name;
    if (entry.isDirectory()) { fs.mkdirSync(path.join(publicDir, name)); copy(path.join(dir, entry.name), name + '/'); }
    else {
      if (!entry.isFile() || !extensions.has(path.extname(name))) throw new Error('Unexpected build member: ' + name);
      const bytes = fs.readFileSync(path.join(dir, entry.name));
      fs.writeFileSync(path.join(publicDir, name), bytes, { flag: 'wx' });
      files.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
    }
  }
}
copy(path.join(root, 'apps/liangxiang-cloudwalk/dist'));
if (!fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8').includes('./assets/')) throw new Error('Expected relative application base.');
if (!files.some(f => f.path === 'licenses/three-MIT.txt')) throw new Error('Missing Three.js license.');
const manifest = JSON.stringify({ format: 1, id, commit, files }, null, 2) + '\n';
fs.writeFileSync(path.join(out, 'manifest.json'), manifest, { flag: 'wx' });
console.log(JSON.stringify({ id, commit, out, manifestSHA256: digest(manifest), files: files.length, bytes: files.reduce((sum, f) => sum + f.bytes, 0) }));
