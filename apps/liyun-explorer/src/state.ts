import { LANDMARKS, START_UV } from './data';
import type { ExplorationState, GameSettings } from './types';
export const SAVE_KEY = 'liyun.exploration.v1';
export function createInitialState(reducedMotion = false): ExplorationState {
  return { version: 1, discoveredIds: ['wencui'], unlockedRegionIds: ['wencui'], playerUV: { ...START_UV }, settings: { music: true, volume: 0.35, quality: 'high', reducedMotion, track: 0 } };
}
export function createExploredState(): ExplorationState {
  const state = createInitialState();
  const ids = LANDMARKS.filter(x => x.id !== 'park').map(x => x.id);
  return { ...state, discoveredIds: ids, unlockedRegionIds: ids };
}
export function explore(state: ExplorationState, id: string): ExplorationState {
  const place = LANDMARKS.find(x => x.id === id);
  if (!place || state.discoveredIds.includes(id)) return state;
  return { ...state, playerUV: { ...place.uv }, discoveredIds: [...state.discoveredIds, id], unlockedRegionIds: [...new Set([...state.unlockedRegionIds, place.regionId])] };
}
export function progressOf(state: ExplorationState): number {
  return Math.min(100, LANDMARKS.filter(x => state.discoveredIds.includes(x.id)).reduce((sum, x) => sum + x.progress, 0));
}
export function restoreState(raw: string | null, reducedMotion = false): ExplorationState {
  const initial = createInitialState(reducedMotion);
  if (!raw) return initial;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.discoveredIds)) return initial;
    const known = new Set(LANDMARKS.map(x => x.id));
    const ids = [...new Set<string>(value.discoveredIds.filter((x: unknown) => typeof x === 'string' && known.has(x)))];
    if (!ids.includes('wencui')) ids.unshift('wencui');
    const s = value.settings ?? {};
    const settings: GameSettings = { music: typeof s.music === 'boolean' ? s.music : initial.settings.music, volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : initial.settings.volume, quality: s.quality === 'low' ? 'low' : 'high', reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : reducedMotion, track: Number.isInteger(s.track) && s.track >= 0 && s.track <= 2 ? s.track : 0 };
    const point = value.playerUV;
    const playerUV = point && [point.u, point.v].every((x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) ? { u: point.u, v: point.v } : initial.playerUV;
    return { version: 1, discoveredIds: ids, unlockedRegionIds: LANDMARKS.filter(x => ids.includes(x.id)).map(x => x.regionId), playerUV, settings };
  } catch { return initial; }
}
