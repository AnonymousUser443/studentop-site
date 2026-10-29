'use strict';
// Only this menu and its existing map/collection handoff; no real account or GPS is used.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const {newSession, until, sleep} = require('../lib.js');
const root = path.resolve(__dirname, '../..');
const app = path.join(root, 'apps/liyun-explorer');
const checks = [], layouts = [];
const q = '[data-testid="activity-screen"]';
let session, vite, cache;
function check(name, value, evidence) {
  assert.ok(value, name + (evidence === undefined ? '' : ': ' + JSON.stringify(evidence)));
  checks.push({name, pass:true, ...(evidence === undefined ? {} : {evidence})});
}
async function phase(value='open') { await until(()=>session.evaluate(`document.querySelector('${q}')?.dataset.phase === '${value}'`),6000,'activity '+value); }
async function open() { await session.click('[data-testid="activity-entry"]'); await phase(); }
async function tab(id) { await session.click('[data-testid="activity-tab-'+id+'"]'); await phase(); }
async function key(value) {
  await session.call('Input.dispatchKeyEvent',{type:'keyDown',key:value,code:value,windowsVirtualKeyCode:value==='Escape'?27:value==='Tab'?9:value==='ArrowDown'?40:13});
  await session.call('Input.dispatchKeyEvent',{type:'keyUp',key:value,code:value,windowsVirtualKeyCode:value==='Escape'?27:value==='Tab'?9:value==='ArrowDown'?40:13});
}
async function close() { await session.click('[data-testid="activity-close"]'); await phase('closed'); }
async function layout(width,height) {
  await session.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await sleep(180);
  const evidence = await session.evaluate(`(()=>{
    const selectors=['.activity-close','.activity-primary','.activity-scroll'];
    const rects=selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
    const tabs=[...document.querySelectorAll('.activity-tab')].map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}));
    const strip=document.querySelector('.activity-strip').getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,rects,tabs,stripFraction:strip.height/innerHeight,scrollWidth:document.documentElement.scrollWidth};
  })()`);
  check('controls inside '+width+'x'+height,evidence.rects.every(r=>r.x>=-1&&r.y>=-1&&r.right<=width+1&&r.bottom<=height+1),evidence);
  check('touch targets '+width+'x'+height,evidence.tabs.every(r=>r.height>=44&&r.width>=44) && evidence.rects[0].height>=44 && evidence.rects[1].height>=44);
  check('no document horizontal overflow '+width+'x'+height,evidence.scrollWidth<=width);
  layouts.push(evidence);
  await session.screenshot(path.join(__dirname,`activity-${width}x${height}.png`));
}
(async()=>{
  cache=await fsp.mkdtemp(path.join(os.tmpdir(),'liyun-activity-vite-'));
  const {createServer}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')).href);
  vite=await createServer({root:app,configFile:path.join(app,'vite.config.ts'),cacheDir:cache,
    server:{host:'127.0.0.1',port:0,strictPort:false,open:false},logLevel:'error'});
  await vite.listen();
  const origin='http://127.0.0.1:'+vite.httpServer.address().port;
  session=await newSession({size:'1920x1080',allowPublic:false});
  await session.navigate(origin+'/?qa=1&preset=fog');
  await until(()=>session.evaluate('!!document.querySelector("[data-testid=activity-entry]")'),12000,'map ready');
  check('map HUD removes old ribbons stamina and fabricated identity',await session.evaluate('!document.querySelector(".story-nav") && !document.querySelector(".stamina-display") && !document.body.textContent.includes("LY06112403") && !document.body.textContent.includes("在线 4")'));
  const initial = await session.evaluate('JSON.stringify(window.__LIYUN__.getState())');
  await session.screenshot(path.join(__dirname,'map-entry.png'));
  await session.click('[data-testid="activity-entry"]');
  await sleep(180);
  const entering = await session.evaluate(`({phase:document.querySelector('${q}').dataset.phase,animations:document.querySelector('${q}').getAnimations({subtree:true}).length,backgroundInert:document.querySelector('.game-hud').inert})`);
  check('opening uses native animations while background is inert',entering.backgroundInert&&entering.animations>0,entering);
  await session.screenshot(path.join(__dirname,'activity-opening.png'));
  await phase();
  check('five real directory tabs',await session.evaluate('document.querySelectorAll(".activity-tab[role=tab]").length===5'));
  check('frost is an honest preview',await session.evaluate('document.querySelector("[data-testid=activity-cta]").dataset.action==="preview" && document.querySelector(".activity-paper").textContent.includes("预告")'));
  await layout(1920,1080);
  await session.click('.activity-reward');
  check('reward click explains concept without granting items',await session.evaluate('!!document.querySelector(".activity-reward-tooltip") && document.querySelector(".activity-reward-tooltip").textContent.includes("构想")'));
  await session.click('[data-testid="activity-cta"]');
  check('upcoming CTA shows preview notice',await session.evaluate('!!document.querySelector("[data-testid=activity-notice]")'));
  await tab('four-seasons');
  check('theme changes to seasons',await session.evaluate(`document.querySelector('${q}').dataset.theme === 'seasons'`));
  await session.click('[data-testid="activity-tab-campus-mystery"]');
  await session.click('[data-testid="activity-tab-campus-encounters"]');
  await session.click('[data-testid="activity-tab-personal-archive"]');
  await phase();
  check('rapid switching presents only final archive',await session.evaluate(`document.querySelector('${q}').dataset.eventId === 'personal-archive' && document.querySelectorAll('.activity-paper h3,.activity-paper h1').length<=1 && document.querySelectorAll('.activity-tab[aria-selected=true]').length===1`));
  await session.screenshot(path.join(__dirname,'activity-archive.png'));
  await session.click('[data-testid="activity-cta"]');
  await until(()=>session.evaluate('!!document.querySelector(".collection-modal")'),6000,'real collection');
  check('archive opens actual collection without fake completions',await session.evaluate('document.querySelectorAll(".collection-item.is-known").length===0'));
  await session.evaluate('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("返回活动一览")).click()');
  await phase();
  check('collection return retains selection',await session.evaluate(`document.querySelector('${q}').dataset.eventId === 'personal-archive'`));
  await tab('frost-festival');
  const beforeCamera = await session.evaluate('window.__LIYUN__.getCamera()');
  const navBox=await session.evaluate('(()=>{const r=document.querySelector(".activity-scroll").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await session.call('Input.dispatchMouseEvent',{type:'mouseWheel',...navBox,deltaY:180,deltaX:0});
  await sleep(100);
  check('directory wheel cannot zoom background map',JSON.stringify(beforeCamera)===JSON.stringify(await session.evaluate('window.__LIYUN__.getCamera()')));
  await session.click('[data-testid="activity-map-preview"]');
  await until(()=>session.evaluate('!!document.querySelector("[data-testid=activity-return]")'),6000,'map handoff');
  check('map preview preserves exploration state',initial===await session.evaluate('JSON.stringify(window.__LIYUN__.getState())'));
  check('map preview restores background input',await session.evaluate('!document.querySelector(".game-hud").inert'));
  await session.screenshot(path.join(__dirname,'map-preview.png'));
  await session.click('[data-testid="activity-return"]'); await phase();
  check('map return retains frost selection',await session.evaluate(`document.querySelector('${q}').dataset.eventId === 'frost-festival'`));
  await session.evaluate('document.querySelector("[data-testid=activity-tab-frost-festival]").focus()');
  await key('ArrowDown'); await phase();
  check('keyboard changes directory and moves focus',await session.evaluate(`document.querySelector('${q}').dataset.eventId === 'four-seasons' && document.activeElement.dataset.testid === 'activity-tab-four-seasons'`));
  await key('Escape'); await phase('closed');
  await until(()=>session.evaluate('document.activeElement.dataset.testid === "activity-entry"'),1500,'entry focus after close frame');
  check('Escape restores entry focus and map input',await session.evaluate('document.activeElement.dataset.testid === "activity-entry" && !document.querySelector(".game-hud").inert'));
  await open(); await tab('frost-festival');
  await layout(1366,768); await layout(915,412); await layout(844,390); await layout(740,320);
  await session.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(180);
  check('portrait has usable rotation guidance over menu',await session.evaluate('!!document.querySelector(".orientation-gate") && document.querySelector(".activity-layer").inert'));
  await session.screenshot(path.join(__dirname,'portrait-guide.png'));
  await session.call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  await session.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5}); await sleep(180);
  const touch = await session.evaluate('(()=>{const r=document.querySelector("[data-testid=activity-tab-campus-mystery]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await session.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch,id:1}]});
  await session.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await phase();
  check('landscape touch selects a chapter',await session.evaluate(`document.querySelector('${q}').dataset.eventId === 'campus-mystery'`));
  await session.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); await sleep(120);
  await close(); await open();
  const reduced = await session.evaluate('({leaves:document.querySelectorAll(".activity-artwork-leaf").length,animated:[...document.querySelector("[data-testid=activity-screen]").getAnimations({subtree:true})].filter(a=>a.playState==="running" && a.effect.getTiming().iterations===Infinity).length})');
  check('Reduced Motion stops infinite effects',reduced.animated===0,reduced);
  await session.screenshot(path.join(__dirname,'activity-reduced-motion.png'));
  for(let i=0;i<10;i++){await close();await open();}
  check('ten reopens do not duplicate scene or tabs',await session.evaluate('document.querySelectorAll("[data-testid=activity-screen]").length===1 && document.querySelectorAll(".activity-tab").length===5 && document.querySelectorAll(".activity-artwork").length===1'));
  await close();
  check('closed menu has no running effects',await session.evaluate('!document.querySelector("[data-testid=activity-screen]").getAnimations({subtree:true}).some(a=>a.playState==="running")'));
  check('no browser errors',session.errors.length===0,session.errors);
})().then(()=>{
  const result={ok:true,baseline:'230f80d',scope:'Local activity menu only; no real credentials, GPS, cloud data or production service',checks,layouts,environment:{browser:'Owned headless Microsoft Edge, software rendering',devices:'Emulated CSS viewports and CDP touch; not physical mobile benchmarks'}};
  fs.writeFileSync(path.join(__dirname,'browser-checks.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ok:true,checks:checks.length,layouts:layouts.length}));
}).catch(async error=>{
  let state;
  if(session){try{state=await session.evaluate('({phase:document.querySelector("[data-testid=activity-screen]")?.dataset.phase,event:document.querySelector("[data-testid=activity-screen]")?.dataset.eventId,body:document.body.innerText.slice(-3500),errors:window.__LIYUN__?.getState()})');await session.screenshot(path.join(__dirname,'failure.png'));}catch{}}
  fs.writeFileSync(path.join(__dirname,'browser-failure.json'),JSON.stringify({ok:false,error:error.stack,state,checks},null,2)+'\n');
  console.error(error.stack);process.exitCode=1;
}).finally(async()=>{
  if(session)await session.close(); if(vite)await vite.close();
  if(cache)await fsp.rm(cache,{recursive:true,force:true});
});
