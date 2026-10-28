'use strict';
const fs=require('node:fs'),path=require('node:path');const {newSession,until,sleep,matchesTarget}=require('../lib.js');
const report={method:'isolated Edge/CDP, cold profile, no external network permitted; actual legacy resources and natural journey, no exit injection',checks:[],requests:[],screenshots:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw new Error(name);};
const capture=async(s,name)=>{const file=name+'.png';await s.screenshot(path.join(__dirname,file));report.screenshots.push(file);};
const phase=(s,p,ms=55000)=>until(()=>s.evaluate('document.querySelector("#legacy-shell")?.dataset.phase==='+JSON.stringify(p)),ms,'legacy '+p);
(async()=>{let s;
 try{
  s=await newSession({size:'1440x900'});const urls=report.requests;s.client.on('Network.requestWillBeSent',p=>urls.push(p.request.url));await s.navigate('http://127.0.0.1:8081/legacy.html?qa=1&skip=0');
  await phase(s,'welcome');check('legacy_13_models_loaded',await s.evaluate('__LEGACY_QA__.snapshot().loaded===13'),await s.evaluate('__LEGACY_QA__.snapshot()'));
  check('draco_wrapper_and_wasm_same_origin',urls.some(u=>u.includes('/_legacy-draco/draco_wasm_wrapper.js'))&&urls.some(u=>u.includes('/_legacy-draco/draco_decoder.wasm')),urls.filter(u=>u.includes('draco')));
  check('no_external_runtime_requests',urls.filter(u=>/^https?:/.test(u)).every(u=>['127.0.0.1','localhost'].includes(new URL(u).hostname)),urls.filter(u=>/^https?:/.test(u)&&!['127.0.0.1','localhost'].includes(new URL(u).hostname)));
  check('original_audio_does_not_autoplay',await s.evaluate('__LEGACY_QA__.snapshot().sound===false')&&!urls.some(u=>/\.mp3(?:$|\?)/i.test(u)));
  await sleep(500);await capture(s,'original-welcome');await s.click('#legacy-start');await phase(s,'journey');
  await s.click('#legacy-pause');await sleep(100);const before=await s.evaluate('__LEGACY_QA__.snapshot()');await sleep(450);const after=await s.evaluate('__LEGACY_QA__.snapshot()');check('legacy_pause_stops_clock',before.paused&&after.paused&&JSON.stringify(before.camera)===JSON.stringify(after.camera));await s.click('#legacy-pause');
  await s.click('#legacy-audio');await until(()=>s.evaluate('__LEGACY_QA__.snapshot().sound'),6000,'user sound opt in');check('sound_is_user_opt_in',urls.some(u=>/\.mp3(?:$|\?)/i.test(u)));await s.click('#legacy-audio');
  await phase(s,'door',70000);await capture(s,'original-door');check('legacy_door_natural_arrival',await s.evaluate('!document.getElementById("legacy-enter").hidden'));
  await s.click('#legacy-enter');await until(async()=>matchesTarget(await s.evaluate('location.href'),'http://127.0.0.1:5174/'),20000,'original actual destination');await s.evaluate('new Promise(r=>document.readyState==="complete"?r(true):addEventListener("load",()=>r(true),{once:true}))');await sleep(500);
  check('legacy_enter_reaches_local_liyun',await s.evaluate('location.origin==="http://127.0.0.1:5174"'));
  check('legacy_full_flow_no_errors',s.errors.length===0,s.errors);report.requests=urls;await s.close();s=null;
  s=await newSession({size:'390x844'});await s.navigate('http://127.0.0.1:8081/legacy.html?qa=1');await phase(s,'welcome');await capture(s,'original-mobile');check('legacy_mobile_not_forcibly_rotated',await s.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth && getComputedStyle(document.body).transform==="none"'));
  await s.evaluate('__LEGACY_QA__.loseContext();true');await phase(s,'fallback',6000);await capture(s,'original-context-fallback');check('context_loss_leaves_exit_and_retry',await s.evaluate('!document.querySelector("#legacy-fallback").hidden && document.querySelector("#legacy-retry") && document.querySelector("#legacy-skip").href==="http://127.0.0.1:5174/"'));
  report.expectedContextFaultErrors=[...s.errors];await s.close();s=null;
  s=await newSession({size:'1366x768'});await s.call('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)};'});await s.navigate('http://127.0.0.1:8081/legacy.html');await phase(s,'fallback',8000);check('no_webgl_has_explicit_fallback',await s.evaluate('!document.querySelector("#legacy-fallback").hidden'));await s.click('#legacy-fallback-exit');await until(async()=>matchesTarget(await s.evaluate('location.href'),'http://127.0.0.1:5174/'),10000,'fallback actual exit');check('fallback_actual_local_exit',true);report.expectedNoWebGLFaultErrors=[...s.errors];await s.close();s=null;
  s=await newSession({size:'1366x768'});await s.navigate('http://127.0.0.1:8081/legacy.html?skip=1');await until(async()=>matchesTarget(await s.evaluate('location.href'),'http://127.0.0.1:5174/'),10000,'skip actual exit');check('skip_parameter_actual_local_exit',true);check('skip_no_unexpected_errors',s.errors.length===0,s.errors);await s.close();s=null;
  report.ok=true;
 }catch(e){report.ok=false;report.error=String(e.stack||e);if(s){report.browserErrors=[...s.errors];report.current=await s.evaluate('({url:location.href,phase:document.querySelector("#legacy-shell")?.dataset.phase,message:document.querySelector("#legacy-error")?.textContent})').catch(()=>null);await capture(s,'original-failure').catch(()=>{});}process.exitCode=1;}
 finally{if(s)await s.close();fs.writeFileSync(path.join(__dirname,'legacy-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,current:report.current}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
