import { MAP_HEIGHT, MAP_WIDTH } from '../data';
import type { EffectsProps, Landmark } from '../types';
import { clamp01, eventTiming } from './timing';

/**
 * Campus fog field.
 *
 * Replaces the old "one cloud silhouette stamped on an 85×46 grid" texture with
 * two fBm noise maps that are composited, drift, and are erased per landmark.
 * Everything is computed from the props (camera / discoveredIds / event), so a
 * fixed `fixedTime` still produces a reproducible frame for the QA scripts.
 */

const TAU = Math.PI * 2;

const PALETTE = {
  edge: [186, 201, 191],
  core: [247, 250, 244],
  deep: [92, 116, 103],
  warm: [255, 220, 165],
  rim: [240, 245, 235],
} as const;

/** Density knobs: `coverage` and `haze` are the two values worth touching. */
export const FOG_TUNING = {
  coverage: 0.96,
  haze: 0.34,
  driftWorld: 9,
  breath: 0.028,
  wisps: 24,
  rays: 0.62,
  raysCount: 6,
  grainWidth: 640,
  grainHeight: 793,
  revealRadius: 560,
  beaconRadius: 780,
  beaconPeek: 200,
};

const rgba = (color: readonly number[], alpha: number) =>
  `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstepRange = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 2.2);

function makeTable(seed: number) {
  let state = (seed >>> 0) || 1;
  const table = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    table[i] = state / 4294967296;
  }
  return table;
}

const tableIndex = (x: number, y: number) => ((x & 255) | ((y & 255) << 8)) & 65535;

function valueNoise(table: Float32Array, x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = table[tableIndex(xi, yi)];
  const b = table[tableIndex(xi + 1, yi)];
  const c = table[tableIndex(xi, yi + 1)];
  const d = table[tableIndex(xi + 1, yi + 1)];
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(table: Float32Array, x: number, y: number, octaves: number) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(table, x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return sum / norm;
}

/** One fog map: big shapes plus a sharp threshold, so masses and gaps stay readable. */
function buildFogTexture(seed: number) {
  const width = FOG_TUNING.grainWidth;
  const height = FOG_TUNING.grainHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const table = makeTable(seed);
  const [edgeR, edgeG, edgeB] = PALETTE.edge;
  const [coreR, coreG, coreB] = PALETTE.core;
  const [deepR, deepG, deepB] = PALETTE.deep;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const big = fbm(table, u * 1.55, v * 1.55, 4);
      const mid = fbm(table, u * 4.1 + 13.7, v * 4.1 + 5.3, 3);
      const fine = fbm(table, u * 13 + 41.1, v * 13 + 7.7, 2);
      const raw = big * 0.72 + mid * 0.22 + fine * 0.06;

      // Contrast stretch, then a soft threshold: roughly half is dense fog, half is gap.
      const n = clamp01((raw - 0.5) * 3.4 + 0.5);
      let alpha = smoothstepRange(0.2, 0.45, n);
      alpha = 0.5 + 0.5 * alpha;
      alpha *= 0.82 + 0.18 * smoothstepRange(0.1, 0.9, mid);

      const core = smoothstepRange(0.35, 0.95, alpha);
      const rimInk = (1 - smoothstepRange(0.02, 0.3, alpha)) * 0.6;

      const index = (y * width + x) * 4;
      data[index] = lerp(lerp(edgeR, coreR, core), deepR, rimInk);
      data[index + 1] = lerp(lerp(edgeG, coreG, core), deepG, rimInk);
      data[index + 2] = lerp(lerp(edgeB, coreB, core), deepB, rimInk);
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type Reveal = { landmark: Landmark; progress: number; x: number; y: number };

export class FogField {
  private textures: HTMLCanvasElement[] = [];
  private seed = Number.NaN;
  private buffer = document.createElement('canvas');

  private ensure(seed: number) {
    if (this.textures.length === 2 && this.seed === seed) return;
    this.seed = seed;
    this.textures = [buildFogTexture(seed * 7 + 1337), buildFogTexture(seed * 11 + 9871)];
  }

  draw(ctx: CanvasRenderingContext2D, props: EffectsProps, pixelDensity: number, now: number) {
    const seed = props.seed ?? 1386;
    this.ensure(seed);

    const { width, height } = props.viewport;
    const camera = props.camera;
    const tuning = FOG_TUNING;
    const reduced = props.settings.reducedMotion;
    const t = reduced ? 0 : now / 1000;

    // Offscreen at ~0.72x: the fog is soft anyway and this keeps 1920 wide cheap.
    const resolution = Math.min(props.settings.quality === 'low' ? 0.5 : 0.72, 1400 / Math.max(1, width), 1);
    const bufferWidth = Math.max(1, Math.ceil(width * resolution));
    const bufferHeight = Math.max(1, Math.ceil(height * resolution));
    if (this.buffer.width !== bufferWidth || this.buffer.height !== bufferHeight) {
      this.buffer.width = bufferWidth;
      this.buffer.height = bufferHeight;
    }
    const paint = this.buffer.getContext('2d')!;
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.clearRect(0, 0, bufferWidth, bufferHeight);

    // 1. Fog body: a flat haze plus two drifted noise maps.
    paint.setTransform(
      resolution * camera.scale,
      0,
      0,
      resolution * camera.scale,
      resolution * camera.x,
      resolution * camera.y,
    );
    paint.fillStyle = rgba(PALETTE.edge, tuning.haze * tuning.coverage);
    paint.fillRect(-2, -2, MAP_WIDTH + 4, MAP_HEIGHT + 4);

    const drift = reduced ? 0 : tuning.driftWorld;
    const ax = Math.sin(t * 0.13) * drift;
    const ay = Math.cos(t * 0.097) * drift * 0.8;
    const bx = Math.cos(t * 0.081) * drift * 1.6;
    const by = Math.sin(t * 0.067) * drift * 1.2;

    paint.globalAlpha = tuning.coverage * 0.9;
    paint.drawImage(this.textures[0], ax - 40, ay - 40, MAP_WIDTH + 80, MAP_HEIGHT + 80);

    const breath = 1 + (reduced ? 0 : tuning.breath) * Math.sin(t * 0.052);
    paint.save();
    paint.translate(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    paint.scale(breath, breath);
    paint.translate(-MAP_WIDTH / 2, -MAP_HEIGHT / 2);
    paint.globalAlpha = tuning.coverage * 0.36;
    paint.drawImage(this.textures[1], bx - 40, by - 40, MAP_WIDTH + 80, MAP_HEIGHT + 80);
    paint.restore();
    paint.globalAlpha = 1;

    // 2. Reveal state, derived from props so QA's fixedTime stays reproducible.
    paint.setTransform(resolution, 0, 0, resolution, 0, 0);
    const timing = eventTiming(props.event, now);
    const reveals: Reveal[] = [];
    for (const landmark of props.landmarks) {
      if (!props.discoveredIds.includes(landmark.id)) continue;
      const revealing = props.event?.landmarkId === landmark.id && timing.progress < 1;
      const progress = revealing ? timing.reveal : 1;
      reveals.push({
        landmark,
        progress,
        x: camera.x + landmark.uv.u * MAP_WIDTH * camera.scale,
        y: camera.y + landmark.uv.v * MAP_HEIGHT * camera.scale,
      });
    }

    paint.globalCompositeOperation = 'destination-out';
    for (const reveal of reveals) {
      const radius = this.revealRadius(reveal, camera.scale);
      if (radius <= 0.5) continue;
      paint.save();
      paint.translate(reveal.x, reveal.y);
      paint.scale(1, 0.88);
      const gradient = paint.createRadialGradient(0, 0, radius * 0.42, 0, 0, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.62, 'rgba(0,0,0,0.94)');
      gradient.addColorStop(0.86, 'rgba(0,0,0,0.55)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      paint.fillStyle = gradient;
      paint.beginPath();
      paint.arc(0, 0, radius, 0, TAU);
      paint.fill();
      paint.restore();
    }

    // The beacon keeps a small clear halo before discovery, same as before.
    const beacon = props.landmarks.find(x => x.isBeacon);
    if (beacon && !props.discoveredIds.includes(beacon.id)) {
      const radius = tuning.beaconPeek * camera.scale;
      paint.save();
      paint.translate(camera.x + beacon.uv.u * MAP_WIDTH * camera.scale, camera.y + beacon.uv.v * MAP_HEIGHT * camera.scale);
      paint.scale(1, 0.88);
      const gradient = paint.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      paint.fillStyle = gradient;
      paint.beginPath();
      paint.arc(0, 0, radius, 0, TAU);
      paint.fill();
      paint.restore();
    }

    // 3. Churning edge while revealing, faint breathing afterwards.
    this.drawFrontier(paint, reveals, camera.scale, t, reduced);

    // 4. A restrained warm glow inside every discovered area.
    paint.globalCompositeOperation = 'lighter';
    for (const reveal of reveals) {
      if (reveal.progress < 0.55) continue;
      const radius = this.revealRadius(reveal, camera.scale) * 0.72;
      const strength = (reveal.progress - 0.55) / 0.45;
      const gradient = paint.createRadialGradient(reveal.x, reveal.y, 0, reveal.x, reveal.y, radius);
      gradient.addColorStop(0, rgba(PALETTE.warm, 0.075 * strength));
      gradient.addColorStop(0.6, rgba(PALETTE.warm, 0.028 * strength));
      gradient.addColorStop(1, rgba(PALETTE.warm, 0));
      paint.fillStyle = gradient;
      paint.fillRect(reveal.x - radius, reveal.y - radius, radius * 2, radius * 2);
    }

    // 5. Light pouring out of the fog centre during the reveal.
    paint.globalCompositeOperation = 'source-over';
    for (const reveal of reveals) {
      if (reveal.progress <= 0 || reveal.progress >= 1) continue;
      this.drawRevealLight(paint, reveal, camera.scale, t, reduced);
    }

    paint.globalCompositeOperation = 'source-over';

    // 6. Present. Clearing the whole backing store keeps pixelDensity changes clean.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.buffer, 0, 0, width, height);
    ctx.restore();
  }

  private revealRadius(reveal: Reveal, scale: number) {
    const base = reveal.landmark.isBeacon ? FOG_TUNING.beaconRadius : FOG_TUNING.revealRadius;
    return base * scale * (reveal.progress >= 1 ? 1 : easeOut(reveal.progress));
  }

  private drawFrontier(
    paint: CanvasRenderingContext2D,
    reveals: Reveal[],
    scale: number,
    t: number,
    reduced: boolean,
  ) {
    const gusts: { x: number; y: number; size: number; alpha: number; driftX: number; driftY: number }[] = [];
    const count = FOG_TUNING.wisps;
    const spin = reduced ? 0 : 1;

    for (const reveal of reveals) {
      if (reveal.progress <= 0) continue;
      const radius = this.revealRadius(reveal, scale);
      if (radius < 8) continue;
      const settled = reveal.progress >= 1;
      const intensity = settled ? 0.13 : Math.sin(Math.PI * Math.min(1, reveal.progress * 1.05));
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * TAU + Math.sin(t * 0.62 * spin + i * 1.7) * 0.1 * spin;
        const distance = radius * (0.93 + 0.085 * Math.sin(t * 1.05 * spin + i * 2.3));
        const size = radius * (0.2 + 0.085 * Math.sin(t * 0.86 * spin + i * 1.3));
        const alpha = 0.3 * intensity * (0.55 + 0.45 * Math.sin(t * 1.25 * spin + i * 0.9));
        if (alpha <= 0.004) continue;
        gusts.push({
          x: reveal.x + Math.cos(angle) * distance,
          y: reveal.y + Math.sin(angle) * distance * 0.88,
          size,
          alpha,
          driftX: Math.cos(angle) * size * 0.5,
          driftY: Math.sin(angle) * size * 0.5,
        });
      }
    }
    if (!gusts.length) return;

    paint.globalCompositeOperation = 'destination-out';
    for (const gust of gusts) {
      const gradient = paint.createRadialGradient(
        gust.x + gust.driftX, gust.y + gust.driftY, 0,
        gust.x + gust.driftX, gust.y + gust.driftY, gust.size,
      );
      gradient.addColorStop(0, `rgba(0,0,0,${clamp01(gust.alpha * 1.35)})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      paint.fillStyle = gradient;
      paint.beginPath();
      paint.arc(gust.x + gust.driftX, gust.y + gust.driftY, gust.size, 0, TAU);
      paint.fill();
    }

    paint.globalCompositeOperation = 'source-over';
    for (const gust of gusts) {
      const gradient = paint.createRadialGradient(gust.x, gust.y, 0, gust.x, gust.y, gust.size * 1.1);
      gradient.addColorStop(0, rgba(PALETTE.rim, clamp01(gust.alpha * 0.9)));
      gradient.addColorStop(0.55, rgba(PALETTE.rim, clamp01(gust.alpha * 0.45)));
      gradient.addColorStop(1, rgba(PALETTE.rim, 0));
      paint.fillStyle = gradient;
      paint.beginPath();
      paint.arc(gust.x, gust.y, gust.size * 1.1, 0, TAU);
      paint.fill();
    }
  }

  private drawRevealLight(
    paint: CanvasRenderingContext2D,
    reveal: Reveal,
    scale: number,
    t: number,
    reduced: boolean,
  ) {
    const progress = reveal.progress;
    const radius = this.revealRadius({ ...reveal, progress: 1 }, scale);
    const fade = Math.sin(Math.PI * clamp01(progress * 1.12)) * (1 - smoothstepRange(0.72, 1, progress));
    const alpha = FOG_TUNING.rays * fade;
    if (alpha <= 0.002) return;
    const { x, y } = reveal;

    // Warm halo. Plain compositing (not `lighter`) because the fog is nearly white.
    const halo = paint.createRadialGradient(x, y, 0, x, y, radius * 1.2);
    halo.addColorStop(0, rgba(PALETTE.warm, alpha * 0.55));
    halo.addColorStop(0.45, rgba(PALETTE.warm, alpha * 0.22));
    halo.addColorStop(0.78, rgba(PALETTE.warm, alpha * 0.16));
    halo.addColorStop(0.93, rgba(PALETTE.warm, alpha * 0.62));
    halo.addColorStop(1, rgba(PALETTE.warm, 0));
    paint.fillStyle = halo;
    paint.beginPath();
    paint.arc(x, y, radius * 1.2, 0, TAU);
    paint.fill();

    const length = radius * 1.3;
    const spin = reduced ? 0 : t * 0.16;
    for (let i = 0; i < FOG_TUNING.raysCount; i++) {
      const angle = (i / FOG_TUNING.raysCount) * TAU + spin + 0.4;
      const spread = 0.075 + 0.035 * Math.sin(i * 2.1 + t * 0.5);
      const gradient = paint.createLinearGradient(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length * 0.88);
      gradient.addColorStop(0, rgba(PALETTE.warm, alpha * 0.75));
      gradient.addColorStop(0.45, rgba(PALETTE.warm, alpha * 0.3));
      gradient.addColorStop(1, rgba(PALETTE.warm, 0));
      paint.fillStyle = gradient;
      paint.beginPath();
      paint.moveTo(x, y);
      paint.arc(x, y, length, angle - spread, angle + spread);
      paint.closePath();
      paint.fill();
    }

    const ring = clamp01((progress - 0.15) / 0.75);
    if (ring > 0 && ring < 1) {
      paint.strokeStyle = rgba(PALETTE.warm, alpha * 1.4 * (1 - ring));
      paint.lineWidth = 1.6;
      paint.beginPath();
      paint.ellipse(x, y, radius * 1.06 * ring, radius * 1.06 * ring * 0.88, 0, 0, TAU);
      paint.stroke();
    }
  }

  dispose() {
    this.textures = [];
    this.seed = Number.NaN;
    this.buffer.width = 1;
    this.buffer.height = 1;
  }
}
