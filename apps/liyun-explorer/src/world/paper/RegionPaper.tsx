import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '../../data';
import type { MapCamera, SceneEvent, Viewport } from '../../types';
import { paperContains, paperNearViewport } from './geometry';
import { getArrivalAtlas, paperSections as SECTIONS } from './arrivalBake';
import { PAPER_COLOR, PAPER_FRINGE, PAPER_TEXTURE, PAPER_TILE } from './scorch';
import { type PaperJob, warmPaperTexture } from './burnCanvas';
import PaperBurn from './PaperBurn';
import styles from './paper.module.css';

const EMPTY_JOBS: PaperJob[] = [];
const standby = new Map<string, PaperJob>();
function standbyFor(region: (typeof SECTIONS)[number]) {
  const atlas = getArrivalAtlas(region.id);
  if (!atlas) return undefined;
  let job = standby.get(region.id);
  if (!job) {
    job = { region, atlas, origin: region.center, reason: 'arrival', startsAt: 0, fixedStartsAt: 0, batchSize: 1, length: 940 };
    standby.set(region.id, job);
  }
  return job;
}

function usePaperClock(paused: boolean) {
  const clock = useRef({ hiddenAt: paused ? performance.now() : null, spent: 0 });
  const [, rerender] = useReducer(n => n + 1, 0);
  useLayoutEffect(() => {
    if (paused && clock.current.hiddenAt === null) {
      clock.current.hiddenAt = performance.now(); rerender();
    } else if (!paused && clock.current.hiddenAt !== null) {
      clock.current.spent += performance.now() - clock.current.hiddenAt;
      clock.current.hiddenAt = null; rerender();
    }
  }, [paused]);
  return useCallback(() => (clock.current.hiddenAt ?? performance.now()) - clock.current.spent, []);
}

type Props = {
  camera: MapCamera;
  viewport: Viewport;
  unlockedIds: string[];
  event: SceneEvent | null;
  paused?: boolean;
  fixedTime?: number;
  reducedMotion?: boolean;
  reduceFlash?: boolean;
  arrivalKey?: string;
  arrivalPending?: boolean;
  detail?: 'simple' | 'full';
  onArrivalBusy?: (busy: boolean) => void;
};

