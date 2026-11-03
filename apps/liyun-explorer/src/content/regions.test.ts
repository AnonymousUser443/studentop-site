import { describe, expect, it } from 'vitest';
import { LANDMARKS, MAP_ID } from '../data';
import { campusMap } from '../location/campus';
import { pointInPolygon } from './geometry.mjs';
import { REGION_DOCUMENT, REGION_IDS, REGIONS, GAME_BOUNDARY, cleanRegionIds, createRecommendedDraft, getConfirmedCheckInOverride, getRegion, regionsForLandmark, validateRegionDocument } from './regions';

describe('recommended content contract',()=>{
  it('binds a separately defined game envelope to all eight unchanged landmark anchors',()=>{
    expect(REGION_DOCUMENT.map_id).toBe(MAP_ID);
    expect(validateRegionDocument(REGION_DOCUMENT).valid).toBe(true);
    expect(REGION_DOCUMENT.status).toBe('recommended');
    expect(REGION_DOCUMENT.review.confirmed).toBe(false);
    for(const place of LANDMARKS){
      expect(pointInPolygon(place.uv,GAME_BOUNDARY.polygon)).toBe(true);
      expect(pointInPolygon(place.uv,getRegion(place.regionId)!.polygon)).toBe(true);
      const point=REGION_DOCUMENT.checkInPoints.find(item=>item.id===place.id)!;
      expect(point.centerUv).toEqual(place.uv);
      expect(point.radiusM).toBe(place.checkInRadius);
    }
    const support=LANDMARKS.filter(place=>campusMap.uvToGeo(place.uv.u,place.uv.v).support.mode==='calibrated');
    expect(support.map(place=>place.id).sort()).toEqual(['beihu','teaching']);
  });
  it('provides safe unknown-ID behavior and independently sanitizes region progress',()=>{
    expect(getRegion('unknown')).toBeUndefined();
    expect(regionsForLandmark('unknown')).toEqual([]);
    expect(cleanRegionIds(['tower','tower','unknown','park',null])).toEqual(['tower','park']);
    expect(cleanRegionIds(null)).toEqual([]);
    expect(REGION_IDS).toHaveLength(8);
    expect(REGIONS.map(region=>region.art.hero)).toEqual(REGION_IDS.map(id=>`/assets/landmarks/${id}/hero.webp`));
    expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();
  });
  it('rejects map mismatches, duplicate/unknown IDs and invalid unlock references',()=>{
    const draft=createRecommendedDraft();draft.map_id='another-map';
    draft.regions[0].id='unknown' as typeof draft.regions[0]['id'];
    draft.regions[1].unlock.landmarkId='unknown' as typeof draft.regions[1]['id'];
    draft.checkInPoints[1].id=draft.checkInPoints[2].id;
    const codes=validateRegionDocument(draft).errors.map(error=>error.code);
    expect(codes).toContain('map-id');expect(codes).toContain('region-id');expect(codes).toContain('unlock');expect(codes).toContain('duplicate-point');
  });
  it('rejects bad geometry, missing coverage, invalid radius and remote asset URLs',()=>{
    const draft=createRecommendedDraft();
    draft.regions[0].polygon=[{u:.1,v:.1},{u:.2,v:.2},{u:.1,v:.2},{u:.2,v:.1}];
    draft.regions[1].polygon=[{u:.9,v:.9},{u:.95,v:.9},{u:.95,v:.95}];
    draft.regions[2].maskImage='https://remote.example/mask.png';
    draft.checkInPoints[3].radiusM=0;
    const codes=validateRegionDocument(draft).errors.map(error=>error.code);
    expect(codes).toContain('self-intersection');expect(codes).toContain('outside-boundary');expect(codes).toContain('landmark-outside');expect(codes).toContain('radius');expect(codes).toContain('mask-image');
  });
  it('requires explicit complete field review before application',()=>{
    expect(validateRegionDocument(REGION_DOCUMENT,{requireConfirmed:true}).valid).toBe(false);
    const draft=createRecommendedDraft();draft.status='confirmed';draft.review={confirmed:true,reviewer:'测试核对',reviewedAt:'2026-11-03T00:00:00Z',notes:'合成测试'};
    draft.gameBoundary.status='confirmed';draft.regions.forEach(region=>region.status='confirmed');
    draft.checkInPoints.forEach(point=>{point.status='confirmed';point.fieldConfirmationRequired=false;});
    expect(validateRegionDocument(draft,{requireConfirmed:true}).valid).toBe(true);
    draft.checkInPoints[3].fieldConfirmationRequired=true;
    expect(validateRegionDocument(draft,{requireConfirmed:true}).valid).toBe(false);
  });
});
