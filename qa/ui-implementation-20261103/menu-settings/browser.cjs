'use strict';
// Isolated local QA only. Uses an owned temporary Edge profile via the existing repository harness.
const fs = require('node:fs');
const path = require('node:path');
const { newSession, until, sleep } = require('../../lib.js');
// Keep every earlier screenshot and results.json intact.
const out = path.join(__dirname, 'verified-focus-fullscreen-2');
fs.mkdirSync(out, {recursive:true});
const checks = [];
const evidence = { mode: 'Isolated Edge / CDP input, localhost:5176, QA preset only', layouts: [] };
function check(name, pass, detail) { checks.push({ name, pass: Boolean(pass), detail }); }
const snapshot = `(() => {
  const page = document.querySelector('.settings-screen[data-state="open"],.menu-screen[data-state="open"]');
  const bounds = el => { const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
  const visible = el => {const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const small = [...page.querySelectorAll('button,[role="slider"],a')].filter(visible).map(el=>({name:el.getAttribute('aria-label')||el.textContent.trim(),...bounds(el)})).filter(r=>r.width<43.9||r.height<43.9);
  const containers = [...page.querySelectorAll('.menu-scroll,.menu-grid,.menu-card,.menu-footer,.menu-rail,.settings-panel,.settings-rail,.settings-footer')].map(el=>({class:el.className,...bounds(el),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,overflow:getComputedStyle(el).overflowY}));
  return {viewport:[innerWidth,innerHeight],page:page.className,category:page.querySelector('.settings-rail-item[aria-selected="true"]')?.id,bounds:bounds(page),focusInside:page.contains(document.activeElement),focus:{tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label')},small,containers,root:{...document.documentElement.dataset},blur:document.querySelector('.settings-backdrop')?getComputedStyle(document.querySelector('.settings-backdrop')).backdropFilter:'none'};
})()`;