/** Cover locked regions with a single, non-animated sheet. The canvas exists only for a reveal. */
export default memo(function RegionPaper({ camera, viewport, unlockedIds, event, paused = false, fixedTime, reducedMotion, reduceFlash = false, arrivalKey, arrivalPending = false, detail = 'full', onArrivalBusy }: Props) {
  const [jobs, setJobs] = useState<PaperJob[]>(EMPTY_JOBS);
  const unlocked = useMemo(() => new Set(unlockedIds), [unlockedIds]);
  const previous = useRef(unlocked), playedArrival = useRef<string | undefined>(undefined);
  const latestEvent = useRef(event);
  latestEvent.current = event;
  const readClock = usePaperClock(paused);
  const [phase, wake] = useReducer(n => n + 1, 0);
  const mountedCrops = useRef(new Set<string>());
  const pattern = `paper-${useId()}`;
  useEffect(warmPaperTexture, []);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = unlocked;
    const arrival = arrivalKey !== undefined && arrivalKey !== playedArrival.current;
    if (arrivalPending) {
      playedArrival.current = undefined;
      setJobs(EMPTY_JOBS);
      return;
    }
    if (arrival) playedArrival.current = arrivalKey;
    if (reducedMotion) { setJobs(EMPTY_JOBS); return; }

    const discovery = latestEvent.current;
    const candidates = SECTIONS.filter(region => unlocked.has(region.id) && (arrival || !before.has(region.id)));
    candidates.sort((a, b) => (a.center.u - b.center.u) * .7 + (a.center.v - b.center.v) * .3 || a.order - b.order);
    const now = performance.now(), clockNow = readClock();
    const playCount = candidates.length;
    const spacing = Math.min(120, 420 / Math.max(1, playCount - 1));
    const begin = arrival ? now + 160 : discovery ? discovery.startedAt + discovery.duration * .39 : now + 45;
    const additions: PaperJob[] = candidates.map((region, i) => {
      const fixedStartsAt = begin + i * spacing;
      const startsAt = clockNow + Math.max(0, begin - now) + i * spacing;
      const point = !arrival && discovery && paperContains(region, discovery.to) ? discovery.to : undefined;
      return { region, reason: arrival ? 'arrival' : 'unlock', startsAt, fixedStartsAt,
        origin: point ?? region.center,
        atlas: point ? undefined : getArrivalAtlas(region.id),
        batchSize: playCount, length: arrival ? 940 : 1150 };
    });
    setJobs(old => {
      const remaining = arrival ? EMPTY_JOBS : old.filter(job => unlocked.has(job.region.id));
      if (!additions.length && remaining.length === old.length) return old;
      const combined = [...remaining, ...additions];
      // A second check-in can land mid-burn. Share the same budget with it,
      // then keep each crop's current resolution until its own reveal ends.
      return combined.map(job => job.batchSize >= combined.length ? job : { ...job, batchSize: combined.length });
    });
  }, [unlocked, arrivalKey, arrivalPending, reducedMotion, readClock]);

  const { waiting, active, next, arrivalBusy } = useMemo(() => {
    const waiting = new Set<string>(), active = new Map<string, PaperJob>();
    let next = Infinity, arrivalBusy = false;
    if (!arrivalPending && !reducedMotion && jobs.length) {
      const time = fixedTime ?? readClock();
      for (const job of jobs) {
        if (!unlocked.has(job.region.id)) continue;
        const start = fixedTime === undefined ? job.startsAt : job.fixedStartsAt;
        if (time < start) { waiting.add(job.region.id); next = Math.min(next, job.startsAt); }
        else if (time < start + job.length) { active.set(job.region.id, job); next = Math.min(next, job.startsAt + job.length); }
        arrivalBusy ||= job.reason === 'arrival';
      }
    }
    return { waiting, active, next, arrivalBusy };
    // A camera update does not advance paper phase; the scheduled boundary does.
  }, [arrivalPending, reducedMotion, jobs, unlocked, fixedTime, readClock, phase, paused]);
  useEffect(() => { onArrivalBusy?.(arrivalBusy); }, [arrivalBusy, onArrivalBusy]);
  useEffect(() => {
    if (paused || fixedTime !== undefined) return;
    if (!Number.isFinite(next)) {
      if (jobs.length) setJobs(EMPTY_JOBS);
      return;
    }
    const timer = setTimeout(() => {
      const current = readClock();
      setJobs(old => {
        const remaining = old.filter(job => current < job.startsAt + job.length);
        return remaining.length === old.length ? old : remaining;
      });
      wake();
    }, Math.max(1, Math.ceil(next - readClock()) + 1));
    return () => clearTimeout(timer);
  }, [next, paused, fixedTime, readClock, jobs.length]);

  const covered = useMemo(() => SECTIONS.filter(region => arrivalPending || !unlocked.has(region.id) || waiting.has(region.id)), [arrivalPending, unlocked, waiting]);
  const preparedCovers = useMemo(() => new Map(covered.flatMap(region => {
    const job = !reducedMotion && unlocked.has(region.id) ? standbyFor(region) : undefined;
    return job ? [[region.id, job] as const] : [];
  })), [covered, reducedMotion, unlocked]);
  const sheet = useMemo(() => {
    const staticPath = covered.filter(region => !preparedCovers.has(region.id)).map(region => region.path).join(' ');
    return <svg className={styles.sheet} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} data-testid="region-paper-base">
      <defs>
        <pattern id={pattern} patternUnits="userSpaceOnUse" width={PAPER_TILE} height={PAPER_TILE}>
          <rect width={PAPER_TILE} height={PAPER_TILE} fill={PAPER_COLOR} />
          <image href={PAPER_TEXTURE} width={PAPER_TILE} height={PAPER_TILE} preserveAspectRatio="none" />
        </pattern>
      </defs>
      {staticPath && <g>
        {PAPER_FRINGE.map(([width, alpha]) => <path key={width} d={staticPath} fill="none"
          stroke={`url(#${pattern}) ${PAPER_COLOR}`} strokeWidth={width} strokeOpacity={alpha} strokeLinejoin="round" />)}
        <path d={staticPath} fill={`url(#${pattern}) ${PAPER_COLOR}`} />
      </g>}
      {covered.map(region => <path key={region.id} d={region.path} fill="none" data-region-id={region.id} />)}
    </svg>;
  }, [covered, preparedCovers, pattern]);
  const candidates = useMemo(() => new Map([...preparedCovers, ...active]), [preparedCovers, active]);
  const crops = useMemo(() => {
    const visible = new Set<string>();
    const elements = [];
    for (const [id, job] of candidates) {
      const near = paperNearViewport(job.region, camera, viewport);
      if (!near && !mountedCrops.current.has(id)) continue;
      if (near) visible.add(id);
      // Keep a prepared or running crop through a quick pan, but stop drawing
      // it offscreen. Re-entry catches up to the same paper clock.
      elements.push(<PaperBurn key={id} job={job} standing={!active.has(id)} count={job.batchSize} detail={detail}
        visible={near} subdued={reduceFlash} paused={paused} fixedTime={fixedTime} readClock={readClock} />);
    }
    return { elements, visible };
  }, [candidates, active, camera, viewport, detail, reduceFlash, paused, fixedTime, readClock]);
  useLayoutEffect(() => {
    for (const id of mountedCrops.current) if (!preparedCovers.has(id) && !active.has(id)) mountedCrops.current.delete(id);
    for (const id of crops.visible) mountedCrops.current.add(id);
  }, [preparedCovers, active, crops.visible]);
  return <div className={styles.cover} data-testid="region-paper" data-paper-state={active.size ? paused ? 'paused' : 'burning' : waiting.size ? 'waiting' : 'still'} aria-hidden="true">
    {sheet}
    {crops.elements}
  </div>;
});
