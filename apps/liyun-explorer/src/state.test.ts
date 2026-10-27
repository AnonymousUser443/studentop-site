import { describe, it, expect } from 'vitest';
import { createInitialState, createExploredState, explore, progressOf, restoreState } from './state';
describe('exploration save contract', () => {
  it('starts at 3% and a reproducible explored fixture reaches 37%', () => { expect(progressOf(createInitialState())).toBe(3); expect(progressOf(createExploredState())).toBe(37); });
  it('commits discovery once even if the visual sequence is interrupted or clicked twice', () => { const a = explore(createInitialState(), 'tower'); const b = explore(a, 'tower'); expect(b).toBe(a); expect(a.discoveredIds).toEqual(['wencui', 'tower']); expect(restoreState(JSON.stringify(a))).toEqual(a); });
  it('ignores unknown landmarks', () => { const a = createInitialState(); expect(explore(a, 'invalid')).toBe(a); });
  it('recovers malformed and future-version saves', () => { expect(restoreState('{')).toEqual(createInitialState()); expect(restoreState('{"version":2}')).toEqual(createInitialState()); });
  it('validates ids, coordinates and settings without trusting stored derived state', () => { const a = restoreState(JSON.stringify({ version:1, discoveredIds:['tower','tower','bad'], unlockedRegionIds:['bad'], playerUV:{u:99,v:-1}, settings:{volume:4,track:-1,quality:'ultra'} })); expect(a.discoveredIds).toEqual(['wencui','tower']); expect(a.unlockedRegionIds).toEqual(['wencui','tower']); expect(a.playerUV).toEqual(createInitialState().playerUV); expect(a.settings.volume).toBe(1); expect(a.settings.track).toBe(0); });
});
