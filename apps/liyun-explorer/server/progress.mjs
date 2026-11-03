import { sanitizeSettings } from '../shared/game-settings.mjs';
import {publishedAnchors} from './published-content.mjs';
// Public map anchors only; keep in sync with src/data.ts (never use live GPS here).
export const START_UV = Object.freeze({ u: 0.502, v: 0.507 });
const uv = (x, y) => ({ u: x / 1000.56, v: y / 1240.28003 });
export const LANDMARK_UVS = Object.freeze({
  wencui: uv(535, 584), beihu: uv(358, 459), library: uv(383.53911, 681.16021),
  teaching: uv(390.2327, 576.30071), wenbo: uv(676.88028, 586.26561),
  sports: uv(704.37769, 680.49071), tower: uv(727, 491), park: uv(615, 285),
});
const REGION_IDS = new Set(['wencui', 'beihu', 'library', 'teaching', 'wenbo', 'sports', 'tower', 'park']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Reconstruct every level; spreading an untrusted state/settings would persist GPS or credentials.
export function sanitizeProgress(raw) {
  if (!isRecord(raw) || ![1, 2, 3].includes(raw.version)) throw new TypeError('state 必须是 version 1、2 或 3 的对象');
  const isReal = raw.version === 2 || raw.version === 3;
  const extra=publishedAnchors(),anchors={...LANDMARK_UVS,...extra};
  const discoveredIds = isReal && Array.isArray(raw.discoveredIds)
    ? [...new Set(raw.discoveredIds.filter(id => typeof id === 'string' && Object.hasOwn(anchors, id)))] : [];
  const point = isRecord(raw.playerUV) ? raw.playerUV : {};
  const allowedPoints = [START_UV, ...discoveredIds.flatMap(id => [LANDMARK_UVS[id],extra[id]].filter(Boolean))];
  const anchor = isReal && allowedPoints.find(p => p.u === point.u && p.v === point.v);
  const s = isRecord(raw.settings) ? raw.settings : {};
  // 旧版或缺字段的 v3 由打卡迁移；v3 明确的空数组不能被重新推导覆盖。
  const unlockedRegionIds = raw.version === 3 && Object.hasOwn(raw, 'unlockedRegionIds')
    ? [...new Set((Array.isArray(raw.unlockedRegionIds) ? raw.unlockedRegionIds : [])
      .filter(id => typeof id === 'string' && (REGION_IDS.has(id)||Object.hasOwn(extra,id))))]
    : [...discoveredIds];
  return {
    version: 3,
    discoveredIds,
    unlockedRegionIds,
    playerUV: { ...(anchor || START_UV) },
    settings: sanitizeSettings(s),
  };
}