(async()=>{
  let s;
  try {
    s=await newSession({size:'1440x900',hardwareRendering:true});
    await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});
    await s.call('Page.bringToFront');
    const pointerClick=s.click;
    s.click=async(selector)=>{await s.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'});true`);await sleep(80);const box=await s.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await s.call('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await sleep(60);await pointerClick(selector);};
    await s.navigate('http://127.0.0.1:5176/?qa=1&preset=explored');
    await until(()=>s.evaluate('Boolean(window.__LIYUN__&&document.querySelector(".hud-brand-badge"))'),15000,'HUD ready');
    await s.evaluate('window.__LIYUN__.setSettings({autoDegrade:false,music:false}); window.__LIYUN__.freeze(1000);window.__menuQAFrame=requestAnimationFrame(function frame(){window.__menuQAFrame=requestAnimationFrame(frame)});true');
    await sleep(500);
    const key=async(key,code,virtualKey,modifiers=0)=>{await s.call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualKey,modifiers});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualKey,modifiers});await sleep(100);};
    const esc=async()=>{await key('Escape','Escape',27);await sleep(400);};
    const openMenu=async()=>{await s.click('.hud-brand-badge');await until(()=>s.evaluate('Boolean(document.querySelector(".menu-screen[data-state=open]"))'),5000,'Menu opens');await sleep(500);};
    const openSettings=async()=>{await s.click('.menu-grid [aria-label="设置"]');await until(()=>s.evaluate('Boolean(document.querySelector(".settings-screen[data-state=open]"))'),5000,'Settings opens');await sleep(600);};
    const goTab=async(id)=>{await s.click('#settings-tab-'+id);await sleep(500);};

    for (const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,600],[844,390],[667,375]]) {
      await s.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await sleep(250);await openMenu();
      let row=await s.evaluate(snapshot);evidence.layouts.push(row);
      check(`menu ${width}x${height} keeps world visible`,row.bounds.right<=width-70&&row.bounds.height<=height+1,row.bounds);
      check(`menu ${width}x${height} hit areas`,!row.small.length,row.small);
      check(`menu ${width}x${height} owns focus`,row.focusInside,row.focus);
      if(width===1920){await key('Tab','Tab',9,8);check('menu Shift Tab remains trapped',await s.evaluate('document.querySelector(".menu-screen").contains(document.activeElement)'),await s.evaluate('document.activeElement.outerHTML.slice(0,180)'));await key('Tab','Tab',9);check('menu Tab wraps to close',await s.evaluate('document.activeElement===document.querySelector(".menu-close")'),await s.evaluate('document.activeElement.outerHTML.slice(0,180)'));}
      const scroll=row.containers.find(c=>c.class==='menu-scroll'),footer=row.containers.find(c=>c.class==='menu-footer');
      check(`menu ${width}x${height} scroll avoids footer`,scroll.bottom<=footer.y+1,{scroll,footer});
      await s.screenshot(path.join(out,'shots',`menu-${width}x${height}.png`));
      await openSettings();
      row=await s.evaluate(snapshot);evidence.layouts.push(row);
      check(`settings ${width}x${height} hit areas`,!row.small.length,row.small);
      check(`settings ${width}x${height} owns focus`,row.focusInside,row.focus);
      check(`settings ${width}x${height} panel fits`,row.containers.every(c=>c.right<=width+1&&c.bottom<=height+1&&c.scrollWidth<=c.clientWidth+1),row.containers);
      await s.screenshot(path.join(out,'shots',`settings-${width}x${height}.png`));
      for(const category of ['image','sound','message','account','data','other','keys']){await goTab(category);const detail=await s.evaluate(snapshot);evidence.layouts.push(detail);check(`settings ${width}x${height} ${category} fit and hit areas`,!detail.small.length&&detail.containers.every(c=>c.right<=width+1&&c.bottom<=height+1&&c.scrollWidth<=c.clientWidth+1),{small:detail.small,containers:detail.containers});if(width===667)await s.screenshot(path.join(out,'shots',`settings-${category}-${width}x${height}.png`));}
      await esc();await esc();
      check(`return ${width}x${height} restores world focus`,await s.evaluate('document.activeElement===document.querySelector(".hud-brand-badge")'),await s.evaluate('({tag:document.activeElement.tagName,class:document.activeElement.className})'));
    }
    await s.call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await openMenu();
    // Hover outline and rail tooltip are captured from actual pointer state.
    let box=await s.evaluate('(()=>{const r=document.querySelector(".menu-grid [aria-label=设置]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await s.call('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await sleep(200);
    await s.screenshot(path.join(out,'shots','menu-hover.png'));
    await openSettings();
    await s.click('[role="combobox"][aria-label="双击缩放"]');await sleep(150);
    check('select opens above settings',await s.evaluate('Boolean(document.querySelector("[role=listbox]"))'),true);
    await s.screenshot(path.join(out,'shots','settings-select.png'));
    await esc();
    check('first Escape closes only select',await s.evaluate('!document.querySelector("[role=listbox]")&&Boolean(document.querySelector(".settings-screen[data-state=open]"))'),await s.evaluate('({focus:document.activeElement.getAttribute("aria-label"),settings:!!document.querySelector(".settings-screen[data-state=open]")})'));

    // Real Tab/Shift+Tab dispatch tests Radix's focus loop in both directions.
    await s.evaluate('document.querySelector(".settings-close").focus();true');
    await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
    await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
    await sleep(100);
    check('Shift Tab stays in settings',await s.evaluate('document.querySelector(".settings-screen").contains(document.activeElement)'),await s.evaluate('document.activeElement.outerHTML.slice(0,200)'));
    await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await sleep(100);
    check('Tab wraps to close button',await s.evaluate('document.activeElement===document.querySelector(".settings-close")'),await s.evaluate('document.activeElement.outerHTML.slice(0,200)'));

    await goTab('image');
    await s.evaluate('window.__LIYUN__.setQualityPreset("ultra");true');await sleep(250);
    await s.click('[role="combobox"][aria-label="光晕层数"]');await sleep(150);
    await s.click('[role="option"][data-state="unchecked"]');await sleep(350);
    evidence.custom=await s.evaluate('({state:window.__LIYUN__.getState().settings,marks:[...document.querySelectorAll(".settings-row.is-customized")].map(e=>e.getAttribute("aria-label"))})');
    check('custom quality changes only one row',evidence.custom.state.qualityPreset==='custom'&&evidence.custom.marks.length===1,evidence.custom);
    await s.screenshot(path.join(out,'shots','settings-custom.png'));

    await s.click('.settings-footer .settings-btn--secondary');await sleep(150);
    check('defaults requires confirmation',await s.evaluate('Boolean(document.querySelector(".settings-confirm[data-state=open]"))'),true);
    check('confirmation starts on cancel',await s.evaluate('document.activeElement.textContent==="取消"'),await s.evaluate('document.activeElement.textContent'));
    await key('Tab','Tab',9,8);check('confirmation Shift Tab wraps to confirm',await s.evaluate('document.activeElement===document.querySelector(".settings-confirm-actions button:last-child")'),await s.evaluate('document.activeElement.textContent'));await key('Tab','Tab',9);check('confirmation Tab wraps to cancel',await s.evaluate('document.activeElement.textContent==="取消"'),await s.evaluate('document.activeElement.textContent'));
    await s.screenshot(path.join(out,'shots','settings-confirm-defaults.png'));
    await esc();
    check('Escape cancels confirmation and preserves custom',await s.evaluate('!document.querySelector(".settings-confirm[data-state=open]")&&window.__LIYUN__.getState().settings.qualityPreset==="custom"'),true);
    check('confirmation returns focus to opener',await s.evaluate('document.activeElement===document.querySelector(".settings-footer .settings-btn--secondary")'),await s.evaluate('document.activeElement.outerHTML.slice(0,200)'));

    await goTab('data');
    await s.click('.settings-data-card:nth-of-type(2) .settings-btn');await sleep(200);
    await s.screenshot(path.join(out,'shots','settings-confirm-progress.png'));await esc();
    await s.click('.settings-data-card:nth-of-type(3) .settings-btn');await sleep(200);
    await s.screenshot(path.join(out,'shots','settings-confirm-local.png'));await esc();
    await goTab('account');await s.screenshot(path.join(out,'shots','settings-guest.png'));
    await goTab('other');await s.screenshot(path.join(out,'shots','settings-about.png'));

    await s.evaluate('window.__LIYUN__.setSettings({reducedMotion:true});true');await sleep(100);
    evidence.reduced=await s.evaluate('({motion:document.documentElement.dataset.motion,blur:getComputedStyle(document.querySelector(".settings-backdrop")).backdropFilter,sweep:document.querySelector(".settings-rail-sweep")?.getBoundingClientRect().width||0})');
    check('reduced motion removes blur and selected flare',evidence.reduced.motion==='reduced'&&evidence.reduced.blur==='blur(0px)'&&evidence.reduced.sweep===0,evidence.reduced);
    await s.screenshot(path.join(out,'shots','settings-reduced.png'));
    await esc();await esc();
    // Exit is observable immediately, then fully removed.
    await s.evaluate('window.__LIYUN__.setSettings({reducedMotion:false});true');await openMenu();
    await s.click('.menu-close');
    evidence.menuExit=await s.evaluate('({retained:!!document.querySelector(".menu-screen"),state:document.querySelector(".menu-screen")?.dataset.state})');
    check('menu has an observable exit',evidence.menuExit.retained&&evidence.menuExit.state==='closed',evidence.menuExit);
    await sleep(600);
    check('menu exit removes portal and restores focus',await s.evaluate('!document.querySelector(".menu-screen")&&document.activeElement===document.querySelector(".hud-brand-badge")'),true);

    // Cold/lazy opener is explicitly preserved by the parent, including the account pill.
    await s.click('.hud-status .hud-pill:nth-child(2)');await sleep(600);await s.click('.menu-close');await sleep(600);
    check('account pill opener receives returned focus',await s.evaluate('document.activeElement===document.querySelector(".hud-status .hud-pill:nth-child(2)")'),await s.evaluate('document.activeElement.outerHTML.slice(0,200)'));

    // Browser fullscreen stays on documentElement, so body-mounted portals are included.
    await s.click('.hud-status [aria-label="进入全屏"]');
    await until(()=>s.evaluate('Boolean(document.fullscreenElement)'),5000,'Fullscreen enters');
    check('fullscreen root includes the portal host',await s.evaluate('document.fullscreenElement===document.documentElement&&document.fullscreenElement.contains(document.body)'),await s.evaluate('document.fullscreenElement?.tagName'));
    const frontVisible=selector=>s.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect();if(!e||!r)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return document.fullscreenElement?.contains(e)&&r.width>0&&r.height>0&&Number(getComputedStyle(e).opacity)>.99&&(e===hit||e.contains(hit));})()`);
    await openMenu();check('fullscreen menu portal is visible',await frontVisible('.menu-screen'),true);await s.screenshot(path.join(out,'shots','fullscreen-menu.png'));
    await openSettings();check('fullscreen settings portal is visible',await frontVisible('.settings-screen'),true);
    await s.click('[role="combobox"][aria-label="双击缩放"]');await sleep(250);check('fullscreen select portal is visible',await frontVisible('[role="listbox"]'),true);await s.screenshot(path.join(out,'shots','fullscreen-select.png'));await s.click('[role="option"][data-state="checked"]');await sleep(150);
    await s.click('.settings-footer .settings-btn--secondary');await sleep(350);check('fullscreen confirmation portal is visible',await frontVisible('.settings-confirm'),true);await s.screenshot(path.join(out,'shots','fullscreen-confirm.png'));await s.click('.settings-confirm-actions button:first-child');await sleep(300);
    await s.click('.settings-close');await sleep(500);await s.click('.menu-close');await sleep(500);
    check('fullscreen survives page and confirmation navigation',await s.evaluate('document.fullscreenElement===document.documentElement'),true);
    await s.click('.hud-status [aria-label="退出全屏"]');await until(()=>s.evaluate('!document.fullscreenElement'),3000,'Fullscreen exits');

    check('no browser exceptions or failed local requests',!s.errors.length,s.errors);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:checks.every(c=>c.pass),checks,evidence,errors:s.errors},null,2));
    console.log(JSON.stringify({ok:checks.every(c=>c.pass),total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass),errors:s.errors}));
  } catch(error) {
    await s?.screenshot(path.join(out,'shots','failure.png')).catch(()=>{});
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:false,error:String(error.stack||error),checks,evidence,errors:s?.errors},null,2));
    console.error(String(error.stack||error));process.exitCode=1;
  } finally { await s?.close(); }
})();
