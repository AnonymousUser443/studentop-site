'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {newSession,until,sleep}=require('../lib.js');
const {startFixture}=require('./fixture.cjs');
const {login}=require('../revision-20261028/fixture.cjs');
const checks=[];let s,f;
const frame='window.document.querySelector(".task-manager-frame").contentDocument';
function check(name,value,evidence){assert.ok(value,name+(evidence===undefined?'':': '+JSON.stringify(evidence)));checks.push({name,pass:true,...(evidence===undefined?{}:{evidence})});}
async function inner(expr){return s.evaluate(`(()=>{const document=${frame};const innerWidth=document.documentElement.clientWidth;const Event=document.defaultView.Event;return (${expr})})()`);}
async function clickInner(selector){
  const point=await s.evaluate(`(()=>{const f=document.querySelector('.task-manager-frame'),d=f.contentDocument,e=d.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;const a=f.getBoundingClientRect(),b=e.getBoundingClientRect();return {x:a.x+b.x+b.width/2,y:a.y+b.y+b.height/2}})()`);
  assert.ok(point,'frame target '+selector);await s.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await s.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
}
async function live(){await until(()=>inner('document.querySelector("#connectionState")?.dataset.reason==="live"'),8000,'real proxied fixture data');}
(async()=>{
  f=await startFixture();s=await newSession({size:'1600x1000',allowPublic:false});await login(s,f);
  check('desktop and start list register native monitor',await s.evaluate('!!Win.apps["rpi-task-manager"] && !Win.apps["rpi-task-manager"].external && SITE.desktop.includes("rpi-task-manager") && SITE.startPinned.includes("rpi-task-manager")'));
  await s.evaluate('WM.launch("projects");true');
  await until(()=>s.evaluate('!!document.querySelector("[data-native-project=rpi-task-manager]")'),4000,'native project entry');
  await until(()=>s.evaluate('!WM.byApp("projects")[0].opening'),2000,'project window settled');
  await s.evaluate('document.querySelector("[data-native-project=rpi-task-manager]").scrollIntoView({block:"center"});true');
  await s.click('[data-native-project="rpi-task-manager"]');
  await until(()=>s.evaluate('!!document.querySelector(".task-manager-frame")?.contentDocument?.querySelector("#connectionState")'),8000,'monitor iframe');await live();
  check('monitor runs inside desktop window',await s.evaluate('document.querySelectorAll(".window[data-app=rpi-task-manager]").length===1 && document.querySelector(".task-manager-frame").contentWindow.location.origin===location.origin'));
  check('project card launches the native monitor',await s.evaluate('WM.byApp("rpi-task-manager").length===1'));
  await s.evaluate('WM.byApp("projects").forEach(WM.close);true');
  await s.evaluate('WM.launch("rpi-task-manager");true');check('relaunch focuses single existing window',await s.evaluate('document.querySelectorAll(".window[data-app=rpi-task-manager]").length===1'));
  check('four synthetic logical cores and real fixture identity',await inner('document.querySelectorAll("#resourceBody canvas.chart").length===4 && document.querySelector("#hostTag").textContent==="synthetic-qa-monitor"'));
  if(await s.evaluate('!!document.querySelector(".toast-dismiss")'))await s.click('.toast-dismiss');
  await sleep(1700);
  await s.screenshot(path.join(__dirname,'monitor-performance.png'));
  await clickInner('[data-view="processes"]');await until(()=>inner('document.querySelectorAll(".process-row").length===2'),6000,'process table');
  check('processes are returned by authenticated proxy',await inner('document.querySelector("#processTableBody").textContent.includes("qa-sampler")'));
  await clickInner('#processSearch');await s.call('Input.insertText',{text:'qa-worker'});
  check('process search filters by supplied data',await inner('document.querySelectorAll(".process-row").length===1 && document.querySelector("#processTableBody").textContent.includes("qa-worker")'));
  await clickInner('[data-sort="pid"]');check('process sorting reports accessible state',await inner('document.querySelector("[data-sort=pid]").closest("th").getAttribute("aria-sort")==="ascending"'));
  await s.screenshot(path.join(__dirname,'monitor-processes.png'));
  await clickInner('[data-view="settings"]');await inner('(()=>{const e=document.querySelector("#themeSelect");e.value="light";e.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  check('local theme setting works inside isolated document',await inner('document.documentElement.dataset.theme==="light"'));
  await clickInner('[data-view="system"]');await until(()=>inner('document.querySelector("#systemCards").textContent.includes("Fixture OS")'),2000,'system view routed');check('system view uses fixture OS and removes SSH action',await inner('document.querySelector("#systemCards").textContent.includes("Fixture OS") && !document.querySelector("#copySshButton")'));
  await clickInner('#pauseButton');await until(()=>f.streams()===0,4000,'manual pause closes SSE');
  check('manual pause closes upstream data stream',f.streams()===0);
  await s.click('.window[data-app="rpi-task-manager"] .caption-min');await sleep(150);await s.evaluate('WM.launch("rpi-task-manager");true');await sleep(300);
  check('window restore respects manual pause',await inner('document.querySelector("#connectionState").lastElementChild.textContent==="已暂停"')&&f.streams()===0);
  await clickInner('#pauseButton');await live();await until(()=>f.streams()===1,4000,'one restored stream');
  await s.click('.window[data-app="rpi-task-manager"] .caption-min');await until(()=>f.streams()===0,4000,'minimize closes SSE');check('minimize suspends real upstream stream',f.streams()===0);
  await s.evaluate('WM.launch("rpi-task-manager");true');await live();check('restore reconnects one stream',f.streams()===1);
  await s.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(250);
  check('monitor supports phone window without document overflow',await inner('document.documentElement.scrollWidth<=innerWidth'));
  await s.screenshot(path.join(__dirname,'monitor-phone.png'));
  await s.call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await sleep(150);
  f.fail();await until(()=>inner('document.querySelector("#footerStatus").textContent.includes("暂不可用")'),7000,'honest offline state');
  check('offline keeps last sample with explicit unavailable status',await inner('document.querySelector("#connectionState").dataset.reason==="offline" && document.querySelector("#footerStatus").textContent.includes("暂不可用")'));
  await s.screenshot(path.join(__dirname,'monitor-unavailable.png'));
  f.restore();await clickInner('#refreshButton');await live();await until(()=>f.streams()===1,6000,'recovery reconnects stream');
  check('service recovery and refresh restore continuous stream',f.streams()===1);
  // Expected failed fixture upstream requests are part of the offline scenario above.
  check('no JavaScript exceptions',!s.errors.some(e=>e.startsWith('EXCEPTION:')),s.errors.filter(e=>e.startsWith('EXCEPTION:')));
  await s.click('.window[data-app="rpi-task-manager"] .caption-close');await until(()=>s.evaluate('!document.querySelector(".task-manager-frame")'),2000,'close destroys owned document');
  check('close destroys document and streams',f.streams()===0);
  f.fail();await s.evaluate('WM.launch("rpi-task-manager");true');await until(()=>s.evaluate('!!document.querySelector(".task-manager-frame")?.contentDocument?.querySelector("#connectionState")'),5000,'reopened monitor');
  await until(()=>inner('document.querySelector("#footerStatus").textContent.includes("暂不可用")'),7000,'first request unavailable');
  check('initial unavailable service does not fabricate graphs',await inner('document.querySelectorAll("#resourceBody canvas.chart").length===0 && document.querySelector("#resourceBody").textContent.includes("等待第一次采样")'));
  f.restore();await clickInner('#refreshButton');await live();await until(()=>f.streams()===1,6000,'initial503 recovery');
  check('initial failed EventSource recovers after service and refresh',f.streams()===1);
  await s.evaluate('DesktopGate.lock().then(()=>true)');await until(()=>s.evaluate('!document.querySelector(".task-manager-frame")'),3000,'lock disposes monitor');
  check('desktop lock disposes monitor document',!await s.evaluate('!!document.querySelector(".task-manager-frame")'));
})().then(()=>{fs.writeFileSync(path.join(__dirname,'browser-checks.json'),JSON.stringify({ok:true,checks,scope:'Only native monitor window with synthetic local sampler; no Pi access, no private host data',environment:'Owned headless Microsoft Edge, 1600x1000 and emulated390x844'},null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length}));}).catch(async e=>{if(s)try{await s.screenshot(path.join(__dirname,'failure.png'));}catch{}fs.writeFileSync(path.join(__dirname,'failure.json'),JSON.stringify({ok:false,error:e.stack,checks,errors:s?.errors},null,2)+'\n');console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(s)await s.close();if(f)await f.close();});
