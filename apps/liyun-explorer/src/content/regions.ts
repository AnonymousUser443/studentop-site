import source from './regions.json';
import overrides from './checkin-overrides.json';
import { CONTENT_MAP_ID, REGION_IDS as ORIGINAL_REGION_IDS, validateRegionDocument } from './contracts.mjs';
import {PUBLICATION,KNOWN_ANCHORS,publishedOverride} from './catalog';
import {photoURL} from '../../shared/published.mjs';
import type { UV } from '../types';
import { isUV } from './geometry.mjs';

export type RegionId=string;
export const REGION_IDS:readonly string[]=PUBLICATION?Object.keys(KNOWN_ANCHORS):ORIGINAL_REGION_IDS;
export const isRegionId=(id:unknown):id is RegionId=>typeof id==='string'&&REGION_IDS.includes(id);
export {validateRegionDocument};
export type ContentStatus = 'recommended' | 'draft' | 'confirmed';
export type Region = {
  id: RegionId; name: string; subtitle: string; map_id: string; status: ContentStatus;
  polygon: UV[]; geometry?:UV[][][]; maskImage?: string | null;
  unlock: { type: 'landmark'; landmarkId: RegionId }; revealOrder: number;
  story: { chapter: string; title: string; body: string; verse: string };
  art: { hero: string; alt: string; palette: string[] }; notes?: string;
};
export type CheckInPoint = {
  id: RegionId; regionId: RegionId; name: string; status: ContentStatus; centerUv: UV;
  radiusM: number; physical: boolean; source: string; fieldConfirmationRequired: boolean; notes?: string;
  wgs84?: { latitude: number; longitude: number; source: 'manual-field' };
};
export type RegionDocument = {
  schema_version: 1; map_id: string; coordinate_system: 'image-normalized-uv'; status: ContentStatus;
  review: { confirmed: boolean; reviewer: string; reviewedAt: string | null; notes: string };
  gameBoundary: { id: 'campus-game'; name: string; status: ContentStatus; polygon: UV[]; notes?: string };
  regions: Region[]; checkInPoints: CheckInPoint[];
};

const validation = validateRegionDocument(source);
if (!validation.valid || source.map_id !== CONTENT_MAP_ID) throw new Error(`分区内容无效：${validation.errors.map(error => error.message).join('；')}`);
export const REGION_DOCUMENT = source as RegionDocument;
export const REGIONS: readonly Region[] = PUBLICATION?PUBLICATION.document.sites.map((site,index)=>({id:site.id,name:site.name,subtitle:site.subtitle,map_id:CONTENT_MAP_ID,status:'confirmed',polygon:site.geometry[0][0],geometry:site.geometry,maskImage:null,unlock:{type:'landmark',landmarkId:site.id},revealOrder:index,story:{chapter:`第${index+1}章`,title:site.name,body:site.intro,verse:site.verse},art:{hero:site.photos[0]?photoURL(site.photos[0].id):'',alt:site.photos[0]?.alt??site.name,palette:['#21493e','#f3e8c8','#d4b874']}})):REGION_DOCUMENT.regions;
export const GAME_BOUNDARY = PUBLICATION?{...REGION_DOCUMENT.gameBoundary,name:PUBLICATION.document.boundary.name,polygon:PUBLICATION.document.boundary.geometry[0][0],geometry:PUBLICATION.document.boundary.geometry}:REGION_DOCUMENT.gameBoundary;
export const getRegion = (id: string): Region | undefined => REGIONS.find(region => region.id === id);
export const regionsForLandmark = (id: string): Region[] => REGIONS.filter(region => region.unlock.landmarkId === id);
export const cleanRegionIds = (ids: unknown): RegionId[] => Array.isArray(ids) ? [...new Set(ids.filter(isRegionId))] : [];
export const createRecommendedDraft = (): RegionDocument => JSON.parse(JSON.stringify(REGION_DOCUMENT)) as RegionDocument;

export type ConfirmedCheckInOverride = { id: RegionId; centerUv: UV; radiusM: number; latitude: number; longitude: number; status: 'confirmed'; fieldConfirmationRequired: false };
/** Explicitly applied, reviewed config only. Visual marker anchors stay in data.ts. */
export function getConfirmedCheckInOverride(id: string): ConfirmedCheckInOverride | undefined {
  if(PUBLICATION)return publishedOverride(id);
  if (overrides.schema_version !== 1 || !overrides.enabled || overrides.map_id !== CONTENT_MAP_ID || overrides.review.confirmed !== true || !overrides.review.reviewer.trim() || typeof overrides.review.reviewedAt !== 'string' || !Number.isFinite(Date.parse(overrides.review.reviewedAt))) return undefined;
  const point = (overrides.points as ConfirmedCheckInOverride[]).find(item => item.id === id);
  if (!point || !isRegionId(point.id) || point.status !== 'confirmed' || point.fieldConfirmationRequired !== false || !isUV(point.centerUv) || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 85 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 || !Number.isFinite(point.radiusM) || point.radiusM < 5 || point.radiusM > 200) return undefined;
  return point;
}
