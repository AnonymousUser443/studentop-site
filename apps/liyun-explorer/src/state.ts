import { START_UV } from './data';
import {LANDMARKS,KNOWN_ANCHORS,PUBLICATION} from './content/catalog';
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

export function explore(state: ExplorationState, id: string, location: LocationState, now = performance.now()): ExplorationState {
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
  if(PUBLICATION&&LANDMARKS.every(place=>state.discoveredIds.includes(place.id)))return 100;
  return Math.min(100, LANDMARKS.filter(x => state.discoveredIds.includes(x.id)).reduce((sum, x) => sum + x.progress, 0));
}

/** 兼容 v1 / v2 / v3 三档解析；v1 不迁移打卡，只保留可迁移的设置项。 */
export function restoreState(raw: string | null, reducedMotion = false): ExplorationState {
  const initial = createInitialState(reducedMotion);
  if (!raw) return initial;
  try {
    const value = JSON.parse(raw);
    if (![1, 2, 3].includes(value?.version) || !Array.isArray(value.discoveredIds)) return initial;

    const known = new Set(Object.keys(KNOWN_ANCHORS));
    // v1: contains auto-completed Wencui and unrestricted demo clicks → never promote to check-ins.
    const isReal = value.version === 2 || value.version === 3;
    const ids = isReal
      ? [...new Set<string>(value.discoveredIds.filter((x: unknown): x is string => typeof x === 'string' && known.has(x)))]
      : [];

    const s = value.settings !== null && typeof value.settings === 'object' && !Array.isArray(value.settings) ? value.settings : {};
    // 每条迁移链都使用共享白名单，新增设置只需在 shared/game-settings 中声明一次。
    const settings: GameSettings = sanitizeSettings({ ...s, reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : reducedMotion });

    const point = value.playerUV;
    // 与云端一致，只恢复虚拟角色的公共锚点；任意位置或 GPS 派生 UV 不进入有效存档。
    const anchor = isReal && point
      ? [START_UV, ...ids.map(id=>KNOWN_ANCHORS[id]).filter(Boolean)].find(x => x.u === point.u && x.v === point.v)
      : undefined;
    const knownRegions = new Set(Object.keys(KNOWN_ANCHORS));
    const unlockedRegionIds = value.version === 3 && Object.hasOwn(value, 'unlockedRegionIds')
      ? [...new Set<string>((Array.isArray(value.unlockedRegionIds) ? value.unlockedRegionIds : [])
        .filter((x: unknown): x is string => typeof x === 'string' && knownRegions.has(x)))]
      : [...new Set(LANDMARKS.filter(x => ids.includes(x.id)).map(x => x.regionId))];

    return {
      version: 3,
      discoveredIds: ids,
      unlockedRegionIds,
      playerUV: { ...(anchor ?? START_UV) },
      settings,
    };
  } catch {
    return initial;
  }
}
