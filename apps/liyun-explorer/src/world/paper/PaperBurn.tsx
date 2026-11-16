import { memo, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { makePaperRaster, paperBurnBounds, paperFragments, playPaperAtlas, type PaperJob } from './burnCanvas';
import styles from './paper.module.css';

const easeOut = (t: number) => 1 - (1 - t) ** 2;
const frameMs = 1000 / 30;

type Props = {
  job: PaperJob;
  count: number;
  detail: 'simple' | 'full';
  subdued: boolean;
  paused: boolean;
  standing: boolean;
  visible: boolean;
  fixedTime?: number;
  readClock: () => number;
};

export default memo(function PaperBurn({ job, count, detail, subdued, paused, standing, visible, fixedTime, readClock }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const debris = useRef<HTMLDivElement>(null);
  const { region, length, startsAt, fixedStartsAt, reason, origin } = job;
  const { id } = region;
  const bounds = paperBurnBounds(job.region);
  const render = useRef<ReturnType<typeof makePaperRaster>>(undefined);
  const particleDetail = reason === 'arrival' ? 'simple' : detail;
  const particles = useMemo(() => standing ? [] : paperFragments(job, particleDetail, subdued), [standing, region, origin, particleDetail, subdued]);
  const previous = useRef(-1);
  const atlas = job.atlas;
  const liveStart = atlas ? undefined : startsAt;
  useLayoutEffect(() => {
    const element = canvas.current!;
    // Keep the allocation for the lifetime of this reveal. A later concurrent
    // reveal can budget its own crop without rebuilding the one already onstage.
    render.current = atlas ? playPaperAtlas(element, atlas) : makePaperRaster(element, job, count, particleDetail);
    previous.current = -1;
    return () => {
      element.width = 1; element.height = 1;
      render.current = undefined;
    };
  }, [atlas, id, liveStart]);

  useLayoutEffect(() => {
    previous.current = -1;
    const el = canvas.current!;
    if (!visible) return;
    if (standing) { render.current?.(0, subdued); return; }
    const fragments = [...debris.current!.children] as HTMLElement[];
    let frame = 0;
    const draw = () => {
      if (!paused && fixedTime === undefined && document.hidden) return;
      const elapsed = fixedTime === undefined ? readClock() - startsAt : fixedTime - fixedStartsAt;
      const progress = Math.max(0, Math.min(1, elapsed / length));
      const frameIndex = progress >= 1 ? Infinity : fixedTime !== undefined ? progress : Math.floor(Math.max(0, elapsed) / frameMs);
      if (previous.current !== frameIndex) {
        previous.current = frameIndex;
        el.dataset.paperProgress = progress.toFixed(3);
        render.current?.(progress, subdued);
        for (let i = 0; i < fragments.length; i++) {
          const { delay, xDrift, yDrift, spin } = particles[i];
          const t = (progress - delay) / (.97 - delay);
          const fragment = fragments[i];
          const outside = t <= 0 || t >= 1;
          if (fragment.hidden !== outside) fragment.hidden = outside;
          if (outside) continue;
          const travel = t * (.47 + .53 * t), roll = Math.sin(t * 15 + i);
          const dx = xDrift * travel;
          const dy = -yDrift * easeOut(t) + roll * Math.min(8, yDrift * .055);
          const life = 1 - Math.max(0, (t - .45) / .55) ** 1.35;
          fragment.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${spin * t}deg) scale(${(.67 + .33 * Math.abs(roll)) * life},${life * (.42 + .58 * Math.abs(Math.cos(t * 14 + i)))})`;
          fragment.style.opacity = String(Math.min(1, 7 * t) * life);
        }
      }
      if (!paused && fixedTime === undefined && progress < 1 && !document.hidden) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [length, startsAt, fixedStartsAt, subdued, paused, standing, visible, fixedTime, readClock, particles]);

  return <div className={styles.burn} hidden={!visible} style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}>
    <canvas ref={canvas} data-testid={standing ? 'region-paper-prepared' : 'region-paper-burn'} data-region-id={standing ? undefined : id} data-paper-reason={standing ? undefined : reason} data-paper-source={atlas ? 'baked' : 'live'} />
    <div ref={debris} className={styles.debris} aria-hidden="true">
      {particles.map(({ x, y, size }, i) => <span key={i} hidden className={styles.fragment} style={{ left: x, top: y, '--fragment': `${size}px` } as CSSProperties} />)}
    </div>
  </div>;
});
