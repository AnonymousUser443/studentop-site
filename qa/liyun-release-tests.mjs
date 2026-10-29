import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {buildLiyunRelease} from '../tools/build-liyun-release.mjs';
test('public assets get deterministic version URLs including dynamic image prefixes and fonts',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'liyun-release-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'source');fs.mkdirSync(path.join(source,'assets/fonts'),{recursive:true});
 fs.writeFileSync(path.join(source,'index.html'),'<html><head><link href="/assets/style.css"><link href="/favicon.svg"></head><script src="/assets/main.js"></script></html>');
 fs.writeFileSync(path.join(source,'assets/main.js'),'const root="/assets/activity/reward-";fetch("/api/health");const remote="https://example.test/assets/x";');
 fs.writeFileSync(path.join(source,'assets/style.css'),'@font-face{src:url(/assets/fonts/local.woff2)}');fs.writeFileSync(path.join(source,'assets/fonts/local.woff2'),'FONT');fs.writeFileSync(path.join(source,'favicon.svg'),'<svg/>');
 const a=buildLiyunRelease(source,path.join(dir,'a')),b=buildLiyunRelease(source,path.join(dir,'b'));assert.equal(a.id,b.id);assert.deepEqual(a.files,b.files);assert.equal(a.sourceFiles,5);
 const prefix='/assets/releases/'+a.id+'/';const js=fs.readFileSync(path.join(dir,'a',prefix,'main.js'),'utf8');assert(js.includes('"'+prefix+'activity/reward-"'));assert(js.includes('fetch("/api/health")'));assert(js.includes('https://example.test/assets/x'));
 assert(fs.readFileSync(path.join(dir,'a',prefix,'style.css'),'utf8').includes('url('+prefix+'fonts/local.woff2)'));assert(fs.readFileSync(path.join(dir,'a/index.html'),'utf8').includes(prefix+'favicon.svg'));
 fs.writeFileSync(path.join(source,'assets/fonts/local.woff2'),'NEW FONT');const c=buildLiyunRelease(source,path.join(dir,'c'));assert.notEqual(c.id,a.id);assert.throws(()=>buildLiyunRelease(source,path.join(dir,'a')));assert.throws(()=>buildLiyunRelease(source,path.join(source,'out')));
});
test('release refuses private or executable files instead of copying arbitrary source',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'liyun-release-deny-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'index.html'),'<head></head>');fs.writeFileSync(path.join(source,'private.json'),'{}');assert.throws(()=>buildLiyunRelease(source,path.join(dir,'out')));fs.unlinkSync(path.join(source,'private.json'));fs.mkdirSync(path.join(source,'assets'));for(const name of ['private.json','run.ps1']){fs.writeFileSync(path.join(source,'assets',name),'blocked');assert.throws(()=>buildLiyunRelease(source,path.join(dir,'out')));fs.unlinkSync(path.join(source,'assets',name));}
});
