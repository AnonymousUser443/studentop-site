import { useEffect, useLayoutEffect, useRef } from 'react';
import P5 from 'p5';
import { MAP_WIDTH, MAP_HEIGHT } from '../data';
import type { EffectsProps, Landmark } from '../types';
import { clamp01, eventTiming, seededRandom } from './timing';
import './effects.css';

type Leaf = { x: number; y: number; size: number; speed: number; phase: number; direction: number };
type Mote = { x: number; y: number; phase: number; speed: number; size: number };
const TAU = Math.PI * 2;

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Flat, scalloped cloud silhouettes: deliberately illustrated rather than smoke simulation. */
function cloudPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.18);
  ctx.bezierCurveTo(-w * 0.62, -h * 0.06, -w * 0.35, -h * 0.38, -w * 0.2, -h * 0.23);
  ctx.bezierCurveTo(-w * 0.19, -h * 0.68, w * 0.13, -h * 0.6, w * 0.16, -h * 0.28);
  ctx.bezierCurveTo(w * 0.36, -h * 0.56, w * 0.61, -h * 0.25, w * 0.43, -h * 0.04);
  ctx.bezierCurveTo(w * 0.66, h * 0.02, w * 0.5, h * 0.3, w * 0.26, h * 0.25);
  ctx.bezierCurveTo(w * 0.09, h * 0.52, -w * 0.25, h * 0.4, -w * 0.5, h * 0.18);
  ctx.closePath();
  ctx.restore();
}

function cloudTexture(seed: number) {
  const canvas = makeCanvas(1000, 1240);
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(seed);
  ctx.fillStyle = 'rgba(78,105,88,0.66)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // The cached three-value palette provides paper-cut depth without a per-pixel noise pass.
  for (let row = -1; row < 29; row++) {
    for (let column = -1; column < 14; column++) {
      const x = column * 85 + (row % 2) * 38 + random() * 32;
      const y = row * 46 + random() * 24;
      const width = 105 + random() * 75;
      const height = 31 + random() * 18;
      const flip = random() > 0.5 ? 1 : -1;
      ctx.fillStyle = 'rgba(62,89,77,0.16)';
      cloudPath(ctx, x + 5, y + 5, width, height, flip); ctx.fill();
      ctx.fillStyle = random() > 0.45 ? 'rgba(224,222,193,0.32)' : 'rgba(186,203,177,0.25)';
      cloudPath(ctx, x, y, width, height, flip); ctx.fill();
      ctx.strokeStyle = 'rgba(244,237,204,0.12)'; ctx.lineWidth = .7; ctx.stroke();
      if (random() > 0.55) {
        ctx.strokeStyle = 'rgba(242,235,202,0.2)';
        ctx.beginPath();
        ctx.ellipse(x + width * 0.1, y - height * 0.08, width * 0.16, height * 0.22, 0, 0.1, Math.PI * 1.55);
        ctx.stroke();
      }
    }
  }
  return canvas;
}

function landmarkPoint(landmark: Landmark, props: EffectsProps) {
  return {
    x: props.camera.x + landmark.uv.u * MAP_WIDTH * props.camera.scale,
    y: props.camera.y + landmark.uv.v * MAP_HEIGHT * props.camera.scale,
  };
}

