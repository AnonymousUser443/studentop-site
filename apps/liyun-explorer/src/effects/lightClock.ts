type TimeConfig = { visible: boolean; moving: boolean; fps: number };
type Raf = { request: (callback: FrameRequestCallback) => number; cancel: (frame: number) => void; now: () => number };

/** Bound the decorative backing buffer at extreme desktop sizes. The canvas
 * continues to draw in CSS coordinates, including all geographic anchors. */
export function lightBackingSize(width: number, height: number, density: number) {
  const maxEdge = 4096, maxPixels = 6_000_000;
  const scale = Math.min(density, maxEdge / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

/** One coalesced draw on invalidation; only visible moving layers keep a RAF alive. */
export function createLightClock(config: (now: number) => TimeConfig, draw: (now: number) => void, raf: Raf) {
  let frame: number | undefined, deadline: number | undefined;
  let dirty = true, disposed = false;
  const request = () => { if (frame === undefined) frame = raf.request(tick); };
  const cancel = () => {
    if (frame !== undefined) raf.cancel(frame);
    frame = deadline = undefined;
  };
  function tick(now: number) {
    frame = undefined;
    const { visible, moving, fps } = config(now);
    if (disposed || !visible) { deadline = undefined; return; }
    if (!moving) {
      if (dirty || deadline !== undefined) { dirty = false; draw(now); }
      deadline = undefined;
      return;
    }
    const period = 1000 / Math.max(1, fps);
    if (deadline === undefined || now >= deadline - 1) {
      const next = (deadline ?? now) + period;
      deadline = next > now ? next : now + period;
      dirty = false;
      draw(now);
    }
    request();
  }
  return {
    invalidate() {
      if (disposed) return;
      dirty = true;
      const { visible } = config(raf.now());
      if (visible) request();
      else cancel();
    },
    dispose() { disposed = true; cancel(); },
  };
}
