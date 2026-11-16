/** Run after synthetic bootstrap; never unlocks or mutates a production account. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {browser,evaluate,screenshot,waitFor,inspect} from '../tingchao/browser.mjs';
const checks=[];
async function check(name,fn){const detail=await fn();assert(detail!==false,name);checks.push({name,pass:true,detail});console.log('PASS '+name);}
try{
 await browser('click','--role','button','--name','听潮漫游');
 await evaluate(()=>{document.querySelector('[data-tingchao-root] aside').scrollTop=0;});
 if(!(await evaluate(()=>AidenMusic.getSnapshot().status==='playing'))){await browser('click','main button[class*="heroPlay"]');await waitFor(()=>AidenMusic.getSnapshot().status==='playing');}
 // This installed userscript creates an invisible, full-width popup at z99999999.
 // Remove its DOM only in this owned loopback fixture; extension settings stay intact.
 await evaluate(()=>{if(location.hostname!=='127.0.0.1'||!window.__tingchaoQa)throw Error('Synthetic fixture required');document.querySelectorAll('body > .h5player-popup-wrap').forEach(el=>el.remove());});
 if(await evaluate(()=>WM.byApp('tingchao')[0].state==='max')){await browser('click','[data-music-window-chrome] .caption-max');await waitFor(()=>WM.byApp('tingchao')[0].state==='normal');}
 await evaluate(()=>getSelection()?.removeAllRanges());
 await check('only original three captions are embedded inside music',()=>evaluate(()=>{const w=WM.byApp('tingchao')[0],root=w.el.querySelector('[data-tingchao-root]');return getComputedStyle(w.el.querySelector(':scope > .titlebar')).display==='none'&&w.el.querySelectorAll('.caption-btn').length===3&&root.querySelectorAll('[aria-label="窗口操作"] .caption-btn').length===3;}));
 await check('captions align to content upper right',()=>evaluate(()=>{const root=document.querySelector('[data-tingchao-root]').getBoundingClientRect(),cap=document.querySelector('[data-music-window-chrome] .captions').getBoundingClientRect();return Math.abs(root.right-cap.right)<2&&Math.abs(root.top-cap.top)<2&&cap.height>=30;}));
 await screenshot('qa/tingchao-vnext/frameless-night.png',1366,768);
 await evaluate(()=>document.querySelector('[data-window-drag-region]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,button:0})));
 await waitFor(()=>WM.byApp('tingchao')[0].state==='max');
 await check('double click uses existing maximize and restore state',()=>evaluate(()=>document.querySelector('[data-music-window-chrome] .caption-max').getAttribute('aria-label')==='向下还原'));
 await browser('click','[data-music-window-chrome] .caption-max');await waitFor(()=>WM.byApp('tingchao')[0].state==='normal');
 await evaluate(()=>{const w=WM.byApp('tingchao')[0],region=document.querySelector('[data-window-drag-region]'),r=region.getBoundingClientRect();window.__chromeStart={...w.rect};const source=document.createElement('span');source.id='chromeDragSource';Object.assign(source.style,{display:'block',width:'40px',height:'28px',marginLeft:'32px'});region.appendChild(source);const target=document.createElement('div');target.id='chromeDragTarget';Object.assign(target.style,{position:'fixed',left:(r.x+52+50)+'px',top:(r.y+r.height/2+70)+'px',width:'4px',height:'4px',pointerEvents:'none',zIndex:'9999'});document.body.appendChild(target);});
 await browser('drag','#chromeDragSource','#chromeDragTarget');
 await check('native pointer drag moves the music window',()=>evaluate(()=>{document.getElementById('chromeDragTarget')?.remove();document.getElementById('chromeDragSource')?.remove();const r=WM.byApp('tingchao')[0].rect;return Math.abs(r.x-__chromeStart.x)>20&&Math.abs(r.y-__chromeStart.y)>20;}));
 await evaluate(()=>getSelection()?.removeAllRanges());
 await browser('click','[data-music-window-chrome] .caption-max');await waitFor(()=>WM.byApp('tingchao')[0].state==='max');
 await evaluate(()=>document.querySelector('[data-music-window-chrome] .caption-max').dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'})));await waitFor(()=>!!document.querySelector('.snap-layouts:not([hidden])'));
 await check('original snap menu remains reachable from embedded maximize',()=>evaluate(()=>document.querySelector('.snap-layouts').getAttribute('role')==='menu'));
 await browser('keys','Escape');await browser('click','[data-music-window-chrome] .caption-max');await waitFor(()=>WM.byApp('tingchao')[0].state==='normal');
 await browser('click','[data-music-window-chrome] .caption-min');await waitFor(()=>WM.byApp('tingchao')[0].state==='min');
 await check('minimize preserves runtime and one audio element',()=>evaluate(()=>__tingchaoQa.audio.length===1&&AidenMusic.getSnapshot().status==='playing'));
 await evaluate(()=>AidenMusic.open());await waitFor(()=>WM.byApp('tingchao')[0].state!=='min');
 await browser('click','[aria-label="展开沉浸歌词"]');await waitFor(()=>!!document.querySelector('[data-lyric-mode]'));
 await check('immersive lyrics retain original controls and drag region',()=>evaluate(()=>document.querySelectorAll('[data-music-window-chrome] .caption-btn').length===3&&document.querySelector('[data-window-drag-region]').getBoundingClientRect().height>=20));
 await browser('click','--role','button','--name','回到听潮');await browser('select','[data-tingchao-root] select[aria-label="听潮外观"]','light');
 await screenshot('qa/tingchao-vnext/frameless-day.png',1920,1080);
 await evaluate(()=>{window.__chromeStyle=WM.byApp('tingchao')[0].el.getAttribute('style');const w=WM.byApp('tingchao')[0];Object.assign(w.el.style,{width:'390px',height:'720px',minWidth:'0',left:'0',top:'0'});});
 await check('390px toolbar controls do not overlap native captions',()=>evaluate(()=>{const caption=document.querySelector('[data-music-window-chrome] .captions').getBoundingClientRect();return [...document.querySelectorAll('[data-tingchao-root] header input,[data-tingchao-root] header button,[data-tingchao-root] header select')].every(el=>{const r=el.getBoundingClientRect();return !r.width||r.top>=caption.bottom-1||r.right<=caption.left;});}));
 await screenshot('qa/tingchao-vnext/frameless-390.png',390,844);
 await evaluate(()=>{const w=WM.byApp('tingchao')[0];w.el.setAttribute('style',__chromeStyle);WM.moveIntoView(w);});
 await browser('select','[data-tingchao-root] select[aria-label="听潮外观"]','dark');
 await check('no window lifecycle or browser errors',()=>evaluate(()=>__tingchaoQa.errors.length===0));
 await fs.writeFile('qa/tingchao-vnext/checks-window.json',JSON.stringify({checks,state:await inspect()},null,2)+'\n');
}catch(error){await fs.writeFile('qa/tingchao-vnext/failure-window.json',JSON.stringify({message:error.message,checks,state:await inspect().catch(()=>null)},null,2)+'\n');throw error;}
