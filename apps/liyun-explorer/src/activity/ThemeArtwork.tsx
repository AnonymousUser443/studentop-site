import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './artwork.css';

export interface ThemeArtworkProps {
  themeKey: string;
  reducedMotion: boolean;
  quality: 'high' | 'low';
  paused: boolean;
}

const PAINTINGS: Record<string, string> = {
  frost: '/assets/paintings/waterbirds.webp',
  seasons: '/assets/paintings/north-lake.webp',
  mystery: '/assets/paintings/library.webp',
  encounters: '/assets/paintings/waterbirds.webp',
  archive: '/assets/paintings/library.webp'
};

// Fixed nodes and phases make repeated captures reproducible. No per-frame JS work.
const FALLING_LEAVES = [
  [32, -8, 7.6, -2.3, -14], [46, 5, 9.2, -6.7, 13],
  [58, -6, 8.4, -1.1, -9], [68, 12, 10.6, -8.1, 18],
  [39, 16, 11.4, -5.3, -12], [76, -3, 9.8, -3.9, 11],
  [53, 19, 12.2, -9.4, 16], [63, 9, 10.2, -7.7, -17]
];

function GinkgoLeaf({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="-35 -48 70 62" focusable="false">
    <path className="art-leaf-face" d="M0 0C-7-9-21-10-30-30L-25-42-18-39-12-46-3-41 0-32 4-43 12-45 19-38 27-40 32-27C23-11 9-9 0 0Z"/>
    <path className="art-leaf-veins" d="M0 0-25-36M0 0-14-39M0 0-4-35M0 0 11-39M0 0 25-33M0 0 3 11"/>
  </svg>;
}

/** Decorative scene only. It never reads accounts, GPS, persisted state or rewards. */
export default function ThemeArtwork({ themeKey, reducedMotion, quality, paused }: ThemeArtworkProps) {
  const theme = Object.hasOwn(PAINTINGS, themeKey) ? themeKey : 'frost';
  const target = PAINTINGS[theme];
  const [current, setCurrent] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (loaded.current === target) return;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      void image.decode().catch(() => undefined).then(() => {
        if (cancelled) return;
        setPrevious(loaded.current);
        loaded.current = target;
        setCurrent(target);
      });
    };
    image.onerror = () => { if (!cancelled) setFailed(true); };
    image.src = target;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [target]);

  return <div className={`activity-artwork artwork-theme-${theme}`} aria-hidden="true" data-paused={paused || hidden || failed} data-reduced={reducedMotion} data-quality={quality} data-art-status={failed ? 'unavailable' : current === target ? 'ready' : 'loading'}>
    <div className="activity-artwork-fallback"><svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" focusable="false"><path d="M0 330 122 205 215 292 357 173 513 318 671 225 813 318 1000 199V600H0Z" fill="#597c6b" opacity=".45"/><path d="M0 390 142 277 265 373 415 300 588 390 777 311 1000 380V600H0Z" fill="#2c5a4d" opacity=".5"/><path d="M280 335v-88h155v88m-143-69h130m-130 22h130m-130 22h130" stroke="#c2c8a5" strokeWidth="6" fill="#8da088"/><path d="M80 440q240-58 480 0t440 7M0 485q250-34 510 0t490-5" stroke="#e4d5a4" strokeWidth="3" fill="none" opacity=".45"/></svg></div>
    <div className="activity-artwork-landscape" data-image-failed={failed}>
      {previous && !reducedMotion && <img className="activity-artwork-photo artwork-photo-old" src={previous} alt="" decoding="async"/>}
      {current && <img key={current} className="activity-artwork-photo artwork-photo-current" src={current} alt="" decoding="async" onAnimationEnd={() => setPrevious(null)}/>}
    </div>
    <div className="activity-artwork-wash"/>
    <div className="activity-artwork-water"><i/><i/><i/></div>
    <img className="activity-artwork-branch" src="/assets/activity/ginkgo-bough.webp" alt="" decoding="async" onError={event => { event.currentTarget.hidden = true; }}/>
    <div className="activity-artwork-leaves">{FALLING_LEAVES.slice(0, quality === 'low' ? 4 : 8).map(([x, y, duration, delay, drift], index) => <GinkgoLeaf key={index} className={`activity-artwork-leaf leaf-${index}`} style={{ left: `${x}%`, top: `${y}%`, '--leaf-duration': `${duration}s`, '--leaf-delay': `${delay}s`, '--leaf-drift': `${drift}vw`, '--leaf-turn': `${index % 2 ? -235 : 285}deg` } as CSSProperties}/>)}</div>
    <div className="activity-artwork-clouds"><svg viewBox="0 0 1000 170" preserveAspectRatio="none" focusable="false"><path d="M0 96C122 62 138 136 244 118S282 72 360 92 508 148 601 123 707 72 799 104 886 139 1000 92V170H0Z" fill="#f0e2b7"/><path d="M0 129c126-41 206 45 332 10s174-22 294 8 237-41 374-13" fill="none" stroke="#d7bd78" strokeWidth="3"/></svg></div>
    <img className="activity-artwork-journal" src="/assets/activity/travel-journal.webp" alt="" decoding="async" onError={event => { event.currentTarget.hidden = true; }}/>
    {(failed || current !== target) && <span className="activity-artwork-load-state">{failed ? '画境暂不可用' : '画境载入中…'}</span>}
    <span className="activity-artwork-glint glint-one"/><span className="activity-artwork-glint glint-two"/>
    <div className="activity-artwork-paper-edge"/>
  </div>;
}
