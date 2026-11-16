/** Local synthetic desktop only. Browser interaction goes through OpenCLI. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {browser,evaluate,inspect,screenshot,waitFor} from '../tingchao/browser.mjs';
const phase=process.argv[2]||'bootstrap', origin=process.argv[3], checks=[];
const directory='qa/tingchao-folia';
await fs.mkdir(directory,{recursive:true});
const click=(...args)=>browser('click',...args);
async function check(name,fn){const value=await fn();assert(value!==false,name);checks.push({name,pass:true,detail:value});console.log('PASS '+name);}
async function seek(ms){await evaluate(ms=>{const input=document.querySelector('[aria-label="音乐播放器"] input[aria-label="播放进度"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,String(ms));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},ms);}
async function pause(){if(await evaluate(()=>AidenMusic.getSnapshot().status==='playing'))await click('[aria-label="音乐播放器"] button[aria-label="暂停播放"]');}
async function resume(){if(await evaluate(()=>AidenMusic.getSnapshot().status!=='playing'))await click('[aria-label="音乐播放器"] button[aria-label="开始播放"]');}
try {
  if(phase==='bootstrap') {
    await evaluate(origin=>{if(location.origin===origin){window.__tingchaoQa?.audio.forEach(audio=>audio.pause());localStorage.clear();sessionStorage.clear();}},origin).catch(()=>{});
    const opened=await browser('open',origin+'/?foliaQa='+Date.now(),'--window','background');
    await browser('tab','select',opened.page,'--window','foreground');
    await waitFor(()=>window.Win&&window.DesktopGate,45000);
    if(await evaluate(()=>Win.isLocked())) {
      await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());
    }
    await check('music remains lazy before launch',()=>evaluate(()=>!performance.getEntriesByType('resource').some(e=>/\/js\/music\//.test(e.name))));
    await evaluate(()=>{WM.launch('tingchao');return true;});
    await waitFor(()=>!!document.querySelector('[data-tingchao-root] main button'),25000);
    await check('Folia and Pixi remain lazy in music home',()=>evaluate(()=>!performance.getEntriesByType('resource').some(e=>/FoliaStage-|createSonnetPixiRuntime-|\/lib-/.test(e.name))));
    await browser('select','[data-tingchao-root] select[aria-label="听潮外观"]','dark');
    await browser('click','--role','button','--name','从一首歌开始');
    await waitFor(()=>AidenMusic.getSnapshot()?.status==='playing');
    await click('[aria-label="展开沉浸歌词"]');
    await waitFor(()=>!!document.querySelector('[aria-label="沉浸歌词"]'));
    await check('default scroll has no Folia renderer',()=>evaluate(()=>document.querySelector('[data-lyric-mode]').dataset.lyricMode==='scroll'&&!document.querySelector('[data-folia-stage]')));
    await browser('click','--role','button','--name','演出');
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',45000);
    await pause();await seek(6500);
    await check('real Sonnet canvas uses one audio and native window',()=>evaluate(()=>document.querySelectorAll('[data-folia-stage] canvas').length===1&&__tingchaoQa.audio.length===1&&document.querySelectorAll('[data-tingchao-root] iframe').length===0));
    await screenshot(directory+'/night-round1.png',1366,768);
  }
  if(phase==='visual') {
    await pause();await seek(8500);
    await screenshot(directory+'/night-round2.png',1920,1080);
    await check('night CSS tokens match artwork and lyric text',()=>evaluate(()=>{const r=document.querySelector('[data-tingchao-root]'),c=getComputedStyle(r);return r.dataset.musicTheme==='dark'&&c.getPropertyValue('--tc-teal').trim()==='#64c7b4'&&document.querySelector('[aria-label="沉浸歌词"] img').src.includes('tide-depth');}));
    await browser('click','--role','button','--name','回到听潮');
    await browser('select','[data-tingchao-root] select[aria-label="听潮外观"]','light');
    await click('[aria-label="展开沉浸歌词"]');
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    await seek(4500);
    await screenshot(directory+'/day-round1.png',1366,768);
    await check('day theme and saved performance preference survive remount',()=>evaluate(()=>document.querySelector('[data-tingchao-root]').dataset.musicTheme==='light'&&getComputedStyle(document.querySelector('[data-folia-stage]')).getPropertyValue('--tc-teal').trim()==='#237e70'&&document.querySelector('[aria-label="沉浸歌词"] img').src.includes('day-depth')));
    await seek(11000);
    await screenshot(directory+'/day-round2.png',1920,1080);
    await check('clicking current subtitle seeks without resuming paused audio',async()=>{await click('[data-folia-stage] button[title="点击定位到这一句"]');return evaluate(()=>AidenMusic.getSnapshot().status==='paused'&&Math.abs(AidenMusic.getSnapshot().positionMs-8000)<100);});
  }
  if(phase==='lifecycle') {
    if(await evaluate(()=>document.querySelector('[data-tingchao-root]')?.dataset.visible==='false')) {
      await click('#musicDesktopSurface button[aria-label="恢复听潮主窗口"]');
      await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    }
    if(!(await evaluate(()=>!!document.querySelector('[data-lyric-mode]')))) {
      await click('[aria-label="展开沉浸歌词"]');
      await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    }
    const expected=String((Number(await evaluate(()=>AidenMusic.getSnapshot().currentTrack.id))+1)%8+1);
    await resume();await seek(1000);
    await check('rapid next-next leaves only latest track and canvas',async()=>{await click('[aria-label="音乐播放器"] button[aria-label="下一首"]');await click('[aria-label="音乐播放器"] button[aria-label="下一首"]');await waitFor(id=>AidenMusic.getSnapshot().currentTrack.id===id&&document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',12000,expected);return evaluate(()=>document.querySelectorAll('[data-folia-stage] canvas').length===1&&__tingchaoQa.audio.length===1);});
    await click('#windowLayer button[aria-label="最小化"]');
    await waitFor(()=>document.querySelector('[data-tingchao-root]')?.dataset.visible==='false'&&document.querySelectorAll('[data-folia-stage] canvas').length===0);
    await check('minimize destroys visual renderer while playback continues',()=>evaluate(()=>AidenMusic.getSnapshot().status==='playing'&&!__tingchaoQa.audio[0].paused));
    await click('#musicDesktopSurface button[aria-label="恢复听潮主窗口"]');
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    await click('#windowLayer button[aria-label="关闭"]');
    await waitFor(()=>!document.querySelector('[data-tingchao-root]'));
    await check('closing window keeps one playing audio and mini surface',()=>evaluate(()=>AidenMusic.getSnapshot().status==='playing'&&__tingchaoQa.audio.length===1&&!!document.querySelector('[aria-label="听潮迷你播放器"]')));
    await evaluate(()=>DesktopGate.lock());
    await waitFor(()=>Win.isLocked()&&!!document.querySelector('[aria-label="听潮锁屏媒体控制"]'));
    await click('#lockMusicControls button[aria-label="下一首"]');
    await waitFor(id=>AidenMusic.getSnapshot().currentTrack.id===id&&AidenMusic.getSnapshot().status==='playing',12000,String(Number(expected)%8+1));
    await check('lock-screen next uses existing runtime without a lyric canvas',()=>evaluate(()=>__tingchaoQa.audio.length===1&&!document.querySelector('[data-folia-stage]')&&Win.isLocked()));
    await click('#lockMusicControls button[aria-label="暂停播放"]');
    await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());
    await evaluate(()=>{WM.launch('tingchao');return true;});await waitFor(()=>!!document.querySelector('[data-tingchao-root]'));
    await check('unlock and reopen retain pause and single audio',()=>evaluate(()=>AidenMusic.getSnapshot().status==='paused'&&__tingchaoQa.audio.length===1));
    await check('no uncaught renderer or runtime errors',()=>evaluate(()=>__tingchaoQa.errors.length===0));
  }
  if(phase==='fallback') {
    if(!(await evaluate(()=>!!document.querySelector('[data-lyric-mode]'))))await click('[aria-label="展开沉浸歌词"]');
    await evaluate(()=>{const win=WM.byApp('tingchao')[0];if(win.state!=='max')WM.toggleMaximize(win);else WM.moveIntoView(win);return true;});
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    await seek(5500);
    await evaluate(()=>{
      const win=document.querySelector('[data-tingchao-root]').closest('[role="dialog"]');
      window.__foliaWindowStyle=win.getAttribute('style');
      Object.assign(win.style,{width:'390px',height:'720px',minWidth:'0',left:'0',top:'0'});
    });
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='compact'&&document.querySelectorAll('[data-folia-stage] canvas').length===0);
    await check('narrow window uses readable scroll without a GPU canvas',()=>evaluate(()=>!!document.querySelector('[data-folia-stage] [aria-label="歌词，点击行可跳转播放"]')&&__tingchaoQa.audio.length===1));
    await screenshot(directory+'/compact-390.png',390,844);
    await evaluate(()=>{const win=WM.byApp('tingchao')[0];win.el.setAttribute('style',window.__foliaWindowStyle);WM.moveIntoView(win);return true;});
    await screenshot(directory+'/restored-desktop.png',1366,768);
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    await evaluate(()=>Win.setPref('motion',false));
    await waitFor(()=>document.querySelector('[data-lyric-mode]')?.dataset.lyricMode==='scroll'&&!document.querySelector('[data-folia-stage]'));
    await check('reduced motion destroys Sonnet and retains lyrics and pause state',()=>evaluate(()=>!!document.querySelector('[aria-label="歌词，点击行可跳转播放"]')&&AidenMusic.getSnapshot().status==='paused'));
    await evaluate(()=>Win.setPref('motion',true));
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    await evaluate(()=>document.querySelector('[data-folia-stage] canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='fallback'&&document.querySelectorAll('[data-folia-stage] canvas').length===0);
    await check('WebGL context loss falls back without changing audio state',()=>evaluate(()=>AidenMusic.getSnapshot().status==='paused'&&__tingchaoQa.audio.length===1&&document.querySelector('[data-folia-stage]').textContent.includes('演出暂不可用')));
    await screenshot(directory+'/gpu-fallback.png');
    await browser('click','--role','button','--name','随行');
    await evaluate(()=>{window.__foliaGetContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^(webgl2?|experimental-webgl)$/.test(kind)?null:__foliaGetContext.call(this,kind,...args);};});
    try {
      await browser('click','--role','button','--name','演出');
      await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='fallback',25000);
      await check('unavailable WebGL initialization leaves no attached canvas or playback change',()=>evaluate(()=>document.querySelectorAll('[data-folia-stage] canvas').length===0&&AidenMusic.getSnapshot().status==='paused'&&__tingchaoQa.audio.length===1));
    } finally {
      await evaluate(()=>{HTMLCanvasElement.prototype.getContext=__foliaGetContext;delete window.__foliaGetContext;});
    }
  }
  if(phase==='performance') {
    await browser('click','--role','button','--name','随行');
    await browser('click','--role','button','--name','演出');
    await waitFor(()=>document.querySelector('[data-folia-stage]')?.dataset.renderer==='sonnet',35000);
    await evaluate(()=>{
      if(window.__foliaDraws)return;
      window.__foliaDraws={count:0};
      for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
        const original=WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name]=function(...args){if(this.canvas?.closest?.('[data-folia-stage]'))__foliaDraws.count++;return original.apply(this,args);};
      }
    });
    await resume();await seek(0);
    const metrics=await evaluate(async()=>{
      const times=[];let start=performance.now(),previous=start;
      await new Promise(resolve=>{function tick(now){times.push(now-previous);previous=now;if(times.length>=120)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
      const sorted=times.slice(3).sort((a,b)=>a-b);
      const canvas=document.querySelector('[data-folia-stage] canvas');
      return {samples:sorted.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],drawCalls:__foliaDraws.count,viewport:[innerWidth,innerHeight],canvas:{css:[canvas.clientWidth,canvas.clientHeight],buffer:[canvas.width,canvas.height]}};
    });
    await check('active lyrics produce real WebGL draw calls',()=>metrics.drawCalls>0);
    await pause();
    await check('paused Sonnet stops continuous GPU rendering',()=>evaluate(async()=>{await new Promise(r=>setTimeout(r,250));const before=__foliaDraws.count;await new Promise(r=>setTimeout(r,500));return __foliaDraws.count===before;}));
    await fs.writeFile(directory+'/performance.json',JSON.stringify(metrics,null,2));
    console.log(JSON.stringify(metrics));
  }
  await fs.writeFile(directory+'/checks-'+phase+'.json',JSON.stringify({phase,checks,inspection:await inspect()},null,2));
} catch(error) {
  await fs.writeFile(directory+'/failure-'+phase+'.json',JSON.stringify({phase,checks,error:error.message,inspection:await inspect().catch(()=>null)},null,2));
  await screenshot(directory+'/failure-'+phase+'.png').catch(()=>{});
  throw error;
}
