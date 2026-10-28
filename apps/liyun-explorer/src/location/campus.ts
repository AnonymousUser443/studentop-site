import { createCampusMap } from './vendor/coordinates.mjs';
import metadata from './data/map.json';
import artifact from './data/selected_model.json';
import { LANDMARKS, MAP_ID, MAP_WIDTH, MAP_HEIGHT } from '../data';
import type { UV } from '../types';

// Original v0.4 SDK and full model are copied verbatim. Inputs are WGS84,
// latitude first. Never feed GCJ-02 results from the old AMap implementation.
if (metadata.map_id !== MAP_ID || metadata.image.width !== MAP_WIDTH || metadata.image.height !== MAP_HEIGHT) {
  throw new Error('地图画布与标定版本不一致');
}
export const campusMap = createCampusMap(metadata, artifact);
export const CAMPUS_MAP_IMAGE = '/assets/maps/calibrated/campus_no_labels.webp';
export const CAMPUS_MAP_FALLBACK = '/assets/maps/calibrated/campus_no_labels.png';
export const MAX_LOCATION_AGE_MS = 15_000;
export const GOOD_ACCURACY_M = 50;
const EARTH_RADIUS_M = 6378137;
const radians = (value: number) => value * Math.PI / 180;

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const lat = radians(b.latitude - a.latitude), lon = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

// Preserve every existing UI landmark anchor. These are model-derived reference
// coordinates, not additional field measurements or backend check-in rules.
export const campusLandmarks = LANDMARKS.map(place => ({
  ...place, ...campusMap.uvToGeo(place.uv.u, place.uv.v), physical: !place.isBeacon,
}));

export function nearestLandmark(position: { latitude: number; longitude: number }) {
  return campusLandmarks.filter(place => place.physical)
    .map(place => ({ ...place, distance: distanceMeters(position, place) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

/** Approximate GPS uncertainty on the *same* map, allowing its anisotropic scale. */
export function accuracyRadii(uv: UV, latitude: number, longitude: number, accuracy: number) {
  const stepM = 5;
  const north = campusMap.gpsToMap(latitude + stepM / EARTH_RADIUS_M * 180 / Math.PI, longitude);
  const east = campusMap.gpsToMap(latitude, longitude + stepM / (EARTH_RADIUS_M * Math.cos(radians(latitude))) * 180 / Math.PI);
  return {
    x: Math.hypot((north.u - uv.u) * MAP_WIDTH, (east.u - uv.u) * MAP_WIDTH) * accuracy / stepM,
    y: Math.hypot((north.v - uv.v) * MAP_HEIGHT, (east.v - uv.v) * MAP_HEIGHT) * accuracy / stepM,
  };
}

/** Project a compass bearing through the original nonlinear map model. Adding
 * a north offset alone would ignore this map's anisotropic local scale. */
export function headingOnMap(position: { latitude: number; longitude: number }, heading: number) {
  if (!Number.isFinite(heading)) return null;
  const distance = 10, direction = radians(heading);
  const from = campusMap.gpsToMap(position.latitude, position.longitude);
  const to = campusMap.gpsToMap(
    position.latitude + Math.cos(direction) * distance / EARTH_RADIUS_M * 180 / Math.PI,
    position.longitude + Math.sin(direction) * distance / (EARTH_RADIUS_M * Math.cos(radians(position.latitude))) * 180 / Math.PI,
  );
  const dx = (to.u - from.u) * MAP_WIDTH, dy = (to.v - from.v) * MAP_HEIGHT;
  return Math.hypot(dx,dy) > 1e-6 ? ((Math.atan2(dx,-dy) * 180 / Math.PI) % 360 + 360) % 360 : null;
}
