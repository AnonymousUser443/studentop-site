import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '../../data';
import { REGIONS, type Region } from '../../content/regions';
import type { MapCamera } from '../../types';
import { useSettings } from '../../app/stores/useSettings';
import { useMotionPreferences } from '../../motion/useMotionPreferences';
import styles from './region-veil.module.css';
import { DISPLAY_LANDMARKS } from '../../map/displayLandmarks';

let animationEngine: ReturnType<typeof importEngine> | undefined;
const importEngine = () => import('gsap');
const engine = () => animationEngine ??= importEngine();
type Props = { camera: MapCamera; unlockedIds: string[]; reducedMotion?: boolean };

// One nonzero fill rasterizes all locked pieces as a union. Separate clipped
// polygons leave a translucent seam where two antialiased edges meet.
function polygonPath(region: Region) {
  return (region.geometry??[[region.polygon]]).flatMap(component=>component.map((ring,hole)=>{
    const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.u*q.v-q.u*p.v;},0);
    const polygon=(hole===0?area<0:area>0)?[...ring].reverse():ring;
    return polygon.map((point,index)=>`${index?'L':'M'}${point.u*MAP_WIDTH},${point.v*MAP_HEIGHT}`).join(' ')+' Z';
  })).join(' ');
}

/** Static UV geometry follows the same camera as the map. No GPS, Canvas redraw or per-frame React state. */
export default function RegionVeil({ camera, unlockedIds, reducedMotion }: Props) {
  const quality = useSettings(state => state.spec);
  const preferences = useMotionPreferences();
  useEffect(() => { void engine().catch(() => { animationEngine = undefined; }); }, []); // map-ready prefetch
  const reduced = Boolean(reducedMotion || preferences.reducedMotion);
  return <svg className={styles.veil} width="100%" height="100%" data-testid="region-veil" aria-hidden="true">
    <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
      <path d={REGIONS.filter(region => !unlockedIds.includes(region.id)).map(polygonPath).join(' ')}
        className={styles.paper} fillRule="nonzero" data-testid="region-veil-base" />
      {REGIONS.map(region => <VeilPiece key={region.id} region={region} unlocked={unlockedIds.includes(region.id)}
        reduced={reduced} simple={quality.inkRevealFidelity === 'simple' || preferences.reduceFlash}
        layers={quality.inkLayers} scale={camera.scale} />)}
    </g>
  </svg>;
}

