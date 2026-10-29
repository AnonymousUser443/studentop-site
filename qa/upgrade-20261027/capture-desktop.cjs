'use strict';
const fs=require('node:fs'); const path=require('node:path');
const {newSession,until,sleep}=require('../lib.js');
(async()=>{
 const s=await newSession({size:'1440x900'}); const out=__dirname; const report={phase:'early-visual-review',renderer:'isolated Edge / SwiftShader; not physical-device performance evidence',checks:[],screenshots:[]};
 const capture=async name=>{await s.evaluate('document.fonts.ready.then(()=>true)');await sleep(350);await s.screenshot(path.join(out,name+'.png'));report.screenshots.push(name+'.png');};
 const check=async(name,expression)=>{const value=await s.evaluate(expression);report.checks.push({name,pass:!!value});if(!value)throw new Error('Failed '+name);};
 try{
  await s.navigate('http://127.0.0.1:8899/');await until(()=>s.evaluate('Boolean(window.Win&&window.WM&&document.querySelector(".tb-start"))'),8000,'Desktop initialize');
  await check('new wallpaper default','document.documentElement.dataset.wall==="chenyu"');
  await capture('desktop-lock-first');
  await s.click('#lockScreen');await until(()=>s.evaluate('!Win.isLocked()'),4000,'Unlock');await sleep(500);
  await check('desktop width fits','document.documentElement.scrollWidth<=innerWidth+1');
  await capture('desktop-first');
  await s.click('.tb-start');await sleep(300);await capture('start-first');
  await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await s.click('.desktop-icon[data-app="about"]',2);await until(()=>s.evaluate('WM.list().some(w=>w.appId==="about")'),4000,'Open About');await capture('about-first');
  report.desktop=await s.evaluate('({viewport:[innerWidth,innerHeight],theme:Win.prefs.theme,wall:Win.prefs.wall,windows:WM.list().map(w=>({app:w.appId,state:w.state,rect:w.rect})),images:Array.from(document.images).filter(i=>i.src.includes("avatar")).map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0}))})');
  await s.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(400);
  await check('mobile no horizontal overflow','document.documentElement.scrollWidth<=innerWidth+1');await capture('mobile-about-first');
  report.mobile=await s.evaluate('({viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]})');
  if(s.errors.length)throw new Error(JSON.stringify(s.errors)); report.ok=true;
 }catch(e){report.ok=false;report.error=String(e.stack||e);process.exitCode=1;}
 finally{report.errors=s.errors;fs.writeFileSync(path.join(out,'desktop-first-review.json'),JSON.stringify(report,null,2));await s.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
