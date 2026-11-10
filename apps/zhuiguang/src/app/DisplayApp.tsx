import { appUrl, roleUrl } from "../core/url";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type gsap from 'gsap';
import { sceneKey } from '../production/story/registry';
import { deck, params, reducedMotion, slideById } from '../core/deck';
import { useSync } from '../core/sync';
import { audio } from '../core/audio';
import { useShowAssets } from '../core/use-show-assets';
import { pageTimeline, transitionTimeline } from '../core/timeline';
import { LoadingPaper, PaperLayers, SlideView } from '../components/SlideView';
import { AudienceQr, RaffleStage } from '../components/ShowExtras';
import { Stage } from '../components/Stage';
import { usePageSwipe } from '../core/page-swipe';
import { AuthPanel, Icon, LiveInteractionButton, Navigator } from '../components/Controls';
import './display-show.css';
export default function DisplayApp(){const preview=params.get('preview');const sync=useSync('display',!preview);const [entered,setEntered]=useState(!!preview);const assets=useShowAssets(!preview);const {offlineReady,progress,retry}=assets;const ready=!!preview||assets.ready;const ended=!preview&&!!sync.state.show?.endedAt;const [renderedId,setRenderedId]=useState(preview?slideById(preview).id:'P0-01');const [qr,setQr]=useState(false);const [tools,setTools]=useState(false),[pinned,setPinned]=useState(false),[auth,setAuth]=useState(false),[directory,setDirectory]=useState(false),[muted,setMuted]=useState(false);const root=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null),pageTl=useRef<gsap.core.Timeline>(),transitionTl=useRef<gsap.core.Timeline>();const busy=useRef(false),queue=useRef<string[]>([]),rendered=useRef(renderedId),enteredRef=useRef(entered);const playedId=useRef<string>();const previewTarget=useRef(renderedId);const run=useRef<()=>void>(()=>{});const hideTools=useRef<ReturnType<typeof setTimeout>>();const lastKey=useRef(0);const slide=slideById(renderedId);
 enteredRef.current=entered;rendered.current=renderedId;
 run.current=()=>{if(busy.current||!enteredRef.current||!host.current)return;const id=queue.current.shift();if(!id)return;if(id===rendered.current){run.current();return}busy.current=true;if(reducedMotion){setRenderedId(id);return}transitionTl.current?.kill();transitionTl.current=transitionTimeline(host.current,slideById(rendered.current),slideById(id),()=>setRenderedId(id));transitionTl.current.play(0)};
 function enterAt(id:string){setRenderedId(id==='P0-02'?'P0-01':id);setEntered(true)}
 useEffect(()=>{if(ready&&!entered&&(sync.state.startedAt!==null||ended))enterAt(sync.state.pageId)},[ready,entered,ended,sync.state.startedAt,sync.state.pageId]);
 useEffect(()=>{if(!ended)return;setQr(false);setAuth(false);setDirectory(false);audio.setMuted(true);audio.silence();root.current?.querySelectorAll('video').forEach(video=>video.pause())},[ended]);
 useEffect(()=>{if(preview||!entered)return;const target=sync.state.pageId;if(target!==queue.current.at(-1)){queue.current.push(target);run.current()}},[sync.state.pageId,entered,preview]);
 useLayoutEffect(()=>{if(!entered||!root.current)return;const pageRoot=root.current;const videos=[...pageRoot.querySelectorAll('video')];const mediaEvents=['play','pause','seeked','ended'];const mediaChanged=(event:Event)=>{const video=event.currentTarget as HTMLVideoElement;if(!video.paused)audio.silence();if(!preview)sync.setMedia(renderedId,!video.paused&&!video.ended,video.currentTime)};videos.forEach(video=>mediaEvents.forEach(name=>video.addEventListener(name,mediaChanged)));busy.current=true;pageRoot.dataset.ready='false';const previousId=playedId.current;playedId.current=renderedId;pageTl.current=pageTimeline(pageRoot,slideById(renderedId),()=>{busy.current=false;pageRoot.dataset.ready='true';run.current()},previousId);const at=params.get('at');if(at!==null&&Number.isFinite(Number(at)))pageTl.current.pause(Math.max(0,Number(at)));else pageTl.current.play(0);return()=>{pageTl.current?.kill();audio.stopScene();pageRoot.getAnimations().forEach(animation=>animation.cancel());videos.forEach(v=>{mediaEvents.forEach(name=>v.removeEventListener(name,mediaChanged));v.pause();v.currentTime=0})}},[renderedId,entered]);
 useEffect(()=>()=>{clearTimeout(hideTools.current);transitionTl.current?.kill();audio.destroy()},[]);
 const start=useCallback(async()=>{if(!ready||ended)return;if(!sync.authorized){setAuth(true);return}await audio.unlock();if(!sync.state.startedAt)sync.start();enterAt(sync.state.pageId);audio.cue(slide.id,slide.chapter)},[ready,ended,sync,slide.id,slide.chapter]);
 function goPreview(id:string){if(id===previewTarget.current)return;previewTarget.current=id;if(params.has('at')){setRenderedId(id);return}queue.current.push(id);run.current()}
 function navigate(next=true){if(ended)return;if(preview){const index=deck.findIndex(page=>page.id===previewTarget.current);const target=deck[Math.max(0,Math.min(deck.length-1,index+(next?1:-1)))];goPreview(target.id);return}if(!entered){void start();return}if(!sync.authorized){setAuth(true);return}next?sync.next():sync.prev()}
 function toggleAudio(){void audio.unlock();const v=!muted;setMuted(v);audio.setMuted(v);if(!v)audio.cue(slide.id,slide.chapter)}
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.target instanceof Element&&e.target.matches('input,textarea,[contenteditable]'))||auth||directory)return;if(e.key==='Escape'){setQr(false);setPinned(false);setTools(false);return}if(e.key==='q'||e.key==='Q'){if(!ended)setQr(value=>!value);return}if(e.key==='h'||e.key==='H'){setPinned(v=>!v);setTools(true);return}if(e.key==='f'||e.key==='F'){void document.documentElement.requestFullscreen?.();return}if(ended)return;if(e.key==='m'||e.key==='M'){toggleAudio();return}if(e.key==='b'||e.key==='B'){sync.setBlackout(!sync.state.blackout);return}if(e.key==='v'||e.key==='V'){const v=root.current?.querySelector('video');if(v){if(v.paused)void v.play().catch(()=>{});else v.pause()}return}if(e.key==='ArrowRight'||e.code==='Space'||e.key==='ArrowLeft'){e.preventDefault();if(performance.now()-lastKey.current<180)return;lastKey.current=performance.now();navigate(e.key!=='ArrowLeft')}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[entered,ready,ended,sync,auth,directory,muted,renderedId]);
 const swipe=usePageSwipe(navigate,!ended&&!auth&&!directory);
 function mouse(){setTools(true);clearTimeout(hideTools.current);hideTools.current=setTimeout(()=>{if(!pinned)setTools(false)},2600)}
 return <div className={`display-app ${tools||pinned?'tools-visible':''}`} onPointerMove={mouse} onDoubleClick={()=>{setPinned(v=>!v);setTools(true)}}><Stage className="display-stage"><div ref={host} className="deck-host stage-swipe" {...swipe}>{entered?<div ref={root} className="animated-slide" key={sceneKey(renderedId)}><SlideView slide={slide} messages={sync.publicMessages} results={sync.results} state={sync.state} staticMode={reducedMotion} audienceUrl={new URL(roleUrl('audience'), location.origin).href}/></div>:<><LoadingPaper progress={progress.percent} status={ready?'纸面已备好':progress.phase==='error'?'纸面尚未铺妥':'正在铺展纸面'} failed={progress.failed.length}/><PaperLayers/>{progress.phase==='error'&&<button className="preload-retry" onClick={retry}>重新铺展 · 重试未完成资源</button>}</>}
 <svg className="texture-def" aria-hidden="true"><defs><filter id="ink-transition-filter"><feTurbulence type="fractalNoise" baseFrequency=".008" numOctaves="3" seed="4" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="100"/></filter></defs></svg><div className="transition-shade"/><div className="transition-ink"/><div className="transition-sweep"/>{!preview&&!ended&&sync.state.raffle&&<RaffleStage raffle={sync.state.raffle}/>} {qr&&!ended&&<AudienceQr/>}{sync.state.blackout&&<div className="display-blackout"/>}</div></Stage>
 {!preview&&!sync.rehearsal&&(ended||!sync.connected||(!entered&&sync.state.show))&&<aside className="display-room-status" role="status">
   {sync.state.show&&<span className="mono">场次 {sync.state.show.id}</span>}
   <span>{ended?'本场已结束':sync.joinError||(sync.connected?'现场已连接':'正在连接现场…')}</span>
   {!ended&&sync.joinError&&<button type="button" onClick={sync.retryConnection}>重试</button>}
   {(ended||sync.joinError)&&<a href={appUrl('/?role=display')}>返回场次入口</a>}
 </aside>}{params.get('debug')==='1'&&<div className="display-debug"><span>{renderedId}</span><span>{preview?'PREVIEW':sync.rehearsal?'LOCAL':`LIVE ${sync.state.revision}`}</span><span>{sync.state.online.audience} AUDIENCE</span><span>{queue.current.length} QUEUED</span><span>{progress.loaded}/{progress.total} ASSETS</span></div>}
 <div className="display-toolbar" onPointerEnter={()=>clearTimeout(hideTools.current)}>
  <button className="icon-button" disabled={ended} onClick={()=>navigate(false)} title="上一页 ←" aria-label="上一页"><Icon name="prev"/></button>
  <span className="page-chip">{entered?renderedId:'PRELUDE'}</span>
  <button className="icon-button" disabled={ended} onClick={()=>navigate()} title="下一页 / 开始 → 空格" aria-label="下一页或开始"><Icon name="next"/></button>
  <i className="tool-separator"/>
  <button className="icon-button" disabled={ended} onClick={()=>{if(sync.authorized||preview)setDirectory(true);else setAuth(true)}} title="节目单" aria-label="节目单"><Icon name="grid"/></button>
  <button className="icon-button" disabled={ended} onClick={toggleAudio} title="切换声音 M" aria-label="切换声音" aria-pressed={muted}><Icon name={muted?'mute':'sound'}/></button>
  <button className="icon-button" disabled={ended} onClick={()=>sync.setBlackout(!sync.state.blackout)} title="熄灯 B" aria-label="熄灯" aria-pressed={sync.state.blackout}><Icon name="blackout"/></button>
  <button className="icon-button" onClick={()=>void document.documentElement.requestFullscreen?.()} title="全屏 F" aria-label="全屏"><Icon name="fullscreen"/></button>
  <i className="tool-separator"/>
  <a className="icon-button" href={roleUrl('presenter',sync.rehearsal)} target="_blank" rel="noreferrer" title="提词器" aria-label="提词器"><Icon name="teleprompter"/></a>
  <button className="icon-button" disabled={ended} onClick={()=>setQr(value=>!value)} title="观众扫码 Q" aria-label="观众扫码" aria-pressed={qr}><Icon name="qr"/></button>
  <a className="icon-button" href={appUrl('/?role=gallery')} target="_blank" rel="noreferrer" title="画册" aria-label="画册"><Icon name="gallery"/></a>
  {entered&&!ended&&<LiveInteractionButton slide={slide} sync={sync} iconOnly/>}
 </div>
 {!entered&&!ended&&(tools||ready)&&<div className="preload-backstage">{ready?'资源已备妥 · 空格开始':'准备离线资源中'} · H 固定工具栏 · {offlineReady?'离线缓存已就绪':ready?'离线缓存未就绪 · 保持联网或重试':'正在核验离线缓存'}{offlineReady&&!sync.connected&&!sync.rehearsal&&!sync.authorized&&<a href={appUrl('/?role=display&motion=on&rehearsal=1')}>启动本机离线放映 ↗</a>}{ready&&!offlineReady&&<button className="secondary-button" onClick={retry}>重试离线准备</button>}</div>}
 {auth&&<AuthPanel sync={sync} onClose={()=>setAuth(false)}/>} {directory&&<Navigator current={renderedId} onGo={id=>{if(preview)goPreview(id);else sync.go(id)}} onClose={()=>setDirectory(false)}/>}</div>}
