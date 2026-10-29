'use strict';
const fs=require('node:fs');const path=require('node:path');const {newSession,until,sleep}=require('../lib.js');
const report={method:'isolated Edge CDP mouse/key/touch input plus DOM geometry; emulated sizes, not physical devices',viewports:[],checks:[],screenshots:[]};
(async()=>{
 for(const [width,height] of [[1440,900],[1920,1080],[1366,768],[390,844]]){
  const s=await newSession({size:width+'x'+height});const size=width+'x'+height;
  const check=(name,pass,detail)=>{report.checks.push({viewport:size,name,pass:!!pass,detail});if(!pass)throw new Error(size+' '+name);};
  const evaluate=expression=>s.evaluate(expression);
  const esc=async()=>{await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(230);};
  const capture=async name=>{await evaluate('document.fonts.ready.then(()=>true)');await sleep(300);const file=name+'-'+width+'.png';await s.screenshot(path.join(__dirname,file));report.screenshots.push(file);};
  const move=async(x,y,buttons=0)=>s.call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,buttons});
  const down=async(x,y,button='left')=>s.call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,clickCount:1});
  const up=async(x,y,button='left')=>s.call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,clickCount:1});
  try{
   await s.navigate('http://127.0.0.1:8899/?skipLock=1');await until(()=>evaluate('Boolean(window.WM && window.Shell && !Win.isLocked())'),7000,'desktop');await evaluate('Win.clearNotifications();true');if(await evaluate('!!document.querySelector(".toast-dismiss")')) await s.click('.toast-dismiss');await sleep(350);
   check('clean_first_desktop',await evaluate('WM.list().length===0'));
   await capture('desktop');
   const geometry=await evaluate('(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};const hit=id=>{const r=rect(id);const el=document.elementFromPoint(r.x+r.w/2,r.y+r.h/2);return !!el&&!!el.closest("#"+id);};return {center:rect("tbCenter"),right:rect("tbRight"),show:rect("showDesktopBtn"),hits:Object.fromEntries(["trayTray","trayClock","notifBtn","showDesktopBtn"].map(id=>[id,hit(id)]))};})()');
   check('taskbar_regions_disjoint',geometry.center.right<=geometry.right.x+1&&geometry.right.right<=geometry.show.x+1,geometry);
   check('taskbar_controls_hit_test',Object.values(geometry.hits).every(Boolean),geometry.hits);
   await s.click('#trayTray');await sleep(250);check('quick_settings_pointer_open',await evaluate('!!document.querySelector(".quick-settings")'));await esc();
   await s.click('#trayClock');await sleep(250);check('calendar_pointer_open',await evaluate('!!document.querySelector(".cal-month")'));await esc();
   await s.click('#startBtn');await sleep(250);check('start_pointer_open',await evaluate('!!document.querySelector("[data-flyout=start]")'));await capture('desktop-start');await esc();
   if(width===390){
    await s.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const p=await evaluate('(()=>{const r=document.querySelector(".desktop-icon[data-app=about]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await s.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await s.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await until(()=>evaluate('WM.isRunning("about")'),3000,'touch single tap');check('touch_single_tap_opens',true);await capture('desktop-about');
   }else{
    await s.click('.desktop-icon[data-app="about"]',2);await until(()=>evaluate('WM.isRunning("about")'),3000,'double click');check('double_click_opens',true);await sleep(300);
    const before=await evaluate('({...WM.byApp("about")[0].rect})');const x=before.x+220,y=before.y+20;
    await move(x,y);await down(x,y);await move(x+45,y+40,1);await move(x+90,y+80,1);await up(x+90,y+80);await sleep(200);
    const after=await evaluate('({...WM.byApp("about")[0].rect})');check('titlebar_mouse_drag',after.x>before.x+30&&after.y>before.y+30,{before,after});
    const handle=await evaluate('(()=>{const r=WM.byApp("about")[0].el.querySelector(".rs-handle[data-dir=se]").getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,hit:hit?.className,canResize:!!hit?.closest(".rs-handle")};})()');check('resize_handle_hit_test',handle.canResize,handle);
    await move(handle.x,handle.y);await down(handle.x,handle.y);await move(handle.x+45,handle.y+35,1);await up(handle.x+45,handle.y+35);await sleep(200);
    const resized=await evaluate('({...WM.byApp("about")[0].rect})');check('resize_handle_mouse_drag',resized.w>after.w+15,{after,resized});
    await s.click('.window.is-active .caption-max');await sleep(300);check('caption_maximize',await evaluate('WM.byApp("about")[0].state==="max"'));await s.click('.window.is-active .caption-max');await sleep(300);
   }
   await evaluate('["about","projects","skills","contact","cv","thispc","terminal","notepad","photos","settings","recycle"].forEach(id=>WM.launch(id));true');await sleep(400);
   check('multi_app_stress_count',await evaluate('WM.list().length===11'));
   const collision=await evaluate('(()=>{const c=document.getElementById("tbCenter").getBoundingClientRect(),r=document.getElementById("tbRight").getBoundingClientRect();return c.right<=r.left+1&&document.documentElement.scrollWidth<=innerWidth+1;})()');check('multi_app_taskbar_no_overlap',collision);
   await s.click('#showDesktopBtn');await sleep(400);check('show_desktop_real_click',await evaluate('WM.list().every(w=>w.state==="min")'));await s.click('#showDesktopBtn');await sleep(400);check('show_desktop_restore_real_click',await evaluate('WM.list().some(w=>w.state!=="min")'));
   await evaluate('WM.closeAll();true');await sleep(350);await evaluate('Win.setPref("themeMode","dark");true');await s.click('#startBtn');await sleep(250);await capture('desktop-dark');await esc();
   check('dark_theme_applied',await evaluate('document.documentElement.dataset.theme==="dark"'));
   await s.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(150);
   check('system_reduced_motion',await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches && getComputedStyle(document.querySelector(".taskbar")).animationName==="none"'));
   check('no_runtime_or_network_errors',s.errors.length===0,s.errors);report.viewports.push({width,height,ok:true});
  }catch(e){report.error=String(e.stack||e);report.errors=s.errors;report.viewports.push({width,height,ok:false});process.exitCode=1;break;}
  finally{await s.close();}
 }
 report.ok=!report.error&&report.viewports.length===4;fs.writeFileSync(path.join(__dirname,'desktop-matrix.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,viewports:report.viewports,checks:report.checks.length,error:report.error}));
})().catch(e=>{console.error(e);process.exitCode=1;});
