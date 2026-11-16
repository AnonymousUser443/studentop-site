import { memo, useEffect, useState, type CSSProperties } from 'react';
import { ACTIVITY_ART, ACTIVITY_PAINTINGS, artworkReady, warmArtwork } from './artworkAssets';
import type { ThemeKey } from './events';
import './artwork.css';

export interface ThemeArtworkProps {
  themeKey: ThemeKey;
  reducedMotion: boolean;
  quality: 'high' | 'low';
  paused: boolean;
}

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

const leaves = FALLING_LEAVES.map(([x, y, duration, delay, drift], index) => <GinkgoLeaf key={index} className={`activity-artwork-leaf leaf-${index}`} style={{ left: `${x}%`, top: `${y}%`, '--leaf-duration': `${duration}s`, '--leaf-delay': `${delay}s`, '--leaf-drift': `${drift}vw`, '--leaf-turn': `${index % 2 ? -235 : 285}deg` } as CSSProperties}/>);
const lowLeaves = leaves.slice(0, 4);

/** Decorative scene only. It never reads accounts, GPS, persisted state or rewards. */
export default memo(function ThemeArtwork({ themeKey, reducedMotion, quality, paused }: ThemeArtworkProps) {
  const target = ACTIVITY_PAINTINGS[themeKey];
  const [pictures, setPictures] = useState<{ current: string | null; outgoing: string | null; reveal: boolean }>(() => ({
    current: artworkReady(target) ? target : null, outgoing: null, reveal: false,
  }));
  const ready = artworkReady(target);
  const changing = ready && pictures.current !== target;
  const current = changing ? target : pictures.current;
  const outgoing = changing ? pictures.current : pictures.outgoing;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === target;
  useEffect(() => {
    if (pictures.current === target) return;
    let cancelled = false;
    const present = (ready: boolean) => {
      if (cancelled) return;
      if (!ready) { setFailedSource(target); return; }
      setFailedSource(null);
      setPictures(previous => previous.current === target ? previous : { current: target, outgoing: previous.current, reveal: !reducedMotion });
    };
    if (ready) present(true);
    else void warmArtwork(target).then(present);
    return () => { cancelled = true; };
  }, [target, pictures.current, ready, reducedMotion]);
  useEffect(() => {
    if (reducedMotion) setPictures(previous => previous.reveal ? { ...previous, outgoing: null, reveal: false } : previous);
  }, [reducedMotion]);

  // One keyed list lets the existing image become the outgoing half of the
  // reveal without remounting it. Even an interrupted A → B → A reuses A.
  const photos = outgoing && outgoing !== current && !reducedMotion ? [outgoing, current] : [current];
  return <div className={`activity-artwork artwork-theme-${themeKey}`} aria-hidden="true" data-paused={paused} data-reduced={reducedMotion} data-quality={quality} data-art-status={failed ? 'unavailable' : current === target ? 'ready' : 'loading'}>
    <div className="activity-artwork-fallback"><svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" focusable="false"><path d="M0 330 122 205 215 292 357 173 513 318 671 225 813 318 1000 199V600H0Z" fill="#597c6b" opacity=".45"/><path d="M0 390 142 277 265 373 415 300 588 390 777 311 1000 380V600H0Z" fill="#2c5a4d" opacity=".5"/><path d="M280 335v-88h155v88m-143-69h130m-130 22h130m-130 22h130" stroke="#c2c8a5" strokeWidth="6" fill="#8da088"/><path d="M80 440q240-58 480 0t440 7M0 485q250-34 510 0t490-5" stroke="#e4d5a4" strokeWidth="3" fill="none" opacity=".45"/></svg></div>
    <div className="activity-artwork-landscape" data-image-failed={!current && failed}>
      {photos.map(src => {
        if (!src) return null;
        const previous = src !== current;
        const entering = !previous && !reducedMotion && (changing || pictures.reveal);
        return <div key={src} className={`artwork-photo-slot${previous ? ' artwork-photo-old' : entering ? ' artwork-photo-current' : ''}`}
          onAnimationEnd={entering ? event => {
            if (event.target === event.currentTarget) setPictures(value => value.current === src && value.reveal ? { current: src, outgoing: null, reveal: false } : value);
          } : undefined}>
          <img className="activity-artwork-photo" src={src} alt="" decoding="async" />
        </div>;
      })}
    </div>
    <div className="activity-artwork-wash"/>
    <div className="activity-artwork-water"><i/><i/><i/></div>
    <img className="activity-artwork-branch" src={ACTIVITY_ART.branch} alt="" decoding="async" onError={event => { event.currentTarget.hidden = true; }}/>
    <div className="activity-artwork-leaves">{quality === 'low' ? lowLeaves : leaves}</div>
    <div className="activity-artwork-clouds"><svg viewBox="0 0 1000 170" preserveAspectRatio="none" focusable="false"><path d="M0 96C122 62 138 136 244 118S282 72 360 92 508 148 601 123 707 72 799 104 886 139 1000 92V170H0Z" fill="#f0e2b7"/><path d="M0 129c126-41 206 45 332 10s174-22 294 8 237-41 374-13" fill="none" stroke="#d7bd78" strokeWidth="3"/></svg></div>
    <img className="activity-artwork-journal" src={ACTIVITY_ART.journal} alt="" decoding="async" onError={event => { event.currentTarget.hidden = true; }}/>
    <span className="activity-artwork-glint glint-one"/><span className="activity-artwork-glint glint-two"/>
    <div className="activity-artwork-paper-edge"/>
  </div>;
});
