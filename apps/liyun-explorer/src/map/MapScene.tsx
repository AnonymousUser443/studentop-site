import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '../data';
import type { IconName, MapCamera, MapSceneProps, UV } from '../types';
import { cameraLimits, clamp, clampCamera, screenToUV, uvToScreen, zoomAt } from './geometry';
import { springStep } from './spring';
import './map.css';
import { CAMPUS_MAP_IMAGE, CAMPUS_MAP_FALLBACK, GOOD_ACCURACY_M } from '../location/campus';
import '../location/location.css';
import { useLabelOcclusion } from './useLabelOcclusion';
import { useSettings } from '../app/stores/useSettings';
import { useExploration } from '../app/stores/useExploration';
import RegionPaper from '../world/paper/RegionPaper';

// Same calibrated canvas; only the colour and paper grain differ in the player.
const campusTextures = [
  '/assets/maps/campus-xuan.webp',
  CAMPUS_MAP_IMAGE,
  ...(import.meta.env.DEV ? [CAMPUS_MAP_FALLBACK] : []),
];

type Point = { x: number; y: number };
type ViewOrigin = { left: number; top: number; viewport: MapSceneProps['viewport'] };
type Gesture = { camera: MapCamera; origin: Point; distance: number; anchor: UV };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const sameCamera = (a: MapCamera, b: MapCamera) => a.x === b.x && a.y === b.y && a.scale === b.scale;
function visualPlayer({ playerUV, event, reducedMotion, fixedTime }: MapSceneProps, now: number) {
  if (!event || reducedMotion) return { position: playerUV, travelling: false };
  const t = clamp(((fixedTime ?? now) - event.startedAt) / (event.duration * .43), 0, 1);
  const eased = t * t * (3 - 2 * t);
  return { position: { u: event.from.u + (event.to.u - event.from.u) * eased, v: event.from.v + (event.to.v - event.from.v) * eased }, travelling: t < 1 };
}
function capturePointer(element: HTMLElement, id: number) {
  try { if (!element.hasPointerCapture(id)) element.setPointerCapture(id); }
  catch { /* The OS may cancel a pointer while the viewport is rotating. */ }
}

