import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../apps/liyun-explorer/src');
if (fs.existsSync(path.join(here, 'mapping.json'))) throw new Error('One-time migration already recorded. Inspect mapping.json and before-source; do not overwrite the audit trail.');
const scope = ['global.css', 'styles/quality.css', 'map/map.css', 'location/location.css', 'activity/activity.css', 'activity/artwork.css', 'hud/hud.css'];
const tokens = fs.readFileSync(path.join(root, 'styles/tokens.css'), 'utf8');
const palette = [...tokens.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, token, hex]) => ({ token, hex: hex.toLowerCase(), rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }));
function lab(rgb) {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  const xyz = [(r * .4124564 + g * .3575761 + b * .1804375) / .95047, r * .2126729 + g * .7151522 + b * .072175, (r * .0193339 + g * .119192 + b * .9503041) / 1.08883].map(v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
palette.forEach(color => { color.lab = lab(color.rgb); });
const explicit = {
  '#efe5cc': '--paper-map', '#f1e5c8': '--paper-200', '#18392f': '--ink-900', '#425b47': '--jade-600', '#d7b468': '--gold-400', '#9a783f': '--gold-600',
  '#4f5d35': '--jade-600', '#455234': '--jade-700', '#6f765b': '--ink-700', '#8a886a': '--ink-500', '#9b8854': '--gold-700', '#7e725a': '--ink-500', '#6c6d50': '--ink-500',
  '#995241': '--bronze-700', '#b4b997': '--paper-400', '#b6b99b': '--sage-200', '#e2a07a': '--state-warn-on-dark',
};
const mappings = new Map();
const replace = (raw, rgb, alpha, file) => {
  const sourceLab = lab(rgb);
  const ranked = palette.map(p => ({ ...p, deltaE76: Math.hypot(...p.lab.map((v, i) => v - sourceLab[i])) })).sort((a, b) => a.deltaE76 - b.deltaE76);
  const base = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  const selected = explicit[base] ? ranked.find(p => p.token === explicit[base]) : ranked[0];
  if (!selected) throw new Error('Unknown mapping: ' + raw);
  const output = alpha >= 1 ? `var(${selected.token})` : `color-mix(in srgb, var(${selected.token}) ${Number((alpha * 100).toFixed(4))}%, transparent)`;
  const key = raw.toLowerCase();
  if (!mappings.has(key)) mappings.set(key, { source: key, base, token: selected.token, target: selected.hex, alpha, deltaE76: Number(selected.deltaE76.toFixed(3)), explicit: Boolean(explicit[base]), output, files: [] });
  const record = mappings.get(key); if (!record.files.includes(file)) record.files.push(file);
  return output;
};
for (const file of scope) {
  const filename = path.join(root, file), before = fs.readFileSync(filename, 'utf8');
  const backup = path.join(here, 'before-source', file); fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, before);
  const after = before.replace(/#[0-9a-f]{3,8}\b/gi, raw => {
    let hex = raw.slice(1); if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)), alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    return replace(raw, rgb, alpha, file);
  }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([.\d]+))?\s*\)/gi, (raw, r, g, b, alpha) => replace(raw, [+r, +g, +b], alpha === undefined ? 1 : +alpha, file));
  fs.writeFileSync(filename, after);
}
const result = { metric: 'CIE76 distance compares original and chosen base RGB; original alpha is retained independently. Large text contrast fixes and semantic aliases are explicit, not nearest-color choices.', paletteCount: palette.length, scope, mappings: [...mappings.values()].sort((a, b) => b.deltaE76 - a.deltaE76) };
fs.writeFileSync(path.join(here, 'mapping.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ paletteCount: palette.length, mappings: mappings.size, largestBaseChanges: result.mappings.slice(0, 15) }, null, 2));
