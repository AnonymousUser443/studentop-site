'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');const assert=require('node:assert/strict');
const {newSession,until,sleep}=require('../lib.js');
const app=path.resolve(__dirname,'../../apps/liyun-explorer'),checks=[],faults=[];let vite,cache,s;
function check(name,value,evidence){assert.ok(value,name+': '+JSON.stringify(evidence));checks.push({name,pass:true,...(evidence===undefined?{}:{evidence})});}
const phase=value=>until(()=>s.evaluate(`document.querySelector('[data-testid=activity-screen]')?.dataset.phase==='${value}'`),5000,value);
async function open(){await s.click('[data-testid=activity-entry]');await phase('open');}
async function fresh(blocked=[]){
  if(s){faults.push(...s.errors);await s.close();}
  s=await newSession({size:'1366x768',allowPublic:false});
  if(blocked.length)await s.call('Network.setBlockedURLs',{urls:blocked});
  await s.navigate('http://127.0.0.1:'+vite.httpServer.address().port+'/?qa=1&preset=fog');
  await until(()=>s.evaluate('!!document.querySelector("[data-testid=activity-entry]")'),12000,'map');
}
async function esc(){await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
(async()=>{
  cache=await fsp.mkdtemp(path.join(os.tmpdir(),'activity-fault-vite-'));
  const {createServer}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')).href);
  vite=await createServer({root:app,configFile:path.join(app,'vite.config.ts'),cacheDir:cache,server:{host:'127.0.0.1',port:0,strictPort:false,open:false},logLevel:'error'});await vite.listen();
  await fresh(['*assets/paintings/*']);await open();
  await until(()=>s.evaluate('document.querySelector(".activity-artwork")?.dataset.artStatus==="unavailable"'),5000,'failed landscape');
  check('failed landscape leaves interactive title and preview',await s.evaluate('document.querySelector("#activity-event-title").textContent==="霜降雅集" && !document.querySelector("[data-testid=activity-cta]").disabled'));
  check('failed landscape pauses decorative loops',await s.evaluate('document.querySelector(".activity-artwork").dataset.paused==="true" && [...document.querySelectorAll(".activity-artwork-leaf")].every(e=>getComputedStyle(e).animationPlayState==="paused")'));
  await s.screenshot(path.join(__dirname,'fallback-landscape.png'));await s.click('[data-testid=activity-close]');await phase('closed');
  check('image failure cannot trap the menu',await s.evaluate('!document.querySelector(".game-hud").inert'));
  await fresh(['*assets/activity/reward-*.webp','*assets/activity/ginkgo-bough.webp','*assets/activity/travel-journal.webp']);await open();
  await until(()=>s.evaluate('document.querySelectorAll(".activity-reward-fallback").length>=4'),5000,'reward fallback');
  check('missing reward images fall back to real icons',await s.evaluate('document.querySelectorAll(".activity-reward-fallback > svg").length>=4'));
  await s.evaluate('document.querySelector(".activity-reward").scrollIntoView({block:"center"});true');
  await s.click('.activity-reward');await until(()=>s.evaluate('!!document.querySelector(".activity-reward-tooltip")'),1500,'fallback reward details');check('fallback reward still explains availability',await s.evaluate('!!document.querySelector(".activity-reward-tooltip")'));
  check('missing foreground art hides broken images',await s.evaluate('[...document.querySelectorAll(".activity-artwork-branch,.activity-artwork-journal")].every(e=>e.hidden && getComputedStyle(e).display==="none")'));
  await s.screenshot(path.join(__dirname,'fallback-rewards.png'));
  await fresh();await s.click('[data-testid=activity-entry]');await sleep(70);await s.click('[data-testid=activity-close]');await phase('closed');
  check('closing during opening cancels its timeline',await s.evaluate('!document.querySelector(".game-hud").inert && document.querySelectorAll(".activity-artwork").length===0'));
  await open();await s.click('[data-testid=activity-map-preview]');await esc();await phase('closed');await sleep(650);
  check('Escape cancels pending map navigation',await s.evaluate('!document.querySelector("[data-testid=activity-return]") && window.__LIYUN__.getState().discoveredIds.length===0'));
  await open();
  await s.evaluate('window.__activityTestHidden=true;Object.defineProperty(document,"hidden",{configurable:true,get:()=>window.__activityTestHidden});document.dispatchEvent(new Event("visibilitychange"));true');await sleep(50);
  check('synthetic hidden signal pauses visible menu effects',await s.evaluate('document.querySelector(".activity-artwork").dataset.paused==="true" && [...document.querySelectorAll(".activity-artwork-leaf")].every(e=>getComputedStyle(e).animationPlayState==="paused")'));
  await s.evaluate('window.__activityTestHidden=false;document.dispatchEvent(new Event("visibilitychange"));true');await sleep(50);
  check('synthetic foreground signal resumes effects',await s.evaluate('document.querySelector(".activity-artwork").dataset.paused==="false"'));
  await s.evaluate('document.querySelector("[data-testid=activity-close]").focus();true');
  await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
  await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
  check('Shift Tab stays inside the activity dialog',await s.evaluate('document.querySelector("[data-testid=activity-screen]").contains(document.activeElement) && !document.querySelector(".game-hud").contains(document.activeElement)'));
  faults.push(...s.errors);
  check('no JavaScript exceptions in failure scenarios',!faults.some(e=>e.startsWith('EXCEPTION:')),faults.filter(e=>e.startsWith('EXCEPTION:')));
})().then(()=>{fs.writeFileSync(path.join(__dirname,'fallbacks-checks.json'),JSON.stringify({ok:true,checks,expectedNetworkFaults:faults,limitations:'Hidden state was an explicitly synthetic visibility signal; image failures used real browser URL blocking. No physical performance or mobile hardware claim.'},null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length}));}).catch(async error=>{if(s)try{await s.screenshot(path.join(__dirname,'fallback-failure.png'));}catch{}fs.writeFileSync(path.join(__dirname,'fallbacks-failure.json'),JSON.stringify({ok:false,error:error.stack,checks,errors:s?.errors},null,2)+'\n');console.error(error.stack);process.exitCode=1;}).finally(async()=>{if(s)await s.close();if(vite)await vite.close();if(cache)await fsp.rm(cache,{recursive:true,force:true});});