const MarkerGlyph = memo(function MarkerGlyph({ icon, locked }: { icon: IconName; locked: boolean }) {
  if (locked) return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 17v-5a6 6 0 0 1 12 0v5m-14 0h16v16H12z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"/><path d="M20 22v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
  return <svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {icon === 'lake' ? <><path d="M20 5c-2 8-11 13-11 20a11 11 0 0 0 22 0C31 18 22 13 20 5Z" fill="#58bad0" stroke="#d8f5f3"/><path d="M20 13c-1 7-6 9-6 14s4 6 5 6M23 17c5 7 5 11 0 14" stroke="#e2fff6" strokeWidth="1.2"/></> : icon === 'book' ? <><path d="M20 11c-7-5-13-3-13-3v22s7-1 13 4c6-5 13-4 13-4V8s-6-2-13 3v23"/><path d="M11 14l5 2m-5 4 5 2m8-6 5-2m-5 8 5-2"/></> : icon === 'sport' ? <><circle cx="23" cy="8" r="3" fill="currentColor" stroke="none"/><path d="m10 17 8-6 6 9 7 2m-13-11-2 12-8 10m8-10 9 5-1 8" strokeWidth="3.3"/></> : icon === 'gate' ? <><path d="m6 15 14-9 14 9M9 17h22M12 18v16m16-16v16M9 34h22M17 34V22h6v12"/><path d="M8 13h24M16 9V6h8v3" strokeWidth="2.5"/></> : <><path d="m20 4 4 11 12 5-12 4-4 12-4-12L4 20l12-5 4-11Z"/><path d="m20 13 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="currentColor"/></>}
  </svg>;
});

const Beacon = memo(function Beacon() {
  return <svg className="map-beacon-tower" viewBox="0 0 100 140" aria-hidden="true">
    <ellipse cx="50" cy="120" rx="45" ry="12" fill="#e9c777" opacity=".15"/>
    <ellipse cx="50" cy="119" rx="37" ry="10" fill="none" stroke="#ffe4a4" strokeWidth="1.2"/>
    <ellipse cx="50" cy="120" rx="27" ry="7" fill="none" stroke="#ffe4a4" strokeWidth="1.6"/>
    <path d="m27 116 9-14 5-60 5-12 4-23 4 23 5 12 5 60 9 14-23 7Z" fill="#807342" stroke="#ffe4a4" strokeWidth="1.6"/>
    <path d="m50 9 3 22 5 14-5 59 11 14-14 4Z" fill="#e9d388"/>
    <path d="m35 107 15 4 15-4M40 44l10 6 9-6M41 60l9 5 8-5M40 80l10 4 10-4M37 100l13 6 13-6" stroke="#fbe4aa" fill="none"/>
    <path d="M45 119v-12a5 5 0 0 1 10 0v12" fill="#263f35" stroke="#fbe4aa"/>
    <path d="m49 53-3 17m7-17 3 17m-7 19-1 10m5-10 1 10" stroke="#fff1c6"/>
    <path d="M6 110c-7-34 2-72 27-88m34 0c25 16 34 54 27 88" stroke="#ffe4a4" fill="none" strokeWidth=".8" opacity=".7"/>
    <path d="m50 0 3 5-3 4-3-4Z" fill="#fff5c5"/>
  </svg>;
});

export default memo(function MapScene(props: MapSceneProps) {
  const { camera, viewport, landmarks, discoveredIds, selectedId, playerUV, event, reducedMotion, disabled, fixedTime, paused, onSelect, onVisualPosition } = props;
  const surface = useRef<HTMLDivElement>(null);
  const dragSensitivity = useSettings(state => state.settings.dragSensitivity);
  const zoomLimit = useSettings(state => state.settings.zoomLimit);
  const doubleZoom = useSettings(state => state.settings.doubleZoom);
  const unlockedRegionIds = useExploration(state => state.state.unlockedRegionIds);
  const controls = useRef({ dragSensitivity, zoomLimit, doubleZoom });
  controls.current = { dragSensitivity, zoomLimit, doubleZoom };
  const propsRef = useRef(props);
  propsRef.current = props;
  const gestureCamera = useRef(camera);
  const lastCameraProp = useRef(camera);
  const lastSent = useRef<MapCamera | null>(null);
  const pending = useRef<MapCamera | null>(null);
  const moveFrame = useRef(0);
  if (lastCameraProp.current !== camera) {
    lastCameraProp.current = camera;
    if (!pending.current && camera !== lastSent.current) gestureCamera.current = camera;
  }
  const emitCamera = (next: MapCamera) => { lastSent.current = next; propsRef.current.onCameraChange(next); };
  const cancelMove = () => { cancelAnimationFrame(moveFrame.current); moveFrame.current = 0; pending.current = null; };
  const flushMove = () => {
    const next = pending.current;
    cancelMove();
    if (next && !propsRef.current.disabled && !document.hidden) emitCamera(next);
  };
  const queueCamera = (next: MapCamera) => {
    if (sameCamera(next, gestureCamera.current)) return;
    // Input owns this optimistic position even before React commits. A pinch
    // ending mid-frame can immediately start panning from the last zoom anchor.
    gestureCamera.current = next;
    pending.current = next;
    if (!moveFrame.current) moveFrame.current = requestAnimationFrame(flushMove);
  };
  const changeCamera = (next: MapCamera) => {
    const changed = !sameCamera(next, gestureCamera.current) || pending.current !== null;
    cancelMove();
    gestureCamera.current = next;
    if (changed) emitCamera(next);
  };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const gestureRect = useRef<ViewOrigin | undefined>(undefined);
  const suppressClickUntil = useRef(0);
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);
  const draggingPointer = useRef(false);
  const showDragging = (active: boolean) => {
    if (draggingPointer.current === active) return;
    draggingPointer.current = active;
    setDragging(active);
  };
  const [imageIndex, setImageIndex] = useState(0);
  const cancelWheel = useRef<() => void>(() => undefined);

  const viewOrigin = (): ViewOrigin => {
    const { left, top } = surface.current!.getBoundingClientRect();
    return { left, top, viewport: propsRef.current.viewport };
  };
  const localPoint = (e: {clientX: number; clientY: number}, duringGesture = false): Point => {
    const rect = duringGesture
      ? gestureRect.current?.viewport === propsRef.current.viewport ? gestureRect.current : (gestureRect.current = viewOrigin())
      : viewOrigin();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startGesture = () => {
    const list = [...pointers.current.values()];
    if (!list.length) { gesture.current = null; return; }
    const origin = list.length > 1 ? midpoint(list[0], list[1]) : list[0];
    const currentCamera = gestureCamera.current;
    gesture.current = { camera: currentCamera, origin, distance: list.length > 1 ? distance(list[0], list[1]) : 0, anchor: screenToUV(origin.x, origin.y, currentCamera) };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    cancelWheel.current();
    if (propsRef.current.disabled || document.hidden || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (!pointers.current.size) gestureRect.current = undefined;
    pointers.current.set(e.pointerId, localPoint(e, true));
    if (!(e.target as Element).closest('button')) capturePointer(e.currentTarget,e.pointerId);
    if (pointers.current.size === 1) { dragged.current = false; }
    if (pointers.current.size > 1) { dragged.current = true; suppressClickUntil.current = performance.now() + 600; }
    startGesture();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (propsRef.current.disabled || document.hidden || !pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, localPoint(e, true));
    const points = [...pointers.current.values()];
    const base = gesture.current;
    const origin = points.length > 1 ? midpoint(points[0], points[1]) : points[0];
    if (distance(origin, base.origin) > 5 || points.length > 1) dragged.current = true;
    if (!dragged.current) return;
    showDragging(true);
    capturePointer(e.currentTarget, e.pointerId);
    const current = propsRef.current;
    if (points.length > 1 && base.distance > 0) {
      const limits = cameraLimits(current.viewport, controls.current.zoomLimit);
      const scale = clamp(base.camera.scale * distance(points[0], points[1]) / base.distance, limits.min, limits.max);
      queueCamera(clampCamera({ scale, x: origin.x - base.anchor.u * MAP_WIDTH * scale, y: origin.y - base.anchor.v * MAP_HEIGHT * scale }, current.viewport, controls.current.zoomLimit));
    } else {
      const sensitivity = controls.current.dragSensitivity;
      queueCamera(clampCamera({ ...base.camera, x: base.camera.x + (origin.x - base.origin.x) * sensitivity, y: base.camera.y + (origin.y - base.origin.y) * sensitivity }, current.viewport, controls.current.zoomLimit));
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (surface.current?.hasPointerCapture(e.pointerId)) surface.current.releasePointerCapture(e.pointerId);
    if (dragged.current) suppressClickUntil.current = performance.now() + 350;
    if (pointers.current.size === 0) { showDragging(false); gesture.current = null; gestureRect.current = undefined; }
    else startGesture();
  };
  const resetPointers = () => {
    const element = surface.current;
    const ids = [...pointers.current.keys()];
    pointers.current.clear();
    for (const id of ids) if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
    gesture.current = null; gestureRect.current = undefined; showDragging(false);
  };
  useLayoutEffect(() => {
    if (!disabled) return;
    cancelWheel.current();
    cancelMove(); gestureCamera.current = propsRef.current.camera;
    resetPointers();
  }, [disabled]);
  useEffect(() => {
    const element = surface.current!;
    let frame = 0, last = 0, target: MapCamera | null = null, origin: ViewOrigin | undefined;
    const velocity = { x: 0, y: 0, scale: 0 };
    const cancel = () => { cancelAnimationFrame(frame); frame=0;target=null;velocity.x=velocity.y=velocity.scale=0; };
    cancelWheel.current = cancel;
    const step = (now: number) => {
      if (!target || propsRef.current.disabled || document.hidden) { cancel(); return; }
      const dt = Math.min((now-last)/1000,.064); last=now;
      const next = { ...gestureCamera.current };
      for (const key of ['x','y','scale'] as const) { const spring=springStep(next[key],velocity[key],target[key],dt);next[key]=spring.value;velocity[key]=spring.velocity; }
      const settled = Math.abs(next.x-target.x)<.04 && Math.abs(next.y-target.y)<.04 && Math.abs(next.scale-target.scale)<.00002 && Math.abs(velocity.scale)<.0001;
      changeCamera(clampCamera(settled ? target : next,propsRef.current.viewport,controls.current.zoomLimit));
      if (settled) cancel(); else frame=requestAnimationFrame(step);
    };
    const wheel = (e: WheelEvent) => {
      const current = propsRef.current;
      if (current.disabled || document.hidden) return;
      e.preventDefault();
      if (!target || origin?.viewport !== current.viewport) origin = viewOrigin();
      const rect = origin!;
      const limits = cameraLimits(current.viewport, controls.current.zoomLimit);
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? current.viewport.height : 1);
      const before = target ?? gestureCamera.current;
      const next = clampCamera(zoomAt(before, Math.exp(-clamp(delta,-200,200)*.0018), e.clientX-rect.left, e.clientY-rect.top, limits.min, limits.max), current.viewport, controls.current.zoomLimit);
      if (sameCamera(next, before)) return;
      target = next;
      if (current.reducedMotion) { changeCamera(target);cancel(); }
      else if (!frame) { last=performance.now();frame=requestAnimationFrame(step); }
    };
    const visibility = () => {
      if (!document.hidden) return;
      cancel(); cancelMove(); gestureCamera.current = propsRef.current.camera;
      resetPointers();
    };
    element.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('visibilitychange',visibility);
    return () => { cancel();cancelMove();element.removeEventListener('wheel',wheel);document.removeEventListener('visibilitychange',visibility); };
  }, []);
  useLayoutEffect(() => {
    onVisualPosition?.(visualPlayer(propsRef.current, performance.now()).position, camera);
  }, [camera, playerUV, event, reducedMotion, fixedTime, onVisualPosition]);
  useEffect(() => {
    if (!event || reducedMotion || paused || fixedTime !== undefined) return;
    let raf = 0;
    const render = (now: number) => {
      if (document.hidden || propsRef.current.paused) return;
      const current = propsRef.current;
      const { position, travelling } = visualPlayer(current, now);
      current.onVisualPosition?.(position, current.camera);
      if (travelling) raf = requestAnimationFrame(render);
    };
    const resume = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(render); };
    resume();
    document.addEventListener('visibilitychange', resume);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', resume); };
  }, [event, reducedMotion, fixedTime, paused]);

  const worldStyle: CSSProperties = { width: MAP_WIDTH, height: MAP_HEIGHT, transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})` };
  const positions = useMemo(() => {
    const mobile = viewport.height < 540 || viewport.width < 900;
    return landmarks.flatMap(landmark => {
      const { x, y } = uvToScreen(landmark.uv, camera);
      const inView = x >= -25 && x <= viewport.width + 25 && y >= 35 && y <= viewport.height + 20;
      // Keep the original geographic anchor when the scenery or HUD obscures it.
      const behindBorder = y > viewport.height * .76 && (x < viewport.width * .26 || x > viewport.width * .72);
      if (!inView || behindBorder) return [];
      const tower = Boolean(landmark.isBeacon), unlocked = discoveredIds.includes(landmark.id);
      const labelWidth = mobile ? (tower ? 190 : landmark.name.length * 13 + 80) : (tower ? 275 : landmark.name.length * 18 + 100);
      return [{ landmark, id: landmark.id, x, y, tower, unlocked, left: x + labelWidth > viewport.width - 16 }];
    });
  }, [landmarks, camera, viewport, discoveredIds]);
  useLabelOcclusion(surface, positions, viewport, disabled);
  const pendingId = event?.landmarkId;
  const markers = useMemo(() => positions.map(({ landmark, x, y, tower, unlocked, left }) => {
    const beacon = tower && !unlocked;
    return <button key={landmark.id} type="button" className={`map-marker ${unlocked ? 'is-discovered' : 'is-locked'} ${tower ? 'is-beacon' : ''} ${selectedId === landmark.id ? 'is-selected' : ''} ${left ? 'label-left' : ''} ${pendingId === landmark.id ? 'is-newly-found' : ''}`} style={{ '--pin-x': `${x}px`, '--pin-y': `${y}px` } as CSSProperties} data-map-pin={landmark.id} data-testid={`poi-${landmark.id}`} data-u={landmark.uv.u} data-v={landmark.uv.v} aria-label={`${landmark.name}，${unlocked ? '已发现' : '待发现'}`} disabled={disabled} onClick={() => { if (performance.now() >= suppressClickUntil.current) onSelect(landmark.id); }}>
      {tower && <Beacon/>}
      <span className="map-marker-gem"><span className="map-marker-glyph"><MarkerGlyph icon={landmark.icon} locked={!unlocked && !beacon}/></span></span>
      <span className="map-marker-name"><strong>{landmark.name}</strong>{!unlocked && <small>{beacon ? '抵达此处以解锁区域' : '待发现'}</small>}</span>
      {unlocked && <span className="map-marker-underline"/>}
    </button>;
  }), [positions, selectedId, pendingId, disabled, onSelect]);
  const live = props.liveLocation?.insideImage ? props.liveLocation : null;
  const liveScreen = live ? uvToScreen(live.uv, camera) : null;
  const reliable = props.locationFresh && live && live.accuracy <= GOOD_ACCURACY_M;
  return <div ref={surface} className={`map-scene ${dragging ? 'is-dragging' : ''} ${reducedMotion ? 'map-reduced-motion' : ''}`} role="region" aria-label="良乡校区探索地图" data-testid="map-scene" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={e => { if (e.target === e.currentTarget) up(e); }} onDoubleClick={e => {
    if (disabled || (e.target as Element).closest('button')) return;
    const point = localPoint(e); const limits = cameraLimits(viewport, controls.current.zoomLimit);
    changeCamera(clampCamera(zoomAt(gestureCamera.current, controls.current.doubleZoom, point.x, point.y, limits.min, limits.max), viewport, controls.current.zoomLimit));
  }}>
    <div className="map-world" style={worldStyle} aria-hidden="true">
      <img className={`map-base-image${imageIndex ? ' is-calibrated-fallback' : ''}`} src={campusTextures[imageIndex]} onError={() => {
        setImageIndex(index => Math.min(index + 1, campusTextures.length - 1));
      }} draggable={false} decoding="async" alt="" width={MAP_WIDTH} height={MAP_HEIGHT}/>
      <RegionPaper camera={camera} viewport={viewport} unlockedIds={unlockedRegionIds} event={event} reducedMotion={reducedMotion}
        reduceFlash={props.reduceFlash} paused={paused} fixedTime={fixedTime} arrivalKey={props.paperArrivalKey} arrivalPending={props.paperArrivalPending} detail={props.paperDetail} onArrivalBusy={props.onPaperArrivalBusy} />
    </div>
    <div className="map-ground-vignette" aria-hidden="true"/>
    <div className="map-markers">{markers}</div>
    {live && liveScreen && <div className={`map-real-location ${reliable ? '' : 'is-unreliable'}`} style={{ left: 0, top: 0, transform: `translate3d(${liveScreen.x}px,${liveScreen.y}px,0)` }} aria-label={props.locationFresh ? '设备实际位置' : '上次定位位置'} data-testid="real-location-marker" data-u={live.uv.u} data-v={live.uv.v}>
      <span className="map-location-accuracy" style={{ width: live.radius.x * 2 * camera.scale, height: live.radius.y * 2 * camera.scale }}/>
      {reliable && typeof props.headingAngle === 'number' && Number.isFinite(props.headingAngle) ? <svg className="map-heading-sector map-location-pointer" viewBox="0 0 100 100" style={{ transform:`rotate(${props.headingAngle}deg)` }} aria-label="当前位置与手机朝向指针" data-testid="heading-sector" data-angle={props.headingAngle}>
        <defs><linearGradient id="heading-fade" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#b6d9bd" stopOpacity=".4"/><stop offset="1" stopColor="#efdaa5" stopOpacity=".03"/></linearGradient></defs>
        <path d="M50 50 27 10Q50-1 73 10Z" fill="url(#heading-fade)" stroke="#e5d3a0" strokeOpacity=".4" strokeWidth=".9"/>
        <circle cx="50" cy="50" r="23" fill="#163e35" fillOpacity=".12" stroke="#e0c58a" strokeOpacity=".52" strokeWidth=".8" strokeDasharray="14 7 2 7"/>
        <g className="map-location-arrow">
          <path d="m50 28 17 37-17-8-17 8Z" fill="#f8edcf" stroke="#ddc185" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="m50 32 13.5 29-13.5-7Z" fill="#6caa92"/>
          <path d="m50 32-13.5 29 13.5-7Z" fill="#fff7df"/>
          <path d="M50 34v19" fill="none" stroke="#e7d39a" strokeWidth=".8"/>
        </g>
      </svg> : <svg className="map-location-neutral" viewBox="0 0 32 32" aria-hidden="true">
        <path d="m16 3 13 13-13 13L3 16Z" fill="#285747" stroke="#dfc58c" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="m16 9 7 7-7 7-7-7Z" fill="#f8edcf"/><path d="m16 9 7 7-7 7Z" fill="#9dc2ac"/>
      </svg>}
      <span className="map-location-label">{props.locationFresh ? reliable ? '我的位置' : '位置精度较低' : '上次位置'}</span>
    </div>}
  </div>;
});
