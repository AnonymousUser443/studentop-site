import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { MAP_WIDTH, MAP_HEIGHT } from '../data';
import type { EffectsProps, Landmark } from '../types';
import { clamp01, eventTiming, seededRandom } from './timing';
import { createLightClock, lightBackingSize } from './lightClock';
import './effects.css';

type Leaf = { x: number; y: number; size: number; speed: number; phase: number; direction: number };
type Mote = { x: number; y: number; phase: number; speed: number; size: number };
const TAU = Math.PI * 2;
const LEAF_TILE = 28, LEAF_DENSITY = 3, LEAF_COLUMNS = 8;
const LEAF_RASTER = LEAF_TILE * LEAF_DENSITY;
const MOTE_TILE = 48, MOTE_RADIUS = 20;

function landmarkPoint(landmark: Landmark, props: EffectsProps) {
  return {
    x: props.camera.x + landmark.uv.u * MAP_WIDTH * props.camera.scale,
    y: props.camera.y + landmark.uv.v * MAP_HEIGHT * props.camera.scale,
  };
}

function paintLeaf(ctx: CanvasRenderingContext2D, size: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#dfb95c';
  ctx.beginPath();
  ctx.moveTo(0, size * 0.6);
  ctx.bezierCurveTo(-size * 0.33, size * 0.12, -size * 0.86, -size * 0.27, -size * 0.65, -size * 0.63);
  ctx.quadraticCurveTo(-size * 0.12, -size * 0.86, 0, -size * 0.47);
  ctx.quadraticCurveTo(size * 0.2, -size * 0.83, size * 0.66, -size * 0.62);
  ctx.bezierCurveTo(size * 0.92, -size * 0.2, size * 0.3, size * 0.1, 0, size * 0.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,170,0.8)';
  ctx.lineWidth = 0.65;
  ctx.beginPath(); ctx.moveTo(0, size * 0.76); ctx.lineTo(0, -size * 0.36); ctx.moveTo(0, size * 0.4); ctx.lineTo(-size * 0.48, -size * 0.45); ctx.moveTo(0, size * 0.4); ctx.lineTo(size * 0.48, -size * 0.45); ctx.stroke();
}

/** Bake each seeded size and its composited fill/vein opacity once. The mobile
 * atlas still uses the same .65 CSS px vein width, even with the smaller body. */
function makeLeafAtlas(leaves: Leaf[], mobile: boolean) {
  const image = document.createElement('canvas');
  image.width = LEAF_RASTER * LEAF_COLUMNS;
  image.height = LEAF_RASTER * Math.ceil(leaves.length / LEAF_COLUMNS);
  const ctx = image.getContext('2d')!;
  leaves.forEach((leaf, i) => {
    ctx.setTransform(LEAF_DENSITY, 0, 0, LEAF_DENSITY,
      (i % LEAF_COLUMNS + .5) * LEAF_RASTER, (Math.floor(i / LEAF_COLUMNS) + .5) * LEAF_RASTER);
    paintLeaf(ctx, leaf.size * (mobile ? .72 : 1), .35 + Math.sin(leaf.phase) * .15);
  });
  return image;
}

function makeMoteSprite() {
  const image = document.createElement('canvas');
  image.width = image.height = MOTE_TILE;
  const ctx = image.getContext('2d')!;
  ctx.fillStyle = '#ffe99e';
  ctx.arc(MOTE_TILE / 2, MOTE_TILE / 2, MOTE_RADIUS, 0, TAU);
  ctx.fill();
  return image;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff4ba';
  ctx.beginPath(); ctx.moveTo(0, -radius); ctx.quadraticCurveTo(radius * 0.16, -radius * 0.14, radius * 0.65, 0); ctx.quadraticCurveTo(radius * 0.16, radius * 0.14, 0, radius); ctx.quadraticCurveTo(-radius * 0.16, radius * 0.14, -radius * 0.65, 0); ctx.quadraticCurveTo(-radius * 0.16, -radius * 0.14, 0, -radius); ctx.fill(); ctx.restore();
}

