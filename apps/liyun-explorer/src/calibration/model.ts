import { campusMap, distanceMeters } from '../location/campus';
import { isRegionId, validateRegionDocument } from '../content/regions';
import type { CheckInPoint, RegionDocument } from '../content/regions';
import type { UV } from '../types';

export const CALIBRATION_STORAGE_KEY = 'liyun.calibration.campus-v04-eaa124716c51375f.v1';
export type Selection = {kind:'boundary'} | {kind:'region';id:string} | {kind:'point';id:string};
export const copyDocument = (document: RegionDocument): RegionDocument => JSON.parse(JSON.stringify(document));
export const selectionKey = (selection: Selection) => selection.kind === 'boundary' ? 'boundary' : `${selection.kind}:${selection.id}`;
export function parseSelection(value: string): Selection {
  const [kind,id] = value.split(':');
  return (kind === 'point' || kind === 'region') && isRegionId(id) ? {kind,id} : {kind:'boundary'};
}
export function selectedPolygon(document: RegionDocument, selection: Selection): UV[] {
  return selection.kind === 'boundary' ? document.gameBoundary.polygon : document.regions.find(region => region.id === selection.id)?.polygon ?? [];
}
export function updatePolygon(document: RegionDocument, selection: Selection, polygon: UV[]) {
  const next = copyDocument(document);
  if (selection.kind === 'boundary') next.gameBoundary.polygon = polygon;
  else { const region = next.regions.find(item => item.id === selection.id); if (region) region.polygon = polygon; }
  return markDraft(next);
}
export function updatePoint(document: RegionDocument, id: string, patch: Partial<CheckInPoint>) {
  const next = copyDocument(document), point = next.checkInPoints.find(item => item.id === id);
  if (point) {
    Object.assign(point,patch);
    if (patch.centerUv && !patch.wgs84) delete point.wgs84;
  }
  return markDraft(next);
}
export function markDraft(document: RegionDocument): RegionDocument {
  return {...document,status:'draft',review:{...document.review,confirmed:false,reviewedAt:null},
    gameBoundary:{...document.gameBoundary,status:'draft'},
    regions:document.regions.map(region => ({...region,status:'draft'})),
    checkInPoints:document.checkInPoints.map(point => ({...point,status:'draft',fieldConfirmationRequired:true}))};
}
export function confirmDocument(document: RegionDocument, confirmed: boolean): RegionDocument {
  if (!confirmed) return markDraft(copyDocument(document));
  return {...document,status:'confirmed',review:{...document.review,confirmed:true,reviewedAt:new Date().toISOString()},
    gameBoundary:{...document.gameBoundary,status:'confirmed'},regions:document.regions.map(region => ({...region,status:'confirmed'})),
    checkInPoints:document.checkInPoints.map(point => ({...point,status:'confirmed',fieldConfirmationRequired:false}))};
}
/** The browser may open geometrically invalid but structurally safe drafts for
 * repair. The CLI still rejects all invalid geometry before applying anything. */
export function readDraft(raw: string): RegionDocument {
  if (raw.length > 1_000_000) throw new Error('草稿超过 1 MB，未导入');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('JSON 格式错误，未导入'); }
  const result = validateRegionDocument(parsed);
  const repairable = new Set(['self-intersection','zero-area','duplicate-vertex','overlapping-edge','outside-boundary','landmark-outside','point-outside','point-region-outside']);
  const fatal = result.errors.filter(error => !repairable.has(error.code));
  if (fatal.length) throw new Error(fatal.slice(0,3).map(error => error.message).join('；'));
  return parsed as RegionDocument;
}
export function pointGeo(point: CheckInPoint) {
  const reference = campusMap.uvToGeo(point.centerUv.u, point.centerUv.v);
  return { ...reference, ...(point.wgs84 ? {latitude:point.wgs84.latitude,longitude:point.wgs84.longitude} : {}) };
}
const EARTH_RADIUS_M = 6378137;
export function geoDestination(latitude: number, longitude: number, radiusM: number, bearing: number) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180, angle = radiusM / EARTH_RADIUS_M, b = bearing * Math.PI / 180;
  const nextLat = Math.asin(Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(b));
  const nextLon = lon + Math.atan2(Math.sin(b) * Math.sin(angle) * Math.cos(lat), Math.cos(angle) - Math.sin(lat) * Math.sin(nextLat));
  return {latitude:nextLat * 180 / Math.PI,longitude:nextLon * 180 / Math.PI};
}
/** A geodesic circle sampled in WGS84 and projected through the existing model.
 * It is an illustrative model projection, never a measured precision boundary. */
export function projectedRange(point: CheckInPoint): UV[] {
  const center = pointGeo(point);
  return Array.from({length:72},(_,index) => {
    const next = geoDestination(center.latitude,center.longitude,point.radiusM,index * 5);
    const uv = campusMap.gpsToMap(next.latitude,next.longitude);
    return {u:uv.u,v:uv.v};
  });
}
export function radiusFromUV(point: CheckInPoint, uv: UV) {
  const destination = campusMap.uvToGeo(uv.u,uv.v);
  return Math.max(5,Math.min(200,Math.round(distanceMeters(pointGeo(point),destination))));
}
export function exportDraft(document: RegionDocument) {
  return {...copyDocument(document), exported_at:new Date().toISOString(), tool_version:'liyun-calibration-v1',
    candidateCoordinates:document.checkInPoints.map(point => ({id:point.id,centerUv:point.centerUv,radiusM:point.radiusM,
      wgs84:pointGeo(point),source:point.wgs84 ? 'manual-field' : 'existing-map-model',
      fieldConfirmationRequired:point.fieldConfirmationRequired})),
    reviewWarning:'边界是游戏内容覆盖建议，不是校园行政边界。模型 WGS84 及投影范围仅供核对；定位采样凸包之外为未验证外推。工具不读取、上传或保存设备实时 GPS。'};
}
