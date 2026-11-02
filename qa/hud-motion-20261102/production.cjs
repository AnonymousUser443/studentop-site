'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {newSession,until,sleep}=require('../lib.js');
(async()=>{
 let s;const checks=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw new Error(name)};
 try{
  s=await newSession({size:'1440x900',hardwareRendering:true});
  await s.call('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin==='http://127.0.0.1:4174')localStorage.setItem('liyun.exploration.v2',JSON.stringify({version:3,discoveredIds:[],settings:{music:false,autoDegrade:false}}))`});
  await s.navigate('http://127.0.0.1:4174/');
  await until(()=>s.evaluate('Boolean(document.querySelector(".entry-alt"))'),10000,'Production entry');
  check('production omits dev-only debug API',await s.evaluate('window.__LIYUN__===undefined'));
  await s.click('.entry-alt');await sleep(900);
  check('guest enters built HUD',await s.evaluate('document.querySelector(".game-stage").dataset.entered==="true" && !document.querySelector(".hud-frame").inert'));
  await s.click('.hud-brand-badge');
  await until(()=>s.evaluate('Boolean(document.querySelector(".menu-grid"))'),5000,'Lazy menu');
  check('lazy menu shows actual zero progress',await s.evaluate('document.querySelector(".menu-progress").getAttribute("aria-valuenow")==="0"'));
  await sleep(500);await s.click('.menu-grid [aria-label="设置"]');
  await until(()=>s.evaluate('Boolean(document.querySelector("#settings-tab-image"))'),5000,'Lazy settings');
  await s.click('#settings-tab-image');await sleep(300);
  await s.click('[role="switch"][aria-label="减少动态效果"]');
  await until(()=>s.evaluate('document.documentElement.dataset.motion==="reduced"'),3000,'Production motion');
  check('built preference persists',await s.evaluate('JSON.parse(localStorage.getItem("liyun.exploration.v2")).settings.reducedMotion===true'));
  check('retained runtime fonts loaded',await s.evaluate('document.fonts.check("16px \'Noto Serif SC\'") && document.fonts.check("16px \'Ma Shan Zheng\'")'));
  await s.screenshot(path.join(__dirname,'shots','production-settings.png'));
  check('no build runtime or resource errors',s.errors.length===0);
  fs.writeFileSync(path.join(__dirname,'production.json'),JSON.stringify({ok:true,total:checks.length,checks,errors:s.errors},null,2));
  console.log(JSON.stringify({ok:true,total:checks.length}));
 }catch(e){fs.writeFileSync(path.join(__dirname,'production.json'),JSON.stringify({ok:false,error:String(e.stack||e),checks,errors:s?.errors},null,2));console.error(e);process.exitCode=1}
 finally{await s?.close()}
})()
