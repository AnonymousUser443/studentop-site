import { REGIONS } from '../../content/regions';
import { paperRegion } from './geometry';
import { type PaperAtlas } from './burnCanvas';
import { PAPER_TEXTURE } from './scorch';
import type { BakeRequest } from './arrivalBake.worker';

// Prepare the public geometry regardless of which account signs in afterward.
export const paperSections = REGIONS.map(paperRegion).filter(region => region.path);
const prepared = new Map<string, PaperAtlas>();
let pending: Promise<void> | undefined;

export function getArrivalAtlas(id: string) { return prepared.get(id); }

export function prepareArrivalPaper() {
  if (pending) return pending;
  pending = new Promise<void>(resolve => {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' ||
      typeof createImageBitmap === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) { resolve(); return; }
    let worker: Worker;
    try { worker = new Worker(new URL('./arrivalBake.worker.ts', import.meta.url), { type: 'module' }); }
    catch { resolve(); return; }
    function finish() { clearTimeout(budget); worker.terminate(); resolve(); }
    const budget = setTimeout(finish, 2200);
    worker.onerror = finish;
    worker.onmessage = ({ data }: MessageEvent<({ id: string } & PaperAtlas) | { done: true }>) => {
      if ('done' in data) finish();
      else prepared.set(data.id, data);
    };
    const request: BakeRequest = {
      regions: paperSections,
      texture: new URL(PAPER_TEXTURE, location.href).href,
      compact: matchMedia('(pointer: coarse)').matches,
    };
    worker.postMessage(request);
  });
  return pending;
}
