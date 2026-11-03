import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_IDS, REFERENCE_ANCHORS, validateRegionDocument } from '../src/content/contracts.mjs';
import { pointInPolygon, signedArea } from '../src/content/geometry.mjs';
import { createCampusMap } from '../src/location/vendor/coordinates.mjs';

export const applicationRoot = fileURLToPath(new URL('../',import.meta.url));
export const readJSON = path => JSON.parse(readFileSync(path,'utf8'));

/** Check the live anchors as well as the independent content reference. */
export function verifySourceAnchors() {
  const source = readFileSync(resolve(applicationRoot,'src/data.ts'),'utf8');
  const anchors = [...source.matchAll(/\{\s*id:\s*'([^']+)'[^\n]*?uv:\s*uv\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)];
  if (anchors.length !== REGION_IDS.length) throw new Error('无法校验现有 8 个 LANDMARKS 锚点，请检查 data.ts 契约');
  for (const [,id,x,y] of anchors) {
    const expected=REFERENCE_ANCHORS[id];
    if (!expected || Math.abs(expected.u-Number(x)/1000.56)>1e-12 || Math.abs(expected.v-Number(y)/1240.28003)>1e-12) throw new Error(`现有锚点 ${id} 与推荐依据不符，不可静默改动 LANDMARKS UV`);
  }
  return anchors.length;
}

export function verifyRegions(document,options={}) {
  const validation=validateRegionDocument(document,options);
  if(!validation.valid)return {...validation,map_id:document?.map_id};
  const metadata=readJSON(resolve(applicationRoot,'src/location/data/map.json'));
  const artifact=readJSON(resolve(applicationRoot,'src/location/data/selected_model.json'));
  const map=createCampusMap(metadata,artifact);
  const hull=artifact.model.calibration_hull_uv.map(([u,v])=>({u,v}));
  const referenceAnchorCount=verifySourceAnchors();
  const regions=document.regions.map(region=>({id:region.id,vertices:region.polygon.length,areaUV:Math.abs(signedArea(region.polygon)),originalLandmarkCovered:pointInPolygon(REFERENCE_ANCHORS[region.id],region.polygon)}));
  const points=document.checkInPoints.map(point=>{
    const geo=map.uvToGeo(point.centerUv.u,point.centerUv.v);
    return {id:point.id,radiusM:point.radiusM,source:point.wgs84?'manual-field':'existing-map-model',candidateWgs84:point.wgs84??{latitude:geo.latitude,longitude:geo.longitude},support:geo.support,insideControlHull:pointInPolygon(point.centerUv,hull)};
  });
  return {...validation,map_id:document.map_id,status:document.status,referenceAnchorCount,regions,points,
    hullNote:`${points.filter(point=>point.insideControlHull).length}/8 个参考中心在定位采样凸包内；凸包不是游戏外边界。`};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),requireConfirmed=args.includes('--require-confirmed'),input=args.find(arg=>!arg.startsWith('--'));
    const unknown=args.filter(arg=>arg.startsWith('--')&&arg!=='--require-confirmed');
    if(unknown.length)throw new Error(`未知参数：${unknown.join(', ')}`);
    const path=input?resolve(input):resolve(applicationRoot,'src/content/regions.json');
    const result=verifyRegions(readJSON(path),{requireConfirmed});
    console.log(JSON.stringify({file:path,...result},null,2));
    if(!result.valid)process.exitCode=1;
  } catch(error) { console.error(error instanceof Error?error.message:String(error));process.exitCode=1; }
}
