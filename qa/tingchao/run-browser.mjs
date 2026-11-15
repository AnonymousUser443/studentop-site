import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {browser,evaluate,inspect,screenshot,waitFor} from './browser.mjs';
const phase=process.argv[2]||'bootstrap',origin=process.argv[3],checks=[];
const root='[data-tingchao-root]';
const click=(...args)=>browser('click',...args);
async function check(name,fn){const detail=await fn();assert(detail!==false,name);checks.push({name,pass:true,detail});console.log('PASS '+name);}
const choose=(selector,value)=>browser('select',selector,value);
const state=()=>evaluate(()=>{const s=AidenMusic.getSnapshot();return{status:s?.status,position:s?.positionMs,id:s?.currentTrack?.id,queue:s?.queue.length,error:s?.error?.message};});
try{
 if(phase==='bootstrap'){
  if(origin){const opened=await browser('open',origin,'--window','foreground');await browser('tab','select',opened.page,'--window','foreground');}
  await waitFor(()=>window.Win&&(!Win.isLocked()||document.getElementById('gateLogin')?.getBoundingClientRect().width>0),45000);
  if(await evaluate(()=>Win.isLocked())){
   await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());
  }
  await check('music framework and artwork lazy before launch',()=>evaluate(()=>!performance.getEntriesByType('resource').some(x=>/\/assets\/(?:releases\/[a-f0-9]{24}\/)?(?:js\/music|img\/music)\//.test(x.name))));
  await evaluate(()=>{WM.launch('tingchao');return true;});
  await waitFor(()=>document.querySelector('[data-tingchao-root]')&&document.querySelector('main button')?.textContent,20000);
  await check('native single window and single audio',()=>evaluate(()=>document.querySelectorAll('[data-tingchao-root]').length===1&&__tingchaoQa.audio.length===1&&document.querySelectorAll('[data-tingchao-root] iframe').length===0));
  await choose(root+' select[aria-label="听潮外观"]','light');
  await screenshot('qa/tingchao/home-light-round1.png');
  await check('day theme illustration visible',()=>evaluate(()=>document.querySelector('[data-tingchao-root]').dataset.musicTheme==='light'&&document.querySelector('img[src*="day-tide"]').naturalWidth>0));
 }
 if(phase==='play'){
  if(await evaluate(()=>!!document.querySelector('div[aria-label="沉浸歌词"]')))await browser('click','--role','button','--name','回到听潮');
  await browser('click','--role','button','--name','从一首歌开始');
  await waitFor(()=>AidenMusic.getSnapshot()?.status==='playing');
  await check('real local audio and runtime clocks advance',async()=>{await new Promise(r=>setTimeout(r,1000));return evaluate(()=>__tingchaoQa.audio.length===1&&!__tingchaoQa.audio[0].paused&&__tingchaoQa.audio[0].currentTime>0&&AidenMusic.getSnapshot().positionMs>0);});
  await check('seek keeps playing',async()=>{await evaluate(()=>{const input=document.querySelector('[aria-label="音乐播放器"] input[aria-label="播放进度"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'10000');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});return evaluate(()=>AidenMusic.getSnapshot().positionMs>=9500&&AidenMusic.getSnapshot().status==='playing');});
  await click('[aria-label="音乐播放器"] button[aria-label="下一首"]');await waitFor(()=>AidenMusic.getSnapshot()?.currentTrack?.id==='2'&&AidenMusic.getSnapshot().status==='playing');
  await check('next track uses same audio',()=>evaluate(()=>__tingchaoQa.audio.length===1&&AidenMusic.getSnapshot().currentIndex===1));
  await click('[aria-label="展开沉浸歌词"]');
  await waitFor(()=>!!document.querySelector('div[aria-label="沉浸歌词"]'));
  await screenshot('qa/tingchao/immersive-light-round1.png');
  await check('lyrics parsed and word timing available',()=>evaluate(()=>AidenMusic.getSnapshot().lyrics?.lines.length>=4&&AidenMusic.getSnapshot().lyrics.hasWordTiming));
 }
 if(phase==='lifecycle'){
  if(await evaluate(()=>!!document.querySelector('div[aria-label="沉浸歌词"]')))await browser('click','--role','button','--name','回到听潮');
  await choose(root+' select[aria-label="听潮外观"]','dark');
  await screenshot('qa/tingchao/home-dark-round1.png');
  await click('[aria-label="展开沉浸歌词"]');await waitFor(()=>!!document.querySelector('div[aria-label="沉浸歌词"]'));
  await screenshot('qa/tingchao/immersive-dark-round1.png');
  await browser('click','--role','button','--name','回到听潮');
  if((await state()).status!=='playing')await click('[aria-label="音乐播放器"] button[aria-label="开始播放"]');
  const initial=await state();
  await click('#windowLayer button[aria-label="关闭"]');
  await waitFor(()=>!document.querySelector('[data-tingchao-root]')&&!document.getElementById('musicDesktopSurface').hidden);
  await check('close preserves playback and exposes mini',()=>evaluate(()=>AidenMusic.getSnapshot().status==='playing'&&!__tingchaoQa.audio[0].paused&&document.querySelector('[aria-label="听潮迷你播放器"]')!==null));
  await screenshot('qa/tingchao/mini-round1.png');
  await click('#musicDesktopSurface button[aria-label="恢复听潮主窗口"]');await waitFor(()=>!!document.querySelector('[data-tingchao-root]'));
  await check('reopen keeps one audio and current position',async()=>{const now=await state();return (await evaluate(()=>__tingchaoQa.audio.length===1))&&now.id===initial.id&&now.position>=initial.position&&now.status==='playing';});
  await click('#windowLayer button[aria-label="最小化"]');await waitFor(()=>document.querySelector('[data-tingchao-root]')?.dataset.visible==='false');
  await check('minimize preserves playback',()=>evaluate(()=>AidenMusic.getSnapshot().status==='playing'&&!document.getElementById('musicDesktopSurface').hidden));
  await click('#musicDesktopSurface button[aria-label="恢复听潮主窗口"]');await waitFor(()=>document.querySelector('[data-tingchao-root]')?.dataset.visible==='true');
  await evaluate(()=>DesktopGate.lock());await waitFor(()=>Win.isLocked()&&!!document.querySelector('[aria-label="听潮锁屏媒体控制"]'));
  await check('lock preserves playing state and clock view',()=>evaluate(()=>AidenMusic.getSnapshot().status==='playing'&&document.getElementById('lockScreen').dataset.gateView==='clock'));
  const beforeNext=await state();await click('#lockMusicControls button[aria-label="下一首"]');await waitFor(()=>AidenMusic.getSnapshot().status==='playing');
  await check('lock next resolves through existing playback lease',async()=>{const now=await state();return now.id!==beforeNext.id&&now.status==='playing'&&(await evaluate(()=>Win.isLocked()&&document.getElementById('lockScreen').dataset.gateView==='clock'));});
  await click('#lockMusicControls button[aria-label="暂停播放"]');
  await check('lock pause does not trigger unlock',()=>evaluate(()=>AidenMusic.getSnapshot().status==='paused'&&Win.isLocked()&&document.getElementById('lockScreen').dataset.gateView==='clock'));
  await screenshot('qa/tingchao/lock-round1.png');
  await check('locked library edit denied',()=>evaluate(async()=>{const res=await fetch('/__desktop/music/v1/playlists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'must not exist',privacy:'private'})});return res.status===401;}));
  await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());
  await check('unlock retains paused state',()=>evaluate(()=>AidenMusic.getSnapshot().status==='paused'&&__tingchaoQa.audio[0].paused));
  await evaluate(()=>DesktopGate.lock());await waitFor(()=>Win.isLocked()&&document.getElementById('lockScreen').dataset.gateView==='clock');
  await check('paused before lock remains paused',()=>evaluate(()=>AidenMusic.getSnapshot().status==='paused'&&__tingchaoQa.audio[0].paused));
  await click('#gateLogin');await browser('fill','#gateAnswer','Synthetic Tingchao visitor 72');await click('#gateSubmit');await waitFor(()=>!Win.isLocked());
  await evaluate(()=>{WM.launch('tingchao');return true;});await waitFor(()=>!!document.querySelector('[data-tingchao-root]'));
 }
 if(phase==='account'){
  const playlistName='晨光与潮声 · QA '+Date.now().toString(36).slice(-4);let playlistId;
  if(await evaluate(()=>document.querySelector('[class*="accountButton"]')?.textContent.includes('隔离测试账号'))){await click(root+' button[class*="accountButton"]');await browser('click','--role','button','--name','退出网易云音乐');await waitFor(()=>document.querySelector('[class*="accountButton"]')?.textContent.includes('扫码登录'));}
  await browser('click','--role','button','--name','扫码登录');
  await waitFor(()=>document.querySelector('[data-tingchao-root] [aria-modal="true"] img')?.src.startsWith('data:image/'));
  await screenshot('qa/tingchao/qr-synthetic-round2.png');
  await waitFor(()=>!document.querySelector('[data-tingchao-root] [aria-modal="true"]')&&document.querySelector('[class*="accountButton"]')?.textContent.includes('隔离测试账号'));
  await check('QR login reaches isolated account',()=>evaluate(async()=>{const value=await(await fetch('/__desktop/music/v1/session')).json();return value.ok&&value.data.authenticated&&value.data.user.name==='隔离测试账号';}));
  await click(root+' button[aria-label="新建歌单"]');
  await browser('fill',root+' [aria-modal="true"] input[data-autofocus]',playlistName);
  await click(root+' [aria-modal="true"] input[name="privacy"]','--nth','1');
  await click(root+' [aria-modal="true"] button[type="submit"]');
  await waitFor(()=>!!document.querySelector('main h1')&&!document.querySelector('[data-tingchao-root] [aria-modal="true"]'));
  await check('private playlist created through UI',async()=>{playlistId=await evaluate(async name=>{const events=await(await fetch('/__qa/events')).json();return events.find(e=>e.method==='playlist_create'&&e.name===name&&e.privacy===10)?.id;},playlistName);return !!playlistId;});
  await browser('fill',root+' input[aria-label="搜索歌曲、歌手、专辑或歌单"]','潮');await click(root+' button[aria-label="开始搜索"]');
  await waitFor(()=>!!document.querySelector('main [role="table"]'));
  await browser('click','main button[aria-label^="收藏 "]','--nth','0');
  await waitFor(()=>document.querySelector('[data-tingchao-root] [aria-modal="true"]')?.getAttribute('aria-label')==='收藏到歌单');
  const option=await evaluate(name=>Array.from(document.querySelectorAll('[data-tingchao-root] [aria-modal="true"] button[class*="playlistOption"]')).findIndex(button=>button.textContent.includes(name)),playlistName);
  await browser('click',root+' [aria-modal="true"] button[class*="playlistOption"]','--nth',String(option));
  await browser('click','--role','button','--name','放进歌单');
  await waitFor(()=>!document.querySelector('[data-tingchao-root] [aria-modal="true"]'));
  await check('add selected track to own playlist',()=>evaluate(async id=>{const events=await(await fetch('/__qa/events')).json();return events.some(e=>e.method==='playlist_tracks'&&e.op==='add'&&e.id===id&&e.tracks.length===1);},playlistId));
  await click(root+' nav button[title="我的歌单"]');await waitFor(()=>!!document.querySelector('main button[class*="playlistCard"]'));
  const card=await evaluate(name=>Array.from(document.querySelectorAll('main button[class*="playlistCard"]')).findIndex(button=>button.textContent.includes(name)),playlistName);
  await browser('click','main button[class*="playlistCard"]','--nth',String(card));
  await waitFor(()=>!!document.querySelector('main button[aria-label^="从歌单移出"]'));
  await browser('click','main button[aria-label^="从歌单移出"]','--nth','0');
  await waitFor(()=>document.querySelector('main')?.textContent.includes('等着第一首歌'));
  await check('remove track updates own playlist',()=>evaluate(async id=>{const events=await(await fetch('/__qa/events')).json();return events.some(e=>e.method==='playlist_tracks'&&e.op==='del'&&e.id===id);},playlistId));
  await screenshot('qa/tingchao/playlist-edited-round2.png');
 }
 if(phase==='search'){
  await browser('fill',root+' input[aria-label="搜索歌曲、歌手、专辑或歌单"]','潮');await click(root+' button[aria-label="开始搜索"]');
  await waitFor(()=>!!document.querySelector('main [role="table"]'));
  if(await evaluate(()=>!!document.querySelector('main button[class*="loadMore"]')))await browser('click','main button[class*="loadMore"]');
  await waitFor(()=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')==='81');
  await check('search pagination appends complete result',()=>evaluate(()=>document.querySelector('main [role="table"]').getAttribute('aria-rowcount')==='81'));
  await evaluate(()=>{const rows=document.querySelector('main div[class*="trackRows"]');rows.scrollTop=700;return true;});
  await browser('click','main button[class*="albumLink"]','--nth','16');
  await waitFor(()=>document.querySelector('main h1')?.textContent==='水岸声音 · 测试专辑');
  await click(root+' button[aria-label="后退"]');
  await waitFor(()=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')==='81');
  await check('back restores search pagination and scroll',()=>evaluate(()=>document.querySelector('main div[class*="trackRows"]').scrollTop>=600));
  for(const [index,title]of [[1,'潮汐来信'],[2,'水岸声音 · 测试专辑'],[3,'听潮测试乐团']]){
   await browser('click','nav[aria-label="搜索结果类型"] button','--nth',String(index));
   await waitFor(()=>!!document.querySelector('main button[class*="Card"]'));
   await browser('click','main button[class*="Card"]','--nth','0');
   await waitFor(expected=>document.querySelector('main h1')?.textContent===expected,12000,title);
   await check('search detail '+index,()=>evaluate(()=>!!document.querySelector('main [role="table"]')));
   await click(root+' button[aria-label="后退"]');await waitFor(()=>!!document.querySelector('nav[aria-label="搜索结果类型"]'));
  }
  await screenshot('qa/tingchao/search-round2.png');
 }
 if(phase==='queue'){
  await click(root+' nav button[title="听潮漫游"]');await waitFor(()=>!!document.querySelector('main button[class*="heroPlay"]'));
  await click('main button[class*="heroPlay"]');await waitFor(()=>AidenMusic.getSnapshot().status==='playing'&&AidenMusic.getSnapshot().queue.length===8);
  const modes=['shuffle','repeat-one','sequence'];
  for(const mode of modes){await click('[aria-label="音乐播放器"] button[aria-label*="点击"]');await check('mode '+mode,()=>evaluate(expected=>AidenMusic.getSnapshot().mode===expected,mode));}
  await evaluate(()=>{const input=document.querySelector('[aria-label="音乐音量"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0.33');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;});
  await check('volume is applied to audio',()=>evaluate(()=>Math.abs(AidenMusic.getSnapshot().volume-.33)<.001&&Math.abs(__tingchaoQa.audio[0].volume-.33)<.001));
  await click('[aria-label="音乐播放器"] button[aria-label="静音"]');await check('mute',()=>evaluate(()=>AidenMusic.getSnapshot().muted&&__tingchaoQa.audio[0].muted));await click('[aria-label="音乐播放器"] button[aria-label="恢复声音"]');
  const before=await evaluate(()=>({ids:AidenMusic.getSnapshot().queue.map(x=>x.queueId),track:AidenMusic.getSnapshot().currentTrack.id}));
  await click('[aria-label="音乐播放器"] button[aria-label^="播放队列，"]');
  await browser('click','aside[aria-label="播放队列"] button[aria-label^="上移 "]','--nth','1');
  await check('queue reorder retains current track',()=>evaluate(expected=>AidenMusic.getSnapshot().queue[0].queueId===expected.ids[1]&&AidenMusic.getSnapshot().currentTrack.id===expected.track&&AidenMusic.getSnapshot().status==='playing',before));
  await browser('click','aside[aria-label="播放队列"] button[aria-label^="移除 "]','--nth','2');await check('queue remove',()=>evaluate(()=>AidenMusic.getSnapshot().queue.length===7));
  await screenshot('qa/tingchao/queue-round2.png');await click('button[aria-label="关闭播放队列"]');
  await browser('click','main button[aria-label$="的更多操作"]','--nth','0');await browser('click','--role','button','--name','下一首播放');
  await check('next insertion permits duplicate songs with distinct ids',()=>evaluate(()=>{const s=AidenMusic.getSnapshot();return s.queue.length===8&&new Set(s.queue.map(x=>x.queueId)).size===8&&s.queue[s.currentIndex+1].track.id==='1';}));
  await click('[aria-label="音乐播放器"] button[aria-label^="播放队列，"]');await click('aside[aria-label="播放队列"] div[class*="queueSummary"] button');
  await check('clear queue clears playback and metadata',()=>evaluate(()=>{const s=AidenMusic.getSnapshot();return s.queue.length===0&&s.currentTrack===null&&__tingchaoQa.audio[0].paused&&(!navigator.mediaSession||navigator.mediaSession.metadata===null);}));await click('button[aria-label="关闭播放队列"]');
  await browser('click','main button[class*="playlistCard"]','--nth','0');await waitFor(()=>!!document.querySelector('main button[class*="primaryButton"]'));
  await click('main button[class*="primaryButton"]');await waitFor(()=>AidenMusic.getSnapshot().queue.length===80&&AidenMusic.getSnapshot().status==='playing');
  await check('play all loads complete paged playlist',()=>evaluate(()=>AidenMusic.getSnapshot().queue.length===80));
 }
 if(phase==='large'){
  await browser('fill',root+' input[aria-label="搜索歌曲、歌手、专辑或歌单"]','长列表');await click(root+' button[aria-label="开始搜索"]');await waitFor(()=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')==='51');
  for(const count of [101,151,201,231]){await click('main button[class*="loadMore"]');await waitFor(expected=>document.querySelector('main [role="table"]')?.getAttribute('aria-rowcount')===String(expected),12000,count);}
  await check('230-track search is virtualized',()=>evaluate(()=>document.querySelector('main [role="table"]').getAttribute('aria-rowcount')==='231'&&document.querySelectorAll('main [role="row"]').length<50));
  await browser('click','main button[class*="trackCoverButton"]','--nth','0');await waitFor(()=>AidenMusic.getSnapshot().queue.length===230&&AidenMusic.getSnapshot().status==='playing');
  await click('[aria-label="音乐播放器"] button[aria-label^="播放队列，"]');
  await check('230-track queue is virtualized',()=>evaluate(()=>document.querySelectorAll('aside[aria-label="播放队列"] div[class*="queueRows"] > div[class*="queueRow"]').length<50));await click('button[aria-label="关闭播放队列"]');
  await evaluate(()=>{const list=document.querySelector('main div[class*="trackRows"]');list.scrollTop=list.scrollHeight;return true;});await waitFor(()=>!!document.querySelector('main [aria-rowindex="231"]'));
  await check('virtualized last track reachable',()=>evaluate(()=>!!document.querySelector('main [aria-rowindex="231"]')));
 }
 if(phase==='visual'){
  await click(root+' nav button[title="听潮漫游"]');await waitFor(()=>!!document.querySelector('main img[src*="-tide.webp"]'));
  await evaluate(()=>{const win=WM.byApp('tingchao')[0];WM.snap(win,'max');window.__tingchaoQa.layouts=[];const capture=()=>{const app=document.querySelector('[data-tingchao-root]'),rail=document.querySelector('[aria-label="此刻正在听"]'),nav=app.querySelector('aside');const r=app.getBoundingClientRect();__tingchaoQa.layouts.push({viewport:[innerWidth,innerHeight],app:[r.width,r.height],overflow:app.scrollWidth>app.clientWidth+1,rail:getComputedStyle(rail).display,nav:getComputedStyle(nav).position});};window.addEventListener('resize',capture);window.__tingchaoQa.captureLayout=capture;win.el.style.width='100vw';win.el.style.height='calc(100vh - var(--taskbar-h))';return true;});
  for(const [theme,width,height]of [['light',1920,1080],['dark',1920,1080],['light',1366,768],['dark',800,720],['light',390,844]]){
   await choose(root+' select[aria-label="听潮外观"]',theme);
   await evaluate(()=>{const win=WM.byApp('tingchao')[0];win.el.style.width='100vw';win.el.style.height='calc(100vh - var(--taskbar-h))';return true;});
   await screenshot(`qa/tingchao/home-${theme}-${width}-round2.png`,width,height);
  }
  await check('real responsive containers at all capture sizes',()=>evaluate(()=>[[1920,1080],[1366,768],[800,720],[390,844]].every(([w,h])=>__tingchaoQa.layouts.some(l=>l.viewport[0]===w&&l.viewport[1]===h&&l.app[0]<=w+1&&!l.overflow))));
  await fs.writeFile('qa/tingchao/layouts-round2.json',JSON.stringify(await evaluate(()=>__tingchaoQa.layouts),null,2)+'\n');
  await choose(root+' select[aria-label="听潮外观"]','auto');await check('auto theme follows desktop',()=>evaluate(()=>document.querySelector('[data-tingchao-root]').dataset.musicTheme===Win.effectiveTheme()));
  await click('[aria-label="展开沉浸歌词"]');await waitFor(()=>!!document.querySelector('div[aria-label="沉浸歌词"]'));
  const perf=await evaluate(()=>new Promise(resolve=>{const gaps=[];let last=0,start=0;const tick=t=>{if(last)gaps.push(t-last);else start=t;last=t;if(t-start<1200)requestAnimationFrame(tick);else resolve({frames:gaps.length,averageMs:gaps.reduce((a,b)=>a+b,0)/gaps.length,p95Ms:gaps.sort((a,b)=>a-b)[Math.floor(gaps.length*.95)]});};requestAnimationFrame(tick);}));
  checks.push({name:'immersive frame sampling (observed machine)',pass:true,detail:perf});
  await click('#windowLayer button[aria-label="最小化"]');await waitFor(()=>document.querySelector('[data-tingchao-root]')?.dataset.visible==='false');
  await check('hidden window freezes progress while audio advances',()=>evaluate(async()=>{await new Promise(r=>setTimeout(r,250));const input=document.querySelector('[aria-label="音乐播放器"] input[aria-label="播放进度"]'),before=input.value,time=__tingchaoQa.audio[0].currentTime;await new Promise(r=>setTimeout(r,800));return input.value===before&&__tingchaoQa.audio[0].currentTime>time+.4;}));
  await click('#musicDesktopSurface button[aria-label="恢复听潮主窗口"]');await waitFor(()=>document.querySelector('[data-tingchao-root]')?.dataset.visible==='true');
  const motion=await evaluate(()=>Win.prefs.motion);await evaluate(()=>{Win.setPref('motion',false);return true;});await check('reduced motion propagated',()=>evaluate(()=>document.querySelector('[data-tingchao-root]').dataset.reducedMotion==='true'));await evaluate(value=>{Win.setPref('motion',value);return true;},motion);
  await browser('click','--role','button','--name','回到听潮');
 }
 if(phase==='live'){
  await waitFor(()=>{const button=document.querySelector('main button[class*="heroPlay"]');return button&&!button.disabled;},45000);
  await click('[aria-label="音乐播放器"] button[aria-label="静音"]');await click('main button[class*="heroPlay"]');
  await waitFor(()=>['playing','error'].includes(AidenMusic.getSnapshot().status),45000);
  for(let attempt=0;attempt<4&&(await state()).status!=='playing';attempt++){await click('[aria-label="音乐播放器"] button[aria-label="下一首"]');await waitFor(()=>['playing','error'].includes(AidenMusic.getSnapshot().status),45000);}
  await check('official guest source decodes and advances',()=>evaluate(async()=>{const audio=__tingchaoQa.audio[0],before=audio.currentTime;await new Promise(r=>setTimeout(r,1600));return audio.readyState>=2&&!audio.paused&&audio.currentTime>before+.5&&AidenMusic.getSnapshot().status==='playing';}));
  const source=await evaluate(()=>{const s=AidenMusic.getSnapshot(),a=__tingchaoQa.audio[0];return{track:s.currentTrack.title,sourceHost:new URL(s.source.url).hostname,quality:s.source.quality,availability:s.source.availability,preview:s.source.preview,decodedDuration:a.duration,buffered:a.buffered.length,mediaSessionTitle:navigator.mediaSession?.metadata?.title};});
  checks.push({name:'actual official source and media metadata',pass:true,detail:source});
  await screenshot('qa/tingchao/live-home-light-round2.png');await click('[aria-label="展开沉浸歌词"]');await waitFor(()=>!!AidenMusic.getSnapshot().lyrics,25000);await screenshot('qa/tingchao/live-immersive-light-round2.png');
  await check('live lyrics or instrumental fallback available',()=>evaluate(()=>!!AidenMusic.getSnapshot().lyrics));
  await click('#windowLayer button[aria-label="关闭"]');await check('real stream continues after close',()=>evaluate(()=>AidenMusic.getSnapshot().status==='playing'&&!__tingchaoQa.audio[0].paused));
  await click('#musicDesktopSurface button[aria-label="暂停播放"]');
 }
 console.log(JSON.stringify(await inspect()));
 await fs.writeFile('qa/tingchao/results-'+phase+'.json',JSON.stringify({phase,at:new Date().toISOString(),checks,state:await state()},null,2)+'\n');
}catch(error){await fs.writeFile('qa/tingchao/failure-'+phase+'.json',JSON.stringify({phase,error:error.stack,checks,inspection:await inspect().catch(()=>null)},null,2)+'\n');console.error(error);process.exitCode=1;}
