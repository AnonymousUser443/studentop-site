import { MAP_HEIGHT, MAP_WIDTH } from '../data';
import type { MapCamera, UV, Viewport } from '../types';

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function baseScale(viewport: Viewport): number {
  return Math.max(viewport.height / 1080 * 0.61, viewport.width / 1920 * 0.55, 0.04);
}
export function cameraLimits(viewport: Viewport) {
  const base = baseScale(viewport);
  return { min: base * 0.55, max: base * 2.7 };
}
export function clampCamera(camera: MapCamera, viewport: Viewport): MapCamera {
  const { min, max } = cameraLimits(viewport);
  const scale = clamp(camera.scale, min, max);
  const width = MAP_WIDTH * scale;
  const height = MAP_HEIGHT * scale;
  return { scale,
    x: width < viewport.width ? (viewport.width - width) / 2 : clamp(camera.x, viewport.width - width, 0),
    y: height < viewport.height ? (viewport.height - height) / 2 : clamp(camera.y, viewport.height - height, 0),
  };
}
export function initialCamera(viewport: Viewport): MapCamera {
  const scale = baseScale(viewport);
  // The true Wencui position is the visual anchor, not an invented landscape crop.
  return clampCamera({ scale, x: viewport.width * 0.61 - (535 / 1000.56) * MAP_WIDTH * scale,
    y: viewport.height * 0.58 - (584 / 1240.28003) * MAP_HEIGHT * scale }, viewport);
}
export function uvToScreen(uv: UV, camera: MapCamera) {
  return { x: camera.x + uv.u * MAP_WIDTH * camera.scale, y: camera.y + uv.v * MAP_HEIGHT * camera.scale };
}
export function screenToUV(x: number, y: number, camera: MapCamera): UV {
  return { u: (x - camera.x) / (MAP_WIDTH * camera.scale), v: (y - camera.y) / (MAP_HEIGHT * camera.scale) };
}
export function zoomAt(camera: MapCamera, factor: number, x: number, y: number, minScale: number, maxScale: number): MapCamera {
  const scale = clamp(camera.scale * factor, minScale, maxScale);
  const ratio = scale / camera.scale;
  return { scale, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio };
}
export function cameraAt(uv: UV, viewport: Viewport, scale = baseScale(viewport)): MapCamera {
  return clampCamera({ scale, x: viewport.width * 0.61 - uv.u * MAP_WIDTH * scale,
    y: viewport.height * 0.52 - uv.v * MAP_HEIGHT * scale }, viewport);
}
