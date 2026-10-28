import { MAP_HEIGHT, MAP_WIDTH } from '../data';
import type { EffectsProps, Landmark } from '../types';
import { clamp01, eventTiming, seededRandom } from './timing';

/**
 * Campus fog field.
 *
 * Volumetric-looking mist built from a few dozen feathered "puff" sprites that
 * drift, breathe and overlap. A thin flat haze underneath keeps the sheet
 * coherent. Everything is derived from the props (camera / discoveredIds /
 * event), so a fixed `fixedTime` still produces a reproducible frame.
 */

const TAU = Math.PI * 2;

const PALETTE = {
  edge: [198, 211, 200],
  core: [250, 252, 246],
  deep: [92, 116, 100],
  warm: [255, 220, 165],
  rim: [240, 245, 235],
} as const;

/** Density knobs: `coverage` and `haze` are the two values worth touching. */
export const FOG_TUNING = {
  coverage: 1,
  haze: 0.44,
  puffCount: 330,
  puffDriftX: 130,
  puffDriftY: 96,
  puffSpeed: 34,
  puffMinRadius: 220,
  puffMaxRadius: 520,
  revealRadius: 560,
  beaconRadius: 780,
  beaconPeek: 200,
  rays: 0.62,
  raysCount: 6,
  wisps: 24,
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

const PUFF_SIZE = 256;

/**
 * One soft cloud puff. `tone` 0 builds the lit bank used closest to the camera,
 * 1 builds the shaded bank used behind it — that pair is what gives the sheet depth.
 */
function buildPuff(seed: number, tone: 0 | 1) {
  const size = PUFF_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const table = makeTable(seed);
  const [coreR, coreG, coreB] = PALETTE.core;
  const [edgeR, edgeG, edgeB] = PALETTE.edge;
  const [deepR, deepG, deepB] = PALETTE.deep;
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Angular noise breaks the circle; radial noise adds wisps toward the rim.
      const angle = Math.atan2(dy, dx);
      const ring = fbm(table, Math.cos(angle) * 1.6 + 5.2, Math.sin(angle) * 1.6 + 8.4, 3);
      const wisps = fbm(table, (x / size) * 3.4 + 2.1, (y / size) * 3.4 + 6.3, 4);
      const rim = 0.88 + 0.24 * (ring - 0.5) + 0.16 * (wisps - 0.5);
      const outer = Math.max(0, 1 - d / rim);

      // Squared falloff reads as volume: dense core, long feathered edge.
      let alpha = Math.pow(clamp01(outer), 1.35);
      alpha *= 0.86 + 0.14 * smoothstepRange(0.2, 0.8, wisps);

      // Volume: a lit crown, a soft terminator around the middle, a shaded base.
      const height = -dy; // +1 at the top of the puff
      const crown = smoothstepRange(0.05, 0.75, height);
      const base = smoothstepRange(-0.15, -0.8, height);
      const relief = 0.5 + crown * 0.42 - base * 0.5 + (wisps - 0.5) * 0.35;
      const lit = clamp01(relief);

      // Back banks sit in the shadow of the front ones.
      const shadowMix = tone === 1 ? 0.45 : 0;
      const bodyR = lerp(lerp(edgeR, coreR, lit), deepR, shadowMix);
      const bodyG = lerp(lerp(edgeG, coreG, lit), deepG, shadowMix);
      const bodyB = lerp(lerp(edgeB, coreB, lit), deepB, shadowMix);

      // Thin rims fade toward the deep tone so overlapping banks keep an edge.
      const rimInk = (1 - smoothstepRange(0, 0.22, alpha)) * (tone === 1 ? 0.45 : 0.25);

      const index = (y * size + x) * 4;
      data[index] = lerp(bodyR, deepR, rimInk);
      data[index + 1] = lerp(bodyG, deepG, rimInk);
      data[index + 2] = lerp(bodyB, deepB, rimInk);
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type Puff = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  driftX: number;
  driftY: number;
  pulse: number;
  variant: number;
  depth: number;
  rotation: number;
  spin: number;
  wave: number;
  highlight: boolean;
};

type Reveal = { landmark: Landmark; progress: number; x: number; y: number };

export class FogField {
  private sprites: HTMLCanvasElement[] = [];
  private puffs: Puff[] = [];
  private seed = Number.NaN;
  private buffer = document.createElement('canvas');

  private ensure(seed: number) {
    if (this.seed === seed && this.sprites.length) return;
    this.seed = seed;
    // Front (lit) sprites first, then the shaded set used for banks further back.
    this.sprites = [
      buildPuff(seed * 3 + 11, 0),
      buildPuff(seed * 5 + 29, 0),
      buildPuff(seed * 7 + 47, 0),
      buildPuff(seed * 3 + 11, 1),
      buildPuff(seed * 5 + 29, 1),
      buildPuff(seed * 7 + 47, 1),
    ];
    const random = seededRandom(seed * 13 + 5);
    const tuning = FOG_TUNING;
    this.puffs = Array.from({ length: tuning.puffCount }, () => {
      const radius = tuning.puffMinRadius + random() * (tuning.puffMaxRadius - tuning.puffMinRadius);
      const depth = random(); // 0 = far bank, 1 = right in front of the camera
      return {
        x: random() * MAP_WIDTH,
        y: random() * MAP_HEIGHT,
        radius,
        alpha: 0.76 + random() * 0.24,
        phase: random() * TAU,
        speed: 0.35 + random() * 0.55,
        driftX: (random() - 0.5) * 2 * tuning.puffDriftX,
        driftY: (random() - 0.5) * 2 * tuning.puffDriftY,
        pulse: 0.10 + random() * 0.10,
        variant: Math.floor(random() * 3),
        highlight: random() > 0.72,
        depth,
        rotation: random() * TAU,
        spin: (random() - 0.5) * 0.05,
        // The travelling wave is keyed off position, so neighbouring banks rise together.
        wave: (random() * MAP_WIDTH * 0.0024 + random() * MAP_HEIGHT * 0.0017) % TAU,
      };
    });
    // Back banks first so the lit ones end up in front.
    this.puffs.sort((a, b) => a.depth - b.depth);
  }

  draw(ctx: CanvasRenderingContext2D, props: EffectsProps, pixelDensity: number, now: number) {
    const seed = props.seed ?? 1386;
    this.ensure(seed);

    const { width, height } = props.viewport;
    const camera = props.camera;
    const tuning = FOG_TUNING;
    const reduced = props.settings.reducedMotion;
    const t = reduced ? 0 : now / 1000;

    const resolution = Math.min(props.settings.quality === 'low' ? 0.42 : 0.58, 1200 / Math.max(1, width), 1);
    const bufferWidth = Math.max(1, Math.ceil(width * resolution));
    const bufferHeight = Math.max(1, Math.ceil(height * resolution));
    if (this.buffer.width !== bufferWidth || this.buffer.height !== bufferHeight) {
      this.buffer.width = bufferWidth;
      this.buffer.height = bufferHeight;
    }
    const paint = this.buffer.getContext('2d')!;
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.clearRect(0, 0, bufferWidth, bufferHeight);

    // 1. Mist body: a whisper-thin haze so the gaps are never fully clear,
    //    then the puff banks on top.
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

    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.scale(resolution, resolution);
    paint.translate(camera.x, camera.y);
    paint.scale(camera.scale, camera.scale);

    const margin = 240;
    for (const puff of this.puffs) {
      // A slow wave runs across the map: banks in the same area swell together,
      // so the sheet rolls instead of every puff bobbing on its own clock.
      const wave = Math.sin(t * 0.85 - puff.wave + puff.phase * 0.15);
      const swell = Math.sin(t * 0.62 - puff.wave * 1.3 + puff.phase * 0.6);

      const x = puff.x + Math.sin(t * puff.speed * 0.22 + puff.phase) * puff.driftX * (0.6 + 0.4 * wave);
      const y = puff.y + Math.cos(t * puff.speed * 0.19 + puff.phase * 1.7) * puff.driftY * (0.6 + 0.4 * swell);
      const radius = puff.radius * (1 + puff.pulse * (1 + swell));
      const alpha = puff.alpha * (0.58 + 0.42 * wave);

      // Cull against the viewport in screen space before drawing the sprite.
      const screenX = (camera.x + x * camera.scale) * resolution;
      const screenY = (camera.y + y * camera.scale) * resolution;
      const screenR = radius * camera.scale * resolution * 1.1;
      if (screenX + screenR < -margin || screenX - screenR > bufferWidth + margin) continue;
      if (screenY + screenR < -margin || screenY - screenR > bufferHeight + margin) continue;

      // Depth: far banks are dimmer, squatter and slightly bigger; front ones are crisp.
      const shade = 0.62 + 0.38 * puff.depth;
      const squash = 0.82 + 0.1 * puff.depth;
      const sprite = this.sprites[puff.depth < 0.5 ? puff.variant + 3 : puff.variant];
      paint.globalAlpha = clamp01(alpha * tuning.coverage * shade);
      paint.save();
      paint.translate(x, y);
      paint.rotate(puff.rotation + (reduced ? 0 : t * puff.spin));
      paint.scale(1, squash);
      paint.drawImage(sprite, -radius, -radius, radius * 2, radius * 2);
      paint.restore();

      // Lit crowns: a few banks pick up a travelling highlight, so the sheet reads
      // as rolling even where the fog is nearly opaque.
      if (puff.highlight && !reduced) {
        paint.globalCompositeOperation = 'lighter';
        const glow = 0.16 * clamp01(0.5 + 0.5 * wave);
        paint.globalAlpha = glow;
        paint.save();
        paint.translate(x, y - radius * 0.12);
        paint.rotate(puff.rotation - (t * puff.spin) / 2);
        paint.scale(1, squash * 0.9);
        paint.drawImage(sprite, -radius * 0.85, -radius * 0.85, radius * 1.7, radius * 1.7);
        paint.restore();
        paint.globalCompositeOperation = 'source-over';
      }
    }
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
      gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
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

    // 6. Present.
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
    this.sprites = [];
    this.puffs = [];
    this.seed = Number.NaN;
    this.buffer.width = 1;
    this.buffer.height = 1;
  }
}
