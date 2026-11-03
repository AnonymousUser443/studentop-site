'use strict';
// Supplements, and never reruns, menu114 / pressed-hitarea36 / HUD45.
// Native CDP pointer/key input drives real states. No DOM classes/pseudo-state forcing.
const fs = require('node:fs');
const path = require('node:path');
const {newSession, until, sleep} = require('../../lib.js');
const out = process.env.CONTROL_QA_OUT ? path.resolve(process.env.CONTROL_QA_OUT) : __dirname;
const mode = process.env.CONTROL_QA_MODE || 'all';
const only = process.env.CONTROL_QA_ONLY ? new Set(process.env.CONTROL_QA_ONLY.split(',')) : null;
const base = process.env.CONTROL_QA_URL || 'http://127.0.0.1:5176/';
fs.mkdirSync(out, {recursive:true});
const checks = [], samples = [], businessStates = [], safeAreas = [], pressedHitAreas = [];
const check = (name, pass, detail) => checks.push({name, pass:Boolean(pass), detail});
const visualProps = ['color','backgroundColor','backgroundImage','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','borderTopWidth','borderRadius','boxShadow','opacity','filter','transform','outlineColor','outlineStyle','outlineWidth','outlineOffset','fill','stroke','strokeWidth'];
function differences(a,b) {
  const result = [];
  for (const key of new Set([...Object.keys(a.visual||{}),...Object.keys(b.visual||{})])) {
    if (a.visual?.[key] !== b.visual?.[key]) result.push({property:key,from:a.visual?.[key],to:b.visual?.[key]});
  }
  return {count:result.length,examples:result.slice(0,16)};
}
(async () => {
  let s;
  const evidence = {scope:'Owned temporary Edge, localhost DEV isolated QA; no physical phone/GPS claim',controls:20,mode};
  try {
    s = await newSession({size:'1440x900',hardwareRendering:true});
    await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});
    // The four-state matrix explicitly exercises ordinary motion; reduced UI is
    // exercised by the safe-area/held-target phase. Never inherit a host OS toggle.
    await s.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await s.call('Page.bringToFront');
    // Hold only the hardware provider for a real locating/pending state. It emits
    // no coordinates and does not bypass the production check-in predicate.
    await s.call('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(navigator,'geolocation',{value:{watchPosition(){window.__pendingGeoCalls=(window.__pendingGeoCalls||0)+1;return 1},clearWatch(){}}});HTMLMediaElement.prototype.play=async function(){};`});
    const key = async (name,code,vk,modifiers=0) => {
      for (const type of ['keyDown','keyUp']) await s.call('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:vk,modifiers});
      await sleep(80);
    };
    const escape = () => key('Escape','Escape',27);
    const api = code => s.evaluate(`(()=>{${code};return true})()`);
    const point = async selector => {
      await s.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});return true})()`);
      await sleep(80);
      return s.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    };
    const move = p => s.call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
    const pointer = (type,p) => s.call('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
    const click = async (selector,settleMs=430) => {
      const p = await point(selector); await move(p); await sleep(90);
      await pointer('mousePressed',p); await pointer('mouseReleased',p); await sleep(settleMs);
    };
    const neutral = async selector => {
      const p = selector ? await point(selector) : await s.evaluate('({x:innerWidth/2,y:6})');
      await move(p); await pointer('mousePressed',p); await pointer('mouseReleased',p); await sleep(350);
    };
    const focusByTab = async selector => {
      for (let i=0;i<150;i++) {
        await key('Tab','Tab',9);
        const reached = await s.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`);
        if (reached) {await sleep(150);return {reached:true,tabs:i+1};}
      }
      return {reached:false,tabs:150};
    };
    const snapshot = selector => s.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return {missing:true};const visual={},names=${JSON.stringify(visualProps)},nodes=[e,...[...e.querySelectorAll('*')].slice(0,18)];nodes.forEach((n,i)=>{for(const pseudo of [null,'::before','::after']){const c=getComputedStyle(n,pseudo);if(pseudo&&c.content==='none')continue;for(const k of names)visual[i+(pseudo||'')+'.'+k]=c[k]}});const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:e.getAttribute('aria-label')||e.textContent.trim(),rect:r.toJSON(),hit:hit?.className?.baseVal??hit?.className,inert:!!e.closest('[inert]'),documentFocus:document.hasFocus(),activeLabel:document.activeElement?.getAttribute('aria-label')||document.activeElement?.tagName,enabled:!e.disabled&&e.getAttribute('aria-disabled')!=='true',hover:e.matches(':hover'),active:e.matches(':active'),focus:e===document.activeElement,focusVisible:e.matches(':focus-visible'),cursor:getComputedStyle(e).cursor,text:e.textContent.trim(),expanded:e.getAttribute('aria-expanded'),state:e.getAttribute('data-state'),busy:e.getAttribute('aria-busy'),visual}})()`);
    const sample = async ({id,selector,neutralSelector,releaseInside=false,pointerDownOpens=false,closePanelAfterRelease=false}) => {
      if (only && !only.has(id)) return;
      await neutral(neutralSelector);
      const normal = await snapshot(selector);
      const p = await point(selector); await move(p); await sleep(350);
      const hover = await snapshot(selector);
      if (normal.inert || !hover.hover) {evidence.inputFailure={id,normal,hover};throw Error(`Pointer cannot reach ${id}; inspect blocker and input frame before treating it as CSS failure`);}
      await pointer('mousePressed',p); await sleep(220);
      const press = await snapshot(selector);
      if (releaseInside) await pointer('mouseReleased',p);
      else {const away = neutralSelector ? await point(neutralSelector) : await s.evaluate('({x:innerWidth/2,y:6})');await move(away);await pointer('mouseReleased',away);}
      if (closePanelAfterRelease) {await sleep(150);await escape();await sleep(650);}
      if (pointerDownOpens && await s.evaluate('Boolean(document.querySelector("[role=listbox]"))')) {await escape();await sleep(250);}
      await neutral(neutralSelector);
      const keyboard = await focusByTab(selector);
      const focus = await snapshot(selector);
      const delta = {hover:differences(normal,hover),press:differences(hover,press),focus:differences(normal,focus)};
      const immediateAction = pointerDownOpens && press.expanded === 'true';
      const fifthState = id==='hud-locate' ? 'Real pending hardware busy/disabled state is measured separately.' : id.startsWith('activity-') ? 'Real navigation busy state disables the action and tabs; measured separately.' : 'This enabled synchronous control has no pending operation. Real unavailable menu entries and calibration Undo are sampled separately; no artificial busy state is injected.';
      const row = {id,selector,normal,hover,press,focus,keyboard,differences:delta,immediateAction,fifthState};
      samples.push(row);
      check(`${id} enabled normal/hover/held press/keyboard focus`, normal.enabled && normal.rect.width>=43.9 && normal.rect.height>=43.9 && press.rect?.width>=43.9 && press.rect?.height>=43.9 && hover.hover && delta.hover.count>0 && (press.active||immediateAction) && (delta.press.count>0||immediateAction) && keyboard.reached && focus.focusVisible && delta.focus.count>0,{enabled:normal.enabled,rect:normal.rect,pressedRect:press.rect,hover:delta.hover,press:delta.press,focus:delta.focus,active:press.active,focusVisible:focus.focusVisible,keyboard,immediateAction});
      console.log(JSON.stringify({sample:id,hover:delta.hover.count,press:delta.press.count,focus:delta.focus.count,focusVisible:focus.focusVisible}));
    };
    const ready = async () => {
      await s.navigate(new URL('?qa=1&preset=explored',base).href);
      await until(()=>s.evaluate('Boolean(window.__LIYUN__&&document.querySelector(".hud-brand-badge"))'),15000,'QA HUD');
      await api('window.__LIYUN__.setSettings({autoDegrade:false,music:false,reducedMotion:false});window.__LIYUN__.freeze(1000);window.__controlFrame=requestAnimationFrame(function f(){window.__controlFrame=requestAnimationFrame(f)})');
      await sleep(700);
      evidence.initialInput = await s.evaluate('({stage:{...document.querySelector(".game-stage").dataset},ui:window.__LIYUN__.getUi(),motion:{systemReduced:matchMedia("(prefers-reduced-motion: reduce)").matches,gameReduced:window.__LIYUN__.getState().settings.reducedMotion,root:document.documentElement.dataset.motion},dialogs:[...document.querySelectorAll("[role=dialog]")].map(e=>({class:e.className,hidden:e.hidden})),active:document.activeElement.tagName})');
    };
    await ready();
    if (mode !== 'safe') {
      for (const [id,selector] of [
        ['hud-brand','.hud-brand-badge'],['hud-center','.hud-brand-copy'],['hud-collection','[data-testid="dock-collection"]'],['hud-account','.hud-status .hud-pill:nth-child(2)'],['hud-locate','.location-primary']
      ]) await sample({id,selector});
      const marker = await s.evaluate(`(()=>{const e=[...document.querySelectorAll('.map-marker:not(:disabled)')].find(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>100&&x<innerWidth-100&&y>100&&y<innerHeight-120&&e.contains(document.elementFromPoint(x,y))});return e?.getAttribute('data-testid')})()`);
      if (!marker) throw Error('No visible enabled marker');
      await sample({id:'map-marker',selector:`[data-testid=${JSON.stringify(marker)}]`,releaseInside:true,closePanelAfterRelease:true});
      await click('.hud-brand-badge');
      await until(()=>s.evaluate('Boolean(document.querySelector(".menu-screen[data-state=open]"))'),5000,'Menu');await sleep(550);
      for (const [id,selector] of [['menu-close','.menu-close'],['menu-login','.menu-login'],['menu-settings-tile','.menu-tile[aria-label="设置"]'],['menu-settings-rail','.menu-rail-button[aria-label="设置"]']]) await sample({id,selector,neutralSelector:'.menu-nickname'});
      const menuDisabled = await snapshot('.menu-tile:disabled');businessStates.push({id:'menu-upcoming-disabled',state:menuDisabled});
      check('upcoming menu tile has real disabled semantics and visible status',!menuDisabled.enabled&&menuDisabled.text.includes('即将开放'),{label:menuDisabled.label,opacity:menuDisabled.visual['0.opacity']});
      await click('.menu-rail-button[aria-label="设置"]');
      await until(()=>s.evaluate('Boolean(document.querySelector(".settings-screen[data-state=open]"))'),5000,'Settings');await sleep(500);
      for (const options of [
        {id:'settings-close',selector:'.settings-close'},
        {id:'settings-category',selector:'#settings-tab-control'},
        {id:'settings-slider',selector:'.settings-slider-thumb[aria-label="拖动灵敏度"]',releaseInside:true},
        {id:'settings-select',selector:'.settings-select-trigger[aria-label="双击缩放"]',pointerDownOpens:true},
        {id:'settings-defaults',selector:'.settings-footer .settings-btn--secondary'},
      ]) await sample({...options,neutralSelector:'.settings-heading h1'});
      await click('#settings-tab-message');
      await sample({id:'settings-switch',selector:'.settings-switch[aria-label="播放恭喜演出"]',neutralSelector:'.settings-heading h1'});
      await api('window.__LIYUN__.setRoute("map")');await sleep(600);
      await click('[data-testid="dock-collection"]');await until(()=>s.evaluate('Boolean(document.querySelector(".collection-item"))'),5000,'Collection');await sleep(500);
      await sample({id:'collection-known-tile',selector:'.collection-item.is-known',neutralSelector:'.modal-heading h2'});
      await escape();await sleep(650);
      await api('window.__LIYUN__.setRoute("calibration")');await until(()=>s.evaluate('Boolean(document.querySelector(".cal-screen"))'),5000,'Calibration');await sleep(300);
      await sample({id:'calibration-pan-tool',selector:'.cal-tools button:nth-child(3)',neutralSelector:'.cal-header h1'});
      const undo = await snapshot('.cal-history button:first-child');businessStates.push({id:'calibration-undo-disabled',state:undo});
      check('calibration Undo is visibly disabled before any edit',!undo.enabled&&Number(undo.visual['0.opacity'])<.6,{opacity:undo.visual['0.opacity'],enabled:undo.enabled});
      await click('[aria-label="关闭标定工坊"]');await sleep(500);
      await click('[data-testid="activity-entry"]');await until(()=>s.evaluate('document.querySelector(".activity-screen")?.dataset.phase==="open"'),5000,'Activity');
      await sample({id:'activity-selected-tab',selector:'.activity-tab[aria-selected="true"]',neutralSelector:'.activity-page-header h2'});
      await sample({id:'activity-primary',selector:'.activity-primary',neutralSelector:'.activity-page-header h2'});
      // A real navigate action: disabled + text + spinner + aria-busy, not DOM mutation.
      await click('.activity-map-preview',30);
      const activityBusy = await s.evaluate(`(()=>{const e=document.querySelector('.activity-screen'),b=e?.querySelector('.activity-primary'),tab=e?.querySelector('.activity-tab[aria-selected=true]');return {phase:e?.dataset.phase,busy:e?.getAttribute('aria-busy'),disabled:b?.disabled,label:b?.textContent.trim(),spinner:!!b?.querySelector('.activity-action-spinner'),selectedTabDisabled:tab?.disabled,selectedTabOpacity:tab?getComputedStyle(tab).opacity:null}})()`);
      businessStates.push({id:'activity-navigation-busy',state:activityBusy});
      check('activity navigation uses real busy label/spinner and disables repeated action',activityBusy.phase==='navigating'&&activityBusy.busy==='true'&&activityBusy.disabled&&activityBusy.selectedTabDisabled&&activityBusy.label.includes('正在展开')&&activityBusy.spinner,activityBusy);
      await sleep(600);await api('window.__LIYUN__.showPanel(null)');await sleep(400);
      await click('.location-primary');
      const locationBusy = await snapshot('.location-primary');businessStates.push({id:'location-pending-hardware-busy',fixture:'geolocation watch provider intentionally holds its callback; no coordinates',state:locationBusy});
      const indicatorAnimation=await s.evaluate('getComputedStyle(document.querySelector(".location-primary>span")).animationName');
      check('pending location has real busy/disabled label and animated internal indicator',!locationBusy.enabled&&locationBusy.busy==='true'&&locationBusy.text.includes('定位中')&&indicatorAnimation!=='none',{enabled:locationBusy.enabled,busy:locationBusy.busy,text:locationBusy.text,indicatorAnimation});
      await click('.location-stop');
      evidence.equivalentStates = samples.map(row=>({id:row.id,hoverEqualsNormal:!row.differences.hover.count,pressEqualsHover:!row.differences.press.count,focusEqualsNormal:!row.differences.focus.count,immediateAction:row.immediateAction}));
      evidence.fifthStatePolicy = 'No fabricated busy state for synchronous navigation, tabs, sliders or switches. Real menu upcoming, calibration Undo, activity transition, and pending-location states are measured separately.';
      evidence.semanticEquivalence = [{control:'settings-select',reason:'Pointerdown immediately opens the real listbox; its caret/expanded feedback is accepted without adding a second button animation.'},{control:'activity-selected-tab disabled during navigation',reason:'The selected tab keeps its selection color/opacity while disabled. The owning dialog exposes aria-busy and the primary action shows a spinner and pending label, so the brief whole-page transition supplies busy feedback.'},{controls:'Synchronous menu navigation, category tabs, sliders and switches',reason:'No asynchronous busy phase is supported; pending/disabled states are not fabricated to fill a universal five-state matrix.'}];
      fs.writeFileSync(path.join(out,'state-samples.json'),JSON.stringify({samples,businessStates,evidence},null,2));
    }
    if (mode !== 'states') {
      await api('window.__LIYUN__.setPreset("explored");window.__LIYUN__.setSettings({autoDegrade:false,music:false,reducedMotion:true})');await sleep(700);
      const protocol = await (await fetch(`http://127.0.0.1:${s.port}/json/protocol`)).json();
      const emulation = protocol.domains.find(domain=>domain.domain==='Emulation');
      const command = emulation.commands.find(command=>command.name==='setSafeAreaInsetsOverride');
      const safeType = emulation.types.find(type=>type.id==='SafeAreaInsets');
      evidence.safeAreaProtocol = {command,safeType};
      if (!command) throw Error('Browser lacks setSafeAreaInsetsOverride; explicit CSS fallback fixture required');
      const insets = {top:12,right:44,bottom:21,left:44};
      await s.call('Emulation.setSafeAreaInsetsOverride',{insets});
      const readEnv = () => s.evaluate(`(()=>{const e=document.createElement('div');e.style.cssText='position:fixed;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';document.body.append(e);const c=getComputedStyle(e),value={top:parseFloat(c.paddingTop),right:parseFloat(c.paddingRight),bottom:parseFloat(c.paddingBottom),left:parseFloat(c.paddingLeft)};e.remove();return value})()`);
      const reach = async (selector,width,height) => {
        await point(selector);
        return s.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {label:e.getAttribute('aria-label')||e.textContent.trim(),rect:r.toJSON(),enabled:!e.disabled,centerUncovered:e.contains(document.elementFromPoint(x,y)),insideSafe:r.x>=${insets.left}-.1&&r.right<=${width-insets.right}+.1&&r.y>=${insets.top}-.1&&r.bottom<=${height-insets.bottom}+.1,large:r.width>=43.9&&r.height>=43.9}})()`);
      };
      const heldHit = async (selector,id,width,height,neutralSelector) => {
        const p=await point(selector);await move(p);await sleep(180);
        const hover=await snapshot(selector);await pointer('mousePressed',p);await sleep(160);
        const press=await snapshot(selector),delta=differences(hover,press);
        const row={id,viewport:[width,height],selector,normalRect:hover.rect,pressedRect:press.rect,active:press.active,visualDifference:delta};pressedHitAreas.push(row);
        check(`held ${width}x${height} ${id} keeps >=44 and visible feedback`,press.active&&press.rect.width>=43.9&&press.rect.height>=43.9&&delta.count>0,row);
        const away=neutralSelector?await point(neutralSelector):{x:width/2,y:6};await move(away);await pointer('mouseReleased',away);await sleep(180);
      };
      for (const [width,height] of [[844,390],[667,375]]) {
        await s.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(350);
        const actual = await readEnv();check(`safe-area ${width}x${height} native CSS env reads nonzero override`,Object.keys(insets).every(key=>actual[key]===insets[key]),{requested:insets,actual});
        for (const context of ['menu','settings','cinematic','calibration']) {
          if (context==='cinematic') {await api('window.__LIYUN__.previewCinematic({type:"landmark",contentId:"wencui"})');await until(()=>s.evaluate('document.querySelector("[data-testid=cinematic-screen]")?.dataset.timelineReady==="true"'),5000,'Safe cinematic');await sleep(1300);}
          else {await api(`window.__LIYUN__.setRoute(${JSON.stringify(context)})`);await until(()=>s.evaluate(`Boolean(document.querySelector(${JSON.stringify(context==='menu'?'.menu-screen[data-state=open]':context==='settings'?'.settings-screen[data-state=open]':'.cal-screen')}))`),5000,`Safe ${context}`);await sleep(350);}
          const selectors = context==='menu'?['.menu-close','.menu-rail-button[aria-label="设置"]','.menu-tile[aria-label="设置"]','.menu-login'] : context==='settings'?['.settings-close','#settings-tab-control','.settings-slider-thumb[aria-label="拖动灵敏度"]','.settings-footer .settings-btn--primary'] : context==='cinematic'?['[data-testid="cinematic-screen"] button']:['[aria-label="关闭标定工坊"]','.cal-tools button:nth-child(3)','.cal-map-controls button[aria-label="放大地图"]','.cal-inspector .cal-wide-button'];
          if (context==='settings') {await click('#settings-tab-control');}
          const rows=[];for (const selector of selectors) rows.push({selector,...await reach(selector,width,height)});
          const row={context,viewport:[width,height],insets:actual,targets:rows};safeAreas.push(row);
          check(`safe-area ${width}x${height} ${context} controls stay reachable and >=44`,rows.every(row=>row.enabled&&row.centerUncovered&&row.insideSafe&&row.large),row);
          if (width===667 && process.env.CONTROL_QA_SCREENSHOTS!=='0') await s.screenshot(path.join(out,`safe-${context}-${width}.png`));
          if (context==='cinematic') await heldHit('[data-testid="cinematic-screen"] button','cinematic-continue',width,height,'[data-testid="cinematic-screen"] header');
          if (context==='cinematic') {await escape();await until(()=>s.evaluate('!document.querySelector("[data-testid=cinematic-screen]")'),4000,'Safe cinematic close');}
          else {await api('window.__LIYUN__.setRoute("map")');await sleep(400);}
        }
        await heldHit('.location-primary','location-primary',width,height);
        await api('window.__LIYUN__.showPanel("activities")');await until(()=>s.evaluate('document.querySelector(".activity-screen")?.dataset.phase==="open"'),5000,'Held activity');
        await heldHit('.activity-primary','activity-primary',width,height,'.activity-page-header h2');
        await heldHit('.activity-close','activity-close',width,height,'.activity-page-header h2');
        await escape();await sleep(450);
      }
      await s.call('Emulation.setSafeAreaInsetsOverride',{insets:{}});
      fs.writeFileSync(path.join(out,'safe-area.json'),JSON.stringify({evidence,safeAreas},null,2));
      fs.writeFileSync(path.join(out,'pressed-hitareas.json'),JSON.stringify({pressedHitAreas,thresholdCssPx:44,toleranceCssPx:.1},null,2));
    }
    const result = {ok:checks.every(row=>row.pass)&&s.errors.length===0,total:checks.length,passed:checks.filter(row=>row.pass).length,checks,evidence,errors:s.errors};
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({ok:result.ok,total:result.total,passed:result.passed,failed:checks.filter(row=>!row.pass).map(row=>row.name),errors:s.errors}));
  } catch (error) {
    await s?.screenshot(path.join(out,'failure.png')).catch(()=>{});
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:false,error:String(error.stack||error),checks,evidence,samples,businessStates,safeAreas,errors:s?.errors},null,2));
    console.error(error); process.exitCode=1;
  } finally {await s?.close();}
})();
