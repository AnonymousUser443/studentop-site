import { LANDMARKS } from '../content/catalog';
import { getConfirmedCheckInOverride } from '../content/regions';
import type { Landmark, UV } from '../types';

/** Reviewed content can move a visual pin; the immutable public save anchors remain in data.ts. */
export function displayLandmark(place: Landmark, confirmed = getConfirmedCheckInOverride(place.id)): Landmark {
  return confirmed ? { ...place, uv: { ...confirmed.centerUv }, checkInRadius: confirmed.radiusM } : place;
}

export const DISPLAY_LANDMARKS = LANDMARKS.map(place => displayLandmark(place));
export const getDisplayLandmark = (id: string) => DISPLAY_LANDMARKS.find(place => place.id === id);

export function displayPlayerUV(saved: UV, source: readonly Landmark[] = LANDMARKS, display: readonly Landmark[] = DISPLAY_LANDMARKS): UV {
  const anchor = source.find(place => Math.abs(place.uv.u - saved.u) < 1e-10 && Math.abs(place.uv.v - saved.v) < 1e-10);
  return anchor ? display.find(place => place.id === anchor.id)?.uv ?? saved : saved;
}

