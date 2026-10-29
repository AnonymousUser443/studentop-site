'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {newSession,until,sleep}=require('../lib.js');
const report={method:'isolated Edge CDP with explicit fault injection; no physical-device performance claims',checks:[],cases:[],notes:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});if(!pass)throw new Error(name);};
async function run(name,fn){const s=await newSession({size:'1440x900'});try{await fn(s);const expected=s.errors.filter(x=>name==='webgl-unavailable'&&x.includes('THREE.WebGLRenderer: Error creating WebGL context.'));const unexpected=s.errors.filter(x=>!expected.includes(x));if(unexpected.length)throw new Error('Unexpected browser errors '+JSON.stringify(unexpected));report.cases.push({name,ok:true,errors:[...unexpected],expectedFaultDiagnostics:[...expected]});}catch(e){report.cases.push({name,ok:false,error:String(e.stack||e),errors:s.errors});}finally{await s.close();}}
const ready=s=>until(()=>s.evaluate('window.__CAMPUS_QA__?.phase==="welcome"'),16000,'3D welcome');
(async()=>{
 await run('pause-background-contextloss',async s=>{
  await s.navigate('http://127.0.0.1:8081/?qa=1');await ready(s);check('ready_has_no_fallback_layer',await s.evaluate('!document.querySelector(".campus-fallback-art")'));
  await s.click('[data-testid="campus-start"]');await sleep(500);await s.click('.campus-pause');await sleep(100);const before=await s.evaluate('__CAMPUS_QA__.snapshot()');await sleep(350);const after=await s.evaluate('__CAMPUS_QA__.snapshot()');check('pause_stops_camera',before.paused&&JSON.stringify(before.camera)===JSON.stringify(after.camera));
  await s.click('.campus-pause');await sleep(350);check('resume_moves_camera',await s.evaluate('__CAMPUS_QA__.snapshot().progress')>after.progress);
  const current=(await s.call('Target.getTargetInfo')).targetInfo.targetId;const other=(await s.call('Target.createTarget',{url:'about:blank',background:false})).targetId;await s.call('Target.activateTarget',{targetId:other});await sleep(300);
  const hidden=await s.evaluate('document.hidden');if(hidden){const b=await s.evaluate('__CAMPUS_QA__.snapshot()');await sleep(350);const a=await s.evaluate('__CAMPUS_QA__.snapshot()');check('hidden_tab_stops_frames',a.performance.backgroundPaused&&a.performance.frames===b.performance.frames);}else report.notes.push('Headless target activation did not hide page; real-tab background pause not claimed.');
  await s.call('Target.closeTarget',{targetId:other});await s.call('Target.activateTarget',{targetId:current});await sleep(200);
  await s.evaluate('__CAMPUS_QA__.loseContext();true');await until(()=>s.evaluate('document.querySelector("main[data-phase]")?.dataset.phase==="fallback"'),4000,'context loss fallback');
  check('contextloss_preserves_static_entry',await s.evaluate('Boolean(document.querySelector(".campus-fallback-art") && document.querySelector("[data-testid=campus-enter]")?.href==="http://127.0.0.1:5174/")'));await s.screenshot(path.join(__dirname,'campus-context-fallback.png'));check('contextloss_no_unexpected_errors',s.errors.length===0,s.errors);
 });
 await run('reduced-motion-mobile',async s=>{
  await s.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await s.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await s.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await s.navigate('http://127.0.0.1:8081/?qa=1');await ready(s);const initial=await s.evaluate('__CAMPUS_QA__.snapshot()');check('reduced_motion_quality_cap',initial.reducedMotion&&initial.quality==='low'&&initial.performance.dpr<=1.25,initial);
  await s.click('[data-testid="campus-start"]');await until(()=>s.evaluate('__CAMPUS_QA__.phase==="arrival"'),1500,'reduced arrival');check('reduced_motion_skips_long_walk',true);await s.screenshot(path.join(__dirname,'campus-reduced-mobile.png'));check('mobile_error_free',s.errors.length===0,s.errors);
 });
 await run('webgl-unavailable',async s=>{
  await s.call('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes("webgl")?null:original.call(this,type,...args);};'});
  await s.navigate('http://127.0.0.1:8081/?qa=1');await until(()=>s.evaluate('document.querySelector("main[data-phase]")?.dataset.phase==="fallback"'),16000,'No-WebGL fallback');
  check('webgl_failure_not_blank',await s.evaluate('!!document.querySelector(".campus-fallback-art") && !!document.querySelector("[data-testid=campus-enter]") && !!document.querySelector("#campus-skip")'));
  const unexpected=s.errors.filter(x=>!x.includes('THREE.WebGLRenderer: Error creating WebGL context.'));check('no_unexpected_errors_beyond_injected_webgl',unexpected.length===0,s.errors);
  await s.click('[data-testid="campus-enter"]');await until(()=>s.evaluate('location.href==="http://127.0.0.1:5174/"'),5000,'Fallback entry');await until(()=>s.evaluate('document.readyState==="complete"'),10000,'Fallback destination loaded');await sleep(400);check('fallback_link_goes_local',true);
 });
 await run('fast-refresh-twice',async s=>{
  await s.navigate('http://127.0.0.1:8081/?qa=1');await ready(s);await s.evaluate('import("/@vite/client").then(m=>{window.__HMR_UPDATES__=0;m.createHotContext("/qa-hmr-probe").on("vite:beforeUpdate",()=>{window.__HMR_UPDATES__++;});return true;})');
  const file=path.resolve(__dirname,'../../apps/genshin-start/src/App.tsx');const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');const before=hash();
  for(let i=1;i<=2;i++){const now=new Date();fs.utimesSync(file,now,now);await until(()=>s.evaluate('window.__HMR_UPDATES__>='+i),6000,'HMR update '+i);await sleep(1500);check('fast_refresh_'+i+'_keeps_3d',await s.evaluate('__CAMPUS_QA__?.phase==="welcome" && !__CAMPUS_QA__.snapshot().performance.contextLost'));}
  check('hmr_content_unchanged',hash()===before);check('hmr_error_free',s.errors.length===0,s.errors);
 });
 report.ok=report.cases.every(x=>x.ok);fs.writeFileSync(path.join(__dirname,'campus-resilience.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,cases:report.cases,notes:report.notes}));if(!report.ok)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
