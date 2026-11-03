import { describe, expect, it } from 'vitest';
import { LANDMARKS, START_UV } from '../data';
import { displayLandmark, displayPlayerUV } from './displayLandmarks';
import type { ConfirmedCheckInOverride } from '../content/regions';

describe('reviewed display pins keep public save anchors intact', () => {
  it('does not change a default or unreviewed landmark', () => {
    const original = LANDMARKS[0];
    expect(displayLandmark(original, undefined)).toBe(original);
  });
  it('projects a reviewed point without mutating its public source', () => {
    const original = LANDMARKS[0], uv = { ...original.uv };
    const reviewed = { id: 'wencui', centerUv: { u: .54, v: .48 }, radiusM: 32,
      latitude: 39.73, longitude: 116.16, status: 'confirmed', fieldConfirmationRequired: false } as ConfirmedCheckInOverride;
    const shown = displayLandmark(original, reviewed);
    expect(shown.uv).toEqual(reviewed.centerUv);
    expect(shown.checkInRadius).toBe(32);
    expect(original.uv).toEqual(uv);
    expect(displayPlayerUV(uv, [original], [shown])).toEqual(reviewed.centerUv);
    expect(displayPlayerUV(START_UV, [original], [shown])).toEqual(START_UV);
  });
});
