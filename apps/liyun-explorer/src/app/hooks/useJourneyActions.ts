import { useCallback, useEffect, useRef, useState } from 'react';
import { DISPLAY_LANDMARKS as LANDMARKS } from '../../map/displayLandmarks';
import { checkInEligibility } from '../../location/checkIn';
import type { LocationState } from '../../location/geolocation';
import { progressOf } from '../../state';
import type { Landmark, MapCamera, SceneEvent, UV } from '../../types';
import { commitDiscovery } from '../discovery';
import { useCinematic } from '../stores/useCinematic';
import { useExploration } from '../stores/useExploration';
import { useUi } from '../stores/useUi';

type Options = {
  qa: boolean; location: LocationState; message: (text: string) => void; playUnlock: () => void;
  visual: { current: { uv: UV; camera: MapCamera } }; frameDiscovery: (place: Landmark, reduced: boolean) => void;
};

export function useJourneyActions({ qa, location, message, playUnlock, visual, frameDiscovery }: Options) {
  const [event, setEvent] = useState<SceneEvent | null>(null);
  const [fixedTime, setFixedTime] = useState<number | undefined>();
  const eventRef = useRef(event); eventRef.current = event;
  const locationRef = useRef(location); locationRef.current = location;
  const cueTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastDiscovery = useRef(-Infinity);
  const clear = useCallback(() => {
    clearTimeout(cueTimer.current); setEvent(null); setFixedTime(undefined); lastDiscovery.current = -Infinity;
    useCinematic.getState().clear();
  }, []);
  useEffect(() => () => clearTimeout(cueTimer.current), []);
  useEffect(() => {
    if (!event || fixedTime !== undefined) return;
    const timer = setTimeout(() => setEvent(null), Math.max(0, event.startedAt + event.duration - performance.now()) + 100);
    return () => clearTimeout(timer);
  }, [event, fixedTime]);
  const discover = useCallback((id: string) => {
    const place = LANDMARKS.find(item => item.id === id), before = useExploration.getState().state;
    if (!place) return;
    if (before.discoveredIds.includes(id)) { message('这一处风景，已收录于你的旅途'); return; }
    const next = commitDiscovery(before, id, locationRef.current);
    if (next === before) { message(checkInEligibility(id, locationRef.current).message); return; }
    const reduced = before.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startedAt = performance.now(), duration = reduced ? 400 : 3200;
    const quick = startedAt - lastDiscovery.current <= 10000;
    lastDiscovery.current = startedAt;
    // Persist the validated state first; all following animation is presentation only.
    useExploration.getState().replace(next);
    frameDiscovery(place, reduced);
    setEvent({ id: Date.now(), type: 'discover', landmarkId: id, from: { ...visual.current.uv }, to: place.uv, startedAt, duration });
    useUi.getState().select(null);
    if (next.settings.showCinematic) useCinematic.getState().enqueue({
      type: 'landmark', contentId: id, progressDelta: progressOf(next) - progressOf(before),
      availableAt: startedAt + duration, quick,
      unlockedRegions: next.unlockedRegionIds.filter(region => !before.unlockedRegionIds.includes(region)),
    });
    if (!qa) {
      clearTimeout(cueTimer.current);
      cueTimer.current = setTimeout(playUnlock, reduced ? 40 : Math.round(duration * .39));
    }
    message(`打卡成功 · ${place.name}`);
  }, [qa, message, playUnlock, visual, frameDiscovery]);
  const freeze = useCallback((offset?: number) => setFixedTime(offset === undefined ? undefined : (eventRef.current?.startedAt ?? 0) + offset), []);
  return { event, eventRef, fixedTime, freeze, clear, discover };
}
