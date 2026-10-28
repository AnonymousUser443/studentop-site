'use strict';
const fs=require('node:fs'),path=require('node:path');
const {newSession,until,sleep}=require('../lib.js');
const {startFixture}=require('./fixture.cjs');
const report={method:'isolated Edge/CDP, actual browser input with synthetic private verifier; emulated sizes, no physical-device claim',checks:[],screenshots:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw new Error(name);};
const key=async(s,key,code=key,windowsVirtualKeyCode=key==='Enter'?13:key==='Escape'?27:9,extra={})=>{await s.call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{}),...extra});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode,...extra});};
const phase=(s,p)=>until(()=>s.evaluate('document.querySelector("#lockScreen")?.dataset.gatePhase==='+JSON.stringify(p)),8000,'gate phase '+p);
const ready=s=>until(()=>s.evaluate('document.querySelector("#lockScreen")?.dataset.gateStatus==="ready"'),8000,'gate ready');
const capture=async(s,name)=>{await s.evaluate('document.fonts.ready.then(()=>true)');const file=name+'.png';await s.screenshot(path.join(__dirname,file));report.screenshots.push(file);};
async function submit(s,text){await s.click('#gateAnswer');await s.call('Input.insertText',{text});await s.click('#gateSubmit');}
async function signin(s,f,{navigate=true}={}){
 if(navigate)await s.navigate(f.origin+'/');
 await until(()=>s.evaluate('!!window.DesktopGate'),5000,'gate initialized');
 if(await s.evaluate('document.querySelector("#lockScreen").dataset.gateView==="boot"'))await s.click('#gateSkip');
 await phase(s,'clock');await ready(s);await s.click('#gateLogin');await phase(s,'question');await submit(s,f.answer);
 await until(()=>s.evaluate('!Win.isLocked() && !document.querySelector("#desktop").inert'),8000,'authenticated desktop');
 await sleep(250);if(await s.evaluate('!!document.querySelector(".toast-dismiss")'))await s.click('.toast-dismiss');await sleep(220);
}
(async()=>{
 const f=await startFixture();let s;
 try{
  s=await newSession({size:'1440x900'});await s.navigate(f.origin+'/?skipLock=1&open=about');
  await phase(s,'bios');check('first_visit_bios_is_presentation',await s.evaluate('Win.isLocked() && document.querySelector("#desktop").inert'));await capture(s,'boot-bios');
  await phase(s,'logo');check('specified_logo_loaded',await s.evaluate('document.querySelector(".gate-logo").complete && document.querySelector(".gate-logo").naturalWidth===1046'));await capture(s,'boot-logo');
  await phase(s,'clock');await ready(s);check('startup_does_not_authorize',await s.evaluate('Win.isLocked() && WM.list().length===0'));await capture(s,'lock-clock');
  await s.evaluate('sessionStorage.setItem("win11home.unlocked","1");true');await s.navigate(f.origin+'/?skipLock=1&open=about');await phase(s,'clock');await ready(s);
  check('old_flag_and_skip_parameter_cannot_unlock',await s.evaluate('Win.isLocked() && WM.list().length===0 && document.querySelector("#desktop").inert'));
  await key(s,'Enter');await phase(s,'question');check('enter_opens_question_only',await s.evaluate('Win.isLocked()'));check('password_input_has_accessible_label',await s.evaluate('gateAnswer.type==="password" && !!document.querySelector("label[for=gateAnswer]")'));
  await s.click('#gateReveal');check('reveal_is_explicit',await s.evaluate('gateAnswer.type==="text"'));await s.click('#gateReveal');
  await key(s,'Escape');await phase(s,'clock');check('escape_returns_without_unlock',await s.evaluate('Win.isLocked()'));await s.click('#gateLogin');
  for(let n=1;n<=3;n++){await submit(s,'not the synthetic answer '+n);await until(()=>s.evaluate('document.querySelector("#lockScreen").dataset.gateStatus==='+JSON.stringify(n<3?'denied':'cooldown')),8000,'attempt '+n);check('attempt_'+n+'_clears_secret_field',await s.evaluate('gateAnswer.value===""'));check('attempt_'+n+'_keeps_locked',await s.evaluate('Win.isLocked()'));}
  check('third_failure_disables_form',await s.evaluate('gateAnswer.disabled && gateSubmit.disabled && !gateCountdown.hidden'));await capture(s,'lock-cooldown');
  await s.navigate(f.origin+'/?skipLock=1');await phase(s,'clock');await s.click('#gateLogin');await phase(s,'question');check('refresh_retains_cooldown',await s.evaluate('gateSubmit.disabled && document.querySelector("#lockScreen").dataset.gateStatus==="cooldown"'));
  await s.call('Network.clearBrowserCookies');await s.navigate(f.origin+'/');await phase(s,'clock');await s.click('#gateLogin');await phase(s,'question');check('cookie_reset_retains_server_cooldown',await s.evaluate('gateSubmit.disabled && document.querySelector("#lockScreen").dataset.gateStatus==="cooldown"'));
  f.advance(300_500);await s.navigate(f.origin+'/');await signin(s,f,{navigate:false});check('cooldown_expiry_allows_real_server_verification',await s.evaluate('!Win.isLocked()'));
  await s.navigate(f.origin+'/?open=about');await until(()=>s.evaluate('!!window.WM && !Win.isLocked() && WM.isRunning("about")'),8000,'session restored deep link');check('valid_session_restore_and_deeplink',true);
  await s.evaluate('Win.showLock();true');await phase(s,'clock');await ready(s);await s.navigate(f.origin+'/?skipLock=1');await phase(s,'clock');await ready(s);check('explicit_lock_revokes_session_after_refresh',await s.evaluate('Win.isLocked()'));
  await signin(s,f,{navigate:false});await s.evaluate('WM.closeAll();true');await sleep(300);
  const regression=await s.evaluate(fs.readFileSync(path.join(__dirname,'../desktop-upgrade.js'),'utf8'));check('previous_desktop_regression',regression.ok,regression.checks.length);report.previousRegression=regression;
  const expected=e=>/^HTTP (401|429): .*\/__desktop\/auth$/.test(e);
  check('flow_has_no_unexpected_errors',s.errors.filter(e=>!expected(e)).length===0,s.errors.filter(e=>!expected(e)));report.expectedAuthenticationRejections=s.errors.filter(expected);await s.close();s=null;
  for(const [width,height] of [[1440,900],[1920,1080],[1366,768],[390,844]]){
   s=await newSession({size:width+'x'+height});await signin(s,f);const prefix=width+'x'+height;
   check(prefix+'_taskbar_hit_targets',await s.evaluate('(()=>{return ["trayTray","trayClock","notifBtn","showDesktopBtn"].every(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("#"+id);});})()'));
   check(prefix+'_both_opening_entries',await s.evaluate('!!document.querySelector(".desktop-icon[data-app=genshin-original]") && !!document.querySelector(".desktop-icon[data-app=genshin-start]")'));
   await s.click('#notifBtn');await sleep(250);await key(s,'Escape');await sleep(250);check(prefix+'_notification_focus_return',await s.evaluate('document.activeElement.id==="notifBtn"'));
   await s.click('#startBtn');await sleep(250);await capture(s,'desktop-start-'+width);await key(s,'Escape');await sleep(220);
   if(width>900){
    await s.click('.desktop-icon[data-app=about]',2);await until(()=>s.evaluate('WM.isRunning("about")'),3000,'about launch');await sleep(300);
    const drag=async(dx,dy)=>{const p=await s.evaluate('(()=>{const w=WM.byApp("about")[0],r=w.el.querySelector(".titlebar").getBoundingClientRect();return {x:'+ (dx<0?'r.right-200':'r.left+100') +',y:Math.max(5,r.y+20)};})()');const end={x:Math.max(30,Math.min(width-30,p.x+dx)),y:Math.max(30,Math.min(height-95,p.y+dy))};await s.call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await s.call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await s.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:(p.x+end.x)/2,y:(p.y+end.y)/2,buttons:1});await s.call('Input.dispatchMouseEvent',{type:'mouseMoved',...end,buttons:1});await s.call('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});await sleep(150);};
    await drag(-900,80);let rect=await s.evaluate('({...WM.byApp("about")[0].rect})');check(prefix+'_actual_left_overflow',rect.x<0,rect);
    const before=rect;await s.evaluate('WM.minimize(WM.byApp("about")[0]);WM.restore(WM.byApp("about")[0]);true');await sleep(450);rect=await s.evaluate('({...WM.byApp("about")[0].rect})');check(prefix+'_restore_preserves_overflow',rect.x===before.x,rect);
    await capture(s,'window-overflow-'+width);await s.evaluate('WM.moveIntoView(WM.byApp("about")[0]);true');await sleep(250);
    rect=await s.evaluate('({...WM.byApp("about")[0].rect})');check(prefix+'_explicit_recover_to_screen',rect.x>=0&&rect.y>=0,rect);
    await drag(width,height);rect=await s.evaluate('({...WM.byApp("about")[0].rect})');check(prefix+'_actual_right_and_bottom_overflow',rect.x+rect.w>width&&rect.y+rect.h>height-60,rect);
    await s.evaluate('WM.moveIntoView(WM.byApp("about")[0]);true');
    await s.click('.window.is-active .caption-max');await s.click('.window.is-active .caption-max');check(prefix+'_maximize_restore_works',await s.evaluate('WM.byApp("about")[0].state==="normal"'));
   } else {
    await s.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});const p=await s.evaluate('(()=>{const r=document.querySelector(".desktop-icon[data-app=about]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');await s.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await s.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(()=>s.evaluate('WM.isRunning("about")'),3000,'touch launch');check(prefix+'_touch_open',true);await capture(s,'desktop-mobile-about');
   }
   await s.evaluate('["about","projects","skills","contact","cv","thispc","terminal","notepad","photos","settings","recycle"].forEach(id=>WM.launch(id));true');await sleep(350);check(prefix+'_eleven_apps_stress',await s.evaluate('WM.list().length===11 && document.documentElement.scrollWidth<=document.documentElement.clientWidth'));
   await s.click('#showDesktopBtn');await sleep(300);check(prefix+'_show_desktop',await s.evaluate('WM.list().every(w=>w.state==="min")'));await s.click('#showDesktopBtn');await sleep(300);check(prefix+'_restore_desktop',await s.evaluate('WM.list().some(w=>w.state!=="min")'));
   await s.evaluate('WM.closeAll();Win.setPref("themeMode","dark");true');await sleep(300);await s.click('#startBtn');await sleep(200);await capture(s,'desktop-dark-'+width);await key(s,'Escape');
   await s.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});check(prefix+'_reduced_motion',await s.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'));
   check(prefix+'_no_unexpected_errors',s.errors.length===0,s.errors);await s.close();s=null;
  }
  // Separate fresh mobile boot, with reduced motion already set before first navigation.
  s=await newSession({size:'390x844'});await s.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await s.navigate(f.origin+'/');await phase(s,'clock');await ready(s);check('reduced_motion_first_visit_skips_wait',await s.evaluate('document.querySelector("#gateBoot").hidden && Win.isLocked()'));await s.click('#gateLogin');await capture(s,'lock-mobile');
  const layout=await s.evaluate('(()=>{const r=gateForm.getBoundingClientRect();return {left:r.left,right:r.right,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth};})()');check('mobile_question_fits_viewport',layout.left>=0&&layout.right<=layout.client&&layout.scroll<=layout.client,layout);
  check('mobile_no_unexpected_errors',s.errors.length===0,s.errors);await s.close();s=null;
  report.ok=true;
 }catch(e){report.ok=false;report.error=String(e.stack||e);if(s){report.browserErrors=[...s.errors];await capture(s,'failure').catch(()=>{});}process.exitCode=1;}
 finally{if(s)await s.close();await f.close();fs.writeFileSync(path.join(__dirname,'desktop-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,screenshots:report.screenshots.length}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
