import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

// Read-only source audit. Probe stores in a separate Node process, never in a user save.
const outDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(outDir, '../..');
const app = path.join(root, 'apps/liyun-explorer');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const read = p => fs.readFileSync(p, 'utf8');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const srcFiles = walk(path.join(app, 'src'));
const cssFiles = srcFiles.filter(p => p.endsWith('.css'));
const hexes = text => [...text.matchAll(/#[\da-f]{3,8}\b/gi)].map(m => m[0].toLowerCase());
const currentCss = cssFiles.map(read).join('\n');
const previous = git(['rev-parse', '05b7e32^']);
const oldPaths = git(['ls-tree', '-r', '--name-only', previous, '--', 'apps/liyun-explorer/src']).split('\n');
const previousCss = oldPaths.filter(p => p.endsWith('.css')).map(p => git(['show', `${previous}:${p}`])).join('\n');
const testIds = text => [...new Set([...text.matchAll(/data-testid=(?:"([^"]+)"|\{`([^`]+)`\})/g)]
  .map(m => m[1] ?? m[2]))].sort();
const oldIds = testIds(oldPaths.filter(p => /\.tsx?$/.test(p)).map(p => git(['show', `${previous}:${p}`])).join('\n'));
const currentIds = testIds(srcFiles.filter(p => /\.tsx?$/.test(p)).map(read).join('\n'));

globalThis.matchMedia = () => ({ matches: false });
const compiled = await build({
  stdin: {
    contents: 'export { useSettings } from "./src/app/stores/useSettings.ts"; export { createExploredState, restoreState } from "./src/state.ts"; export { sanitizeCloudState } from "./src/account.ts"; export { LANDMARKS } from "./src/data.ts";',
    resolveDir: app, loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
});
const { useSettings, createExploredState, restoreState, sanitizeCloudState, LANDMARKS } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);
useSettings.getState().setPreset('ultra');
const before = { ...useSettings.getState().spec };
useSettings.getState().setOverride('glowLayers', 1);
const after = { ...useSettings.getState().spec };
const changed = Object.keys(before).filter(k => before[k] !== after[k]);
const independentRegions = { ...createExploredState(), unlockedRegionIds: ['beihu', 'park'] };
const selectedModel = JSON.parse(read(path.join(app, 'src/location/data/selected_model.json'))).model;
const { modelSupport } = await import(pathToFileURL(path.join(app, 'src/location/vendor/model-transform.mjs')));
const landmarkSupport = LANDMARKS.map(place => ({ id: place.id, name: place.name, uv: place.uv,
  insideControlHull: modelSupport(selectedModel, place.uv.u, place.uv.v).inside_control_hull }));

const distFiles = walk(path.join(app, 'dist'));
const html = read(path.join(app, 'dist/index.html'));
const initialJs = [...new Set([...html.matchAll(/(?:src|href)="([^"?]+\.js)"/g)].map(m => m[1]))];
const jsSizes = initialJs.map(url => {
  const bytes = fs.readFileSync(path.join(app, 'dist', url.replace(/^\//, '')));
  return { url, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
});
const result = {
  date: '2026-11-02', timezone: 'Asia/Shanghai', head: git(['rev-parse', 'HEAD']), previous,
  appLines: read(path.join(app, 'src/App.tsx')).split(/\r?\n/).length - 1,
  stores: srcFiles.filter(p => /[\\/]app[\\/]stores[\\/]/.test(p) && !p.includes('.test.')).map(p => path.relative(app, p)),
  css: {
    scope: 'src/**/*.css; static literals, not computed runtime colors',
    files: cssFiles.length, lines: currentCss.split(/\r?\n/).length,
    uniqueHex: new Set(hexes(currentCss)).size, previousUniqueHex: new Set(hexes(previousCss)).size,
    important: (currentCss.match(/!important/g) ?? []).length,
    modules: cssFiles.filter(p => p.endsWith('.module.css')).length,
  },
  testIds: { scope: 'static JSX literals/templates only; not full DOM/state coverage', previous: oldIds, current: currentIds, removed: oldIds.filter(id => !currentIds.includes(id)) },
  customQualityProbe: {
    steps: ["setPreset('ultra')", "setOverride('glowLayers', 1)"], before, after, changed,
    expectedChanged: ['glowLayers'], isolatesSingleOverride: changed.length === 1 && changed[0] === 'glowLayers',
  },
  independentRegionProbe: {
    input: independentRegions.unlockedRegionIds,
    restored: restoreState(JSON.stringify(independentRegions)).unlockedRegionIds,
    cloudSanitized: sanitizeCloudState(independentRegions).unlockedRegionIds,
    note: 'Current one-landmark-one-region compatibility is intentional; independent unlock persistence is not implemented.',
  },
  regionPlanPreflight: {
    modelMessage: selectedModel.message,
    landmarkSupport,
    outsideSupportIds: landmarkSupport.filter(p => !p.insideControlHull).map(p => p.id),
    note: 'The calibration control hull is not a campus boundary. The existing supportXY uses same-sign edge crosses (convex polygons only), not a general concave polygon containment test.',
  },
  build: {
    totalBytes: distFiles.reduce((n, p) => n + fs.statSync(p).size, 0),
    sourceTtfFiles: distFiles.filter(p => /\.ttf$/i.test(p)).map(p => path.relative(app, p)),
    htmlInitialJs: jsSizes, htmlInitialJsGzipBytes: jsSizes.reduce((n, p) => n + p.gzipBytes, 0),
    note: 'JS sum includes index.html script/modulepreload entries; menu/settings lazy chunks are excluded.',
  },
};
fs.writeFileSync(path.join(outDir, 'static.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
