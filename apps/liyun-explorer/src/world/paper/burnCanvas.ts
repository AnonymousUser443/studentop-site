import { PAPER_BLEED, PAPER_COLOR, PAPER_FRINGE, PAPER_TEXTURE, PAPER_TILE, fragmentRelease, paintScorch, paperRasterSize, paperSeed, scorchField, scorchThreshold } from './scorch';
import { paperContains, type PaperBounds, type PaperRegion } from './geometry';
import type { UV } from '../../types';
import { MAP_HEIGHT, MAP_WIDTH } from '../../data';

export type PaperJob = {
  region: PaperRegion;
  startsAt: number;
  fixedStartsAt: number;
  length: number;
  origin: UV;
  reason: 'arrival' | 'unlock';
  batchSize: number;
  atlas?: PaperAtlas;
};

export const PAPER_FRAMES = 29;
export const PAPER_ATLAS_COLUMNS = 6;
export type PaperAtlas = { bitmap: ImageBitmap; width: number; height: number };

let texture: HTMLImageElement | undefined;

export function warmPaperTexture() {
  if (!texture) { texture = new Image(); texture.src = PAPER_TEXTURE; }
}

export function paperBurnBounds({ bounds }: PaperRegion): PaperBounds {
  return { x: bounds.x - PAPER_BLEED, y: bounds.y - PAPER_BLEED, width: bounds.width + PAPER_BLEED * 2, height: bounds.height + PAPER_BLEED * 2 };
}

export function ignition(job: Pick<PaperJob, 'origin'>, bounds: PaperBounds) {
  const { x, y, width, height } = bounds;
  // Keep a fraction of a pixel of room at each edge without moving an
  // ignition point from thin or concave paper into an adjacent region.
  return {
    u: Math.max(.001, Math.min(.999, (job.origin.u * MAP_WIDTH - x) / width)),
    v: Math.max(.001, Math.min(.999, (job.origin.v * MAP_HEIGHT - y) / height)),
  };
}

export function paintPaperSource(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bounds: PaperBounds, raster: { width: number; height: number }, shape: Path2D, tile?: CanvasImageSource, tileWidth = 1) {
  const { x, y } = bounds;
  const sx = raster.width / bounds.width, sy = raster.height / bounds.height;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, raster.width, raster.height);
  context.setTransform(sx, 0, 0, sy, -x * sx, -y * sy);
  context.lineJoin = 'round';
  context.strokeStyle = PAPER_COLOR;
  for (const [width, alpha] of PAPER_FRINGE) {
    context.lineWidth = width;
    context.globalAlpha = alpha;
    context.stroke(shape);
  }
  context.globalAlpha = 1;
  context.fillStyle = PAPER_COLOR;
  context.fill(shape);
  if (tile) {
    const pattern = context.createPattern(tile, 'repeat');
    if (pattern && typeof pattern.setTransform === 'function' && typeof DOMMatrix === 'function') {
      pattern.setTransform(new DOMMatrix().scale(PAPER_TILE / tileWidth));
      context.globalCompositeOperation = 'source-atop';
      context.fillStyle = pattern;
      context.fillRect(x, y, bounds.width, bounds.height);
      context.globalCompositeOperation = 'source-over';
    }
  }
  return context.getImageData(0, 0, raster.width, raster.height).data;
}

export function playPaperAtlas(canvas: HTMLCanvasElement, atlas: PaperAtlas) {
  const { width, height, bitmap } = atlas;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.globalCompositeOperation = 'copy';
  let previous = -1;
  return (progress: number, subdued: boolean) => {
    const frame = Math.min(PAPER_FRAMES - 1, Math.floor(progress * (PAPER_FRAMES - 1)));
    const index = frame + (subdued ? PAPER_FRAMES : 0);
    if (index === previous) return;
    previous = index;
    context.drawImage(bitmap, (index % PAPER_ATLAS_COLUMNS) * width, Math.floor(index / PAPER_ATLAS_COLUMNS) * height,
      width, height, 0, 0, width, height);
  };
}

/** Create an immutable crop and a single work buffer for a live check-in. */
export function makePaperRaster(canvas: HTMLCanvasElement, job: PaperJob, count: number, detail: 'simple' | 'full') {
  const { path, id } = job.region;
  const bounds = paperBurnBounds(job.region);
  const raster = paperRasterSize(bounds.width, bounds.height, count, detail);
  canvas.width = raster.width; canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context || typeof Path2D === 'undefined') return;
  const { u, v } = ignition(job, bounds);
  const field = scorchField(raster.width, raster.height, u, v, paperSeed(id), bounds.width / bounds.height);
  const shape = new Path2D(path);
  const output = context.createImageData(raster.width, raster.height);
  const source = () => {
    warmPaperTexture();
    const tile = texture?.complete && texture.naturalWidth ? texture : undefined;
    return { pixels: paintPaperSource(context, bounds, raster, shape, tile, tile?.naturalWidth), textured: Boolean(tile) };
  };
  let base = source();
  return (progress: number, subdued: boolean) => {
    if (!base.textured && texture?.complete && texture.naturalWidth) base = source();
    paintScorch(base.pixels, output.data, field, progress, subdued);
    context.putImageData(output, 0, 0);
  };
}

/** Eight short-lived flecks maximum, carried up/right; the paper rips before they leave. */
export function paperFragments(job: PaperJob, detail: 'simple' | 'full', subdued: boolean) {
  const { id } = job.region;
  const bounds = paperBurnBounds(job.region);
  let seed = paperSeed(id);
  const { u, v } = ignition(job, bounds);
  const threshold = scorchThreshold(u, v, seed, bounds.width / bounds.height);
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  const span = Math.max(32, Math.min(bounds.width, bounds.height));
  const originX = u * bounds.width, originY = v * bounds.height;
  return Array.from({ length: subdued ? 3 : detail === 'full' ? 8 : 4 }, (_, i) => {
    let x = originX, y = originY;
    for (let attempt = 0; attempt < 6; attempt++) {
      const t = random(), angle = (t * 1.8 - .9) * Math.PI, reach = span * (.12 + random() * .45);
      const sampleX = originX + Math.cos(angle) * reach, sampleY = originY + Math.sin(angle) * reach;
      if (!paperContains(job.region, { u: (bounds.x + sampleX) / MAP_WIDTH, v: (bounds.y + sampleY) / MAP_HEIGHT })) continue;
      x = sampleX; y = sampleY; break;
    }
    return {
      x, y,
      delay: fragmentRelease(threshold(x / bounds.width, y / bounds.height)), xDrift: span * (.43 + random() * .62),
      yDrift: span * (.14 + random() * .37), spin: 170 + random() * 820,
      size: Math.max(4, Math.min(24, span * (.012 + random() * .017) * (i % 3 ? 1 : .65))),
    };
  });
}
