import { describe, expect, it } from 'vitest';
import fixtures from '../../tests/fixtures/reference_queries.json';
import { campusLandmarks, campusMap, distanceMeters } from './campus';
import { LANDMARKS } from '../data';
import { screenToUV, uvToScreen, zoomAt } from '../map/geometry';

describe('unchanged 2026-10-26 campus calibration', () => {
  it('matches all 168 published Python reference queries from the handoff', () => {
    for (const row of fixtures.forward) {
      const result = campusMap.uvToGeo(row.u, row.v);
      expect(result.latitude).toBeCloseTo(row.expected.latitude, 10);
      expect(result.longitude).toBeCloseTo(row.expected.longitude, 10);
      expect(result.support.mode).toBe(row.expected.support.mode);
    }
  });
  it('maps all 13 raw WGS84 samples to the published fitted results, without snapping to training anchors', () => {
    for (const row of fixtures.inverse) {
      const result = campusMap.gpsToMap(row.latitude, row.longitude);
      expect(result.u).toBeCloseTo(row.expected.u, 8);
      expect(result.v).toBeCloseTo(row.expected.v, 8);
    }
  });
  it('preserves the UI landmark UVs and round trips their model-derived WGS84 coordinates', () => {
    for (const [i, place] of campusLandmarks.entries()) {
      expect(place.uv).toEqual(LANDMARKS[i].uv);
      const result = campusMap.gpsToMap(place.latitude, place.longitude);
      expect(result.u).toBeCloseTo(place.uv.u, 7);
      expect(result.v).toBeCloseTo(place.uv.v, 7);
    }
    expect(campusLandmarks.find(p => p.id === 'tower')?.physical).toBe(false);
  });
  it('does not clamp outside GPS onto a campus edge', () => {
    const gps = campusMap.uvToGeo(-.2, .4);
    const point = campusMap.gpsToMap(gps.latitude, gps.longitude);
    expect(point.inside_image).toBe(false);
    expect(point.u).toBeCloseTo(-.2, 7);
  });
  it('preserves the same GPS anchor through mobile/desktop pans and zoom', () => {
    const point = campusMap.gpsToMap(fixtures.inverse[5].latitude, fixtures.inverse[5].longitude);
    for (const camera of [{scale:.2,x:-10,y:-350},{scale:.7,x:-700,y:-1200}]) {
      const screen = uvToScreen(point, camera);
      const zoomed = zoomAt(camera, 1.8, screen.x, screen.y, .1, 2);
      const back = screenToUV(screen.x, screen.y, zoomed);
      expect(back.u).toBeCloseTo(point.u, 10);
      expect(back.v).toBeCloseTo(point.v, 10);
    }
  });
  it('computes straight-line distance in metres rather than SVG units', () => {
    const a = {latitude:39.73,longitude:116.16};
    expect(distanceMeters(a,a)).toBe(0);
    expect(distanceMeters(a,{...a,latitude:a.latitude+.001})).toBeCloseTo(111.31949, 3);
  });
});
