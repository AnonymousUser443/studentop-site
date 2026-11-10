import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv[2]) throw new Error('Usage: node scripts/package-pi.mjs <new staging directory>');
const root = fileURLToPath(new URL('..', import.meta.url));
const stage = resolve(process.argv[2]);
await mkdir(stage);
const dist = resolve(root, 'dist-pi');
const raw = await readFile(join(dist, 'assets/manifest.json'), 'utf8');
const entries = JSON.parse(raw);
const index = await readFile(join(dist, 'index.html'), 'utf8');
if (!index.includes('src="/zhuiguang/assets/')) throw new Error('Build with PRESENTATION_BASE=/zhuiguang/ and PRESENTATION_DIST=dist-pi');
const copies = [
  ...entries.map(({path, sha256}) => ({source: join(dist, path.slice(1)), name: 'dist' + path, sha256})),
  ...['assets/manifest.json', 'sw.js'].map(name => ({source: join(dist, name), name: 'dist/' + name})),
  ...['package.json', 'package-lock.json', 'src/content/deck.json', 'server/index.mjs', 'server/audience-admissions.mjs', 'server/show-database.mjs', 'server/raffle.mjs', 'server/show-catalog.mjs', 'server/show-runtime.mjs', 'server/backup.mjs'].map(name => ({source: join(root, name), name})),
];
for (const { source, name, sha256 } of copies) {
  if (sha256 && createHash('sha256').update(await readFile(source)).digest('hex') !== sha256) throw new Error('Build integrity mismatch: ' + name);
  const target = join(stage, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
console.log('Prepared ' + copies.length + ' release files in ' + stage);
