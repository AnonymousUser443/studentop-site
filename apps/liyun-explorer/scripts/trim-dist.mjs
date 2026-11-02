import { existsSync, lstatSync, readdirSync, realpathSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = realpathSync(join(root, 'dist'));
if (dist !== join(root, 'dist')) throw new Error('Refusing an unexpected dist target.');
const sourceOnly = [
  'assets/fonts/MaShanZheng-Regular.ttf',
  'assets/maps/campus.png', 'assets/maps/campus.webp',
  'assets/maps/campus-enhanced.webp', 'assets/maps/campus-enhanced-mobile.webp',
];
let removedBytes = 0;
for (const name of sourceOnly) {
  const file = resolve(dist, name);
  if (relative(dist, file).startsWith('..' + sep) || !file.startsWith(dist + sep)) throw new Error('Path escaped dist.');
  if (!existsSync(file)) continue;
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Refusing non-file: ' + name);
  removedBytes += stat.size;
  unlinkSync(file);
}
for (const name of ['index.html','assets/maps/calibrated/campus_no_labels.webp','assets/maps/calibrated/campus_no_labels.png',
  'assets/fonts/NotoSerifSC-UI.woff2','assets/fonts/MaShanZheng-UI.woff2','assets/fonts/NotoSerifSC-OFL.txt','assets/fonts/MaShanZheng-OFL.txt']) {
  if (!existsSync(join(dist, name))) throw new Error('Missing runtime asset: ' + name);
}
const bytes = folder => readdirSync(folder, {withFileTypes:true}).reduce((sum, e) => {
  if (e.isSymbolicLink()) throw new Error('Unexpected symlink in dist.');
  return sum + (e.isDirectory() ? bytes(join(folder,e.name)) : statSync(join(folder,e.name)).size);
}, 0);
const totalBytes = bytes(dist);
if (totalBytes > 20 * 1024 * 1024) throw new Error('Build exceeds 20 MiB: ' + totalBytes);
console.log(JSON.stringify({ok:true,removedBytes,totalBytes,mib:totalBytes/1024/1024}));
