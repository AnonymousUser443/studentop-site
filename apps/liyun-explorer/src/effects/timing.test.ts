import { describe, expect, it } from 'vitest';
import { eventTiming, seededRandom } from './timing';
import type { SceneEvent } from '../types';

const event: SceneEvent = { id: 1, type: 'discover', landmarkId: 'tower', from: { u: 0.5, v: 0.5 }, to: { u: 0.7, v: 0.4 }, startedAt: 1000, duration: 2800 };
describe('discovery timeline', () => {
  it('keeps a newly committed target covered until the arrival phase', () => {
    expect(eventTiming(event, 1000).reveal).toBe(0);
    expect(eventTiming(event, 1800).reveal).toBe(0);
    expect(eventTiming(event, 2900).reveal).toBeGreaterThan(0.5);
  });
  it('reaches a stable final state regardless of skipped frames', () => {
    expect(eventTiming(event, 5000)).toMatchObject({ progress: 1, travel: 1, reveal: 1, burst: 1, active: false });
    expect(eventTiming(event, 900)).toMatchObject({ progress: 0, reveal: 0, active: false });
  });
  it('replays the exact same cloud composition for a given seed', () => {
    const a = seededRandom(1386), b = seededRandom(1386), c = seededRandom(1387);
    const sequence = (next: () => number) => Array.from({ length: 20 }, next);
    expect(sequence(a)).toEqual(sequence(b));
    expect(sequence(seededRandom(1386))).not.toEqual(sequence(c));
  });
});
