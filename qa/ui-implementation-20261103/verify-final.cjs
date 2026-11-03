'use strict';
// Repeatable, local-only final gate. Network tests bind ephemeral loopback servers with synthetic accounts.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'apps/liyun-explorer'),checks=[];
fs.mkdirSync(path.join(__dirname,'logs'),{recursive:true});
const run=(name,command,args,cwd=app)=>{
  const started=Date.now(),r=cp.spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:12e6,windowsHide:true});
  const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(__dirname,'logs',name+'.log'),output);
  const row={name,command:[command,...args],exitCode:r.status,pass:r.status===0,elapsedMs:Date.now()-started,log:'logs/'+name+'.log'};
  if(r.error)row.error=String(r.error);checks.push(row);console.log(JSON.stringify(row));if(!row.pass)throw Error(name+' failed; see '+row.log);
};
try{
  run('unit','node',['node_modules/vitest/vitest.mjs','run','--reporter=json','--outputFile=../../qa/ui-implementation-20261103/vitest-final.json']);
  run('server-store','node',['server/store.test.mjs']);run('server-http','node',['server/server.test.mjs']);
  run('regions-check','node',['scripts/verify-regions.mjs']);fs.copyFileSync(path.join(__dirname,'logs/regions-check.log'),path.join(__dirname,'regions-check.json'));
  run('calibration-cli','node',['src/calibration/cli-qa.mjs']);
  run('map-frozen','node',['scripts/verify-calibrated-map.mjs']);
  run('asset-manifest','node',['scripts/asset-manifest.mjs','--check']);
  run('font-characters','node',['scripts/collect-font-text.mjs','--out',path.join(__dirname,'font-characters-final.txt')]);
  const current=fs.readFileSync(path.join(__dirname,'font-characters-final.txt'),'utf8'),built=fs.readFileSync(path.join(app,'scripts/fonts-characters.txt'),'utf8');
  checks.push({name:'font-subset-text-current',pass:current===built});if(current!==built)throw Error('Runtime text changed after font subsetting; rebuild fonts first');
  run('font-coverage','python',[path.join(__dirname,'font-coverage.py')],root);
  run('typescript','node',['node_modules/typescript/bin/tsc','-b']);
  run('vite-build','node',['node_modules/vite/bin/vite.js','build']);
  run('dist-budget','node',['scripts/trim-dist.mjs']);
  run('invariants','node',[path.join(__dirname,'check-invariants.cjs')],root);
  const unit=JSON.parse(fs.readFileSync(path.join(__dirname,'vitest-final.json'),'utf8'));
  const result={ok:true,at:new Date().toISOString(),unit:{files:unit.testResults.length,passed:unit.numPassedTests,total:unit.numTotalTests},checks};
  fs.writeFileSync(path.join(__dirname,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,unit:result.unit,total:checks.length}));
}catch(error){fs.writeFileSync(path.join(__dirname,'checks.json'),JSON.stringify({ok:false,at:new Date().toISOString(),error:String(error.stack||error),checks},null,2));console.error(error);process.exitCode=1;}
