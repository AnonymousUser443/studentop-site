import type { SceneEvent } from '../types';

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smoothstep = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };

/** A pure clock makes screenshots reproducible and keeps reveal independent of frame rate. */
export function eventTiming(event: SceneEvent | null, now: number) {
  if (!event) return { progress: 1, travel: 1, reveal: 1, burst: 1, active: false };
  const progress = clamp01((now - event.startedAt) / Math.max(1, event.duration));
  return {
    progress,
    travel: smoothstep(progress / 0.43),
    reveal: smoothstep((progress - 0.39) / 0.51),
    burst: clamp01((progress - 0.43) / 0.57),
    active: now >= event.startedAt && progress < 1,
  };
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