function visibleBeacon(config: EffectsProps, now: number) {
  const beacon = config.landmarks.find(x => x.isBeacon && (!config.discoveredIds.includes(x.id)
    || (config.event?.landmarkId === x.id && now - config.event.startedAt < config.event.duration * .43)));
  if (!beacon) return undefined;
  const point = landmarkPoint(beacon, config);
  const mobile = config.viewport.width < 950 || config.viewport.height < 520;
  const radius = (mobile ? 33 : 50) * Math.min(1.4, Math.max(0.7, config.camera.scale / 0.72));
  const reach = radius * 1.7 + 2;
  if (point.x < -reach || point.y < -reach || point.x > config.viewport.width + reach || point.y > config.viewport.height + reach) return undefined;
  return { ...point, radius };
}

function glowSprite(stops: [number, string][]) {
  // Interpolate the same colour stops once, then scale the tiny radial brush.
  const image = document.createElement('canvas');
  image.width = image.height = 128;
  const ctx = image.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return image;
}

function drawGlow(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, radius: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function drawLight(ctx: CanvasRenderingContext2D, config: EffectsProps, now: number, leaves: Leaf[], motes: Mote[],
  leafAtlases: Map<boolean, HTMLCanvasElement>, moteSprite: HTMLCanvasElement, beaconGlow: HTMLCanvasElement, burstGlow: HTMLCanvasElement) {
  const { width, height } = config.viewport;
  const t = config.settings.reducedMotion ? 0 : now / 1000;
  const mobile = width < 950 || height < 520;
  ctx.clearRect(0, 0, width, height);

  if (!config.settings.reducedMotion) {
    const leafCount = Math.min(leaves.length, mobile ? Math.ceil(config.spec.leafCount * 0.6) : config.spec.leafCount);
    if (leafCount > 0) {
      let atlas = leafAtlases.get(mobile);
      if (!atlas) { atlas = makeLeafAtlas(leaves, mobile); leafAtlases.set(mobile, atlas); }
      for (let index = 0; index < leafCount; index++) {
        const leaf = leaves[index];
        const y = ((leaf.y + t * leaf.speed) % 1.24) * height - height * 0.12;
        const x = ((leaf.x + t * leaf.speed * 0.22) % 1.2) * width - width * 0.1 + Math.sin(t * 0.55 + leaf.phase) * (mobile ? 12 : 28);
        const reach = leaf.size * (mobile ? .72 : 1) * 1.2;
        if (x < -reach || x > width + reach || y < -reach || y > height + reach) continue;
        const squash = .66 + Math.abs(Math.cos(t * .7 + leaf.phase)) * .34;
        const angle = Math.sin(t * .42 + leaf.phase) * .6 + leaf.direction * .35;
        const sin = Math.sin(angle), cos = Math.cos(angle);
        ctx.save();
        ctx.transform(squash * cos, sin, -squash * sin, cos, x, y);
        ctx.drawImage(atlas, index % LEAF_COLUMNS * LEAF_RASTER, Math.floor(index / LEAF_COLUMNS) * LEAF_RASTER,
          LEAF_RASTER, LEAF_RASTER, -LEAF_TILE / 2, -LEAF_TILE / 2, LEAF_TILE, LEAF_TILE);
        ctx.restore();
      }
    }
    const moteCount = Math.min(motes.length, mobile ? Math.ceil(config.spec.moteCount * 0.6) : config.spec.moteCount);
    for (let index = 0; index < moteCount; index++) {
      const mote = motes[index];
      const x = mote.x * width + Math.sin(t * 0.3 + mote.phase) * 16;
      const y = (1 - ((mote.y + t * mote.speed) % 1)) * height;
      if (x < -mote.size || x > width + mote.size) continue;
      ctx.globalAlpha = (0.2 + Math.sin(t * 0.9 + mote.phase) * 0.17) * (x > width * 0.2 ? 1 : 0.35);
      const reach = mote.size * MOTE_TILE / (2 * MOTE_RADIUS);
      ctx.drawImage(moteSprite, x - reach, y - reach, reach * 2, reach * 2);
    }
    ctx.globalAlpha = 1;
  }

  const beacon = visibleBeacon(config, now);
  if (beacon) {
    const { x, y, radius } = beacon;
    const pulse = config.settings.reduceFlash ? .35 : 0.5 + 0.5 * Math.sin(t * 1.6);
    const glowStrength = .45 + config.spec.glowLayers * .275;
    drawGlow(ctx, beaconGlow, x, y, radius * 1.7, (0.12 + pulse * 0.07) * glowStrength);
    ctx.strokeStyle = `rgba(255,221,133,${0.42 + pulse * 0.22})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y + radius * 0.6, radius, radius * 0.27, -0.15, 0, TAU); ctx.stroke();
    const orbitTime = config.settings.reduceFlash ? 0 : t;
    ctx.beginPath(); ctx.arc(x, y, radius * 1.08, orbitTime * 0.4, orbitTime * 0.4 + Math.PI * 1.35); ctx.stroke();
    if (!config.settings.reducedMotion && !config.settings.reduceFlash) {
      const orbit = t * 0.52;
      star(ctx, x + Math.cos(orbit) * radius * 1.08, y + Math.sin(orbit) * radius * 1.08, mobile ? 4 : 6, 0.85);
    }
  }
  const timing = eventTiming(config.event, now);
  if (config.event && timing.active) {
    const target = { x: config.camera.x + config.event.to.u * MAP_WIDTH * config.camera.scale, y: config.camera.y + config.event.to.v * MAP_HEIGHT * config.camera.scale };
    if (config.settings.reducedMotion || config.settings.reduceFlash) {
      ctx.strokeStyle = `rgba(255,225,144,${Math.sin(timing.progress * Math.PI) * 0.8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(target.x, target.y, mobile ? 35 : 55, 0, TAU); ctx.stroke();
    } else {
      const start = { x: config.camera.x + config.event.from.u * MAP_WIDTH * config.camera.scale, y: config.camera.y + config.event.from.v * MAP_HEIGHT * config.camera.scale };
      if (timing.progress < 0.6) {
        const progress = timing.travel;
        ctx.strokeStyle = `rgba(255,227,141,${(1 - clamp01((timing.progress - 0.43) / 0.17)) * 0.7})`; ctx.lineWidth = mobile ? 1 : 1.8;
        ctx.setLineDash([3, 8]); ctx.lineDashOffset = -t * 18;
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(start.x + (target.x - start.x) * progress, start.y + (target.y - start.y) * progress); ctx.stroke(); ctx.setLineDash([]);
      }
      if (timing.progress >= 0.43) {
        const b = timing.burst;
        const reach = (mobile ? 115 : 185) * Math.min(1.3, config.camera.scale / 0.7);
        const radius = 20 + Math.sqrt(b) * reach;
        const alpha = Math.sin(Math.PI * b) * (1 - b * 0.5);
        drawGlow(ctx, burstGlow, target.x, target.y, radius, alpha);
        ctx.strokeStyle = `rgba(255,230,150,${(1 - b) * 0.8})`; ctx.lineWidth = 2 - b;
        ctx.beginPath(); ctx.arc(target.x, target.y, radius, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,242,192,${(1 - b) * 0.62})`;
        ctx.beginPath(); ctx.ellipse(target.x, target.y + 12, radius * 0.86, radius * 0.36, -0.18, 0, TAU); ctx.stroke();
        const count = Math.round((mobile ? 7 : 14) * config.spec.glowLayers);
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * TAU + 0.2;
          const r = Math.sqrt(b) * reach * (0.4 + ((i * 13) % 11) / 14);
          star(ctx, target.x + Math.cos(angle) * r, target.y + Math.sin(angle) * r * 0.8 - b * 15, (mobile ? 3 : 5) * (1 - b * 0.5), (1 - b) * 0.9);
        }
      }
    }
  }
}

type LightStats = { readonly frameCount: number; isLooping: () => boolean; pixelDensity: () => number; frameRate: () => number };
type LightCanvas = HTMLCanvasElement & { __liyunLight?: LightStats };

export default memo(function Atmosphere(props: EffectsProps) {
  const host = useRef<LightCanvas>(null);
  const latest = useRef(props);
  const invalidate = useRef(() => {});
  useLayoutEffect(() => { latest.current = props; });

  useEffect(() => {
    const canvas = host.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const random = seededRandom((props.seed ?? 1386) + 17);
    const leaves: Leaf[] = Array.from({ length: 40 }, () => ({ x: random(), y: random(), size: 5 + random() * 8, speed: 0.012 + random() * 0.011, phase: random() * TAU, direction: random() > 0.5 ? 1 : -1 }));
    const motes: Mote[] = Array.from({ length: 80 }, () => ({ x: random(), y: random(), phase: random() * TAU, speed: 0.005 + random() * 0.008, size: 0.7 + random() * 1.6 }));
    const leafAtlases = new Map<boolean, HTMLCanvasElement>();
    const moteSprite = makeMoteSprite();
    const beaconGlow = glowSprite([[0, '#f9d05b'], [1, '#f9d05b00']]);
    const burstGlow = glowSprite([[0, 'rgba(255,239,172,.37)'], [.65, 'rgba(249,202,78,.1)'], [1, 'rgba(249,202,78,0)']]);
    let pageHidden = false, frames = 0;
    let lastLive: number | undefined;

    function readState() {
      const config = latest.current, now = performance.now(), event = config.event;
      const visible = !document.hidden && !pageHidden;
      const moving = visible && !config.paused && config.fixedTime === undefined && Boolean(
        (event && now < event.startedAt + event.duration) ||
        (!config.settings.reducedMotion && (config.spec.leafCount > 0 || config.spec.moteCount > 0
          || (!config.settings.reduceFlash && visibleBeacon(config, now)))),
      );
      return { visible, moving, fps: config.spec.lightFps };
    }

    const clock = createLightClock(readState, () => {
      const config = latest.current;
      const { width, height } = config.viewport;
      if (width <= 0 || height <= 0) return;
      const { width: w, height: h } = lightBackingSize(width, height, config.spec.pixelDensity);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
      const now = config.fixedTime ?? (config.paused ? lastLive ?? performance.now() : performance.now());
      if (!config.paused && config.fixedTime === undefined) lastLive = now;
      drawLight(ctx, config, now, leaves, motes, leafAtlases, moteSprite, beaconGlow, burstGlow);
      frames++;
    }, { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id), now: () => performance.now() });

    if (import.meta.env.DEV && new URLSearchParams(location.search).get('qa') === '1') {
      const stats: LightStats = {
        get frameCount() { return frames; },
        isLooping: () => readState().moving,
        pixelDensity: () => latest.current.spec.pixelDensity,
        frameRate: () => latest.current.spec.lightFps,
      };
      canvas.__liyunLight = stats;
    }

    const hide = () => { pageHidden = true; clock.invalidate(); };
    const reveal = () => { pageHidden = false; clock.invalidate(); };
    invalidate.current = clock.invalidate;
    document.addEventListener('visibilitychange', clock.invalidate);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', reveal);
    clock.invalidate();
    return () => {
      clock.dispose();
      invalidate.current = () => {};
      document.removeEventListener('visibilitychange', clock.invalidate);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', reveal);
      delete canvas.__liyunLight;
      leafAtlases.clear();
      canvas.width = canvas.height = 1;
    };
  }, [props.seed]);

  useLayoutEffect(() => { invalidate.current(); }, [
    props.viewport.width, props.viewport.height, props.camera, props.landmarks, props.discoveredIds,
    props.spec.pixelDensity, props.spec.lightFps, props.spec.leafCount, props.spec.moteCount, props.spec.glowLayers,
    props.settings.reducedMotion, props.settings.reduceFlash, props.event, props.paused, props.fixedTime,
  ]);

  return <div className="atmosphere-layer atmosphere-light" aria-hidden="true"><canvas ref={host} data-effect-layer="light" /></div>;
});
