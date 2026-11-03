import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createCampusMap } from '../src/location/vendor/coordinates.mjs';
import { applicationRoot, readJSON, verifyRegions } from './verify-regions.mjs';

export function canonicalContent(document) {
  const fields=(object,keys)=>Object.fromEntries(keys.filter(key=>object[key]!==undefined).map(key=>[key,object[key]]));
  return {schema_version:document.schema_version,map_id:document.map_id,coordinate_system:document.coordinate_system,status:document.status,
    review:fields(document.review,['confirmed','reviewer','reviewedAt','notes']),
    gameBoundary:fields(document.gameBoundary,['id','name','status','polygon','notes']),
    regions:document.regions.map(region=>fields(region,['id','name','subtitle','map_id','status','polygon','maskImage','unlock','revealOrder','story','art','notes'])),
    checkInPoints:document.checkInPoints.map(point=>fields(point,['id','regionId','name','status','centerUv','radiusM','physical','source','fieldConfirmationRequired','notes','wgs84']))};
}

export function deriveOverrides(document) {
  const metadata=readJSON(resolve(applicationRoot,'src/location/data/map.json')),artifact=readJSON(resolve(applicationRoot,'src/location/data/selected_model.json'));
  const map=createCampusMap(metadata,artifact);
  const confirmed=document.status==='confirmed'&&document.review.confirmed===true;
  return {schema_version:1,map_id:document.map_id,enabled:confirmed,review:{...document.review},
    points:document.checkInPoints.map(point=>{
      const geo=map.uvToGeo(point.centerUv.u,point.centerUv.v);
      if(point.wgs84){
        const mapped=map.gpsToMap(point.wgs84.latitude,point.wgs84.longitude);
        if(Math.hypot(mapped.u-point.centerUv.u,mapped.v-point.centerUv.v)>1e-6)throw new Error(`${point.id} 的手填 WGS84 与 UV 不一致，请重新放置候选后导出`);
      }
      return {id:point.id,centerUv:point.centerUv,radiusM:point.radiusM,latitude:point.wgs84?.latitude??geo.latitude,longitude:point.wgs84?.longitude??geo.longitude,
        physical:point.physical,status:confirmed?'confirmed':point.status,fieldConfirmationRequired:!confirmed,source:point.wgs84?'manual-field':confirmed?'field-reviewed-model-reference':'existing-map-model',support:geo.support};
    })};
}

export function calibrationDiff(before,after) {
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  return {boundaryChanged:!same(before.gameBoundary.polygon,after.gameBoundary.polygon),
    changedRegions:after.regions.filter(region=>!same(region,before.regions.find(item=>item.id===region.id))).map(region=>region.id),
    pointChanges:after.checkInPoints.flatMap(point=>{const previous=before.checkInPoints.find(item=>item.id===point.id);return same(previous?.centerUv,point.centerUv)&&previous?.radiusM===point.radiusM&&same(previous?.wgs84,point.wgs84)?[]:[{id:point.id,before:{centerUv:previous?.centerUv,radiusM:previous?.radiusM,wgs84:previous?.wgs84},after:{centerUv:point.centerUv,radiusM:point.radiusM,wgs84:point.wgs84}}];})};
}

const frozenPaths=['src/location/vendor/coordinates.mjs','src/location/vendor/model-transform.mjs','src/location/data/map.json','src/location/data/selected_model.json','public/assets/maps/calibrated/campus_no_labels.webp','public/assets/maps/calibrated/campus_no_labels.png'];
const hashes=()=>Object.fromEntries(frozenPaths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(applicationRoot,path))).digest('hex')]));

export function importCalibration(input,{apply=false}={}) {
  const inputPath=resolve(input);
  if(statSync(inputPath).size>1_000_000)throw new Error('输入文件超过 1 MB');
  const document=readJSON(inputPath),validation=verifyRegions(document,{requireConfirmed:apply});
  if(!validation.valid)throw new Error(validation.errors.map(error=>`${error.target}: ${error.message}`).join('\n'));
  const content=canonicalContent(document),derived=deriveOverrides(document),target=resolve(applicationRoot,'src/content/regions.json'),overrideTarget=resolve(applicationRoot,'src/content/checkin-overrides.json');
  const before=readJSON(target),diff=calibrationDiff(before,content),snapshot=hashes();
  const result={mode:apply?'apply':'dry-run',valid:true,confirmed:document.status==='confirmed'&&document.review.confirmed===true,
    targets:['src/content/regions.json','src/content/checkin-overrides.json'],...diff,
    changesWritten:false,frozenFilesUnchanged:true,
    note:apply?'只应用到独立内容与点位覆盖配置；原地标 UV 和六份冻结标定文件不变。':'默认 dry-run，未写入任何文件。确认稿通过审查后显式添加 --apply。',
    warnings:validation.warnings,candidatePoints:derived.points};
  if(!apply)return result;
  const previous=[readFileSync(target),readFileSync(overrideTarget)],tempSuffix=`.import-${process.pid}-${Date.now()}.tmp`,temps=[target+tempSuffix,overrideTarget+tempSuffix];
  try {
    writeFileSync(temps[0],JSON.stringify(content,null,2)+'\n','utf8');writeFileSync(temps[1],JSON.stringify(derived,null,2)+'\n','utf8');
    renameSync(temps[0],target);renameSync(temps[1],overrideTarget);
    if(JSON.stringify(snapshot)!==JSON.stringify(hashes()))throw new Error('冻结标定文件在应用期间发生变化，已撤销内容写入');
    result.changesWritten=true;
  } catch(error) {
    writeFileSync(target,previous[0]);writeFileSync(overrideTarget,previous[1]);throw error;
  } finally {for(const temp of temps)if(existsSync(temp))unlinkSync(temp);}
  return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),input=args.find(arg=>!arg.startsWith('--')),unknown=args.filter(arg=>arg.startsWith('--')&&!['--apply','--dry-run'].includes(arg));
    if(!input||unknown.length||args.filter(arg=>!arg.startsWith('--')).length!==1||args.includes('--apply')&&args.includes('--dry-run'))throw new Error('用法：node scripts/import-calibration.mjs <review.json> [--dry-run | --apply]');
    console.log(JSON.stringify(importCalibration(input,{apply:args.includes('--apply')}),null,2));
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