function VeilPiece({ region, unlocked, reduced, simple, layers, scale }: {
  region: Region; unlocked: boolean; reduced: boolean; simple: boolean; layers: 0 | 1 | 2; scale: number;
}) {
  const rawId = useId().replace(/:/g, '');
  const clipId = `region-clip-${region.id}-${rawId}`;
  const maskId = `region-reveal-${region.id}-${rawId}`;
  const cloudId = `region-cloud-${region.id}-${rawId}`;
  const artMaskId = `region-art-${region.id}-${rawId}`;
  const filterId = `region-ink-${region.id}-${rawId}`;
  const group = useRef<SVGGElement>(null);
  const reveal = useRef<SVGCircleElement>(null);
  const stamp = useRef<SVGGElement>(null);
  const [present, setPresent] = useState(!unlocked);
  const [phase, setPhase] = useState<'locked' | 'revealing'>('locked');
  const path = polygonPath(region);
  const vertices=region.geometry?.flat(2)??region.polygon;
  const xs = vertices.map(point => point.u * MAP_WIDTH), ys = vertices.map(point => point.v * MAP_HEIGHT);
  const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  const anchor = DISPLAY_LANDMARKS.find(item => item.regionId === region.id)?.uv;
  const center = anchor ? { x: anchor.u * MAP_WIDTH, y: anchor.v * MAP_HEIGHT } : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const radius = Math.max(...vertices.map(point => Math.hypot(point.u * MAP_WIDTH - center.x, point.v * MAP_HEIGHT - center.y))) + 28;
  const labelSize = Math.max(23, 14 / Math.max(scale, .1));

  useLayoutEffect(() => {
    if (!unlocked) {
      setPresent(true); setPhase('locked');
      if (reveal.current) reveal.current.setAttribute('r', '0');
      if (group.current) group.current.style.opacity = '1';
      return;
    }
    if (!present) return;
    let disposed = false;
    let context: gsap.Context | undefined;
    setPhase('revealing');
    if (reduced) { setPresent(false); return; }
    void engine().then(({ gsap }) => {
      if (disposed || !group.current) return;
      context = gsap.context(() => {
        const tl = gsap.timeline({ onComplete: () => { if (!disposed) setPresent(false); } });
        if (simple) tl.to(group.current, { opacity: 0, duration: .32, ease: 'power2.out' });
        else {
          tl.fromTo(reveal.current, { attr: { r: 0 } }, { attr: { r: radius }, duration: layers === 2 ? 1.4 : .9, ease: 'power2.inOut' }, 0)
            .to(stamp.current, { opacity: 0, scale: 1.25, rotate: 8, svgOrigin: `${center.x} ${center.y + 100}`, duration: .42 }, .08)
            .to(group.current, { opacity: 0, duration: .16 }, layers === 2 ? 1.24 : .74);
        }
      }, group);
    }).catch(() => { if (!disposed) setPresent(false); });
    return () => { disposed = true; context?.revert(); };
  }, [unlocked, reduced, simple, layers, present, radius, center.x, center.y]);

  if (!present) return null;
  return <g ref={group} data-region-id={region.id} data-phase={phase} className={styles.piece}>
    <defs>
      <clipPath id={clipId}><path d={path} fillRule="evenodd" /></clipPath>
      <pattern id={cloudId} width="800" height="520" patternUnits="userSpaceOnUse">
        <path d="M-80 170Q-50 100 30 130C25 45 170 20 205 105C280 40 385 95 355 165C450 115 525 180 485 235H-80ZM330 430Q335 365 410 380C405 295 550 270 585 355C660 290 765 345 735 415C830 365 905 430 865 485H330Z"
          fill="var(--paper-300)" opacity=".65" />
        <path d="M-60 200Q30 155 110 180T300 185T490 210M350 450Q440 405 520 430T710 435T900 460"
          fill="none" stroke="var(--jade-400)" strokeWidth="3" opacity=".2" />
      </pattern>
      <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed={region.revealOrder + 3} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={layers === 2 ? 28 : 12} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT}>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="white" />
        <circle ref={reveal} cx={center.x} cy={center.y} r="0" fill="black" filter={!simple && layers > 0 ? `url(#${filterId})` : undefined} />
      </mask>
      {region.maskImage && <mask id={artMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} style={{ maskType: 'alpha' }}>
        <image href={region.maskImage} width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" />
      </mask>}
    </defs>
    <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
      <g mask={region.maskImage ? `url(#${artMaskId})` : undefined}>
        <path d={path} className={styles.paper} fillRule="evenodd" />
        {layers > 0 && <path d={path} fill={`url(#${cloudId})`} data-testid="region-procedural-cloud" />}
        {layers > 0 && <image href="/assets/regions/ink-cloud.webp" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT}
          preserveAspectRatio="xMidYMid slice" className={styles.texture} />}
        {layers === 2 && <image href="/assets/regions/ink-cloud.webp" x={bounds.x - 80} y={bounds.y - 80}
          width={bounds.width + 160} height={bounds.height + 160} preserveAspectRatio="xMidYMid slice" opacity=".3" filter={`url(#${filterId})`} />}
        <path d={path} className={styles.edge} fill="none" />
        {bounds.width * scale > 120 && bounds.height * scale > 85 && <g ref={stamp} transform={`translate(${center.x} ${center.y + 115})`} className={styles.caption}>
          <rect x="-26" y="-30" width="52" height="52" rx="3" />
          <text textAnchor="middle" x="0" y="7" fontSize="26">未启</text>
          <text textAnchor="middle" x="0" y={48 + labelSize} fontSize={labelSize} className={styles.name}>{region.name}</text>
        </g>}
      </g>
    </g>
  </g>;
}
