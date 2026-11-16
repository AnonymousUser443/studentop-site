/** Isolated synthetic origin only; all browser interaction uses OpenCLI. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {browser,evaluate,screenshot,waitFor,inspect} from '../tingchao/browser.mjs';
const phase=process.argv[2]||'bootstrap', origin=process.argv[3], checks=[], directory='qa/tingchao-vnext';
await fs.mkdir(directory,{recursive:true});
const click=(...args)=>browser('click',...args);
async function check(name,fn){const detail=await fn();assert(detail!==false,name);checks.push({name,pass:true,detail});console.log('PASS '+name);}
async function seek(ms){await evaluate(ms=>{const input=document.querySelector('[aria-label="音乐播放器"] input[aria-label="播放进度"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(ms));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},ms);}
try {
 if(phase==='bootstrap'){
  const opened=await browser('open',origin+'/?vnext='+Date.now(),'--window','background');await browser('tab','select',opened.page,'--window','foreground');
  await waitFor(()=>window.Win&&window.DesktopGate,45000);
  if(await evaluate(()=>Win.isLocked())){await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());}
  await evaluate(()=>{AidenMusic.setDesktopLyricsEnabled(false);localStorage.removeItem('aiden.music.desktopLyrics.position');});
  await check('music bundle remains lazy before launch',()=>evaluate(()=>!performance.getEntriesByType('resource').some(e=>/\/js\/music\//.test(e.name))));
  await evaluate(()=>{WM.launch('tingchao');return true;});await waitFor(()=>!!document.querySelector('[data-tingchao-root] main button'),25000);
  await browser('select','[data-tingchao-root] select[aria-label="听潮外观"]','dark');
  await check('jade dark base uses requested color',()=>evaluate(()=>getComputedStyle(document.querySelector('[data-tingchao-root]')).getPropertyValue('--tc-page').trim().toLowerCase()==='#153a30'));
  await check('renderer modules remain lazy on home',()=>evaluate(()=>!performance.getEntriesByType('resource').some(e=>/TiltStage-|FoliaStage-|createSonnetPixiRuntime-|\/lib-/.test(e.name))));
  await evaluate(()=>{window.__listEntries=[];window.__listObserver=new MutationObserver(records=>{for(const r of records)if(r.target.dataset.listState==='entering')__listEntries.push({key:r.target.dataset.listKey,time:performance.now()});});__listObserver.observe(document.querySelector('[data-tingchao-root]'),{subtree:true,attributes:true,attributeFilter:['data-list-state']});});
  await waitFor(()=>!!document.querySelector('main button[class*="heroPlay"]:not([disabled])'));
  await click('main button[class*="heroPlay"]');await waitFor(()=>AidenMusic.getSnapshot()?.status==='playing');
  await click('button[aria-label^="播放音质"]');await waitFor(()=>document.querySelectorAll('[role="menuitemradio"]').length===4);
  await check('quality popup shows actual quality and account constraints',()=>evaluate(()=>document.querySelector('[role="menu"]').parentElement.textContent.includes('本次实际')&&document.querySelector('[role="menu"]').parentElement.textContent.includes('以上选择为请求音质')));
  await screenshot(directory+'/quality-night-round1.png',1366,768);
  await browser('keys','Escape');await waitFor(()=>!document.querySelector('[data-tingchao-root] [role="menu"]'));
  if(!(await evaluate(()=>AidenMusic.desktopLyricsEnabled())))await click('button[aria-label="桌面歌词"]');await waitFor(()=>!!document.querySelector('[data-desktop-lyrics]'));
  await check('desktop lyric toggle creates independent surface',()=>evaluate(()=>AidenMusic.desktopLyricsEnabled()&&document.querySelector('#musicDesktopLyrics [data-desktop-lyrics]')!==null&&__tingchaoQa.audio.length===1));
  if(!(await evaluate(()=>document.querySelector('[data-tingchao-root] button[class*="accountButton"]').textContent.includes('隔离测试账号'))))await click('[data-tingchao-root] button[class*="accountButton"]');
  await waitFor(()=>document.querySelector('[data-tingchao-root]').textContent.includes('隔离测试账号'),18000);
  await check('private and full sidebar playlists are accessible',()=>evaluate(()=>{const rows=document.querySelectorAll('[data-sidebar-item]');return rows.length>=30&&[...rows].some(row=>row.title==='只给自己的私密歌单'&&row.querySelector('svg'));}));
  await check('sidebar scroll reaches last playlist without clipping',()=>evaluate(()=>{const last=[...document.querySelectorAll('[data-sidebar-item]')].at(-1);last.scrollIntoView({block:'nearest'});const root=last.closest('aside'),a=last.getBoundingClientRect(),r=root.getBoundingClientRect();return a.top>=r.top-1&&a.bottom<=r.bottom+1&&root.scrollHeight>root.clientHeight;}));
 }
 if(phase==='community'){
  await click('--role','button','--name','听潮漫游');await waitFor(()=>!!document.querySelector('main section[class*="hero"]'));
  await click('--role','button','--name','我的云盘');await waitFor(()=>document.querySelector('main').textContent.includes('云盘 ·'));
  await check('cloud uses normalized track table',()=>evaluate(()=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')==='51'));
  await click('main button[class*="loadMore"]');await waitFor(()=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')==='74');
  await check('cloud pagination appends all 73 synthetic tracks',()=>evaluate(()=>document.querySelectorAll('main [role="row"]').length===74));
  await check('track text grew fifty percent',()=>evaluate(()=>{const row=document.querySelector('main [role="row"][aria-rowindex]');return parseFloat(getComputedStyle(row.querySelector('button[class*="trackTitle"]')).fontSize)>=15&&Math.round(row.getBoundingClientRect().height)===90;}));
  await click('--role','button','--name','播放已加载歌曲');await waitFor(()=>AidenMusic.getSnapshot().status==='playing');
  await screenshot(directory+'/cloud-night-round1.png',1920,1080);
  await click('button[aria-label="当前歌曲评论"]');await waitFor(()=>!!document.querySelector('[aria-label="声音之外 · 评论"] article'));
  await check('comments include normalized quotes and dates',()=>evaluate(()=>document.querySelectorAll('[aria-label="声音之外 · 评论"] article').length>=20&&!!document.querySelector('[aria-label="声音之外 · 评论"] blockquote')));
  await click('[aria-label="声音之外 · 评论"] article button[aria-pressed]','--nth','0');
  await waitFor(async()=>{const events=await fetch('/__qa/events').then(r=>r.json());return events.some(x=>x.method==='comment_like'&&x.liked);});
  await click('[aria-label="声音之外 · 评论"] article footer button:last-child','--nth','0');
  await browser('fill','[aria-label="声音之外 · 评论"] textarea','隔离验收回复：潮声与青绿。');
  await click('--role','button','--name','发送回复');await waitFor(()=>document.querySelector('[aria-label="声音之外 · 评论"]').textContent.includes('评论已发送'));
  await check('reply stays in isolated fixture and uses reply API action',()=>evaluate(async()=>{const e=await fetch('/__qa/events').then(r=>r.json());return e.some(x=>x.method==='comment'&&x.type===2&&x.replyTo&&x.content==='隔离验收回复：潮声与青绿。');}));
  await click('--role','button','--name','下一页');await waitFor(()=>document.querySelector('[aria-label="声音之外 · 评论"]').textContent.includes('第 2 页'));
  await screenshot(directory+'/comments-night-round1.png',1366,768);
  await click('[aria-label="声音之外 · 评论"] button[aria-label="关闭对话框"]');await waitFor(()=>!document.querySelector('[data-tingchao-root] [aria-modal="true"]'));
  await click('--role','button','--name','心动模式');await waitFor(async()=>{const events=await fetch('/__qa/events').then(r=>r.json());return events.some(x=>x.method==='playmode_intelligence_list');});
  await check('heart mode plays only official endpoint results',()=>evaluate(()=>AidenMusic.getSnapshot().queue.length===8&&AidenMusic.getSnapshot().status==='playing'));
  await check('list rows use real staggered viewport entries',()=>evaluate(()=>__listEntries.length>20&&new Set(__listEntries.map(x=>Math.round(x.time/20))).size>2));
 }
 if(phase==='lyrics'){
  if(!(await evaluate(()=>!!document.querySelector('[data-lyric-mode]'))))await click('[aria-label="展开沉浸歌词"]');await waitFor(()=>document.querySelectorAll('[aria-label="歌词呈现方式"] button').length===3);await click('--role','button','--name','错落');await waitFor(()=>document.querySelector('[data-folia-tilt]')?.dataset.renderer==='tilt',25000);
  if(await evaluate(()=>AidenMusic.getSnapshot().status==='playing'))await click('[aria-label="音乐播放器"] button[aria-label="暂停播放"]');
  await seek(6500);
  await check('Tilt renders embedded typography with one audio',()=>evaluate(()=>!!document.querySelector('[data-folia-tilt] .folia-tilt-line')&&__tingchaoQa.audio.length===1&&!document.querySelector('iframe')));
  await screenshot(directory+'/tilt-night-round1.png',1366,768);
  await click('--role','button','--name','回到听潮');await browser('select','[data-tingchao-root] select[aria-label="听潮外观"]','light');await click('[aria-label="展开沉浸歌词"]');await waitFor(()=>document.querySelector('[data-folia-tilt]')?.dataset.renderer==='tilt',20000);await seek(8500);
  await screenshot(directory+'/tilt-day-round1.png',1920,1080);
  await check('Tilt inherits day palette',()=>evaluate(()=>document.querySelector('[data-tingchao-root]').dataset.musicTheme==='light'&&getComputedStyle(document.querySelector('[data-folia-tilt]')).getPropertyValue('--tc-teal').trim()==='#237e70'));
  await evaluate(()=>Win.setPref('motion',false));await waitFor(()=>!document.querySelector('[data-folia-tilt]'));
  await check('reduced motion falls back to readable lyrics',()=>evaluate(()=>!!document.querySelector('[aria-label="歌词，点击行可跳转播放"]')));
  await evaluate(()=>Win.setPref('motion',true));await waitFor(()=>document.querySelector('[data-folia-tilt]')?.dataset.renderer==='tilt');
  await click('#windowLayer button[aria-label="关闭"]');await waitFor(()=>!document.querySelector('[data-tingchao-root]'));
  await check('closing main window keeps desktop lyrics and pause',()=>evaluate(()=>!!document.querySelector('[data-desktop-lyrics]')&&AidenMusic.getSnapshot().status==='paused'&&__tingchaoQa.audio.length===1));
  await evaluate(()=>DesktopGate.lock());await waitFor(()=>Win.isLocked());
  await check('lock hides overlay and preserves pause',()=>evaluate(()=>document.getElementById('musicDesktopLyrics').hidden&&AidenMusic.getSnapshot().status==='paused'&&!!document.querySelector('[aria-label="听潮锁屏媒体控制"]')));
  await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());
  await click('#musicDesktopLyrics button[aria-label="从桌面歌词恢复听潮主窗口"]');await waitFor(()=>!!document.querySelector('[data-tingchao-root]'));
  await check('reopen retains desktop toggle and unique runtime',()=>evaluate(()=>AidenMusic.desktopLyricsEnabled()&&__tingchaoQa.audio.length===1));
  await click('[aria-label^="移动桌面歌词"]');
  await evaluate(()=>{window.__lyricX=document.querySelector('[data-desktop-lyrics]').getBoundingClientRect().left;});
  await browser('keys','ArrowRight');
  await check('desktop lyric keyboard movement stays reachable',()=>evaluate(()=>Math.abs(document.querySelector('[data-desktop-lyrics]').getBoundingClientRect().left-__lyricX-8)<1));
  await check('no unhandled errors',()=>evaluate(()=>__tingchaoQa.errors.length===0));
 }
 if(phase==='responsive'){
  await evaluate(()=>{const win=WM.byApp('tingchao')[0];window.__vnextStyle=win.el.getAttribute('style');Object.assign(win.el.style,{width:'550px',height:'660px',minWidth:'0',left:'20px',top:'15px'});return true;});
  await click('button[aria-label^="播放音质"]');await waitFor(()=>!!document.querySelector('[role="menu"]'));
  await check('quality popup stays inside narrow window',()=>evaluate(()=>{const a=document.querySelector('[role="menu"]').parentElement.getBoundingClientRect(),b=document.querySelector('[data-tingchao-root]').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1&&a.top>=b.top;}));
  await screenshot(directory+'/quality-day-narrow-round2.png',1366,768);await browser('keys','Escape');
  await click('button[aria-label="展开音乐导航"]');await waitFor(()=>document.querySelector('aside[class*="sidebarOpen"]'));
  await click('--role','button','--name','我的云盘');await waitFor(()=>document.querySelector('main [role="table"]'));
  await check('narrow track list has no horizontal overflow',()=>evaluate(()=>{const main=document.querySelector('main');return main.scrollWidth<=main.clientWidth+1;}));
  await screenshot(directory+'/cloud-day-narrow-round2.png',1366,768);
  await evaluate(()=>{const win=WM.byApp('tingchao')[0];win.el.setAttribute('style',window.__vnextStyle);WM.moveIntoView(win);return true;});
  await screenshot(directory+'/cloud-day-desktop-round2.png',1920,1080);
  await browser('fill','[data-tingchao-root] input[aria-label^="搜索歌曲"]','长列表');
  await click('button[aria-label="开始搜索"]');await waitFor(()=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')==='51');
  for(let i=0;i<3;i++){await click('main button[class*="loadMore"]');await waitFor(expected=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')===String(expected),12000,101+i*50);}
  await check('long track list virtualizes rows at fixed enlarged height',()=>evaluate(()=>document.querySelectorAll('main [role="row"][aria-rowindex]').length<45&&document.querySelector('main [role="table"]').getAttribute('aria-rowcount')==='201'));
  await evaluate(()=>{const node=document.querySelector('main [class*="trackRows"]');window.__entryCount=__listEntries?.length||0;node.scrollTop=11000;node.dispatchEvent(new Event('scroll'));});
  await waitFor(()=>Number(document.querySelector('main [role="row"][aria-rowindex]')?.getAttribute('aria-rowindex')||0)>100);
  await check('scrolled virtual rows enter without premature overscan animation',()=>evaluate(()=>{const pending=[...document.querySelectorAll('main [data-list-state="pending"]')];return pending.length>0&&pending.every(node=>{const a=node.getBoundingClientRect(),b=node.closest('[class*="trackRows"]').getBoundingClientRect();return a.bottom<=b.top||a.top>=b.bottom;});}));
  await screenshot(directory+'/search-virtual-round2.png',1366,768);
  await click('main [role="row"][aria-rowindex] button[aria-label^="播放 "]','--nth','0');await waitFor(()=>AidenMusic.getSnapshot().queue.length===200);
  await click('button[aria-label^="播放队列，"]');await waitFor(()=>!!document.querySelector('aside[aria-label="播放队列"]'));
  await evaluate(()=>{const q=document.querySelector('aside[aria-label="播放队列"] [class*="queueRows"]');q.scrollTop=15000;q.dispatchEvent(new Event('scroll'));});
  await waitFor(()=>Number(document.querySelector('aside[aria-label="播放队列"] [data-list-index]')?.getAttribute('data-list-index')||0)>100);
  await check('200-item queue remains virtual and stable during deep scroll',()=>evaluate(()=>document.querySelectorAll('aside[aria-label="播放队列"] [data-list-item]').length<40&&AidenMusic.getSnapshot().queue.length===200&&__tingchaoQa.errors.length===0));
  await click('button[aria-label="关闭播放队列"]');await waitFor(()=>!document.querySelector('aside[aria-label="播放队列"]'));
  await check('final UI has no removed slogans or unhandled errors',()=>evaluate(()=>{const text=document.querySelector('[data-tingchao-root]').textContent;return !text.includes('你的每一次心动')&&!text.includes('听见此刻，也听见自己')&&__tingchaoQa.errors.length===0;}));
  await evaluate(()=>{const win=WM.byApp('tingchao')[0];Object.assign(win.el.style,{width:'390px',height:'720px',minWidth:'0',left:'0',top:'0'});return true;});
  await screenshot(directory+'/mobile-390-round2.png',390,844);
  await check('390px music container retains readable track rows',()=>evaluate(()=>{const main=document.querySelector('main');return main.scrollWidth<=main.clientWidth+1&&document.querySelectorAll('main [role="row"][aria-rowindex]').length>0;}));
  await evaluate(()=>{const win=WM.byApp('tingchao')[0];win.el.setAttribute('style',window.__vnextStyle);WM.moveIntoView(win);return true;});
 }
 await fs.writeFile(`${directory}/checks-${phase}.json`,JSON.stringify({phase,checks,state:await inspect()},null,2)+'\n');
}catch(error){await fs.writeFile(`${directory}/failure-${phase}.json`,JSON.stringify({phase,message:error.message,checks,state:await inspect().catch(()=>null)},null,2));throw error;}
