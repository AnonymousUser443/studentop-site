import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import deliveryImages from '../src/content/delivery-images.json' with { type: 'json' };

const dist = pathToFileURL(resolve(process.env.PRESENTATION_DIST || 'dist') + sep);
const assets = new URL('assets/', dist);
const manifest = new URL('manifest.json', assets);
const source = JSON.parse(await readFile(manifest, 'utf8'));
const bundles = await readdir(assets, { withFileTypes: true });
const media = source
  .filter(item => item.usable !== false && item.variant !== 'original-resolution')
  .map(item => ({ ...item, path: deliveryImages[item.path] ?? item.path }));
const entries = [
  ...new Map(media.map(item => [item.path, item])).values(),
  ...bundles.filter(item => item.isFile() && /\.(?:js|css)$/.test(item.name)).map(item => ({ path: '/assets/' + item.name })),
  { path: '/index.html', shell: true }, { path: '/favicon.svg', shell: true },
];
const build = await Promise.all(entries.map(async item => {
  const file = await readFile(new URL(item.path.slice(1), dist));
  return { ...item, bytes: file.length, sha256: createHash('sha256').update(file).digest('hex') };
}));
await writeFile(manifest, JSON.stringify(build) + '\n');
console.log('Offline package: ' + build.length + ' files, ' + Math.round(build.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024) + ' MiB');
