import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANDMARKS } from '../data';
import { initialLocationState } from './geolocation';
import { checkInEligibility } from './checkIn';
import { locationAt } from '../../tests/fixtures/location';

afterEach(() => vi.restoreAllMocks());

describe('check-in range and location quality', () => {
  it.each(LANDMARKS.map(place=>[place.id,place.checkInRadius] as const))('%s requires arrival inside its %s metre radius', (id,radius) => {
    expect(checkInEligibility(id,locationAt(id,radius-.01)).allowed).toBe(true);
    const far=checkInEligibility(id,locationAt(id,radius+.01));expect(far.allowed).toBe(false);expect(far.reason).toBe('out-of-range');
  });
  it('rejects missing, denied, failed and paused positioning', () => {
    expect(checkInEligibility('wencui',initialLocationState()).allowed).toBe(false);
    for(const status of ['denied','error','paused','stopped'] as const) {
      const location=locationAt('wencui');expect(checkInEligibility('wencui',{...location,status,running:false}).allowed).toBe(false);
    }
  });
  it('requires a fresh callback receipt and does not trust a cached tracking flag', () => {
    const now=20_000,location=locationAt('wencui',0,5,now);
    expect(checkInEligibility('wencui',location,now+15000).allowed).toBe(true);
    expect(checkInEligibility('wencui',location,now+15001).reason).toBe('stale');
    expect(checkInEligibility('wencui',location,now-1).reason).toBe('stale');
    expect(checkInEligibility('wencui',{...location,status:'stale'},now).allowed).toBe(false);
  });
  it.each([10_000,40_000,NaN,Infinity,Date.UTC(2100,0,1)])('checks actual arrival even with device timestamp %s', timestamp => {
    const now=20_000,location=locationAt('wencui',0,5,now,timestamp);
    expect(checkInEligibility('wencui',location,now).allowed).toBe(true);
    expect(checkInEligibility('wencui',location,now+15001).reason).toBe('stale');
  });
  it('does not let a wall-clock adjustment invalidate a recent callback', () => {
    const location=locationAt('wencui');
    vi.spyOn(Date,'now').mockReturnValue(Date.UTC(2100,0,1));
    expect(checkInEligibility('wencui',location).allowed).toBe(true);
  });
  it('requires reliable device accuracy even when the computed distance is zero', () => {
    expect(checkInEligibility('wencui',locationAt('wencui',0,50)).allowed).toBe(true);
    expect(checkInEligibility('wencui',locationAt('wencui',0,50.1)).reason).toBe('poor-accuracy');
    const location=locationAt('wencui');
    for(const accuracy of [0,-1,NaN,Infinity]) expect(checkInEligibility('wencui',{...location,reading:{...location.reading!,accuracy}}).allowed).toBe(false);
  });
  it('does not use GPS uncertainty as extra allowed distance', () => {
    const result=checkInEligibility('wencui',locationAt('wencui',60,50));
    expect(result.allowed).toBe(false);expect(result.reason).toBe('out-of-range');expect(result.distance).toBeGreaterThan(59);
  });
  it('rejects outside-map and invalid fixes instead of snapping them onto a point', () => {
    const location=locationAt('wencui');
    expect(checkInEligibility('wencui',{...location,reading:{...location.reading!,insideImage:false}}).reason).toBe('outside-map');
    expect(checkInEligibility('wencui',{...location,reading:{...location.reading!,latitude:NaN}}).allowed).toBe(false);
    expect(checkInEligibility('invalid',location).allowed).toBe(false);
  });
});
