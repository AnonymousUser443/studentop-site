import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { MAP_HEIGHT, MAP_WIDTH, START_UV } from '../../data';
import { DISPLAY_LANDMARKS as LANDMARKS } from '../../map/displayLandmarks';
import { cameraAt, clampCamera, initialCamera, uvToScreen } from '../../map/geometry';
import { campusLandmarks, distanceMeters, GOOD_ACCURACY_M, headingOnMap, nearestLandmark } from '../../location/campus';
import { useCampusLocation } from '../../location/useCampusLocation';
import type { Landmark, MapCamera, UV, Viewport } from '../../types';
import { useSettings } from '../stores/useSettings';
import { createCameraStore } from '../cameraStore';

const zoomLimit = () => useSettings.getState().settings.zoomLimit;

/** Owns viewport, camera animation and volatile GPS; none of them write exploration data. */
export function useMapController(stage: RefObject<HTMLDivElement | null>, selected: Landmark | null, discoveredIds: string[]) {
  const [viewport, setViewport] = useState<Viewport>({ width: innerWidth, height: innerHeight });
  const viewportRef = useRef(viewport);
  const [cameraStore] = useState(() => createCameraStore(initialCamera(viewport)));
  const setCamera = cameraStore.set;
  const frame = useRef<number | undefined>(undefined);
  const visual = useRef({ uv: { ...START_UV }, camera: cameraStore.getSnapshot() });
  const landscape = useRef({ viewport, camera: cameraStore.getSnapshot() });
  const location = useCampusLocation();
  const [following, setFollowing] = useState(false);
  const cancelMotion = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  }, []);
  const rememberVisual = useCallback((uv: UV, current: MapCamera) => { visual.current = { uv, camera: current }; }, []);
  const moveCamera = useCallback((next: MapCamera) => { cancelMotion(); setFollowing(false); setCamera(next); }, [cancelMotion, setCamera]);
  const focusPlace = useCallback((id: string) => {
    const place = LANDMARKS.find(item => item.id === id);
    if (place) moveCamera(cameraAt(place.uv, viewportRef.current, visual.current.camera.scale, zoomLimit()));
  }, [moveCamera]);
  const frameDiscovery = useCallback((place: Landmark, reduced: boolean) => {
    cancelMotion(); setFollowing(false);
    const view = viewportRef.current, origin = visual.current.camera, point = uvToScreen(place.uv, origin);
    setCamera(origin);
    if (point.x >= view.width * .26 && point.x <= view.width * .88 && point.y >= view.height * .2 && point.y <= view.height * .78) return;
    const target = cameraAt(place.uv, view, origin.scale, zoomLimit()), began = performance.now();
    if (reduced) { setCamera(target); return; }
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 650), ease = t * t * (3 - 2 * t);
      setCamera({ scale: origin.scale + (target.scale - origin.scale) * ease, x: origin.x + (target.x - origin.x) * ease, y: origin.y + (target.y - origin.y) * ease });
      if (t < 1) frame.current = requestAnimationFrame(step);
      else frame.current = undefined;
    };
    frame.current = requestAnimationFrame(step);
  }, [cancelMotion, setCamera]);

  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height }, previous = viewportRef.current;
      if (!next.width || !next.height || Math.abs(previous.width - next.width) < 1 && Math.abs(previous.height - next.height) < 1) return;
      cancelMotion();
      if (previous.width > previous.height) landscape.current = { viewport: previous, camera: visual.current.camera };
      if (next.width > next.height) {
        const { camera: old, viewport: oldView } = landscape.current;
        const u = (oldView.width / 2 - old.x) / (MAP_WIDTH * old.scale), v = (oldView.height / 2 - old.y) / (MAP_HEIGHT * old.scale);
        const scale = old.scale * Math.min(next.width, next.height) / Math.min(oldView.width, oldView.height);
        setCamera(clampCamera({ scale, x: next.width / 2 - u * MAP_WIDTH * scale, y: next.height / 2 - v * MAP_HEIGHT * scale }, next, zoomLimit()));
      }
      viewportRef.current = next; setViewport(next);
    });
    observer.observe(stage.current);
    return () => { observer.disconnect(); cancelMotion(); };
  }, [stage, cancelMotion, setCamera]);
  useEffect(() => {
    const reading = location.state.reading;
    if (!following || location.state.status !== 'tracking' || !reading?.insideImage) return;
    cancelMotion();
    setCamera(current => cameraAt(reading.uv, viewportRef.current, current.scale, zoomLimit()));
  }, [following, location.state.reading, location.state.status, cancelMotion, setCamera]);
  const locate = useCallback(() => {
    location.start(); setFollowing(true);
    const reading = location.state.reading;
    if (location.state.status === 'tracking' && reading?.insideImage) setCamera(current => cameraAt(reading.uv, viewportRef.current, current.scale, zoomLimit()));
  }, [location.start, location.state, setCamera]);
  const center = useCallback(() => {
    const reading = location.state.reading;
    if (location.state.status === 'tracking' && reading?.insideImage) {
      cancelMotion(); setFollowing(true); setCamera(current => cameraAt(reading.uv, viewportRef.current, current.scale, zoomLimit()));
    } else moveCamera(initialCamera(viewportRef.current));
  }, [location.state, cancelMotion, moveCamera, setCamera]);
  const resetCamera = useCallback(() => moveCamera(initialCamera(viewportRef.current)), [moveCamera]);
  const stopFollowing = useCallback(() => { cancelMotion(); setFollowing(false); }, [cancelMotion]);
  const stopLocation = useCallback(() => { stopFollowing(); location.stop(); }, [stopFollowing, location.stop]);
  const reading = location.state.reading, freshLocation = location.state.status === 'tracking';
  const headingAngle = freshLocation && reading?.insideImage && reading.accuracy <= GOOD_ACCURACY_M && location.heading.status === 'active' && location.heading.bearing !== null
    ? headingOnMap(reading, location.heading.bearing) : null;
  const distanceLabel = useMemo(() => {
    if (!reading?.insideImage || !freshLocation || reading.accuracy > GOOD_ACCURACY_M) return '';
    const target = selected ? campusLandmarks.find(place => place.id === selected.id) : nearestLandmark(reading);
    if (target && !target.isBeacon) {
      const distance = distanceMeters(reading, target);
      return `${selected ? '所选点位' : '最近点位'}：${discoveredIds.includes(target.id) ? target.name : '未知地标'} · 直线约 ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} 千米` : `${Math.round(distance)} 米`}`;
    }
    return target?.isBeacon ? '所选信标为虚构玩法点，不提供真实目的地距离' : '';
  }, [reading, freshLocation, selected, discoveredIds]);
  return { viewport, cameraStore, setCamera, visual, rememberVisual, moveCamera, frameDiscovery, focusPlace, resetCamera, stopFollowing, location, reading, freshLocation, headingAngle, following, locate, center, stopLocation, distanceLabel, portrait: viewport.width <= viewport.height };
}
