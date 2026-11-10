import { MAP_HEIGHT, MAP_WIDTH } from '../../data';
import { FOG_RENDER } from '../../settings/spec';
import type { Region } from '../../content/regions';
import { polygonPath } from './geometry';

export const fogScale = FOG_RENDER.maxBitmapSide / Math.max(MAP_WIDTH + FOG_RENDER.padding * 2, MAP_HEIGHT + FOG_RENDER.padding * 2);
export const fogSize = {
 width: Math.ceil((MAP_WIDTH + FOG_RENDER.padding * 2) * fogScale),
 height: Math.ceil((MAP_HEIGHT + FOG_RENDER.padding * 2) * fogScale),
};

/** Continuous paper mist extends through the map's empty margins; only visited regions clear it. */
export function paintVeil(target: HTMLCanvasElement, clearedRegions: readonly Region[]): string {
 const shape = document.createElement('canvas');
 shape.width = target.width = fogSize.width;
 shape.height = target.height = fogSize.height;
 const raw = shape.getContext('2d')!;
 raw.scale(fogScale, fogScale);
 raw.translate(FOG_RENDER.padding, FOG_RENDER.padding);
 raw.fillStyle = '#fff';
 raw.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
 raw.globalCompositeOperation = 'destination-out';
 raw.fill(new Path2D(clearedRegions.map(polygonPath).join(' ')));
 const ctx = target.getContext('2d')!;
 ctx.filter = `blur(${FOG_RENDER.feather * fogScale}px)`;
 ctx.drawImage(shape, 0, 0);
 ctx.filter = 'none';
 const mask = target.toDataURL();
 ctx.globalCompositeOperation = 'source-in';
 ctx.fillStyle = '#F5E6BD';
 ctx.fillRect(0, 0, target.width, target.height);
 ctx.globalCompositeOperation = 'source-over';
 return mask;
}

let textures: string[] | undefined;
/** Two small seamless sprites, generated once; animation only moves their cached surfaces. */
export function cloudTextures(): string[] {
 if (textures) return textures;
 textures = [17, 83].map(seed => {
  const tile = document.createElement('canvas');
  const size = FOG_RENDER.textureSide;
  tile.width = tile.height = size;
  const ctx = tile.getContext('2d')!;
  let state = seed;
  const random = () => ((state = Math.imul(state, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  for (let i = 0; i < FOG_RENDER.cloudPuffs; i++) {
   const x = random() * size, y = random() * size, radius = size * (.09 + random() * .18);
   for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    const glow = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
    glow.addColorStop(0, i % 3 ? 'rgba(255,253,237,.70)' : 'rgba(145,124,78,.20)');
    glow.addColorStop(.4, i % 3 ? 'rgba(255,252,231,.38)' : 'rgba(166,143,89,.12)');
    glow.addColorStop(1, 'rgba(245,230,189,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
   }
  }
  return tile.toDataURL();
 });
 return textures;
}
