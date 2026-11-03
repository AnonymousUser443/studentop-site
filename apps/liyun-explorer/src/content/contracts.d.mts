import type { UV } from '../types';
export const CONTENT_MAP_ID: string;
export const REGION_IDS: readonly ['wencui','beihu','library','teaching','wenbo','sports','tower','park'];
export type RegionId = typeof REGION_IDS[number];
export function isRegionId(id: unknown): id is RegionId;
export const REFERENCE_ANCHORS: Readonly<Record<RegionId, UV>>;
export type ContentIssue = {code:string;message:string;target:string;vertex?:number};
export type ValidationResult = {valid:boolean;errors:ContentIssue[];warnings:string[]};
export function validateRegionDocument(document: unknown, options?: {requireConfirmed?:boolean}): ValidationResult;
