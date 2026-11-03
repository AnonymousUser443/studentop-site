// Integration evidence uses an owned temporary miniature app. It never applies
// synthetic confirmations to production content or frozen calibration sources.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const app=fileURLToPath(new URL('../../',import.meta.url)),out=fileURLToPath(new URL('./qa/',import.meta.url));
const scratch=mkdtempSync(join(tmpdir(),'liyun-calibration-import-')),checks=[];
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw new Error(name);};
const frozen=['src/location/vendor/coordinates.mjs','src/location/vendor/model-transform.mjs','src/location/data/map.json','src/location/data/selected_model.json','public/assets/maps/calibrated/campus_no_labels.webp','public/assets/maps/calibrated/campus_no_labels.png'];
const copied=['scripts/import-calibration.mjs','scripts/verify-regions.mjs','src/content/contracts.mjs','src/content/geometry.mjs','src/content/regions.json','src/content/checkin-overrides.json','src/data.ts',...frozen.slice(0,4)];
const productionBefore=Object.fromEntries([...frozen,'src/content/regions.json','src/content/checkin-overrides.json'].map(path=>[path,hash(resolve(app,path))]));
let failure;
try {
  for(const path of copied){mkdirSync(dirname(resolve(scratch,path)),{recursive:true});copyFileSync(resolve(app,path),resolve(scratch,path));}
  for(const path of frozen.slice(4)){mkdirSync(dirname(resolve(scratch,path)),{recursive:true});writeFileSync(resolve(scratch,path),'synthetic frozen raster fixture');}
  const sandboxFrozen=Object.fromEntries(frozen.map(path=>[path,hash(resolve(scratch,path))]));
  const content=resolve(scratch,'src/content/regions.json'),override=resolve(scratch,'src/content/checkin-overrides.json'),original=readFileSync(content,'utf8');
  const draft=JSON.parse(original),input=resolve(scratch,'review.json');
  const run=(document,apply=false)=>{writeFileSync(input,JSON.stringify(document));return spawnSync(process.execPath,[resolve(scratch,'scripts/import-calibration.mjs'),input,...(apply?['--apply']:[])],{encoding:'utf8',windowsHide:true});};
  let result=run(draft);check('recommended dry-run succeeds without writing',result.status===0&&!JSON.parse(result.stdout).changesWritten&&readFileSync(content,'utf8')===original);
  result=run(draft,true);check('recommended --apply is refused without writing',result.status!==0&&readFileSync(content,'utf8')===original);
  const confirmed=structuredClone(draft);confirmed.status='confirmed';confirmed.review={confirmed:true,reviewer:'Synthetic CLI fixture (not field review)',reviewedAt:'2026-11-03T00:00:00Z',notes:'Temporary sandbox test only'};
  confirmed.gameBoundary.status='confirmed';confirmed.regions.forEach(region=>region.status='confirmed');confirmed.checkInPoints.forEach(point=>{point.status='confirmed';point.fieldConfirmationRequired=false;});confirmed.checkInPoints[0].radiusM=46;
  result=run(confirmed);check('confirmed dry-run reports changed point but does not write',result.status===0&&JSON.parse(result.stdout).pointChanges.length===1&&!JSON.parse(result.stdout).changesWritten&&readFileSync(content,'utf8')===original);
  result=run(confirmed,true);if(result.status!==0)throw new Error(`Confirmed sandbox apply failed: ${result.stderr || result.stdout || result.error}`);check('explicit confirmed apply writes independent content and enabled overrides',JSON.parse(result.stdout).changesWritten&&JSON.parse(readFileSync(content,'utf8')).review.confirmed&&JSON.parse(readFileSync(override,'utf8')).enabled&&JSON.parse(readFileSync(override,'utf8')).points[0].radiusM===46);
  const appliedHash=hash(content),appliedOverrideHash=hash(override);
  for(const [name,alter] of [
    ['alien map',doc=>{doc.map_id='alien';}],
    ['unknown region ID',doc=>{doc.regions[0].id='alien';}],
    ['self-intersecting polygon',doc=>{doc.regions[0].polygon=[{u:.5,v:.4},{u:.58,v:.5},{u:.5,v:.5},{u:.58,v:.4}];}],
    ['mismatched manual WGS84 binding',doc=>{doc.checkInPoints[0].wgs84={latitude:39.72,longitude:116.16,source:'manual-field'};}],
  ]){
    const malformed=structuredClone(confirmed);alter(malformed);result=run(malformed,true);
    check(`rejects ${name} with no partial writes`,result.status!==0&&hash(content)===appliedHash&&hash(override)===appliedOverrideHash);
  }
  check('all six sandbox frozen inputs stay byte-identical',frozen.every(path=>hash(resolve(scratch,path))===sandboxFrozen[path]));
  check('production content and frozen files stay byte-identical',Object.entries(productionBefore).every(([path,value])=>hash(resolve(app,path))===value));
}catch(error){failure=String(error.stack||error);process.exitCode=1;}
finally {
  mkdirSync(out,{recursive:true});const result={ok:!failure,mode:'Node CLI integration in an owned temporary miniature app; all confirmations are synthetic',checks,...(failure?{error:failure}:{})};
  writeFileSync(resolve(out,'cli-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  const absolute=resolve(scratch),temporaryRoot=resolve(tmpdir());
  if(dirname(absolute)===temporaryRoot&&basename(absolute).startsWith('liyun-calibration-import-'))rmSync(absolute,{recursive:true,force:true});
}
