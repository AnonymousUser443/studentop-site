import { describe, it, expect } from 'vitest';
import { createInitialState, createExploredState, explore, progressOf, restoreState } from './state';
import { initialLocationState } from './location/geolocation';
import { locationAt } from '../tests/fixtures/location';

describe('GPS-validated exploration save contract', () => {
  it('starts with every point unvisited and zero progress', () => {
    const state=createInitialState();
    expect(state.discoveredIds).toEqual([]);expect(state.unlockedRegionIds).toEqual([]);expect(progressOf(state)).toBe(0);
    expect(progressOf(createExploredState())).toBe(37); // Explicit isolated QA fixture only.
  });
  it('commits a real arrival once and restores it without auto-unlocking Wencui', () => {
    const location=locationAt('beihu');
    const a=explore(createInitialState(),'beihu',location),b=explore(a,'beihu',location);
    expect(b).toBe(a);expect(a.discoveredIds).toEqual(['beihu']);expect(a.unlockedRegionIds).toEqual(['beihu']);
    expect(restoreState(JSON.stringify(a))).toEqual(a);
  });
  it('cannot mutate discovery with no GPS, a far fix, or the animated player on the target', () => {
    const state=createInitialState();
    expect(explore(state,'beihu',initialLocationState())).toBe(state);
    expect(explore(state,'beihu',locationAt('sports'))).toBe(state);
    const animated={...state,playerUV:{u:358/1000.56,v:459/1240.28003}};
    expect(explore(animated,'beihu',locationAt('sports'))).toBe(animated);
  });
  it('rechecks the actual timestamp at mutation time, even if UI was previously enabled', () => {
    const now=Date.now(),state=createInitialState(),location=locationAt('wencui',0,5,now);
    expect(explore(state,'wencui',location,now+15001)).toBe(state);
    expect(explore(state,'wencui',location,now).discoveredIds).toEqual(['wencui']);
  });
  it('ignores unknown landmarks and restores invalid or future-version saves safely', () => {
    const state=createInitialState();expect(explore(state,'invalid',locationAt('wencui'))).toBe(state);
    expect(restoreState('{')).toEqual(state);expect(restoreState('{"version":3}')).toEqual(state);
  });
  it('migrates all unrestricted v1 demo records to unvisited while preserving settings', () => {
    const old=JSON.stringify({version:1,discoveredIds:['wencui','beihu','tower'],unlockedRegionIds:['wencui'],playerUV:{u:.9,v:.9},settings:{music:false,volume:.15,quality:'low',track:2}});
    const state=restoreState(old);expect(state.version).toBe(2);expect(state.discoveredIds).toEqual([]);
    expect(state.unlockedRegionIds).toEqual([]);expect(state.playerUV).toEqual(createInitialState().playerUV);
    expect(state.settings.music).toBe(false);expect(state.settings.volume).toBe(.15);expect(state.settings.track).toBe(2);
  });
  it('validates v2 ids and settings without reintroducing an automatic starting landmark', () => {
    const state=restoreState(JSON.stringify({version:2,discoveredIds:['tower','tower','bad'],unlockedRegionIds:['bad'],playerUV:{u:99,v:-1},settings:{volume:4,track:-1,quality:'ultra'}}));
    expect(state.discoveredIds).toEqual(['tower']);expect(state.unlockedRegionIds).toEqual(['tower']);
    expect(state.playerUV).toEqual(createInitialState().playerUV);expect(state.settings.volume).toBe(1);expect(state.settings.track).toBe(0);
  });
});
