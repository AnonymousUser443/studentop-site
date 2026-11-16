import { ignition, paintPaperSource, paperBurnBounds, PAPER_ATLAS_COLUMNS, PAPER_FRAMES } from './burnCanvas';
import type { PaperRegion } from './geometry';
import { paintScorch, paperRasterSize, paperSeed, scorchField } from './scorch';

export type BakeRequest = { regions: PaperRegion[]; texture: string; compact: boolean };

self.addEventListener('message', async (event: MessageEvent<BakeRequest>) => {
  const { regions, texture, compact } = event.data;
  try {
    const response = await fetch(texture);
    if (!response.ok) throw Error('Paper texture unavailable');
    const tile = await createImageBitmap(await response.blob());
    try {
      for (const region of regions) {
        const bounds = paperBurnBounds(region);
        const raster = paperRasterSize(bounds.width, bounds.height, Math.max(3, regions.length), compact ? 'simple' : 'full');
        const { width, height } = raster;
        const context = new OffscreenCanvas(width, height).getContext('2d');
        const canvas = new OffscreenCanvas(width * PAPER_ATLAS_COLUMNS, height * Math.ceil(PAPER_FRAMES * 2 / PAPER_ATLAS_COLUMNS));
        const atlas = canvas.getContext('2d');
        if (!context || !atlas) throw Error('Offscreen rendering unavailable');
        const source = paintPaperSource(context, bounds, raster, new Path2D(region.path), tile, tile.width);
        const origin = ignition({ origin: region.center }, bounds);
        const field = scorchField(width, height, origin.u, origin.v, paperSeed(region.id), bounds.width / bounds.height);
        const frame = atlas.createImageData(width, height);
        for (let i = 0; i < PAPER_FRAMES * 2; i++) {
          paintScorch(source, frame.data, field, i % PAPER_FRAMES / (PAPER_FRAMES - 1), i >= PAPER_FRAMES);
          atlas.putImageData(frame, (i % PAPER_ATLAS_COLUMNS) * width, Math.floor(i / PAPER_ATLAS_COLUMNS) * height);
        }
        const bitmap = canvas.transferToImageBitmap();
        self.postMessage({ id: region.id, bitmap, width, height }, { transfer: [bitmap] });
      }
    } finally { tile.close(); }
  } catch {
    // The main thread keeps a compact fallback for browsers without OffscreenCanvas.
  } finally { self.postMessage({ done: true }); }
});
