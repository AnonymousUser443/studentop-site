import { describe, expect, it } from 'vitest';
import { commitDiscovery } from './discovery';
import { createInitialState } from '../state';
import { initialLocationState } from '../location/geolocation';
import { locationAt } from '../../tests/fixtures/location';

describe('validated discovery and independent region progression', () => {
  it('keeps independent region unlocks when a validated new check-in commits its content unlock', () => {
    const before = { ...createInitialState(), unlockedRegionIds: ['park'] };
    const next = commitDiscovery(before, 'beihu', locationAt('beihu'));
    expect(next.discoveredIds).toEqual(['beihu']);
    expect(next.unlockedRegionIds).toEqual(['park', 'beihu']);
    expect(before.discoveredIds).toEqual([]);
  });

  it('cannot turn a content reveal into a new production check-in without current GPS', () => {
    const before = createInitialState();
    expect(commitDiscovery(before, 'beihu', initialLocationState())).toBe(before);
    expect(commitDiscovery(before, 'beihu', locationAt('sports'))).toBe(before);
    expect(commitDiscovery(before, 'unknown', locationAt('beihu'))).toBe(before);
  });

  it('cannot backfill independent unlocks through duplicate discoveries', () => {
    const before = { ...createInitialState(), discoveredIds: ['beihu'], unlockedRegionIds: [] };
    expect(commitDiscovery(before, 'beihu', locationAt('beihu'))).toBe(before);
    expect(before.unlockedRegionIds).toEqual([]);
  });
});
