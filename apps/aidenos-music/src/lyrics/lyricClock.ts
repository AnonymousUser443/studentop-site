import type { MusicRuntime } from "../domain";

export interface FrameScheduler {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}
const browserScheduler: FrameScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

/** A visual clock only. It never creates audio, seeks it, or changes its playing state. */
export function connectLyricClock(
  runtime: Pick<MusicRuntime, "getSnapshot" | "subscribe">,
  output: { set(seconds: number): void },
  offsetMs: number,
  scheduler: FrameScheduler = browserScheduler,
): () => void {
  let anchor = runtime.getSnapshot(), sampledAt = scheduler.now();
  let frame: number | null = null, disposed = false;
  const offset = Number.isFinite(offsetMs) ? offsetMs : 0;
  const write = (elapsed = 0) => {
    const duration = anchor.durationMs > 0 ? anchor.durationMs : Infinity;
    const position = Math.min(duration, Math.max(0, anchor.positionMs + elapsed));
    output.set((position - offset) / 1000);
  };
  const tick = (time: number) => {
    frame = null;
    if (disposed || anchor.status !== "playing") return;
    // A missing media-time anchor must not turn a stalled stream into invented progress.
    write(Math.min(450, Math.max(0, time - sampledAt)));
    frame = scheduler.request(tick);
  };
  const sync = () => {
    if (disposed) return;
    const next = runtime.getSnapshot();
    if (next.positionMs !== anchor.positionMs || next.status !== anchor.status || next.durationMs !== anchor.durationMs) {
      anchor = next;
      sampledAt = scheduler.now();
      write();
    }
    if (anchor.status === "playing" && frame === null) frame = scheduler.request(tick);
    else if (anchor.status !== "playing" && frame !== null) { scheduler.cancel(frame); frame = null; }
  };
  const unsubscribe = runtime.subscribe(sync);
  write(); sync();
  return () => {
    disposed = true;
    unsubscribe();
    if (frame !== null) scheduler.cancel(frame);
    frame = null;
  };
}
