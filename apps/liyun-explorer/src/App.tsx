import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ExplorationState, GameSettings, MapCamera, PanelId, SceneEvent, Viewport } from './types';
import { LANDMARKS, MAP_HEIGHT, MAP_WIDTH } from './data';
import { createExploredState, createInitialState, explore, progressOf, restoreState, SAVE_KEY, LEGACY_SAVE_KEY } from './state';
import MapScene from './map/MapScene';
import { cameraAt, clampCamera, initialCamera, uvToScreen } from './map/geometry';
import Hud from './hud/Hud';
import Atmosphere from './effects/Atmosphere';
import { useAudio } from './audio/useAudio';
import { useCampusLocation } from './location/useCampusLocation';
import LocationControls from './location/LocationControls';
import { campusLandmarks, distanceMeters, GOOD_ACCURACY_M, nearestLandmark, headingOnMap } from './location/campus';
import { checkInEligibility } from './location/checkIn';

const params = new URLSearchParams(location.search);
const qaMode = import.meta.env.DEV && params.get('qa') === '1';
const preset = qaMode ? params.get('preset') : null;
function load(): ExplorationState {
  if (preset === 'explored') return createExploredState();
  if (preset === 'fog') return createInitialState();
  try { return restoreState(localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY), matchMedia('(prefers-reduced-motion: reduce)').matches); }
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
  const [entered, setEntered] = useState(qaMode);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [event, setEvent] = useState<SceneEvent | null>(null);
  const eventRef=useRef(event);eventRef.current=event;
  const [toast, setToast] = useState<string | null>(null);
  const [hidden, setHidden] = useState(document.hidden);
  const [isFullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fixedTime, setFixedTime] = useState<number | undefined>();
  const [art, setArt] = useState({pine:true,mountain:true});
  const location = useCampusLocation();
  const locationRef = useRef(location.state);locationRef.current = location.state;
  const [followingLocation, setFollowingLocation] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useAudio(state.settings, entered && !qaMode);
  const portrait = viewport.width <= viewport.height;
  const selected = LANDMARKS.find(x => x.id === selectedId) ?? null;
  const message = useCallback((text:string) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3600); }, []);
  useEffect(() => { if (preset) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Private mode keeps a usable in-memory session. */ } }, [state]);
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
  const enter=()=>{const track=Math.floor(Math.random()*3);settings({track});audio.start(track);setEntered(true);if(matchMedia('(pointer: coarse)').matches)fullscreen();};
  const select=useCallback((id:string)=>{if(!LANDMARKS.some(x=>x.id===id))return;setSelectedId(id);setActivePanel(null);},[]);
  const close=useCallback(()=>{setActivePanel(null);setSelectedId(null);},[]);
  const moveCamera=useCallback((next:MapCamera)=>{if(cameraFrame.current!==undefined)cancelAnimationFrame(cameraFrame.current);setFollowingLocation(false);setCamera(next);},[]);
  const discover=useCallback((id:string)=>{
    const place=LANDMARKS.find(x=>x.id===id),before=stateRef.current;
    if(!place)return;
    if(before.discoveredIds.includes(id)){message('这一处风景，已收录于你的旅途');return;}
    const next = explore(before,id,locationRef.current);
    if (next === before) { message(checkInEligibility(id,locationRef.current).message);return; }
    setFollowingLocation(false);
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
    stateRef.current=next;setState(next);
    setEvent({id:Date.now(),type:'discover',landmarkId:id,from,to:place.uv,startedAt,duration:before.settings.reducedMotion?400:3200});
    setSelectedId(null);if(!qaMode)audio.playChime();message(`打卡成功 · ${place.name}`);
  },[audio.playChime,message]);
  useEffect(() => {
    const reading = location.state.reading;
    if (!followingLocation || location.state.status !== 'tracking' || !reading?.insideImage) return;
    if (cameraFrame.current !== undefined) cancelAnimationFrame(cameraFrame.current);
    setCamera(current => cameraAt(reading.uv, viewportRef.current, current.scale));
  }, [followingLocation, location.state.reading, location.state.status]);
  const locate = () => {
    location.start();
    setFollowingLocation(true);
    if (location.state.status === 'tracking' && location.state.reading?.insideImage) {
      setCamera(current => cameraAt(location.state.reading!.uv, viewportRef.current, current.scale));
    }
  };
  const center=useCallback(()=>{
    if(location.state.status==='tracking' && location.state.reading?.insideImage){
      setFollowingLocation(true);setCamera(current=>cameraAt(location.state.reading!.uv,viewportRef.current,current.scale));
    }else moveCamera(initialCamera(viewportRef.current));
  },[moveCamera,location.state]);
  const reading = location.state.reading;
  const freshLocation = location.state.status === 'tracking';
  const headingAngle = freshLocation && reading?.insideImage && reading.accuracy <= GOOD_ACCURACY_M
    && location.heading.status === 'active' && location.heading.bearing !== null
    ? headingOnMap(reading,location.heading.bearing) : null;
  let distanceLabel = '';
  if (reading?.insideImage && freshLocation && reading.accuracy <= GOOD_ACCURACY_M) {
    const target = selected ? campusLandmarks.find(place => place.id === selected.id) : nearestLandmark(reading);
    if (target && !target.isBeacon) {
      const distance = distanceMeters(reading, target);
      distanceLabel = `${selected ? '所选点位' : '最近点位'}：${state.discoveredIds.includes(target.id) ? target.name : '未知地标'} · 直线约 ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} 千米` : `${Math.round(distance)} 米`}`;
    } else if (target?.isBeacon) distanceLabel = '所选信标为虚构玩法点，不提供真实目的地距离';
  }
  const reset=()=>{setState(s=>({...createInitialState(s.settings.reducedMotion),settings:s.settings}));setEvent(null);setSelectedId(null);setActivePanel(null);center();message('云雾归来，新的旅途已开启');};
  useEffect(()=>{
    if(!qaMode)return;
    const api={getState:()=>stateRef.current,getCamera:()=>visual.current.camera,getEvent:()=>eventRef.current,flushSync,select,discover,setCamera,reset,freeze:(offset?:number)=>setFixedTime(offset===undefined?undefined:(event?.startedAt??0)+offset),showPanel:(panel:PanelId)=>{setSelectedId(null);setActivePanel(panel);},setPreset:(name:string)=>{setState(name==='explored'?createExploredState():createInitialState());setEvent(null);setFixedTime(undefined);setToast(null);clearTimeout(toastTimer.current);setSelectedId(null);setActivePanel(null);moveCamera(initialCamera(viewportRef.current));},setEntered};
    (window as unknown as {__LIYUN__:typeof api}).__LIYUN__=api;
  },[camera,discover,select,event]);
  return <div className="game-stage" ref={stage} data-testid="game-stage" data-entered={entered} data-progress={progressOf(state)}>
    <MapScene camera={camera} viewport={viewport} landmarks={LANDMARKS} discoveredIds={state.discoveredIds} selectedId={selectedId} playerUV={state.playerUV} liveLocation={reading} locationFresh={freshLocation} headingAngle={headingAngle} event={event} reducedMotion={state.settings.reducedMotion} onCameraChange={moveCamera} onSelect={select} onVisualPosition={rememberVisual} fixedTime={fixedTime} paused={hidden||portrait} disabled={portrait||!entered||Boolean(activePanel)||Boolean(selectedId)} />
    <Atmosphere camera={camera} viewport={viewport} landmarks={LANDMARKS} discoveredIds={state.discoveredIds} event={event} settings={state.settings} paused={hidden||portrait} seed={42} fixedTime={fixedTime}/>
    <div className="scene-vignette"/>
    {entered && !portrait && <LocationControls state={location.state} heading={location.heading} following={followingLocation} distance={distanceLabel} onLocate={locate} onStop={()=>{setFollowingLocation(false);location.stop();}}/>}
    {art.pine&&<img className="border-art pine" src="/assets/art/pine-left.png" alt="" onError={()=>setArt(s=>({...s,pine:false}))}/>}
    {art.mountain&&<img className="border-art mountain" src="/assets/art/mountain-right.png" alt="" onError={()=>setArt(s=>({...s,mountain:false}))}/>}
    <div className="hud-layer" inert={portrait}><Hud progress={progressOf(state)} collected={state.discoveredIds.length} activePanel={activePanel} selected={selected} discovered={Boolean(selected&&state.discoveredIds.includes(selected.id))} checkIn={selected ? checkInEligibility(selected.id,location.state) : null} state={state} landmarks={LANDMARKS} entered={entered} toast={toast} isFullscreen={isFullscreen} audioBlocked={audio.blocked} onPanel={id=>{setActivePanel(id);setSelectedId(null);}} onSelect={select} onClose={close} onExplore={()=>selectedId&&discover(selectedId)} onLocate={locate} onSettings={settings} onReset={reset} onFullscreen={fullscreen} onCenter={center} onEnter={enter}/></div>
    {portrait&&<div className="orientation-gate" role="dialog" aria-modal="true" aria-label="请横屏探索">
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><g className="rotate-line"><rect x="30" y="12" width="40" height="76" rx="7" stroke="currentColor" strokeWidth="2"/><path d="M43 20h14M46 80h8" stroke="currentColor" strokeWidth="2"/></g><path d="M83 32a38 38 0 0 0-56-15m-2-8 1 10 10-2M17 68a38 38 0 0 0 56 15m2 8-1-10-10 2" stroke="currentColor" strokeWidth="2"/></svg>
      <h1>展开一方天地</h1><p>{matchMedia('(pointer: coarse)').matches?'请手动旋转手机，横屏开启校园之旅':'请将浏览器窗口调整为横向，开启校园之旅'}<br/>你的探索进度会为你保留</p><small>理韵寻踪 · 北理校园探索</small>
    </div>}
  </div>;
}

