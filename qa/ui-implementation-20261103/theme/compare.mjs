import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '../../../apps/liyun-explorer');
const require = createRequire(path.join(app, 'package.json'));
const postcss = require('postcss');
const before = JSON.parse(fs.readFileSync(path.join(here, 'before/results.json')));
const after = JSON.parse(fs.readFileSync(path.join(here, 'after/results.json')));
if (!after.ok) throw new Error('Final legacy theme capture has not passed; do not replace the last comparison with an incomplete capture.');
const allColors = frames => new Set(frames.flatMap(frame => frame.computedColors)).size;
const minimum = values => Math.min(...values.filter(Number.isFinite));
const matched = after.frames.filter(frame => before.frames.some(previous => previous.name === frame.name));
const geometry = matched.map(current => {
  const previous = before.frames.find(frame => frame.name === current.name);
  const changes = [];
  for (const [selector, old] of Object.entries(previous.boxes)) for (const key of ['x', 'y', 'width', 'height']) {
    const value = current.boxes[selector]?.[key];
    if (value === undefined || Math.abs(old[key] - value) > .1) changes.push({ selector, property: key, before: old[key], after: value });
  }
  return { frame: current.name, beforeComputedColors: previous.computedColorCount, afterComputedColors: current.computedColorCount, changes };
});
const layoutProperties = /^(?:position|inset(?:-.+)?|top|right|bottom|left|width|height|min-.+|max-.+|padding(?:-.+)?|margin(?:-.+)?|gap|row-gap|column-gap|display|flex(?:-.+)?|grid(?:-.+)?|align-.+|justify-.+|font-(?:size|weight|family)|line-height|letter-spacing|transform(?:-.+)?|clip-path|object-(?:fit|position)|background-(?:position|size)|overflow(?:-.+)?)$/;
const sourceFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(path.join(directory, entry.name)) : entry.name.endsWith('.css') ? [path.join(directory, entry.name)] : []);
const declarations = css => {
  const map = new Map();
  postcss.parse(css).walkDecls(decl => {
    if (!layoutProperties.test(decl.prop)) return;
    let parent = decl.parent; const scope = [];
    while (parent && parent.type !== 'root') { scope.unshift(parent.type === 'atrule' ? '@' + parent.name + ' ' + parent.params : parent.selector); parent = parent.parent; }
    const key = scope.join(' / ') + ' :: ' + decl.prop;
    map.set(key, [...(map.get(key) ?? []), decl.value]);
  });
  return map;
};
const layoutDeclarationChanges = [], addedLayoutDeclarations = [];
for (const file of sourceFiles(path.join(here, 'before-source'))) {
  const relative = path.relative(path.join(here, 'before-source'), file), current = path.join(app, 'src', relative);
  const old = declarations(fs.readFileSync(file, 'utf8')), next = declarations(fs.readFileSync(current, 'utf8'));
  for (const [key, value] of old) if (JSON.stringify(value) !== JSON.stringify(next.get(key))) layoutDeclarationChanges.push({ file: relative.replaceAll('\\', '/'), key, before: value, after: next.get(key) });
  for (const [key, value] of next) if (!old.has(key)) addedLayoutDeclarations.push({ file: relative.replaceAll('\\', '/'), key, value });
}
const result = {
  at: new Date().toISOString(),
  sourceMetric: { before: JSON.parse(fs.readFileSync(path.join(here, 'before.json'))).uniqueHex, after: JSON.parse(fs.readFileSync(path.join(here, 'after.json'))).uniqueHex },
  computedMetric: { definition: 'Distinct nontransparent resolved solid colors (RGBA bytes) across nine computed properties on visible, non-inert DOM: color, background-color, four border colors, outline-color, fill and stroke. Computed fill/stroke from visible SVG elements is included. Raster pixels, gradient expansion, pseudo-elements and hidden states are excluded.', matchedFrames: matched.length, beforeUnion: allColors(before.frames), afterMatchedUnion: allColors(matched), afterAllFramesUnion: allColors(after.frames) },
  textContrast: { definition: 'Opaque screenshot samples after temporarily hiding selected text; foreground alpha and ancestor opacity included. Reports the fifth percentile across inset line rectangles; thresholds 4.5 normal / 3 large. Disabled text omitted. Decorative text shadow is not counted as contrast support.', beforeChecks: before.frames.reduce((n, frame) => n + frame.texts.length, 0), beforeFailures: before.frames.reduce((n, frame) => n + frame.texts.filter(t => !t.pass).length, 0), afterChecks: after.frames.reduce((n, frame) => n + frame.texts.length, 0), afterFailures: after.frames.reduce((n, frame) => n + frame.texts.filter(t => !t.pass).length, 0) },
  boundaries: after.frames.flatMap(frame => frame.boundaries.filter(b => b.ratio !== null).map(({ selector, ratio, pass }) => ({ frame: frame.name, selector, ratio, pass }))),
  geometry, layoutAuditDefinition: 'Selected bounding boxes in nine matching normal-state frames, plus layout-related declaration comparison against before-source snapshots. Font aliases, separate press-feedback changes and safe-area changes are reported; this is not a claim that all CSS declarations or pixels stayed identical.', layoutDeclarationChanges, addedLayoutDeclarations,
  visibleDifferences: [
    'Nearest shared brand-color substitutions retain alpha but change RGB; these are not pixel-identical screenshots.',
    'A small jade backplate supports the HUD season text. The activity heading gains an absolutely positioned jade gradient behind the existing heading.',
    'Map label fade starts after 90% rather than 55–68% to protect the last glyphs; locked pins retain their distinct muted gemstone but use readable full-opacity labels.',
    'Map markers use the global z-markers token at 7 instead of the old local 4, so ambient leaves/light at 6 cannot paint over functional labels. The map layer remains below HUD and dialogs.',
    'Activity --activity-fast uses the global 160ms duration instead of 140ms, and --activity-ease uses the global e-out curve. Control feedback was subsequently adjusted by the UI acceptance pass, including internal press indicators instead of shrinking the 44px outer hit area.',
    'Paper modal accent text is darker, and interactive borders are stronger for contrast.',
    'New-page contrast fixes strengthen off switches, danger/cancel outlines and calibration form borders. Calibration secondary choice text gains a backing matched to its active/normal state, WGS84 text is darker, and map text halos use non-scaling strokes.',
    'The final screenshots include the separate UI safe-area pass and final font/image assets. Full-frame pixel differences are therefore observations of the final app, not an isolated attribution to the token migration.',
  ],
};
const pageResult=path.join(here,'pages/after/results.json');
if(fs.existsSync(pageResult)){
  const pages=JSON.parse(fs.readFileSync(pageResult));
  if(!pages.ok||pages.frames.length!==53)throw new Error('Final new-page theme capture must pass all 53 frames; preserve the previous comparison while capture is incomplete.');
  result.newPages={ok:pages.ok,frames:pages.frames.length,textChecks:pages.frames.reduce((n,f)=>n+f.texts.length,0),textFailures:pages.frames.reduce((n,f)=>n+f.texts.filter(t=>!t.pass).length,0),vectorChecks:pages.frames.reduce((n,f)=>n+f.vectors.length,0),vectorFailures:pages.frames.reduce((n,f)=>n+f.vectors.filter(t=>!t.pass).length,0),controlChecks:pages.frames.reduce((n,f)=>n+f.controls.length,0),controlFailures:pages.frames.reduce((n,f)=>n+f.controls.filter(t=>t.pass===false).length,0),computedMaxPerFrame:Math.max(...pages.frames.map(f=>f.computedColorCount??0)),computedUnion:new Set(pages.frames.flatMap(f=>f.computedColors??[])).size,errors:pages.errors};
  result.computedMetric.allFinalFrames=after.frames.length+pages.frames.length;
  result.computedMetric.allFinalFramesUnion=allColors([...after.frames,...pages.frames]);
  result.computedMetric.allFinalFramesAtMost80=result.computedMetric.allFinalFramesUnion<=80;
  result.newPages.minimumObserved={normalTextP05:minimum(pages.frames.flatMap(f=>f.texts.filter(t=>t.threshold===4.5).map(t=>t.p05))),largeTextP05:minimum(pages.frames.flatMap(f=>f.texts.filter(t=>t.threshold===3).map(t=>t.p05))),svgHaloRatio:minimum(pages.frames.flatMap(f=>f.vectors.map(t=>t.haloRatio))),svgStrokeCssPixels:minimum(pages.frames.flatMap(f=>f.vectors.map(t=>t.strokePixels))),controlRatio:minimum(pages.frames.flatMap(f=>f.controls.map(t=>t.ratio)))};
}
fs.writeFileSync(path.join(here, 'comparison.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, geometry: geometry.map(({ frame, beforeComputedColors, afterComputedColors, changes }) => ({ frame, beforeComputedColors, afterComputedColors, geometryChanges: changes.length })), boundaries: { checks: result.boundaries.length, failures: result.boundaries.filter(b => !b.pass) }, addedLayoutDeclarations: addedLayoutDeclarations.length }, null, 2));
