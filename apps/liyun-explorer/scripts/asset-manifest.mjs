import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'public/assets');
const output = join(root, 'docs/asset-manifest.json');
const files = [];
function visit(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const filename = join(folder, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Refusing symlink in asset tree: ' + filename);
    if (entry.isDirectory()) visit(filename);
    else if (entry.isFile()) files.push({ path: relative(root, filename).split('\\').join('/'),
      bytes: statSync(filename).size, sha256: createHash('sha256').update(readFileSync(filename)).digest('hex') });
  }
}
visit(base);
const manifest = { generatedAt: new Date().toISOString(), mapId: 'campus-v04-eaa124716c51375f',
  logicalCanvas: [4000, 4958], totalBytes: files.reduce((n, x) => n + x.bytes, 0), files };
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node asset-manifest.mjs [--check]');
if (process.argv.includes('--check')) {
  const previous = JSON.parse(readFileSync(output, 'utf8'));
  const normalize = items => [...items].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (JSON.stringify(normalize(previous.files)) !== JSON.stringify(normalize(files))) throw new Error('Asset manifest differs; review changes before regenerating.');
  console.log('Asset manifest verified; no files written.');
} else {
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Recorded ' + files.length + ' assets in ' + output);
}
