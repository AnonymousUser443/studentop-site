import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({schema_version:1,map_id:'campus-v04-eaa124716c51375f',enabled:true,
  review:{confirmed:true,reviewer:'Synthetic API test',reviewedAt:'2026-11-03T00:00:00Z'},
  points:[{id:'wencui',centerUv:{u:.54,v:.48},radiusM:36,latitude:39.7318,longitude:116.1679,status:'confirmed',fieldConfirmationRequired:false}]}));
vi.mock('./checkin-overrides.json',()=>({default:fixture}));
import { getConfirmedCheckInOverride } from './regions';
beforeEach(()=>{fixture.schema_version=1;fixture.map_id='campus-v04-eaa124716c51375f';fixture.enabled=true;fixture.review={confirmed:true,reviewer:'Synthetic API test',reviewedAt:'2026-11-03T00:00:00Z'};fixture.points=[{id:'wencui',centerUv:{u:.54,v:.48},radiusM:36,latitude:39.7318,longitude:116.1679,status:'confirmed',fieldConfirmationRequired:false}];});
describe('confirmed check-in override consumer API',()=>{
  it('returns the same reviewed center and meter radius consumed by preview and check-in',()=>{const point=getConfirmedCheckInOverride('wencui');expect(point).toMatchObject({centerUv:{u:.54,v:.48},latitude:39.7318,longitude:116.1679,radiusM:36});expect(getConfirmedCheckInOverride('unknown')).toBeUndefined();});
  it('refuses disabled, alien-map or incomplete review configuration',()=>{fixture.enabled=false;expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();fixture.enabled=true;fixture.map_id='alien';expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();fixture.map_id='campus-v04-eaa124716c51375f';fixture.review.reviewer='';expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();});
  it('refuses unconfirmed or still pending field points',()=>{fixture.points[0].fieldConfirmationRequired=true;expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();fixture.points[0].fieldConfirmationRequired=false;fixture.points[0].status='draft';expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();});
  it('refuses nonfinite/out-of-range geography, UV and radius',()=>{for(const patch of [{latitude:NaN},{latitude:91},{longitude:181},{centerUv:{u:-.1,v:.5}},{radiusM:0},{radiusM:201}]){const original={...fixture.points[0]};Object.assign(fixture.points[0],patch);expect(getConfirmedCheckInOverride('wencui')).toBeUndefined();fixture.points[0]=original;}});
});
