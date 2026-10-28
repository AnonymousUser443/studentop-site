import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import { auditLegacyAssets } from './legacy-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-legacy.mjs [--check]');
const audit = await auditLegacyAssets(root);
console.log(JSON.stringify({ entry: audit.entry, output: audit.output, gameFiles: audit.gameFiles, gameBytes: audit.gameBytes, upstreamBytes: audit.upstreamBytes, upstreamLicensePresent: audit.upstreamLicensePresent, publicationStatus: audit.publicationStatus }));
console.warn('LOCAL REVIEW BUILD ONLY: game asset rights and the missing xviewer companion license require review before public redistribution.');
if (!args.includes('--check')) {
  const checked = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit'], { cwd: root, stdio: 'inherit' });
  if (checked.error) throw checked.error;
  if (checked.status !== 0) process.exit(checked.status || 1);
  // The dedicated config empties only this application's dist-legacy, never campus dist.
  await build({ root, configFile: resolve(root, 'vite.legacy.config.ts') });
}