function eraseRegion(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, strength = 1) {
  if (radius <= 0 || strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.translate(x, y);
  ctx.scale(1, 0.83);
  const gradient = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius);
  gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
  gradient.addColorStop(0.64, `rgba(0,0,0,${strength * 0.9})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, size: number, angle: number, alpha: number) {
  ctx.save();
  ctx.rotate(angle);
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
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff4ba';
  ctx.beginPath(); ctx.moveTo(0, -radius); ctx.quadraticCurveTo(radius * 0.16, -radius * 0.14, radius * 0.65, 0); ctx.quadraticCurveTo(radius * 0.16, radius * 0.14, 0, radius); ctx.quadraticCurveTo(-radius * 0.16, radius * 0.14, -radius * 0.65, 0); ctx.quadraticCurveTo(-radius * 0.16, -radius * 0.14, 0, -radius); ctx.fill(); ctx.restore();
}

export default function Atmosphere(props: EffectsProps) {
  const fogHost = useRef<HTMLDivElement>(null);
  const lightHost = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  const instances = useRef<P5[]>([]);
  const readyInstances = useRef(new Set<P5>());
  useLayoutEffect(()=>{current.current=props;});

  useEffect(() => {
    if (!fogHost.current || !lightHost.current) return;
    let texture = cloudTexture(current.current.seed ?? 1386);
    let textureSeed = current.current.seed ?? 1386;
    const buffer = makeCanvas(1, 1);
    const random = seededRandom(textureSeed + 17);
    const leaves: Leaf[] = Array.from({ length: 25 }, () => ({ x: random(), y: random(), size: 5 + random() * 8, speed: 0.012 + random() * 0.011, phase: random() * TAU, direction: random() > 0.5 ? 1 : -1 }));
    const motes: Mote[] = Array.from({ length: 52 }, () => ({ x: random(), y: random(), phase: random() * TAU, speed: 0.005 + random() * 0.008, size: 0.7 + random() * 1.6 }));

    function prepare(p: P5, host: HTMLDivElement, label: string) {
      const config = current.current;
      p.pixelDensity(config.settings.quality === 'high' && config.viewport.width > 950 ? 1.5 : 1);
      const renderer = p.createCanvas(config.viewport.width, config.viewport.height);
      renderer.parent(host); renderer.elt.setAttribute('aria-hidden', 'true'); renderer.elt.setAttribute('data-effect-layer', label);
      if (import.meta.env.DEV && new URLSearchParams(location.search).get('qa') === '1') {
        (renderer.elt as HTMLCanvasElement & {__liyunP5?:P5}).__liyunP5 = p;
      }
      readyInstances.current.add(p);
      p.frameRate(label === 'fog' ? 30 : config.settings.quality === 'high' && config.viewport.height > 520 ? 60 : 30);
      if (config.paused || config.fixedTime !== undefined || config.settings.reducedMotion) p.noLoop();
    }

    const fog = new P5((p) => {
      p.setup = () => prepare(p, fogHost.current!, 'fog');
      p.draw = () => {
        const config = current.current;
        const { width, height } = config.viewport;
        const now = config.fixedTime ?? performance.now();
        const t = config.settings.reducedMotion ? 0 : now / 1000;
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        p.clear();
        if ((config.seed ?? 1386) !== textureSeed) { textureSeed = config.seed ?? 1386; texture = cloudTexture(textureSeed); }
        const resolution = Math.min(config.settings.quality === 'low' ? 0.45 : 0.65, 1250 / Math.max(1, width));
        const bw = Math.max(1, Math.ceil(width * resolution));
        const bh = Math.max(1, Math.ceil(height * resolution));
        if (buffer.width !== bw || buffer.height !== bh) { buffer.width = bw; buffer.height = bh; }
        const b = buffer.getContext('2d')!;
        b.setTransform(resolution, 0, 0, resolution, 0, 0);
        b.clearRect(0, 0, width, height);
        b.fillStyle = 'rgba(47,75,64,0.10)'; b.fillRect(0, 0, width, height);
        const driftX = Math.sin(t * 0.075) * 12 * config.camera.scale;
        const driftY = Math.sin(t * 0.056 + 2) * 6 * config.camera.scale;
        b.drawImage(texture, config.camera.x + driftX, config.camera.y + driftY, MAP_WIDTH * config.camera.scale, MAP_HEIGHT * config.camera.scale);
        const timing = eventTiming(config.event, now);
        for (const landmark of config.landmarks) {
          if (!config.discoveredIds.includes(landmark.id)) continue;
          const point = landmarkPoint(landmark, config);
          const revealing = config.event?.landmarkId === landmark.id && timing.progress < 1;
          const reveal = revealing ? timing.reveal : 1;
          const radius = (landmark.isBeacon ? 620 : 515) * config.camera.scale * reveal;
          eraseRegion(b, point.x, point.y, radius, Math.min(1, reveal * 2));
        }
        // The bright beacon stays visible inside the undiscovered world without unlocking it.
        const beacon = config.landmarks.find(x => x.isBeacon);
        if (beacon) { const point = landmarkPoint(beacon, config); eraseRegion(b, point.x, point.y, 165 * config.camera.scale, 0.46); }
        ctx.save(); ctx.setTransform(p.pixelDensity(), 0, 0, p.pixelDensity(), 0, 0); ctx.drawImage(buffer, 0, 0, width, height); ctx.restore();
      };
    }, fogHost.current);

    const light = new P5((p) => {
      p.setup = () => prepare(p, lightHost.current!, 'light');
      p.draw = () => {
        const config = current.current;
        const { width, height } = config.viewport;
        const now = config.fixedTime ?? performance.now();
        const t = config.settings.reducedMotion ? 0 : now / 1000;
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        p.clear();
        ctx.save(); ctx.setTransform(p.pixelDensity(), 0, 0, p.pixelDensity(), 0, 0);
        const mobile = width < 950 || height < 520;
        if (!config.settings.reducedMotion) {
          const leafCount = config.settings.quality === 'low' || mobile ? 9 : 21;
          for (const leaf of leaves.slice(0, leafCount)) {
            const y = ((leaf.y + t * leaf.speed) % 1.24) * height - height * 0.12;
            const x = ((leaf.x + t * leaf.speed * 0.22) % 1.2) * width - width * 0.1 + Math.sin(t * 0.55 + leaf.phase) * (mobile ? 12 : 28);
            ctx.save(); ctx.translate(x, y); ctx.scale(0.66 + Math.abs(Math.cos(t * 0.7 + leaf.phase)) * 0.34, 1);
            drawLeaf(ctx, leaf.size * (mobile ? 0.72 : 1), Math.sin(t * 0.42 + leaf.phase) * 0.6 + leaf.direction * 0.35, 0.35 + Math.sin(leaf.phase) * 0.15); ctx.restore();
          }
          const moteCount = config.settings.quality === 'low' || mobile ? 16 : 44;
          for (const mote of motes.slice(0, moteCount)) {
            const x = mote.x * width + Math.sin(t * 0.3 + mote.phase) * 16;
            const y = (1 - ((mote.y + t * mote.speed) % 1)) * height;
            const alpha = (0.2 + Math.sin(t * 0.9 + mote.phase) * 0.17) * (x > width * 0.2 ? 1 : 0.35);
            ctx.fillStyle = `rgba(255,233,158,${alpha})`; ctx.beginPath(); ctx.arc(x, y, mote.size, 0, TAU); ctx.fill();
          }
        }
        const beacon = config.landmarks.find(x => x.isBeacon && (!config.discoveredIds.includes(x.id) || (config.event?.landmarkId === x.id && now-config.event.startedAt < config.event.duration*.43)));
        if (beacon) {
          const point = landmarkPoint(beacon, config);
          const radius = (mobile ? 33 : 50) * Math.min(1.4, Math.max(0.7, config.camera.scale / 0.72));
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
          const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 1.7);
          halo.addColorStop(0, `rgba(249,208,91,${0.12 + pulse * 0.07})`); halo.addColorStop(1, 'rgba(249,208,91,0)');
          ctx.fillStyle = halo; ctx.fillRect(point.x - radius * 1.7, point.y - radius * 1.7, radius * 3.4, radius * 3.4);
          ctx.strokeStyle = `rgba(255,221,133,${0.42 + pulse * 0.22})`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(point.x, point.y + radius * 0.6, radius, radius * 0.27, -0.15, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(point.x, point.y, radius * 1.08, t * 0.4, t * 0.4 + Math.PI * 1.35); ctx.stroke();
          if (!config.settings.reducedMotion) {
            const orbit = t * 0.52;
            star(ctx, point.x + Math.cos(orbit) * radius * 1.08, point.y + Math.sin(orbit) * radius * 1.08, mobile ? 4 : 6, 0.85);
          }
        }
        const timing = eventTiming(config.event, now);
        if (config.event && timing.active) {
          const target = { x: config.camera.x + config.event.to.u * MAP_WIDTH * config.camera.scale, y: config.camera.y + config.event.to.v * MAP_HEIGHT * config.camera.scale };
          if (config.settings.reducedMotion) {
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
              const halo = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius);
              halo.addColorStop(0, `rgba(255,239,172,${alpha * 0.37})`); halo.addColorStop(0.65, `rgba(249,202,78,${alpha * 0.1})`); halo.addColorStop(1, 'rgba(249,202,78,0)');
              ctx.fillStyle = halo; ctx.fillRect(target.x - radius, target.y - radius, radius * 2, radius * 2);
              ctx.strokeStyle = `rgba(255,230,150,${(1 - b) * 0.8})`; ctx.lineWidth = 2 - b;
              ctx.beginPath(); ctx.arc(target.x, target.y, radius, 0, TAU); ctx.stroke();
              ctx.strokeStyle = `rgba(255,242,192,${(1 - b) * 0.62})`;
              ctx.beginPath(); ctx.ellipse(target.x, target.y + 12, radius * 0.86, radius * 0.36, -0.18, 0, TAU); ctx.stroke();
              const count = mobile ? 14 : 28;
              for (let i = 0; i < count; i++) {
                const angle = (i / count) * TAU + 0.2;
                const r = Math.sqrt(b) * reach * (0.4 + ((i * 13) % 11) / 14);
                star(ctx, target.x + Math.cos(angle) * r, target.y + Math.sin(angle) * r * 0.8 - b * 15, (mobile ? 3 : 5) * (1 - b * 0.5), (1 - b) * 0.9);
              }
            }
          }
        }
        ctx.restore();
      };
    }, lightHost.current);
    instances.current = [fog, light];
    return () => { instances.current = []; readyInstances.current.clear(); fog.remove(); light.remove(); buffer.width = 1; buffer.height = 1; texture.width = 1; texture.height = 1; };
  }, []);

  useEffect(() => {
    for (const [index, p] of instances.current.entries()) {
      if (!readyInstances.current.has(p)) continue;
      const density = props.settings.quality === 'high' && props.viewport.width > 950 ? 1.5 : 1;
      if (p.pixelDensity() !== density) p.pixelDensity(density);
      if (p.width !== props.viewport.width || p.height !== props.viewport.height) p.resizeCanvas(props.viewport.width, props.viewport.height, true);
      p.frameRate(index === 0 ? 30 : props.settings.quality === 'high' && props.viewport.height > 520 ? 60 : 30);
      if (props.paused || props.fixedTime !== undefined || (props.settings.reducedMotion && !props.event)) { p.noLoop(); p.redraw(); }
      else p.loop();
    }
  }, [props.viewport, props.camera, props.settings.quality, props.settings.reducedMotion, props.paused, props.fixedTime, props.event, props.discoveredIds]);

  return <><div className="atmosphere-layer atmosphere-fog" ref={fogHost} aria-hidden="true" /><div className="atmosphere-layer atmosphere-light" ref={lightHost} aria-hidden="true" /></>;
}
