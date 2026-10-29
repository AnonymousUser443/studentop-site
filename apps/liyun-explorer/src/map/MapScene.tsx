import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '../data';
import type { IconName, MapCamera, MapSceneProps, UV } from '../types';
import { cameraLimits, clamp, clampCamera, screenToUV, uvToScreen, zoomAt } from './geometry';
import './map.css';

type Point = { x: number; y: number };
type Gesture = { camera: MapCamera; origin: Point; distance: number; anchor: UV };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function capturePointer(element: HTMLElement, id: number) {
  try { element.setPointerCapture(id); }
  catch { /* The OS may cancel a pointer while the viewport is rotating. */ }
}

function MarkerGlyph({ icon, locked }: { icon: IconName; locked: boolean }) {
  if (locked) return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 17v-5a6 6 0 0 1 12 0v5m-14 0h16v16H12z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"/><path d="M20 22v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
  return <svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {icon === 'lake' ? <><path d="M20 5c-2 8-11 13-11 20a11 11 0 0 0 22 0C31 18 22 13 20 5Z" fill="#58bad0" stroke="#d8f5f3"/><path d="M20 13c-1 7-6 9-6 14s4 6 5 6M23 17c5 7 5 11 0 14" stroke="#e2fff6" strokeWidth="1.2"/></> : icon === 'book' ? <><path d="M20 11c-7-5-13-3-13-3v22s7-1 13 4c6-5 13-4 13-4V8s-6-2-13 3v23"/><path d="M11 14l5 2m-5 4 5 2m8-6 5-2m-5 8 5-2"/></> : icon === 'sport' ? <><circle cx="23" cy="8" r="3" fill="currentColor" stroke="none"/><path d="m10 17 8-6 6 9 7 2m-13-11-2 12-8 10m8-10 9 5-1 8" strokeWidth="3.3"/></> : icon === 'gate' ? <><path d="m6 15 14-9 14 9M9 17h22M12 18v16m16-16v16M9 34h22M17 34V22h6v12"/><path d="M8 13h24M16 9V6h8v3" strokeWidth="2.5"/></> : <><path d="m20 4 4 11 12 5-12 4-4 12-4-12L4 20l12-5 4-11Z"/><path d="m20 13 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="currentColor"/></>}
  </svg>;
}

function Beacon() {
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
}

export default function MapScene(props: MapSceneProps) {
  const { camera, viewport, landmarks, discoveredIds, selectedId, playerUV, event, reducedMotion, disabled, fixedTime, paused, onSelect, onVisualPosition } = props;
  const surface = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const gestureCamera = useRef(camera);
  const lastCameraProp = useRef(camera);
  if(lastCameraProp.current!==camera){lastCameraProp.current=camera;gestureCamera.current=camera;}
  const changeCamera=(next:MapCamera)=>{gestureCamera.current=next;propsRef.current.onCameraChange(next);};
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const suppressClickUntil = useRef(0);
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const localPoint = (e: {clientX: number; clientY: number}): Point => {
    const rect = surface.current!.getBoundingClientRect();
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
    if (propsRef.current.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.current.set(e.pointerId, localPoint(e));
    if (!(e.target as Element).closest('button')) capturePointer(e.currentTarget,e.pointerId);
    if (pointers.current.size === 1) { dragged.current = false; }
    if (pointers.current.size > 1) { dragged.current = true; suppressClickUntil.current = performance.now() + 600; }
    startGesture();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (propsRef.current.disabled || !pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const points = [...pointers.current.values()];
    const base = gesture.current;
    const origin = points.length > 1 ? midpoint(points[0], points[1]) : points[0];
    if (distance(origin, base.origin) > 5 || points.length > 1) { dragged.current = true; setDragging(true); capturePointer(e.currentTarget,e.pointerId); }
    if (!dragged.current) return;
    const current = propsRef.current;
    if (points.length > 1 && base.distance > 0) {
      const limits = cameraLimits(current.viewport);
      const scale = clamp(base.camera.scale * distance(points[0], points[1]) / base.distance, limits.min, limits.max);
      changeCamera(clampCamera({ scale, x: origin.x - base.anchor.u * MAP_WIDTH * scale, y: origin.y - base.anchor.v * MAP_HEIGHT * scale }, current.viewport));
    } else {
      changeCamera(clampCamera({ ...base.camera, x: base.camera.x + origin.x - base.origin.x, y: base.camera.y + origin.y - base.origin.y }, current.viewport));
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (surface.current?.hasPointerCapture(e.pointerId)) surface.current.releasePointerCapture(e.pointerId);
    if (dragged.current) suppressClickUntil.current = performance.now() + 350;
    if (pointers.current.size === 0) { setDragging(false); gesture.current = null; }
    else startGesture();
  };
  useEffect(() => {
    if (!disabled) return;
    pointers.current.clear(); gesture.current = null; setDragging(false);
  }, [disabled]);
  useEffect(() => {
    const element = surface.current!;
    const wheel = (e: WheelEvent) => {
      const current = propsRef.current;
      if (current.disabled) return;
      e.preventDefault();
      const rect = element.getBoundingClientRect();
      const limits = cameraLimits(current.viewport);
      changeCamera(clampCamera(zoomAt(gestureCamera.current, Math.exp(-clamp(e.deltaY, -200, 200) * 0.0018), e.clientX - rect.left, e.clientY - rect.top, limits.min, limits.max), current.viewport));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  useLayoutEffect(() => {
    let raf = 0;
    const render = () => {
      let position = playerUV;
      if (event && !reducedMotion) {
        const t = clamp(((fixedTime ?? performance.now()) - event.startedAt) / (event.duration * .43), 0, 1);
        const eased = t * t * (3 - 2 * t);
        position = { u: event.from.u + (event.to.u - event.from.u) * eased, v: event.from.v + (event.to.v - event.from.v) * eased };
        if (t < 1 && !document.hidden && !paused && fixedTime === undefined) raf = requestAnimationFrame(render);
      }
      const point = uvToScreen(position, camera);
      if (player.current) player.current.style.transform = `translate3d(${point.x}px,${point.y}px,0)`;
      onVisualPosition?.(position,camera);
    };
    render();
    const resume = () => { if (!document.hidden) { cancelAnimationFrame(raf); render(); } };
    document.addEventListener('visibilitychange', resume);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', resume); };
  }, [camera, playerUV, event, reducedMotion, fixedTime, paused, onVisualPosition]);

  const worldStyle: CSSProperties = { width: MAP_WIDTH, height: MAP_HEIGHT, transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})` };
  const mobile = viewport.height < 540 || viewport.width < 900;
  return <div ref={surface} className={`map-scene ${dragging ? 'is-dragging' : ''} ${reducedMotion ? 'map-reduced-motion' : ''}`} role="region" aria-label="良乡校区探索地图" data-testid="map-scene" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={e => {
    if (disabled || (e.target as Element).closest('button')) return;
    const point = localPoint(e); const limits = cameraLimits(viewport);
    changeCamera(clampCamera(zoomAt(gestureCamera.current, 1.45, point.x, point.y, limits.min, limits.max), viewport));
  }}>
    <div className="map-world" style={worldStyle} aria-hidden="true">
      <span className="map-paper-halo" />
      <img className="map-base-image" src={imageFailed ? '/assets/maps/campus.webp' : mobile ? '/assets/maps/campus-enhanced-mobile.webp' : '/assets/maps/campus-enhanced.webp'} onError={() => setImageFailed(true)} draggable={false} alt="" width={MAP_WIDTH} height={MAP_HEIGHT}/>
      <svg className="map-water-ribbons" viewBox="0 0 1000.56 1240.28003" fill="none">
        <path d="M277 450c18-3 27-2 38-1m12 7c16-4 30-3 41-1m-56-20c12-2 19-1 29 0m18 32c14-2 22-1 32 0" stroke="#e6ecd2" strokeWidth="1" opacity=".5"/>
        <path d="M548 257c33 38 90 65 164 75" stroke="#d6e2b7" strokeWidth=".75" opacity=".4"/>
      </svg>
    </div>
    <div className="map-ground-vignette" aria-hidden="true"/>
    <div className="map-markers">
      {landmarks.map(landmark => {
        const point = uvToScreen(landmark.uv, camera);
        const inView = point.x >= -25 && point.x <= viewport.width + 25 && point.y >= 35 && point.y <= viewport.height + 20;
        // Edge scenery and the campus HUD occlude these corners. Cull the label,
        // never move its geographic anchor; panning or the collection reveals it.
        const behindBorder = point.y > viewport.height * .76 && (point.x < viewport.width * .26 || point.x > viewport.width * .72);
        if (!inView || behindBorder) return null;
        const unlocked = discoveredIds.includes(landmark.id);
        const beacon = landmark.isBeacon && !unlocked;
        const tower=Boolean(landmark.isBeacon);
        const pending = event?.landmarkId === landmark.id;
        const labelWidth=mobile?(tower?190:landmark.name.length*13+80):(tower?275:landmark.name.length*18+100);
        return <button key={landmark.id} type="button" className={`map-marker ${unlocked ? 'is-discovered' : 'is-locked'} ${tower ? 'is-beacon' : ''} ${selectedId === landmark.id ? 'is-selected' : ''} ${point.x+labelWidth>viewport.width-16 ? 'label-left' : ''} ${pending ? 'is-newly-found' : ''}`} style={{ left: point.x, top: point.y }} data-testid={`poi-${landmark.id}`} data-u={landmark.uv.u} data-v={landmark.uv.v} aria-label={`${landmark.name}，${unlocked ? '已发现' : '待发现'}`} disabled={disabled} onClick={() => { if (performance.now() >= suppressClickUntil.current) onSelect(landmark.id); }}>
          {tower && <Beacon/>}
          <span className="map-marker-gem"><span className="map-marker-glyph"><MarkerGlyph icon={landmark.icon} locked={!unlocked && !beacon}/></span></span>
          <span className="map-marker-name"><strong>{landmark.name}</strong>{!unlocked && <small>{beacon ? '抵达此处以解锁区域' : '待发现'}</small>}</span>
          {unlocked && <span className="map-marker-underline"/>}
        </button>;
      })}
    </div>
    <div ref={player} className="map-player" aria-label="你的位置" data-testid="player-marker">
      <span className="map-player-light"/>
      <svg viewBox="0 0 66 76" aria-hidden="true"><path d="m33 8 23 49-23-9-23 9Z" fill="#e7fdff" stroke="#efe6ba" strokeWidth="2"/><path d="m33 12 17 37-17-7-17 7Z" fill="#3aafce"/><path d="m33 12 1 29 16 8Z" fill="#127fac"/><path d="m33 12-17 37 8-5Z" fill="#84deeb"/><ellipse cx="33" cy="61" rx="27" ry="8" fill="none" stroke="#fff0b6" strokeWidth="1.1" opacity=".85"/></svg>
    </div>
  </div>;
}
