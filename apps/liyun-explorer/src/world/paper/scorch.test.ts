import { describe, expect, it } from 'vitest';
import { paperContains, paperRegion } from './geometry';
import { paintScorch, paperRasterSize, paperSeed, scorchField, scorchThreshold } from './scorch';
import type { Region } from '../../content/regions';

describe('lightweight map paper', () => {
  it('erodes a noisy hole around the ignition point and leaves no occluding pixels', () => {
    const side = 108;
    const seed = paperSeed('wencui');
    const field = scorchField(side, side, .32, .52, seed);
    expect(scorchField(side, side, .32, .52, seed)).toEqual(field);
    const source = Uint8ClampedArray.from({ length: field.length * 4 }, (_, i) => [239, 228, 198, 255][i % 4]);
    const output = new Uint8ClampedArray(source.length);
    const alpha = (x: number, y: number) => output[(y * side + x) * 4 + 3];
    paintScorch(source, output, field, 0, false);
    expect(alpha(34, 56)).toBe(255);
    paintScorch(source, output, field, .38, false);
    expect(alpha(34, 56)).toBe(0);
    expect(alpha(100, 105)).toBe(255);
    expect([...output.filter((_, i) => i % 4 === 3)].some(a => a > 0 && a < 255)).toBe(true);
    paintScorch(source, output, field, 1, true);
    expect(output.every((a, i) => i % 4 !== 3 || a === 0)).toBe(true);
  });

  it('bounds the frame cost with larger maps or many simultaneous arrivals', () => {
    for (const [detail, budget] of [['simple', 27_000], ['full', 76_000]] as const) {
      for (const simultaneous of [1, 6, 25]) {
        const { width, height } = paperRasterSize(4000, 4958, simultaneous, detail);
        expect(width * height * simultaneous).toBeLessThanOrEqual(budget);
        expect(width / height).toBeCloseTo(4000 / 4958, 1);
      }
    }
  });

  it('keeps the raster burn front aligned with released fragments at the actual ignition point', () => {
    const seed = paperSeed('beihu');
    const width = 236, height = 103, ratio = 2.205, u = .73, v = .27;
    const field = scorchField(width, height, u, v, seed, ratio);
    const release = scorchThreshold(u, v, seed, ratio);
    const expected = Float32Array.from({ length: field.length }, (_, index) =>
      release((index % width + .5) / width, (Math.floor(index / width) + .5) / height));
    expect(field).toEqual(expected);
  });

  it('places ignition on a region and preserves holes and detached pieces', () => {
    const ring = (x: number, y: number, side: number) => [
      { u: x, v: y }, { u: x + side, v: y }, { u: x + side, v: y + side }, { u: x, v: y + side },
    ];
    const region = paperRegion({
      id: 'fixture', revealOrder: 0, polygon: ring(.1, .1, .5),
      geometry: [[ring(.1, .1, .5), ring(.21, .21, .36)], [ring(.8, .8, .09)]],
    } as Region);
    expect(paperContains(region, region.center)).toBe(true);
    expect(paperContains(region, { u: .35, v: .35 })).toBe(false);
    expect(paperContains(region, { u: .85, v: .85 })).toBe(true);
    expect(paperContains(region, { u: .72, v: .72 })).toBe(false);
    expect(region.path.match(/ Z/g)).toHaveLength(3);
  });
});
