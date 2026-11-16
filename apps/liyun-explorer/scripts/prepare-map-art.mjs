import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../public/assets/maps/calibrated/campus_no_labels.png', import.meta.url));
const material = fileURLToPath(new URL('./assets/map-xuan-grain.webp', import.meta.url));
const target = fileURLToPath(new URL('../public/assets/maps/campus-xuan.webp', import.meta.url));
const width = 4000;
const height = 4958;
const grainSize = 768;

function magick(args, input) {
  const result = spawnSync('magick', args, { input, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(String(result.stderr));
  return result.stdout;
}
function readPixels(path, geometry, channels) {
  if (String(magick(['identify', '-format', '%wx%h', path])) !== geometry) {
    throw new Error('Unexpected image size: ' + path);
  }
  const pixels = magick([path, ...(channels === 'gray' ? ['-colorspace', 'Gray'] : []), '-depth', '8', channels + ':-']);
  const [w, h] = geometry.split('x').map(Number);
  if (pixels.length !== w * h * (channels === 'rgba' ? 4 : 1)) throw new Error('Unexpected pixel data: ' + path);
  return pixels;
}
// The flat stock surrounding the drawn map is a separate visual layer. Only
// pixels connected to the canvas edge and matching that near-uniform stock
// qualify. Do not key out the same cream where it occurs inside map details.
function blankStock(pixels) {
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let read = 0, write = 0;
  const add = index => {
    if (visited[index]) return;
    const i = index * 4;
    const stock = Math.max(Math.abs(pixels[i] - 235), Math.abs(pixels[i + 1] - 229), Math.abs(pixels[i + 2] - 211));
    if (stock > 7 && pixels[i + 3] > 0) return;
    visited[index] = 1;
    queue[write++] = index;
  };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { add(y * width); add(y * width + width - 1); }
  while (read < write) {
    const index = queue[read++];
    const x = index % width;
    if (x > 0) add(index - 1);
    if (x < width - 1) add(index + 1);
    if (index >= width) add(index - width);
    if (index < width * (height - 1)) add(index + width);
  }
  return visited;
}

function applyStockMatte(pixels, stock) {
  for (let n = 0; n < stock.length; n++) if (stock[n]) {
    const i = 4 * n;
    const difference = Math.max(Math.abs(pixels[i] - 235), Math.abs(pixels[i+1] - 229), Math.abs(pixels[i+2] - 211));
    const t = Math.max(0, Math.min(1, (difference - 1) / 6));
    pixels[i+3] = Math.round(pixels[i+3] * t * t * (3 - 2 * t));
  }
}

// Work in the original map's pixel grid so the soft ink margin stays attached
// to the illustration at every zoom. Only the outside of the drawing seeds
// this capped chamfer field; pale roads and courtyards inside are not sources.
function featherMargin(pixels, stock) {
  const feather = 76;
  const cap = feather * 3;
  const distance = new Uint8Array(stock.length);
  for (let n = 0; n < stock.length; n++) {
    distance[n] = stock[n] && pixels[n * 4 + 3] === 0 ? 0 : cap;
  }
  for (let y = 0, n = 0; y < height; y++) for (let x = 0; x < width; x++, n++) {
    let d = distance[n];
    if (!d) continue;
    if (x > 0) d = Math.min(d, distance[n - 1] + 3);
    if (y > 0) {
      d = Math.min(d, distance[n - width] + 3);
      if (x > 0) d = Math.min(d, distance[n - width - 1] + 4);
      if (x < width - 1) d = Math.min(d, distance[n - width + 1] + 4);
    }
    distance[n] = d;
  }
  for (let y = height - 1, n = distance.length - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--, n--) {
    let d = distance[n];
    if (d) {
      if (x < width - 1) d = Math.min(d, distance[n + 1] + 3);
      if (y < height - 1) {
        d = Math.min(d, distance[n + width] + 3);
        if (x > 0) d = Math.min(d, distance[n + width - 1] + 4);
        if (x < width - 1) d = Math.min(d, distance[n + width + 1] + 4);
      }
      distance[n] = d;
    }
    // Suppress the thin frame on the edge of the source canvas as well.
    const t = Math.min(d / cap, Math.max(0, Math.min(x, y, width - 1 - x, height - 1 - y) - 4) / 24, 1);
    if (t < 1) pixels[n * 4 + 3] = Math.round(pixels[n * 4 + 3] * t * t * (3 - 2 * t));
  }
}

function verify(golden) {
  const decoded = readPixels(target, width + 'x' + height, 'rgba');
  for (let i = 3; i < decoded.length; i += 4) {
    if (decoded[i] !== golden[i]) throw new Error('Derived map differs from the expected matte at pixel ' + ((i - 3) / 4));
  }
  console.log('Full canvas and edge feather verified (' + width + ' × ' + height + ').');
}
const mode = process.argv[2];
if (process.argv.length > 3 || (mode && mode !== '--check')) throw new Error('Usage: node scripts/prepare-map-art.mjs [--check]');
const pixels = readPixels(source, width + 'x' + height, 'rgba');
const stock = blankStock(pixels);
applyStockMatte(pixels, stock);
featherMargin(pixels, stock);
if (mode === '--check') {
  verify(pixels);
} else {
  const grain = readPixels(material, grainSize + 'x' + grainSize, 'gray');
  const grainMean = grain.reduce((sum, x) => sum + x, 0) / grain.length;
  const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
  const smooth = (n, low, high) => {
    const t = clamp((n - low) / (high - low));
    return t * t * (3 - 2 * t);
  };
  const mirror = n => {
    const phase = n % (2 * grainSize);
    return phase < grainSize ? phase : 2 * grainSize - 1 - phase;
  };
  const grainX = Uint16Array.from({ length: width }, (_, x) => mirror((x >> 1) + 67));
  const grainY = Uint16Array.from({ length: height }, (_, y) => mirror((y >> 1) + 31));
  // Continuous colour transforms preserve antialiased source edges. Water and
  // vegetation are inferred from the source palette, never from new geometry.
  const palette = new Map();
  const translate = (r, g, b) => {
    const water = smooth(g - r, 12, 42) * smooth(b - r, 23, 56);
    const plant = smooth(g - r, 0, 7) * smooth(g - b, 15, 40);
    const paper = smooth(g, 177, 225) * (1 - smooth(g - r, -4, 2));
    return [
      r + 25 * water - 21 * plant + 4 * paper,
      g - 18 * water - 7 * plant - 2 * paper,
      b - 32 * water + 29 * plant - 8 * paper,
      0.17 + 0.22 * water + 0.23 * plant + 0.08 * paper,
    ];
  };
  for (let y = 0, i = 0; y < height; y++) {
    const row = grainY[y] * grainSize;
    for (let x = 0; x < width; x++, i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const key = (r << 16) | (g << 8) | b;
      let swatch = palette.get(key);
      if (!swatch) {
        swatch = translate(r, g, b);
        palette.set(key, swatch);
      }
      const shade = clamp(grain[row + grainX[x]] - grainMean, -15, 15) * swatch[3];
      for (let c = 0; c < 3; c++) pixels[i + c] = clamp(Math.round(swatch[c] + shade), 0, 255);
    }
  }
  // The only texture is baked into this one bitmap; the browser does no extra
  // map paint or per-frame shading. Keep the alpha exact through WebP encoding.
  magick(['-size', width + 'x' + height, '-depth', '8', 'rgba:-', '-define', 'webp:alpha-quality=100',
    '-define', 'webp:method=6', '-quality', '86', target], pixels);
  verify(pixels);
}
