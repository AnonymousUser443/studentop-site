'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { newSession, until, sleep } = require('../lib.js');
const out = __dirname;
const checks = [];
const evidence = {};
function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) throw new Error(name + ': ' + JSON.stringify(detail));
}

(async () => {
  let s;
  try {
    s = await newSession({ size: '1440x900', hardwareRendering: true });
    await s.call('Emulation.setFocusEmulationEnabled', {enabled:true});
    await s.call('Page.bringToFront');
    await s.navigate('http://127.0.0.1:5174/?qa=1&preset=explored');
    await until(() => s.evaluate('Boolean(window.__LIYUN__ && document.querySelector(".hud-context-toggle"))'), 15000, 'HUD ready');
    await s.evaluate('window.__LIYUN__.setSettings({autoDegrade:false}); true');
    await sleep(1000);
    evidence.renderer = await s.evaluate(`(() => {const c=document.createElement('canvas'),gl=c.getContext('webgl');if(!gl)return 'unavailable';const ext=gl.getExtension('WEBGL_debug_renderer_info');const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);gl.getExtension('WEBGL_lose_context')?.loseContext();return renderer})()`);
    await s.evaluate('window.__LIYUN__.freeze(1000); true');
    // 冻结 Canvas 后仍持续请求真实浏览器帧，避免 headless 的静帧休眠延迟 WAAPI 完成事件。
    // 不替换时钟、不修改 rAF、不推进虚拟时间。
    await s.evaluate('window.__hudQAFrame=requestAnimationFrame(function frame(){window.__hudQAFrame=requestAnimationFrame(frame)}); true');

    // 六档视口：实际可见内容的边界、44px 命中区、安全区、折叠与展开。
    evidence.layouts = [];
    for (const [width, height] of [[1920,1080],[1440,900],[1280,720],[1024,600],[844,390],[667,375]]) {
      await s.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await until(() => s.evaluate(`innerWidth===${width} && innerHeight===${height} && document.querySelector('.game-stage').clientWidth===${width}`), 5000, 'Viewport resized');
      // 收拢与展开均实测，手机最终截图采用收拢态。
      for (const expanded of [true, false]) {
        const current = await s.evaluate('document.querySelector(".hud-context-toggle").getAttribute("aria-expanded")==="true"');
        if (current !== expanded) await s.click('.hud-context-toggle');
        await until(() => s.evaluate(expanded
          ? 'document.querySelector(".hud-context-details").getBoundingClientRect().height>1 && Number(getComputedStyle(document.querySelector(".hud-context-details")).opacity)>.99'
          : 'document.querySelector(".hud-context-details").getBoundingClientRect().height<.5 && document.querySelector(".hud-context-details").inert'), 3000, 'Context transition settles');
        await sleep(200);
        const layout = await s.evaluate(`(() => {
          const boxes = [...document.querySelectorAll('.hud-anchor > .hud-slot')].map(e => {
            const r=e.getBoundingClientRect(); return {name:e.parentElement.className,x:r.x,y:r.y,width:r.width,height:r.height};
          });
          const overlaps=[];
          for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
            const a=boxes[i],b=boxes[j],w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
            if(w>2&&h>2)overlaps.push([a.name,b.name,w,h]);
          }
          const small=[...document.querySelectorAll('.hud-frame button')].map(e=>({name:e.getAttribute('aria-label')||e.textContent,r:e.getBoundingClientRect()})).filter(({r})=>r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)).map(({name,r})=>({name,width:r.width,height:r.height}));
          const outside=boxes.filter(b=>b.x<0||b.y<0||b.x+b.width>innerWidth+1||b.y+b.height>innerHeight+1);
          const labels=[...document.querySelectorAll('.map-marker-name')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({name:e.textContent,r:e.getBoundingClientRect()}));
          const labelOverlaps=[];
          const hits=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
          for(const a of labels){for(const b of boxes){if(hits(a.r,{left:b.x,top:b.y,right:b.x+b.width,bottom:b.y+b.height}))labelOverlaps.push([a.name,b.name]);}}
          for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(hits(labels[i].r,labels[j].r))labelOverlaps.push([labels[i].name,labels[j].name]);
          const hiddenLabels=document.querySelectorAll('.map-marker[data-label-hidden=true]').length;
          return {width:innerWidth,height:innerHeight,expanded:${expanded},boxes,overlaps,small,outside,labelOverlaps,hiddenLabels};
        })()`);
        evidence.layouts.push(layout);
        check(`layout ${width}x${height} expanded=${expanded}`, !layout.overlaps.length && !layout.small.length && !layout.outside.length && !layout.labelOverlaps.length && layout.hiddenLabels<=2, layout);
      }
      if (height > 560) { await s.click('.hud-context-toggle'); await sleep(350); }
      await s.screenshot(path.join(out, 'shots', `hud-${width}x${height}.png`));
    }

    await s.call('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await sleep(400);
    await s.click('[data-testid="dock-collection"]');
    await until(() => s.evaluate('Boolean(document.querySelector(".collection-modal"))'), 5000, 'Collection opens');
    await sleep(500);
    check('modal receives focus', await s.evaluate('document.querySelector(".hud-modal").contains(document.activeElement)'), true);
    await s.screenshot(path.join(out, 'shots', 'collection-open.png'));
    await s.click('.modal-close');
    evidence.exit = await s.evaluate('({retained:!!document.querySelector(".hud-modal-backdrop"),inert:document.querySelector(".hud-modal-backdrop")?.inert})');
    check('modal has observable inert exit', evidence.exit.retained && evidence.exit.inert, evidence.exit);
    await until(() => s.evaluate('!document.querySelector(".hud-modal-backdrop")'), 2000, 'Modal exits');
    const focusAfterExit = await s.evaluate('({testid:document.activeElement?.dataset.testid,tag:document.activeElement?.tagName})');
    check('modal returns focus to trigger', focusAfterExit.testid==='dock-collection', focusAfterExit);

    // 真正的 UI 操作：HUD → 菜单 → 设置 → 图像 → 游戏内开关。
    await s.click('.hud-brand-badge');
    await until(() => s.evaluate('Boolean(document.querySelector(".menu-grid"))'), 5000, 'Menu opens');
    await sleep(450);
    check('menu reads actual exploration and guest identity', await s.evaluate('document.querySelector(".menu-progress").getAttribute("aria-valuenow")==="37" && document.querySelector(".menu-nickname").textContent==="游客" && document.querySelector(".menu-signature").textContent.includes("7 / 8")'), true);
    await s.click('.menu-grid [aria-label="设置"]');
    await until(() => s.evaluate('Boolean(document.querySelector("#settings-tab-image"))'), 5000, 'Settings opens');
    await s.click('#settings-tab-image');
    await sleep(300);
    await s.click('[role="switch"][aria-label="减少动态效果"]');
    await sleep(350);
    check('game reduced-motion applies and stays saved', await s.evaluate('document.documentElement.dataset.motion==="reduced" && window.__LIYUN__.getState().settings.reducedMotion && document.querySelector("[role=switch][aria-label=减少动态效果]").getAttribute("aria-checked")==="true"'), true);
    await s.screenshot(path.join(out, 'shots', 'settings-motion.png'));
    const esc = async () => {
      await s.call('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await s.call('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await sleep(250);
    };
    await esc(); await esc();
    check('settings keyboard route returns to map', await s.evaluate('!document.querySelector(".settings-screen,.menu-screen") && !document.querySelector(".hud-layer").inert'), true);
    // 状态投影断言使用隔离 QA 的 store，不触碰用户本机或云存档。
    await s.evaluate('window.__LIYUN__.setSettings({reducedMotion:false,autoDegrade:false}); true');
    await sleep(250);
    await s.call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await sleep(350);
    evidence.reduced = await s.evaluate(`(() => ({mode:document.documentElement.dataset.motion,ambient:document.documentElement.dataset.ambient,user:window.__LIYUN__.getState().settings.reducedMotion,animations:document.querySelector('.hud-frame').getAnimations({subtree:true}).filter(a=>a.playState==='running').length}))()`);
    check('system preference overrides game OFF and stops HUD loops', evidence.reduced.mode==='reduced' && evidence.reduced.ambient==='off' && !evidence.reduced.user && evidence.reduced.animations===0, evidence.reduced);
    await s.call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await until(() => s.evaluate('document.documentElement.dataset.motion==="full"'), 2000, 'System preference restores');
    const restored = await s.evaluate('({mode:document.documentElement.dataset.motion,ambient:document.documentElement.dataset.ambient,settings:window.__LIYUN__.getState().settings})');
    check('system preference live restoration', restored.mode==='full' && restored.ambient==='on', restored);

    // 原生时序采样：0→37%，中间值存在，圆弧和数字每帧一致。
    await s.call('Emulation.setDeviceMetricsOverride', {width:844,height:390,deviceScaleFactor:1,mobile:false});
    await s.evaluate('window.__LIYUN__.setPreset("fog"); window.__LIYUN__.freeze(1000); true');
    await sleep(1000);
    evidence.progress = await s.evaluate(`new Promise(resolve=>{
      const rows=[],start=performance.now(),C=2*Math.PI*45;
      window.__LIYUN__.setPreset('explored');window.__LIYUN__.freeze(1000);
      function sample(now){const n=Number(document.querySelector('.hud-progress-number').textContent),arc=document.querySelector('.hud-progress-arc'),p=(1-parseFloat(getComputedStyle(arc).strokeDashoffset)/C)*100;rows.push({ms:Math.round(now-start),number:n,arc:p});if(now-start<1300)requestAnimationFrame(sample);else resolve(rows)}requestAnimationFrame(sample)
    })`);
    check('progress grows through visible intermediate values', evidence.progress.some(r=>r.ms>=60&&r.ms<900&&r.number>0&&r.number<37), evidence.progress);
    check('progress arc and number stay synchronized', evidence.progress.every(r=>Math.abs(r.arc-r.number)<=.55), evidence.progress);
    check('progress settles at 37%', evidence.progress.at(-1).number===37 && Math.abs(evidence.progress.at(-1).arc-37)<.01, evidence.progress.at(-1));

    // 中途切换减少动态，直接到终态；强闪光开关单独取消装饰。
    await s.evaluate('window.__LIYUN__.setPreset("fog"); true'); await sleep(1000);
    await s.evaluate('window.__LIYUN__.setPreset("explored"); true'); await sleep(100);
    await s.evaluate('window.__LIYUN__.setSettings({reducedMotion:true}); true'); await sleep(50);
    check('mid-flight reduced motion settles immediately', await s.evaluate('document.querySelector(".hud-progress-number").textContent==="37" && !document.querySelector(".hud-progress-sweep")'), true);
    await s.evaluate('window.__LIYUN__.setSettings({reducedMotion:false,reduceFlash:true}); true'); await sleep(300);
    check('reduce-flash disables HUD ambient highlight', await s.evaluate('document.documentElement.dataset.ambient==="off" && getComputedStyle(document.querySelector(".hud-dock-button"),"::before").display==="none"'), true);

    // 快速开合后只有一个模态，无残留遮罩或失去响应的 HUD。
    await s.evaluate('window.__LIYUN__.setSettings({reduceFlash:false}); true');
    for (let i=0;i<3;i++) {
      await s.click('[data-testid="dock-collection"]');
      await sleep(80);
      await esc();
    }
    check('rapid open/close leaves no stale modal', await s.evaluate('!document.querySelector(".hud-modal-backdrop") && !document.querySelector(".hud-frame").inert'), true);

    await s.evaluate('window.__LIYUN__.setEntered(false); true'); await sleep(250);
    check('HUD hidden and inert before entry', await s.evaluate('document.querySelector(".hud-frame").inert && document.querySelector(".hud-frame").getAttribute("aria-hidden")==="true"'), true);
    await s.evaluate('window.__LIYUN__.setEntered(true); true');
    evidence.entrance = [];
    for (const ms of [40,120,300,450]) {
      await sleep(ms);
      evidence.entrance.push(await s.evaluate('({time:performance.now(),slots:[...document.querySelectorAll(".hud-slot")].map(e=>({name:e.parentElement.className,opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform}))})'));
    }
    check('HUD settles after staggered entrance', evidence.entrance.at(-1).slots.every(r=>Number(r.opacity)===1&&r.transform==='none'), evidence.entrance);

    // 合成横屏下的 rAF 采样仅作回归诊断，不能解释为真机 GPU FPS。
    evidence.perf = [];
    await s.evaluate('window.__LIYUN__.freeze(); true');
    await s.call('Emulation.setDeviceMetricsOverride', {width:844,height:390,deviceScaleFactor:1,mobile:false});
    for (const preset of ['low','high','ultra']) {
      await s.evaluate(`window.__LIYUN__.setQualityPreset('${preset}'); window.__LIYUN__.setSettings({autoDegrade:false}); true`);
      await sleep(500);
      const row = await s.evaluate(`new Promise(resolve=>{let n=0,first,last;function frame(t){if(first===undefined)first=t;n++;last=t;if(t-first<5000)requestAnimationFrame(frame);else resolve({preset:'${preset}',frames:n,ms:last-first,rafFps:(n-1)*1000/(last-first),ambient:document.documentElement.dataset.ambient})}requestAnimationFrame(frame)})`);
      evidence.perf.push(row);
      check(`quality ${preset} controls HUD ambient`, row.ambient===(preset==='low'?'off':'on'), row);
    }
    await s.screenshot(path.join(out, 'shots', 'review-2-mobile.png'));
    // 普通入口的持久化往返也在这个独立临时 profile 中完成。
    await s.evaluate(`(() => {const state=window.__LIYUN__.getState();state.settings={...state.settings,music:false,reducedMotion:false,autoDegrade:false};localStorage.setItem('liyun.exploration.v2',JSON.stringify(state));return true})()`);
    await s.navigate('http://127.0.0.1:5174/');
    await until(() => s.evaluate('Boolean(document.querySelector(".entry-alt"))'), 5000, 'Guest entry');
    await s.evaluate('document.querySelector(".entry-alt").scrollIntoView({block:"center"}); true');
    await sleep(100);
    await s.click('.entry-alt');
    await until(() => s.evaluate('document.querySelector(".game-stage").dataset.entered==="true" && !document.querySelector(".entrance-overlay")'), 5000, 'Guest enters map');
    await sleep(800);
    await s.click('.hud-brand-badge');
    await until(() => s.evaluate('Boolean(document.querySelector(".menu-grid"))'), 5000, 'Normal menu');
    await sleep(450);
    await s.click('.menu-grid [aria-label="设置"]');
    await until(() => s.evaluate('Boolean(document.querySelector("#settings-tab-image"))'), 5000, 'Normal settings');
    await s.click('#settings-tab-image'); await sleep(300);
    await s.click('[role="switch"][aria-label="减少动态效果"]');
    await until(() => s.evaluate('JSON.parse(localStorage.getItem("liyun.exploration.v2")).settings.reducedMotion===true'), 2000, 'Settings persisted');
    check('normal entry persists settings without losing exploration', await s.evaluate('JSON.parse(localStorage.getItem("liyun.exploration.v2")).discoveredIds.length===7'), true);
    await s.navigate('http://127.0.0.1:5174/');
    await until(() => s.evaluate('document.documentElement.dataset.motion==="reduced"'), 5000, 'Settings restored');
    check('reduced-motion setting survives reload', await s.evaluate('document.documentElement.dataset.ambient==="off" && document.querySelector(".game-stage").dataset.progress==="37"'), true);
    check('browser has no errors or failed requests', s.errors.length===0, s.errors);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ok:true,total:checks.length,checks,evidence,errors:s.errors},null,2));
    console.log(JSON.stringify({ok:true,total:checks.length,passed:checks.length,perf:evidence.perf}));
  } catch (error) {
    if (s) {
      await s.screenshot(path.join(out, 'shots', 'failure.png')).catch(()=>{});
      evidence.failureDOM = await s.evaluate('({root:{...document.documentElement.dataset},expanded:document.querySelector(".hud-context-toggle")?.getAttribute("aria-expanded"),details:document.querySelector(".hud-context-details")?.outerHTML,focus:{tag:document.activeElement?.tagName,class:document.activeElement?.className}})').catch(()=>null);
    }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ok:false,error:String(error.stack||error),checks,evidence,errors:s?.errors},null,2));
    console.error(String(error.stack||error)); process.exitCode=1;
  } finally { await s?.close(); }
})();
