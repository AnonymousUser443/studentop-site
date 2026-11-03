import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {sanitizeProgress,START_UV} from './progress.mjs';import {ringGeometry,newSite} from '../shared/authoring.mjs';
test('published and retired site IDs round-trip without permitting arbitrary IDs or live positions',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'liyun-publication-test-')),file=path.join(dir,'published.json'),previous=process.env.LIYUN_CONTENT_FILE;
 try{
  const geometry=ringGeometry([{u:0,v:0},{u:1,v:0},{u:1,v:1},{u:0,v:1}]),doc={schema:2,mapId:'campus-v04-eaa124716c51375f',boundary:{name:'校区',geometry},notes:'',sites:[]};
  const site=newSite(doc,{u:.5,v:.5},'garden');site.intro='介绍';site.geometry=geometry;doc.sites=[site];
  fs.writeFileSync(file,JSON.stringify({revision:1,document:doc,knownAnchors:{retired:{u:.3,v:.3},garden:{u:.5,v:.5}}}));process.env.LIYUN_CONTENT_FILE=file;
  const clean=sanitizeProgress({version:3,discoveredIds:['garden','retired','unknown'],unlockedRegionIds:['garden','retired','unknown'],playerUV:{u:.5,v:.5},gps:{latitude:39.7}});
  assert.deepEqual(clean.discoveredIds,['garden','retired']);assert.deepEqual(clean.unlockedRegionIds,['garden','retired']);assert.deepEqual(clean.playerUV,{u:.5,v:.5});assert(!Object.hasOwn(clean,'gps'));
  assert.deepEqual(sanitizeProgress({...clean,playerUV:{u:.42,v:.43}}).playerUV,START_UV);
 }finally{if(previous===undefined)delete process.env.LIYUN_CONTENT_FILE;else process.env.LIYUN_CONTENT_FILE=previous;assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'liyun-publication-test-'));fs.rmSync(dir,{recursive:true,force:true});}
});
