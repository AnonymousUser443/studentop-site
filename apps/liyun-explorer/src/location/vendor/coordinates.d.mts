export type MapSupport = {
  mode: 'calibrated' | 'transition' | 'extrapolated' | 'baseline';
  independent_accuracy_verified: boolean;
  distance_outside_m?: number;
};
export type GeoPoint = { latitude: number; longitude: number; support: MapSupport; inside_image: boolean };
export type MapPoint = { u: number; v: number; pixel_x: number; pixel_y: number; inside_image: boolean; support: MapSupport };
export function createCampusMap(
  metadata: { map_id: string; image: { width: number; height: number }; view_box: number[] },
  artifact: { map_id: string; model: unknown },
): {
  uvToGeo(u: number, v: number): GeoPoint;
  gpsToMap(latitude: number, longitude: number): MapPoint;
};
