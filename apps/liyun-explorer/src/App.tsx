import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ExplorationState, GameSettings, MapCamera, PanelId, SceneEvent, Viewport } from './types';
import { LANDMARKS, MAP_HEIGHT, MAP_WIDTH } from './data';
import { createExploredState, createInitialState, explore, progressOf, restoreState, SAVE_KEY } from './state';
import MapScene from './map/MapScene';
import { cameraAt, clampCamera, initialCamera, uvToScreen } from './map/geometry';
import Hud from './hud/Hud';
import Atmosphere from './effects/Atmosphere';
import { useAudio } from './audio/useAudio';

const params = new URLSearchParams(location.search);
const qaMode = import.meta.env.DEV && params.get('qa') === '1';
const preset = qaMode ? params.get('preset') : null;

/**
 * 启程卡只弹一次：模块级记号 + 跨实例事件。
 * 开发模式的重复挂载、HMR 重挂载都会重新初始化组件状态，
 * 靠这两样东西保证已经点过「进入校园」后不会再弹第二张卡。
 */
const ENTERED_EVENT = 'liyun:entered';
let enteredOnce = false;

function load(): ExplorationState {
  if (preset === 'explored') return createExploredState();
  if (preset === 'fog') return createInitialState();
  try { return restoreState(localStorage.getItem(SAVE_KEY), matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch { return createInitialState(); }
}
export default function App() {
  const stage = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({width:innerWidth,height:innerHeight});
  const viewportRef = useRef(viewport);
  const [camera, setCamera] = useState<MapCamera>(() => initialCamera(viewport));
  const cameraFrame = useRef<number | undefined>(undefined);
  const landscapeView = useRef({viewport, camera});
  const [state, setState] = useState(load);
  const visual = useRef({uv:state.playerUV,camera});
  const rememberVisual=useCallback((uv:ExplorationState['playerUV'],view:MapCamera)=>{visual.current={uv,camera:view};},[]);
  const stateRef = useRef(state); stateRef.current = state;
  const [entered, setEntered] = useState(() => qaMode || enteredOnce);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [event, setEvent] = useState<SceneEvent | null>(null);
  const eventRef=useRef(event);eventRef.current=event;
  const [toast, setToast] = useState<string | null>(null);
  const [hidden, setHidden] = useState(document.hidden);
  const [isFullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fixedTime, setFixedTime] = useState<number | undefined>();
    const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useAudio(state.settings, entered && !qaMode);
  const portrait = viewport.width <= viewport.height;
  const selected = LANDMARKS.find(x => x.id === selectedId) ?? null;
  const message = useCallback((text:string) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3600); }, []);
  useEffect(() => { if (preset) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Private mode keeps a usable in-memory session. */ } }, [state]);
  useEffect(() => {
    const dismiss = () => setEntered(true);
    window.addEventListener(ENTERED_EVENT, dismiss);
    return () => window.removeEventListener(ENTERED_EVENT, dismiss);
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = {width:entry.contentRect.width,height:entry.contentRect.height};
      if (!next.width || !next.height) return;
      const prev = viewportRef.current;
      if (Math.abs(prev.width-next.width)<1 && Math.abs(prev.height-next.height)<1) return;
      if(cameraFrame.current!==undefined)cancelAnimationFrame(cameraFrame.current);
      if(prev.width>prev.height)landscapeView.current={viewport:prev,camera:visual.current.camera};
      if(next.width>next.height){
        const source=landscapeView.current,c=source.camera,old=source.viewport;
        const u=(old.width/2-c.x)/(MAP_WIDTH*c.scale),v=(old.height/2-c.y)/(MAP_HEIGHT*c.scale);
        const scale=c.scale*Math.min(next.width,next.height)/Math.min(old.width,old.height);
        setCamera(clampCamera({scale,x:next.width/2-u*MAP_WIDTH*scale,y:next.height/2-v*MAP_HEIGHT*scale},next));
      }
      viewportRef.current=next;setViewport(next);
    });
    observer.observe(stage.current);return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const visibility=()=>setHidden(document.hidden), full=()=>setFullscreen(Boolean(document.fullscreenElement));
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setActivePanel(null);setSelectedId(null);}};
    document.addEventListener('visibilitychange',visibility);document.addEventListener('fullscreenchange',full);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',full);document.removeEventListener('keydown',key);clearTimeout(toastTimer.current);if(cameraFrame.current!==undefined)cancelAnimationFrame(cameraFrame.current);};
  }, []);
  useEffect(() => { if(!event || fixedTime!==undefined) return; const timer=setTimeout(()=>setEvent(null),Math.max(0,event.startedAt+event.duration-performance.now())+100);return()=>clearTimeout(timer); }, [event,fixedTime]);
  const fullscreen=useCallback(()=>{
    if(document.fullscreenElement){void document.exitFullscreen().catch(()=>{});return;}
    const el=stage.current;
    if(!el?.requestFullscreen){message('当前浏览器不支持全屏，仍可横屏探索');return;}
    void el.requestFullscreen({navigationUI:'hide'}).then(()=>{
      const orientation=screen.orientation as ScreenOrientation & {lock?:(mode:string)=>Promise<void>};
      void orientation?.lock?.('landscape').catch(()=>{});
    }).catch(()=>message('未能进入全屏，仍可横屏继续探索'));
  },[message]);
  const settings=useCallback((patch:Partial<GameSettings>)=>setState(s=>({...s,settings:{...s.settings,...patch}})),[]);
  const enter=()=>{
    enteredOnce = true;
    const track=Math.floor(Math.random()*3);
    settings({track});audio.start(track);setEntered(true);
    // 同一次加载里若存在第二个 App 实例（开发模式重复挂载等），让它一起关闭启程卡
    window.dispatchEvent(new Event(ENTERED_EVENT));
    if(matchMedia('(pointer: coarse)').matches)fullscreen();
  };
  const select=useCallback((id:string)=>{if(!LANDMARKS.some(x=>x.id===id))return;setSelectedId(id);setActivePanel(null);},[]);
  const close=useCallback(()=>{setActivePanel(null);setSelectedId(null);},[]);
  const moveCamera=useCallback((next:MapCamera)=>{if(cameraFrame.current!==undefined)cancelAnimationFrame(cameraFrame.current);setCamera(next);},[]);
  const discover=useCallback((id:string)=>{
    const place=LANDMARKS.find(x=>x.id===id),before=stateRef.current;
    if(!place)return;
    if(before.discoveredIds.includes(id)){message('这一处风景，已收录于你的旅途');return;}
    const startedAt=performance.now(),from=visual.current.uv;
    const view=viewportRef.current, origin=visual.current.camera, point=uvToScreen(place.uv,origin);
    if(cameraFrame.current!==undefined){cancelAnimationFrame(cameraFrame.current);cameraFrame.current=undefined;}
    setCamera(origin);
    if(point.x<view.width*.26 || point.x>view.width*.88 || point.y<view.height*.2 || point.y>view.height*.78){
      const target=cameraAt(place.uv,view,origin.scale), began=performance.now();
      if(cameraFrame.current!==undefined)cancelAnimationFrame(cameraFrame.current);
      if(before.settings.reducedMotion)setCamera(target);
      else { const step=(now:number)=>{const t=Math.min(1,(now-began)/650),e=t*t*(3-2*t);setCamera({scale:origin.scale+(target.scale-origin.scale)*e,x:origin.x+(target.x-origin.x)*e,y:origin.y+(target.y-origin.y)*e});if(t<1)cameraFrame.current=requestAnimationFrame(step);};cameraFrame.current=requestAnimationFrame(step); }
    }
    setState(s=>explore(s,id));
    setEvent({id:Date.now(),type:'discover',landmarkId:id,from,to:place.uv,startedAt,duration:before.settings.reducedMotion?400:3200});
    setSelectedId(null);if(!qaMode)audio.playChime();message(`已发现 · ${place.name}`);
  },[audio.playChime,message]);
  const center=useCallback(()=>moveCamera(initialCamera(viewportRef.current)),[moveCamera]);
  const reset=()=>{setState(s=>({...createInitialState(s.settings.reducedMotion),settings:s.settings}));setEvent(null);setSelectedId(null);setActivePanel(null);center();message('云雾归来，新的旅途已开启');};
  useEffect(()=>{
    if(!qaMode)return;
    const api={getState:()=>stateRef.current,getCamera:()=>visual.current.camera,getEvent:()=>eventRef.current,flushSync,select,discover,setCamera,reset,freeze:(offset?:number)=>setFixedTime(offset===undefined?undefined:(event?.startedAt??0)+offset),showPanel:(panel:PanelId)=>{setSelectedId(null);setActivePanel(panel);},setPreset:(name:string)=>{setState(name==='explored'?createExploredState():createInitialState());setEvent(null);setFixedTime(undefined);setToast(null);clearTimeout(toastTimer.current);setSelectedId(null);setActivePanel(null);moveCamera(initialCamera(viewportRef.current));},setEntered};
    (window as unknown as {__LIYUN__:typeof api}).__LIYUN__=api;
  },[camera,discover,select,event]);
  return <div className="game-stage" ref={stage} data-testid="game-stage" data-entered={entered} data-progress={progressOf(state)}>
    {/* 纸底：与地图图片自身的纸色一致，中间不留接缝 */}
    <div className="scene-paper" aria-hidden="true" />
    {/* 左右两侧的山水 */}
    <div className="scene-painting" aria-hidden="true">
      <img src="/assets/paintings/frost-frame.webp" alt="" decoding="async" />
      <span className="scene-painting-haze" />
    </div>
    <div className="map-layer">
      <MapScene camera={camera} viewport={viewport} landmarks={LANDMARKS} discoveredIds={state.discoveredIds} selectedId={selectedId} playerUV={state.playerUV} event={event} reducedMotion={state.settings.reducedMotion} onCameraChange={moveCamera} onSelect={select} onVisualPosition={rememberVisual} fixedTime={fixedTime} paused={hidden||portrait} disabled={portrait||!entered||Boolean(activePanel)||Boolean(selectedId)} />
      <Atmosphere camera={camera} viewport={viewport} landmarks={LANDMARKS} discoveredIds={state.discoveredIds} event={event} settings={state.settings} paused={hidden||portrait} seed={42} fixedTime={fixedTime}/>
    </div>
    <div className="scene-vignette"/>
    <img className="border-art pine" src="/assets/art/pine-left.webp" alt="" />
    <img className="border-art mountain" src="/assets/art/mountain-right.webp" alt="" />
    <div className="hud-layer" inert={portrait}><Hud progress={progressOf(state)} collected={state.discoveredIds.length} activePanel={activePanel} selected={selected} discovered={Boolean(selected&&state.discoveredIds.includes(selected.id))} state={state} landmarks={LANDMARKS} entered={entered} toast={toast} isFullscreen={isFullscreen} audioBlocked={audio.blocked} onPanel={id=>{setActivePanel(id);setSelectedId(null);}} onSelect={select} onClose={close} onExplore={()=>selectedId&&discover(selectedId)} onSettings={settings} onReset={reset} onFullscreen={fullscreen} onCenter={center} onEnter={enter}/></div>
    {portrait&&<div className="orientation-gate" role="dialog" aria-modal="true" aria-label="请横屏探索">
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><g className="rotate-line"><rect x="30" y="12" width="40" height="76" rx="7" stroke="currentColor" strokeWidth="2"/><path d="M43 20h14M46 80h8" stroke="currentColor" strokeWidth="2"/></g><path d="M83 32a38 38 0 0 0-56-15m-2-8 1 10 10-2M17 68a38 38 0 0 0 56 15m2 8-1-10-10 2" stroke="currentColor" strokeWidth="2"/></svg>
      <h1>展开一方天地</h1><p>{matchMedia('(pointer: coarse)').matches?'请手动旋转手机，横屏开启校园之旅':'请将浏览器窗口调整为横向，开启校园之旅'}<br/>你的探索进度会为你保留</p><small>理韵寻踪 · 北理校园探索</small>
    </div>}
  </div>;
}

