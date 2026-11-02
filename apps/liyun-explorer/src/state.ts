import { LANDMARKS, START_UV } from './data';
import type { ExplorationState, GameSettings } from './types';
import { checkInEligibility } from './location/checkIn';
import type { LocationState } from './location/geolocation';
import { sanitizeSettings } from './app/stores/useSettings';

/**
 * 存档键：v3 沿用 v2 键名（结构兼容升级，不新开键，避免双份数据）。
 * 旧 v1 键保留只读，不迁移打卡记录。
 */
export const SAVE_KEY = 'liyun.exploration.v2';
export const LEGACY_SAVE_KEY = 'liyun.exploration.v1';

export function createInitialState(reducedMotion = false): ExplorationState {
  return {
    version: 3,
    discoveredIds: [],
    unlockedRegionIds: [],
    playerUV: { ...START_UV },
    settings: sanitizeSettings({ reducedMotion }),
  };
}

export function createExploredState(): ExplorationState {
  const state = createInitialState();
  const ids = LANDMARKS.filter(x => x.id !== 'park').map(x => x.id);
  return { ...state, discoveredIds: ids, unlockedRegionIds: [...new Set(LANDMARKS.filter(x => ids.includes(x.id)).map(x => x.regionId))] };
}

export function explore(state: ExplorationState, id: string, location: LocationState, now = Date.now()): ExplorationState {
  const place = LANDMARKS.find(x => x.id === id);
  if (!place || state.discoveredIds.includes(id) || !checkInEligibility(id, location, now).allowed) return state;
  return {
    ...state,
    playerUV: { ...place.uv },
    discoveredIds: [...state.discoveredIds, id],
    unlockedRegionIds: [...new Set([...state.unlockedRegionIds, place.regionId])],
  };
}

export function progressOf(state: ExplorationState): number {
  return Math.min(100, LANDMARKS.filter(x => state.discoveredIds.includes(x.id)).reduce((sum, x) => sum + x.progress, 0));
}

/** 兼容 v1 / v2 / v3 三档解析；v1 不迁移打卡，只保留可迁移的设置项。 */
export function restoreState(raw: string | null, reducedMotion = false): ExplorationState {
  const initial = createInitialState(reducedMotion);
  if (!raw) return initial;
  try {
    const value = JSON.parse(raw);
    if (![1, 2, 3].includes(value?.version) || !Array.isArray(value.discoveredIds)) return initial;

    const known = new Set(LANDMARKS.map(x => x.id));
    // v1: contains auto-completed Wencui and unrestricted demo clicks → never promote to check-ins.
    const isReal = value.version === 2 || value.version === 3;
    const ids = isReal
      ? [...new Set<string>(value.discoveredIds.filter((x: unknown): x is string => typeof x === 'string' && known.has(x)))]
      : [];

    const s = value.settings ?? {};
    // v3 走统一 sanitize；v1/v2 也一并过这一关，保证新字段有默认值
    const settings: GameSettings = sanitizeSettings({
      music: typeof s.music === 'boolean' ? s.music : initial.settings.music,
      volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : initial.settings.volume,
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : reducedMotion,
      track: Number.isInteger(s.track) && s.track >= 0 && s.track <= 2 ? s.track : 0,
      // v2 只有 quality('low'|'high')，迁移为 qualityPreset
      qualityPreset: s.qualityPreset ?? (s.quality === 'low' ? 'low' : 'high'),
      qualityOverrides: s.qualityOverrides,
      autoDegrade: s.autoDegrade,
      degradedFrom: s.degradedFrom,
      uiSound: s.uiSound,
      reduceFlash: s.reduceFlash,
      hudScale: s.hudScale,
    });

    const point = value.playerUV;
    const playerUV = isReal
      && point
      && [point.u, point.v].every((x: unknown) => typeof x === 'number' && Number.isFinite(x) && (x as number) >= 0 && (x as number) <= 1)
      ? { u: point.u as number, v: point.v as number }
      : initial.playerUV;

    return {
      version: 3,
      discoveredIds: ids,
      unlockedRegionIds: [...new Set(LANDMARKS.filter(x => ids.includes(x.id)).map(x => x.regionId))],
      playerUV,
      settings,
    };
  } catch {
    return initial;
  }
}
