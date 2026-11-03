import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ringGeometry,repairCoverage,coverageReport,geometryArea,pointInGeometry,canonicalDocument,newSite} from '../shared/authoring.mjs';
import {openAuthorStore} from './author-store.mjs';
const box=(x0,y0,x1,y1)=>ringGeometry([{u:x0,v:y0},{u:x1,v:y0},{u:x1,v:y1},{u:x0,v:y1}]);
const fixture=()=>({schema:2,mapId:'campus-v04-eaa124716c51375f',boundary:{name:'测试校区',geometry:box(0,0,1,1)},notes:'',sites:[
 {id:'west',name:'西区',subtitle:'西侧',intro:'西区介绍',verse:'',icon:'gate',physical:true,center:{uv:{u:.25,v:.5}},radiusM:40,geometry:box(0,0,.5,1),photos:[]},
 {id:'east',name:'东区',subtitle:'东侧',intro:'东区介绍',verse:'',icon:'book',physical:true,center:{uv:{u:.75,v:.5}},radiusM:45,geometry:box(.5,0,1,1),photos:[]},
]});
test('repair assigns overlap without gaps and preserves exclusive manually drawn areas',()=>{
 const doc=fixture();doc.sites[0].geometry=box(0,0,.7,1);doc.sites[1].geometry=box(.3,0,1,1);
 assert(coverageReport(doc).overlapArea>.39);const fixed=repairCoverage(doc),report=coverageReport(fixed);
 assert.equal(report.valid,true);assert.equal(report.coverage,1);assert(report.overlapArea<1e-10);
 assert(pointInGeometry({u:.1,v:.1},fixed.sites[0].geometry));assert(pointInGeometry({u:.9,v:.1},fixed.sites[1].geometry));
});
test('repair fills uncovered campus and clips regions outside the campus',()=>{
 const doc=fixture();doc.sites[0].geometry=box(0,0,.4,1);doc.sites[1].geometry=box(.6,0,1,1);
 assert(coverageReport(doc).gapArea>.19);const fixed=repairCoverage(doc);assert(coverageReport(fixed).valid);assert.equal(coverageReport(fixed).gapArea,0);
});
test('concave boundaries and holes survive complete repartition',()=>{
 const doc=fixture();doc.boundary.geometry=[[[{u:0,v:0},{u:1,v:0},{u:1,v:1},{u:0,v:1}],[{u:.4,v:.35},{u:.6,v:.35},{u:.6,v:.65},{u:.4,v:.65}]]];
 const fixed=repairCoverage(doc,{repartition:true});assert(coverageReport(fixed).valid);assert(Math.abs(fixed.sites.reduce((n,s)=>n+geometryArea(s.geometry),0)-.94)<1e-9);
 assert(!fixed.sites.some(s=>pointInGeometry({u:.5,v:.5},s.geometry)));
});
test('overlapping check-in centers are rejected rather than claiming full coverage',()=>{
 const doc=fixture();doc.sites[1].center=structuredClone(doc.sites[0].center);assert.throws(()=>repairCoverage(doc),/重合/);
});
test('canonical content drops unknown nested data and allows new scenic sites',()=>{
 const doc=fixture();doc.sites.push(newSite(doc,{u:.4,v:.4},'new-garden'));doc.secret='discard';doc.sites[0].center.deviceGps='discard';doc.sites[0].geometry[0][0][0].token='discard';
 const clean=canonicalDocument(doc);assert.equal(clean.sites.length,3);assert(!JSON.stringify(clean).includes('discard'));
});
function temporary(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'liyun-author-test-'));const store=openAuthorStore({dataDir:dir,seed:fixture()});return{dir,store,close(){store.close();fs.rmSync(dir,{recursive:true,force:true});}};}
test('different fields merge, same-field stale writes conflict, retries are idempotent',()=>{
 const t=temporary();try{
 const edit=(requestId,target,field,value,expected=0)=>({requestId,clientId:'client-a-111',operations:[{type:'set',target,field,value,expected}]});
 t.store.apply(edit('request-111','site:west','name','A的名称'),'A');
 t.store.apply(edit('request-222','site:west','intro','B的介绍'),'B');
 assert.equal(t.store.snapshot().document.sites[0].name,'A的名称');assert.equal(t.store.snapshot().document.sites[0].intro,'B的介绍');
 assert.throws(()=>t.store.apply(edit('request-333','site:west','name','迟到覆盖'),'B'),e=>e.status===409&&e.conflicts.length===1);
 const result=t.store.apply(edit('request-111','site:west','name','A的名称'),'A');assert.equal(result.replayed,true);assert.equal(result.revision,2);
 }finally{t.close();}
});
test('publishing is explicit, revision-bound, checks coverage and survives restart',()=>{
 const t=temporary();let closed=false;try{
 assert.equal(t.store.published(),null);assert.throws(()=>t.store.publish({baseRevision:0,confirmed:false},'A'),e=>e.status===400);
 t.store.apply({requestId:'request-444',clientId:'client-a-111',operations:[{type:'set',target:'site:west',field:'name',value:'新名称',expected:0}]},'A');
 assert.throws(()=>t.store.publish({baseRevision:0,confirmed:true},'A'),e=>e.status===409);
 t.store.publish({baseRevision:1,confirmed:true},'A');assert.equal(t.store.published().document.sites[0].name,'新名称');assert(fs.existsSync(path.join(t.dir,'published.json')));
 t.store.close();closed=true;const reopened=openAuthorStore({dataDir:t.dir,seed:fixture()});assert.equal(reopened.snapshot().revision,1);assert.equal(reopened.published().revision,1);reopened.close();
 }finally{if(!closed)t.store.close();fs.rmSync(t.dir,{recursive:true,force:true});}
});
test('adding a site and immediately typing its introduction works in one autosave batch',()=>{
 const t=temporary();try{
 const site=newSite(fixture(),{u:.4,v:.4},'new-garden');
 const result=t.store.apply({requestId:'request-batched-add',clientId:'client-a-111',operations:[{type:'add',site,expected:0},{type:'set',target:'site:new-garden',field:'name',value:'新花园',expected:0},{type:'set',target:'site:new-garden',field:'intro',value:'立即填写的介绍',expected:0}]},'A');
 assert.equal(result.document.sites.find(s=>s.id==='new-garden').intro,'立即填写的介绍');
 }finally{t.close();}
});
test('deleted scenic IDs remain in the public known-anchor ledger after publishing',()=>{
 const t=temporary();try{
 t.store.publish({baseRevision:0,confirmed:true},'A');
 const only=fixture();only.sites=[only.sites[0]];only.sites[0].geometry=box(0,0,1,1);
 t.store.apply({requestId:'request-555',clientId:'client-a-111',operations:[{type:'delete',id:'east',expected:0},{type:'set',target:'site:west',field:'geometry',value:only.sites[0].geometry,expected:0}]},'A');
 t.store.publish({baseRevision:1,confirmed:true},'A');const file=JSON.parse(fs.readFileSync(path.join(t.dir,'published.json'),'utf8'));assert(file.knownAnchors.east);assert.equal(file.document.sites.length,1);
 }finally{t.close();}
});
