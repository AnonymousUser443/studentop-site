'use strict';
// Isolates the P0 deletion gate from the intentional theme/UI changes.
// Restores the original unused HUD tail in one temporary browser, then removes it.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {newSession,until,sleep}=require('../lib.js');
const out=path.join(__dirname,'pure-cleanup'),app=path.resolve(__dirname,'../../apps/liyun-explorer');
const postcss=createRequire(path.join(app,'package.json'))('postcss');
const original=cp.execFileSync('git',['show','e15901d:apps/liyun-explorer/src/hud/hud.css'],{encoding:'utf8',maxBuffer:1e6});
const ast=postcss.parse(original),nodes=ast.nodes.filter(n=>n.type!=='comment'&&n.source.end.line>=560);
const mapBefore=postcss.parse(cp.execFileSync('git',['show','e15901d:apps/liyun-explorer/src/map/map.css'],{encoding:'utf8'})),mapAfter=postcss.parse(cp.execFileSync('git',['show','05b7e32:apps/liyun-explorer/src/map/map.css'],{encoding:'utf8'})),mapKept=new Set();
mapAfter.walkRules(rule=>rule.selectors?.forEach(selector=>mapKept.add(selector)));
const mapDeleted=[];mapBefore.walkRules(rule=>{const deleted=rule.selectors.filter(selector=>!mapKept.has(selector));if(deleted.length){const copy=rule.clone();copy.selectors=deleted;nodes.push(copy);mapDeleted.push(...deleted);}});
const legacy=nodes.map(n=>n.toString()).join('\n');
const selectors=[];const collect=rule=>{if(rule.parent?.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;selectors.push(...rule.selectors)};for(const node of nodes){if(node.type==='rule')collect(node);node.walkRules?.(collect);}
const checks=[],frames=[];
(async()=>{let s;try{
  fs.mkdirSync(out,{recursive:true});s=await newSession({size:'1440x900',hardwareRendering:true});await s.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await s.navigate('http://127.0.0.1:5174/?qa=1&preset=explored');await until(()=>s.evaluate('Boolean(window.__LIYUN__)'),15000,'QA');
  await s.evaluate('window.__LIYUN__.setSettings({autoDegrade:false,music:false,uiSound:false,reducedMotion:true});window.__LIYUN__.freeze(1000);document.fonts.ready');await sleep(600);
  for(const[width,height]of[[1920,1080],[1440,900],[1280,720],[1024,600],[844,390],[667,375]]){
    await s.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const state of['map','menu','settings','cinematic']){
      if(state==='cinematic'){await s.evaluate('window.__LIYUN__.setRoute("map");window.__LIYUN__.previewCinematic("beihu");true');await until(()=>s.evaluate('document.querySelector("[data-testid=cinematic-screen]")?.dataset.timelineReady==="true"'),5000,'Cinema');await sleep(1200);}
      else {await s.evaluate(`window.__LIYUN__.setRoute(${JSON.stringify(state)});true`);await sleep(500);}
      await s.evaluate(`(()=>{const style=document.createElement('style');style.id='qa-restored-dead-css';style.textContent=${JSON.stringify(legacy)};document.head.append(style);return true})()`);await sleep(120);
      const matches=await s.evaluate(`(()=>{const found=[];for(const selector of ${JSON.stringify(selectors)}){try{const count=document.querySelectorAll(selector.replace(/::?(before|after)/g,'')).length;if(count)found.push({selector,count})}catch{}}return found})()`);
      const restored=Buffer.from((await s.call('Page.captureScreenshot',{format:'png'})).data,'base64');
      await s.evaluate('document.querySelector("#qa-restored-dead-css").remove();true');await sleep(120);
      const cleaned=Buffer.from((await s.call('Page.captureScreenshot',{format:'png'})).data,'base64'),same=restored.equals(cleaned),name=state+'-'+width+'x'+height;
      const row={state,viewport:[width,height],matches,exactPngEqual:same,restoredSha256:crypto.createHash('sha256').update(restored).digest('hex'),cleanedSha256:crypto.createHash('sha256').update(cleaned).digest('hex')};frames.push(row);
      fs.writeFileSync(path.join(out,name+'-restored.png'),restored);fs.writeFileSync(path.join(out,name+'-cleaned.png'),cleaned);
      checks.push({name,pass:same&&matches.length===0,detail:row});
      if(state==='cinematic'){await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(()=>s.evaluate('!document.querySelector("[data-testid=cinematic-screen]")'),3000,'close');}
    }
  }
  const result={ok:checks.every(c=>c.pass)&&!s.errors.length,total:checks.length,checks,frames,errors:s.errors,source:{commit:'e15901d',file:'src/hud/hud.css',boundary:'Complete top-level nodes intersecting line560 through EOF, plus map selectors removed by05b7e32',bytes:Buffer.byteLength(legacy),selectors:selectors.length,mapDeleted},scope:'Exact paired PNG comparison in the same final app/profile/camera. System/game reduced motion and fixed Canvas isolate pure CSS removal; this is not a historical full-app before/after comparison or an ordinary-animation benchmark.'};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:result.ok,total:checks.length,failed:checks.filter(c=>!c.pass),source:result.source,errors:s.errors},null,2));if(!result.ok)process.exitCode=1;
}catch(error){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:false,error:String(error.stack||error),checks,frames,errors:s?.errors},null,2));console.error(error);process.exitCode=1;}finally{await s?.close();}})();
