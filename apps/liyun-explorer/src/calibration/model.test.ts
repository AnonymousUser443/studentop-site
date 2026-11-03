import { describe, expect, it } from 'vitest';
import { createRecommendedDraft } from '../content/regions';
import { distanceMeters } from '../location/campus';
import { confirmDocument, exportDraft, geoDestination, parseSelection, projectedRange, readDraft, updatePoint, updatePolygon } from './model';

describe('calibration draft lifecycle',()=>{
  it('keeps original content unchanged and resets confirmation after geometry edits',()=>{
    const base=createRecommendedDraft();base.review.reviewer='测试核对人';
    const confirmed=confirmDocument(base,true);
    const moved=updatePolygon(confirmed,{kind:'region',id:'wencui'},confirmed.regions[0].polygon.map((point,index)=>index===0?{...point,u:point.u+.001}:point));
    expect(confirmed.review.confirmed).toBe(true);
    expect(base.regions[0].polygon[0].u).toBe(.46);
    expect(moved.review.confirmed).toBe(false);expect(moved.status).toBe('draft');
    expect(moved.checkInPoints.every(point=>point.fieldConfirmationRequired)).toBe(true);
  });
  it('preserves hand-entered WGS84 until a UV move invalidates that binding',()=>{
    const base=createRecommendedDraft();const id=base.checkInPoints[0].id;
    const placed=updatePoint(base,id,{centerUv:{u:.53,v:.47},wgs84:{latitude:39.73,longitude:116.17,source:'manual-field'}});
    const resized=updatePoint(placed,id,{radiusM:60});
    expect(resized.checkInPoints[0].wgs84?.latitude).toBe(39.73);
    const moved=updatePoint(resized,id,{centerUv:{u:.54,v:.47}});
    expect(moved.checkInPoints[0].wgs84).toBeUndefined();expect(base.checkInPoints[0].wgs84).toBeUndefined();
  });
  it('accepts safe drafts and exposes repairable geometric errors without accepting alien maps',()=>{
    const base=createRecommendedDraft();
    expect(readDraft(JSON.stringify(base)).map_id).toBe(base.map_id);
    base.regions[0].polygon=[{u:.1,v:.1},{u:.2,v:.2},{u:.1,v:.2},{u:.2,v:.1}];
    expect(readDraft(JSON.stringify(base)).regions[0].polygon).toHaveLength(4);
    base.map_id='alien';expect(()=>readDraft(JSON.stringify(base))).toThrow('map_id');
    expect(()=>readDraft('{')).toThrow('JSON');
    expect(()=>readDraft(' '.repeat(1_000_001))).toThrow('1 MB');
  });
  it('projects geodesic reference ranges rather than inventing UV-meter circles',()=>{
    const destination=geoDestination(39.73,116.17,55,90);
    expect(distanceMeters({latitude:39.73,longitude:116.17},destination)).toBeCloseTo(55,4);
    const point=createRecommendedDraft().checkInPoints[0];const range=projectedRange(point);
    expect(range).toHaveLength(72);expect(range.every(uv=>Number.isFinite(uv.u)&&Number.isFinite(uv.v))).toBe(true);
    expect(Math.abs(range[0].v-range[36].v)).not.toBeCloseTo(Math.abs(range[18].u-range[54].u),5);
  });
  it('exports model provenance, review status and candidate coordinates without live device readings',()=>{
    const base=createRecommendedDraft(),exported=exportDraft(base);
    expect(exported.candidateCoordinates).toHaveLength(8);
    expect(exported.candidateCoordinates.every(point=>point.fieldConfirmationRequired)).toBe(true);
    expect(exported.reviewWarning).toContain('不读取');
    expect(parseSelection('region:park')).toEqual({kind:'region',id:'park'});
    expect(parseSelection('point:unknown')).toEqual({kind:'boundary'});
  });
  it('rejects structurally incomplete review metadata before it reaches editor controls',()=>{
    const base=createRecommendedDraft();
    const malformed=JSON.parse(JSON.stringify(base));delete malformed.review.reviewer;
    expect(()=>readDraft(JSON.stringify(malformed))).toThrow('review');
    malformed.review=base.review;malformed.gameBoundary.name={unexpected:'object'};
    expect(()=>readDraft(JSON.stringify(malformed))).toThrow('名称');
  });
});
