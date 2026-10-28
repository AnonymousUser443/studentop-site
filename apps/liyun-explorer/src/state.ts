import { LANDMARKS, START_UV } from './data';
import type { ExplorationState, GameSettings } from './types';
import { checkInEligibility } from './location/checkIn';
import type { LocationState } from './location/geolocation';
export const SAVE_KEY = 'liyun.exploration.v2';
export const LEGACY_SAVE_KEY = 'liyun.exploration.v1';
export function createInitialState(reducedMotion = false): ExplorationState {
  return { version: 2, discoveredIds: [], unlockedRegionIds: [], playerUV: { ...START_UV }, settings: { music: true, volume: 0.35, quality: 'high', reducedMotion, track: 0 } };
}
export function createExploredState(): ExplorationState {
  const state = createInitialState();
  const ids = LANDMARKS.filter(x => x.id !== 'park').map(x => x.id);
  return { ...state, discoveredIds: ids, unlockedRegionIds: ids };
}
export function explore(state: ExplorationState, id: string, location: LocationState, now = Date.now()): ExplorationState {
  const place = LANDMARKS.find(x => x.id === id);
  if (!place || state.discoveredIds.includes(id) || !checkInEligibility(id,location,now).allowed) return state;
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
    if (![1,2].includes(value?.version) || !Array.isArray(value.discoveredIds)) return initial;
    const known = new Set(LANDMARKS.map(x => x.id));
    // Version 1 contains auto-completed Wencui and unrestricted demo clicks.
    // Preserve settings, but don't promote those to GPS-validated check-ins.
    const ids = value.version === 2 ? [...new Set<string>(value.discoveredIds.filter((x: unknown) => typeof x === 'string' && known.has(x)))] : [];
    const s = value.settings ?? {};
    const settings: GameSettings = { music: typeof s.music === 'boolean' ? s.music : initial.settings.music, volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : initial.settings.volume, quality: s.quality === 'low' ? 'low' : 'high', reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : reducedMotion, track: Number.isInteger(s.track) && s.track >= 0 && s.track <= 2 ? s.track : 0 };
    const point = value.playerUV;
    const playerUV = value.version === 2 && point && [point.u, point.v].every((x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) ? { u: point.u, v: point.v } : initial.playerUV;
    return { version: 2, discoveredIds: ids, unlockedRegionIds: LANDMARKS.filter(x => ids.includes(x.id)).map(x => x.regionId), playerUV, settings };
  } catch { return initial; }
}
