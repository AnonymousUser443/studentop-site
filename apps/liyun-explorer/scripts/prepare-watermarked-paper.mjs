import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const local = path => fileURLToPath(new URL(path, import.meta.url));
function convert(...args) {
  const r = spawnSync('magick', args, { windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(r.error?.message || String(r.stderr));
  return r.stdout;
}
const base = local('../public/assets/regions/xuan-paper.webp');
const mark = local('./assets/frost-bit-emblem.png');
const linework = local('./assets/region-paper-ink.svg');
const output = local('../public/assets/regions/xuan-watermarked.webp');
// Mirror only the paper fibre. Non-mirrored impressions share the same
// coordinates in the static SVG and the transient burn canvas.
convert(base, '(', '+clone', '-flop', ')', '+append', '(', '+clone', '-flip', ')', '-append',
  '-fill', '#f7eed3', '-colorize', '47%',
  '(', '-background', 'none', linework, ')', '-compose', 'over', '-composite',
  '(', mark, '-resize', '64x64', '-channel', 'RGBA', '-fill', '#907343', '-colorize', '100,100,100,0',
  '+channel', '-alpha', 'set', '-channel', 'A', '-evaluate', 'multiply', '0.20', '+channel', ')',
  '-gravity', 'NorthWest', '-geometry', '+270+569', '-compose', 'over', '-composite',
  '-define', 'webp:method=6', '-quality', '86', output);
