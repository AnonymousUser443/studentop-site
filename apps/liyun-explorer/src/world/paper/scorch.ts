export const PAPER_COLOR = '#f5e8c8';
export const PAPER_TILE = 1400;
export const PAPER_TEXTURE = '/assets/regions/xuan-watermarked.webp';
// In map pixels. Painting broad translucent layers beneath the opaque core
// gives the edge a soft fibre fringe without a runtime blur or fog.
export const PAPER_FRINGE = [[60, .09], [46, .16], [34, .27], [22, .40], [12, .50]] as const;
export const PAPER_BLEED = PAPER_FRINGE[0][0] / 2;

const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, n: number) => a + (b - a) * n;

export function paperSeed(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 0x1b873593) ^ Math.imul(y, 0x85ebca6b) ^ seed;
  h = Math.imul(h ^ h >>> 15, 0xc2b2ae35);
  return ((h ^ h >>> 13) >>> 0) / 4294967296;
}

function noise(x: number, y: number, seed: number) {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  return lerp(lerp(hash(i, j, seed), hash(i + 1, j, seed), fx),
    lerp(hash(i, j + 1, seed), hash(i + 1, j + 1, seed), fx), fy) - .5;
}

const coarseBand = [5.5, 6.2] as const, fibreBand = [17, 16] as const, grainBand = [49, 42] as const;
const mixNoise = (coarse: number, fibre: number, grain: number) => coarse * .22 + fibre * .11 + grain * .06;

/** A lattice node is shared by many pixels. Cache the seeded values and each
 * axis's interpolation weights instead of hashing four corners per pixel. */
function rasterNoise(width: number, height: number, frequencyX: number, frequencyY: number, seed: number) {
  const columns = Math.floor(frequencyX) + 2, rows = Math.floor(frequencyY) + 2;
  const lattice = new Float64Array(columns * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) lattice[y * columns + x] = hash(x, y, seed);
  const axis = (count: number, frequency: number, stride: number) => {
    const offsets = new Int32Array(count), fractions = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const sample = (i + .5) / count * frequency, node = Math.floor(sample);
      offsets[i] = node * stride;
      fractions[i] = smooth(sample - node);
    }
    return { offsets, fractions };
  };
  const x = axis(width, frequencyX, 1), y = axis(height, frequencyY, columns);
  return (i: number, j: number) => {
    const lower = x.offsets[i] + y.offsets[j], upper = lower + columns;
    const u = x.fractions[i], v = y.fractions[j];
    return lerp(lerp(lattice[lower], lattice[lower + 1], u), lerp(lattice[upper], lattice[upper + 1], u), v) - .5;
  };
}

/**
 * Local, deterministic noise texture. Each pixel stores the point in the
 * timeline when it chars. Multiple spatial frequencies create rough lobes,
 * then fracture them into islands that thin as the wind advances.
 */
function scorchDistance(ox: number, oy: number, ratio: number) {
  const distance = (x: number, y: number) => {
    const dx = (x - ox) * ratio, dy = y - oy;
    return Math.hypot(dx * (dx > 0 ? .78 : 1.12), dy * (dy < 0 ? .92 : 1.2)) - dx * .12 + dy * .06;
  };
  const far = Math.max(distance(0, 0), distance(1, 0), distance(0, 1), distance(1, 1), .01);
  return (u: number, v: number) => Math.max(0, distance(u, v) / far);
}

const mixThreshold = (d: number, grain: number) => clamp(.024 + d * .82 + grain * Math.min(1, d * 4), .022, .96);

export function scorchThreshold(ox: number, oy: number, seed: number, ratio: number) {
  const distance = scorchDistance(ox, oy, ratio);
  return (u: number, v: number) => {
    const grain = mixNoise(noise(u * coarseBand[0], v * coarseBand[1], seed),
      noise(u * fibreBand[0], v * fibreBand[1], seed + 229), noise(u * grainBand[0], v * grainBand[1], seed + 83));
    return mixThreshold(distance(u, v), grain);
  };
}

export function scorchField(width: number, height: number, ox: number, oy: number, seed: number, ratio = width / height) {
  const result = new Float32Array(width * height), distance = scorchDistance(ox, oy, ratio);
  const coarse = rasterNoise(width, height, ...coarseBand, seed);
  const fibre = rasterNoise(width, height, ...fibreBand, seed + 229);
  const grain = rasterNoise(width, height, ...grainBand, seed + 83);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    result[y * width + x] = mixThreshold(distance((x + .5) / width, (y + .5) / height),
      mixNoise(coarse(x, y), fibre(x, y), grain(x, y)));
  }
  return result;
}

/** Spend a fixed raster budget even if the account starts with many areas open. */
export function paperRasterSize(width: number, height: number, simultaneous: number, detail: 'simple' | 'full') {
  const ceiling = detail === 'simple' ? 148 : 236;
  const budget = (detail === 'simple' ? 27_000 : 76_000) / Math.max(1, simultaneous);
  const scale = Math.min(ceiling / Math.max(width, height), Math.sqrt(budget / (width * height)), 1);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function scorchFront(progress: number) {
  const t = clamp(progress / .88);
  // Ignition accelerates, then the final, smaller fragments take longer to detach.
  return -.028 + 1.053 * (t * (.52 + 1.09 * t - .61 * t * t));
}

/** Release a fragment only when the same burn front arrives at its starting point. */
export function fragmentRelease(threshold: number) {
  let a = 0, b = .88;
  for (let i = 0; i < 9; i++) {
    const mid = (a + b) / 2;
    if (scorchFront(mid) < threshold) a = mid;
    else b = mid;
  }
  return Math.min(.89, b + .014);
}

export function paintScorch(source: Uint8ClampedArray, output: Uint8ClampedArray, field: Float32Array, progress: number, subdued: boolean) {
  if (progress <= 0) { output.set(source); return; }
  const front = scorchFront(progress), feather = .008, edge = subdued ? .031 : .045;
  for (let i = 0, p = 0; i < field.length; i++, p += 4) {
    const alpha = source[p + 3], remaining = field[i] - front;
    if (alpha === 0 || remaining <= -feather) { output[p + 3] = 0; continue; }
    if (remaining > edge) {
      output[p] = source[p]; output[p + 1] = source[p + 1]; output[p + 2] = source[p + 2]; output[p + 3] = alpha;
      continue;
    }
    const char = clamp(remaining / edge), rim = clamp(1 - Math.abs(remaining - .003) / .011);
    const warm = subdued ? 0 : rim * .89;
    const r = lerp(lerp(90, source[p], char), 253, warm);
    const g = lerp(lerp(51, source[p + 1], char), 155, warm);
    const b = lerp(lerp(32, source[p + 2], char), 67, warm);
    output[p] = r; output[p + 1] = g; output[p + 2] = b;
    output[p + 3] = alpha * clamp((remaining + feather) / feather);
  }
}
