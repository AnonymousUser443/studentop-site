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
    expect(restoreState('{')).toEqual(state);expect(restoreState('{"version":4}')).toEqual(state);
  });
  it('migrates all unrestricted v1 demo records to unvisited while preserving settings', () => {
    const old=JSON.stringify({version:1,discoveredIds:['wencui','beihu','tower'],unlockedRegionIds:['wencui'],playerUV:{u:.9,v:.9},settings:{music:false,volume:.15,quality:'low',track:2}});
    const state=restoreState(old);expect(state.version).toBe(3);expect(state.discoveredIds).toEqual([]);
    expect(state.unlockedRegionIds).toEqual([]);expect(state.playerUV).toEqual(createInitialState().playerUV);
    expect(state.settings.music).toBe(false);expect(state.settings.volume).toBe(.15);expect(state.settings.track).toBe(2);
  });
  it('validates v2 ids and settings without reintroducing an automatic starting landmark', () => {
    const state=restoreState(JSON.stringify({version:2,discoveredIds:['tower','tower','bad'],unlockedRegionIds:['bad'],playerUV:{u:99,v:-1},settings:{volume:4,track:-1,quality:'ultra'}}));
    expect(state.discoveredIds).toEqual(['tower']);expect(state.unlockedRegionIds).toEqual(['tower']);
    expect(state.playerUV).toEqual(createInitialState().playerUV);expect(state.settings.volume).toBe(1);expect(state.settings.track).toBe(0);
  });

  // ---- v3: 画质预设 / 自动降级 / UI 偏好 ----
  it('migrates v2 quality flag into a v3 preset and fills every new field with defaults', () => {
    const state=restoreState(JSON.stringify({version:2,discoveredIds:['beihu'],playerUV:{u:358/1000.56,v:459/1240.28003},settings:{quality:'low',music:true}}));
    expect(state.version).toBe(3);
    expect(state.settings.qualityPreset).toBe('low');
    expect(state.settings.quality).toBe('low');
    expect(state.settings.autoDegrade).toBe(true);
    expect(state.settings.degradedFrom).toBe(null);
    expect(state.settings.uiSound).toBe(true);
    expect(state.settings.reduceFlash).toBe(false);
    expect(state.settings.hudScale).toBe(1);
    expect(state.settings.qualityOverrides).toEqual({});
  });
  it('round-trips a v3 save without losing preset, overrides or the degrade source', () => {
    const base=createInitialState();
    const saved={...base,discoveredIds:['beihu'],settings:{...base.settings,qualityPreset:'ultra' as const,qualityOverrides:{leafCount:8},autoDegrade:false,degradedFrom:'high' as const,uiSound:false,hudScale:1.12 as const}};
    const restored=restoreState(JSON.stringify(saved));
    expect(restored.settings.qualityPreset).toBe('ultra');
    expect(restored.settings.qualityOverrides).toEqual({leafCount:8});
    expect(restored.settings.autoDegrade).toBe(false);
    expect(restored.settings.degradedFrom).toBe('high');
    expect(restored.settings.uiSound).toBe(false);
    expect(restored.settings.hudScale).toBe(1.12);
  });
  it('rejects out-of-range v3 override values instead of trusting the save file', () => {
    const state=restoreState(JSON.stringify({version:3,discoveredIds:[],playerUV:{u:.5,v:.5},settings:{qualityOverrides:{leafCount:9999,fogFps:-5,inkLayers:9,backdropBlur:500,inkRevealFidelity:'bogus',dropShadows:'nope',cssAmbient:'not-a-bool'}}}));
    expect(state.settings.qualityOverrides.leafCount).toBe(40);
    expect(state.settings.qualityOverrides.fogFps).toBe(10);
    expect(state.settings.qualityOverrides.inkLayers).toBe(2);
    expect(state.settings.qualityOverrides.backdropBlur).toBe(24);
    expect(state.settings.qualityOverrides.inkRevealFidelity).toBeUndefined();
    expect(state.settings.qualityOverrides.dropShadows).toBeUndefined();
    expect(state.settings.qualityOverrides.cssAmbient).toBeUndefined();
  });

  it('preserves independent region unlocks without changing check-ins or accepting unknown IDs', () => {
    const raw = { ...createInitialState(), discoveredIds: ['tower'], unlockedRegionIds: ['beihu', 'beihu', 'park', 'unknown', 2] };
    const saved = restoreState(JSON.stringify(raw));
    expect(saved.discoveredIds).toEqual(['tower']);
    expect(saved.unlockedRegionIds).toEqual(['beihu', 'park']);
    expect(restoreState(JSON.stringify(saved))).toEqual(saved);
    expect(restoreState(JSON.stringify({ ...raw, unlockedRegionIds: [] })).unlockedRegionIds).toEqual([]);
  });

  it('migrates v3 saves with no region field but keeps explicit empty progress independent', () => {
    const old = { version: 3, discoveredIds: ['tower'], settings: {} };
    expect(restoreState(JSON.stringify(old)).unlockedRegionIds).toEqual(['tower']);
    expect(restoreState(JSON.stringify({ ...old, unlockedRegionIds: [] })).unlockedRegionIds).toEqual([]);
    expect(restoreState(JSON.stringify({ ...old, unlockedRegionIds: null })).unlockedRegionIds).toEqual([]);
  });

  it('preserves new controls and messages while stripping arbitrary local coordinates and nested GPS', () => {
    const settings = { ...createInitialState().settings, dragSensitivity: 1.7, zoomLimit: 3.4, doubleZoom: 1.8, messageDuration: 5, showCinematic: false, redDot: false };
    const saved = restoreState(JSON.stringify({ version: 3, discoveredIds: [], unlockedRegionIds: [], playerUV: { u: .13, v: .72, rawGPS: 'private-marker' }, rawGPS: 'private-marker', settings: { ...settings, rawGPS: 'private-marker' } }));
    expect(saved.settings).toEqual(settings);
    expect(saved.playerUV).toEqual(createInitialState().playerUV);
    expect(JSON.stringify(saved)).not.toContain('private-marker');
  });
});
