import { MAP_HEIGHT, MAP_WIDTH } from '../../data';
import type { Region } from '../../content/regions';
import type { MapCamera, UV, Viewport } from '../../types';

export type PaperBounds = { x: number; y: number; width: number; height: number };
export type PaperRegion = { id: string; order: number; path: string; bounds: PaperBounds; center: UV; geometry: UV[][][] };

function inRing(ring: UV[], p: UV) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.v > p.v) !== (b.v > p.v) && p.u < (b.u - a.u) * (p.v - a.v) / (b.v - a.v) + a.u) inside = !inside;
  }
  return inside;
}

/** Holes and detached polygons stay true to the published map. */
export function paperContains({ geometry }: Pick<PaperRegion, 'geometry'>, p: UV) {
  return geometry.some(([outer, ...holes]) => inRing(outer, p) && !holes.some(hole => inRing(hole, p)));
}

/** A concave sheet may have its bounding-box center outside the paper. */
function ignitionPoint(geometry: UV[][][], bounds: PaperBounds): UV {
  const point = (x: number, y: number) => ({ u: (bounds.x + bounds.width * x) / MAP_WIDTH, v: (bounds.y + bounds.height * y) / MAP_HEIGHT });
  const center = point(.5, .5);
  if (paperContains({ geometry }, center)) return center;
  for (const radius of [.125, .25, .375]) {
    for (let i = 0; i < 8; i++) {
      const theta = i * Math.PI / 4;
      const candidate = point(.5 + Math.cos(theta) * radius, .5 + Math.sin(theta) * radius);
      if (paperContains({ geometry }, candidate)) return candidate;
    }
  }
  return geometry[0]?.[0]?.[0] ?? center;
}

/** Nonzero winding fills abutting regions as one sheet and keeps interior holes clear. */
export function paperRegion(region: Region): PaperRegion {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const geometry = region.geometry ?? [[region.polygon]];
  const path = geometry.flatMap(component => component.map((ring, hole) => {
    const area = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p.u * q.v - q.u * p.v;
    }, 0);
    const points = (hole === 0 ? area < 0 : area > 0) ? [...ring].reverse() : ring;
    return points.map(({ u, v }, i) => {
      const x = u * MAP_WIDTH, y = v * MAP_HEIGHT;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
      return `${i ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`;
    }).join(' ') + ' Z';
  })).join(' ');
  const x = Math.floor(left), y = Math.floor(top);
  const bounds = { x, y, width: Math.max(1, Math.ceil(right) - x), height: Math.max(1, Math.ceil(bottom) - y) };
  return { id: region.id, order: region.revealOrder, path, bounds, center: ignitionPoint(geometry, bounds), geometry };
}

/** Offscreen sheets don't need transient rasters; allow space for a small camera move. */
export function paperNearViewport({ bounds }: PaperRegion, camera: MapCamera, viewport: Viewport, margin = 140) {
  const a = camera.x + bounds.x * camera.scale, b = camera.y + bounds.y * camera.scale;
  return a < viewport.width + margin && b < viewport.height + margin &&
    a + bounds.width * camera.scale > -margin && b + bounds.height * camera.scale > -margin;
}
