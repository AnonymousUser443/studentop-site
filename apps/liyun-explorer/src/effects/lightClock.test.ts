import { describe, expect, it, vi } from 'vitest';
import { createLightClock, lightBackingSize } from './lightClock';

function harness(fps = 45) {
  const config = { visible: true, moving: true, fps };
  let now = 0, id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const draw = vi.fn();
  const clock = createLightClock(() => config, draw, {
    request: callback => { pending.set(++id, callback); return id; },
    cancel: frame => { pending.delete(frame); },
    now: () => now,
  });
  function frame(time: number) {
    now = time;
    const before = [...pending];
    pending.clear();
    for (const [, callback] of before) callback(now);
  }
  return { config, pending, clock, draw, frame };
}

describe('light canvas clock', () => {
  it('preserves pixel density for ordinary displays and bounds large transparent buffers', () => {
    expect(lightBackingSize(1920, 1080, 1.5)).toEqual({ width: 2880, height: 1620 });
    const ultra = lightBackingSize(3840, 2160, 2);
    expect(ultra.width * ultra.height).toBeLessThanOrEqual(6_000_000);
    expect(ultra.width / ultra.height).toBeCloseTo(3840 / 2160, 3);
    expect(lightBackingSize(4120, 600, 2).width).toBeLessThanOrEqual(4096);
  });

  it('honours configured cadence even when camera invalidates several times per display frame', () => {
    const { clock, pending, draw, frame } = harness();
    for (let i = 0; i < 60; i++) {
      for (let j = 0; j < 4; j++) clock.invalidate();
      expect(pending.size).toBe(1);
      frame(i * 1000 / 60);
    }
    expect(draw).toHaveBeenCalledTimes(45);
    clock.dispose();
    expect(pending.size).toBe(0);
  });

  it('settles a paused or fixed scene once, and never draws while hidden', () => {
    const { config, clock, pending, draw, frame } = harness();
    clock.invalidate();
    frame(16);
    config.visible = false;
    clock.invalidate();
    expect(pending.size).toBe(0);
    frame(2000);
    expect(draw).toHaveBeenCalledTimes(1);
    config.visible = true;
    config.moving = false;
    for (let i = 0; i < 10; i++) clock.invalidate();
    frame(2016);
    expect(pending.size).toBe(0);
    frame(2048);
    expect(draw).toHaveBeenCalledTimes(2);
    clock.dispose();
    clock.invalidate();
    expect(pending.size).toBe(0);
  });
});
