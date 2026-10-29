import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../hud/Icon';
import { EVENTS, REWARDS, STATUS_LABELS, previewMapTarget, recordedLandmarkCount, resolveEventAction, type EventEntry } from './events';
import ThemeArtwork from './ThemeArtwork';
import './activity.css';

type Phase = 'closed' | 'opening' | 'open' | 'switching' | 'navigating' | 'closing';
export interface ActivityScreenProps {
  open: boolean;
  reducedMotion: boolean;
  quality: 'high' | 'low';
  discoveredIds: string[];
  onClose: () => void;
  onVisitMap: (landmarkId: string) => void;
  onViewCollection: () => void;
}

function ScrollHardware({ lower = false }: { lower?: boolean }) {
  return <svg className={`activity-scroll-hardware ${lower ? 'is-lower' : ''}`} viewBox="0 0 320 32" preserveAspectRatio="none" aria-hidden="true">
    <path d="M9 8h302v16H9z" fill="#425d4a" stroke="#c2a15f" strokeWidth="1.5"/>
    <path d="M27 10h266v4H27z" fill="#799078"/><path d="M27 23h266" stroke="#192e26" strokeWidth="2"/>
    {[8, 19, 294, 305].map(x => <g key={x}><rect x={x} y="3" width="8" height="26" rx="3" fill="#c3a35f" stroke="#66552f"/><path d={`M${x + 2} 5v21`} stroke="#f2dc9b"/></g>)}
    <path d="M40 18h240" stroke="#b3b78c" strokeWidth=".6" opacity=".6"/>
  </svg>;
}

function Tassel({ right = false }: { right?: boolean }) {
  return <svg className={`activity-tassel ${right ? 'is-right' : ''}`} viewBox="0 0 46 230" aria-hidden="true">
    <path d="M22 0c8 7-8 15 0 22s-8 15 0 22v48" fill="none" stroke="#bd9650" strokeWidth="3"/>
    <circle cx="23" cy="95" r="16" fill="#c4c4a0" stroke="#dfc780" strokeWidth="3"/>
    <circle cx="23" cy="95" r="10" fill="none" stroke="#72856a"/>
    <path d="m14 95 9-5 9 5-9 5Z" fill="none" stroke="#657b5c"/>
    <path d="M23 111v24" stroke="#b18c4a" strokeWidth="3"/>
    <ellipse cx="23" cy="131" rx="5" ry="6" fill="#9d7d3d"/>
    <path d="M18 138c0 20-10 45-10 82 8 6 22 6 30 0 0-37-10-62-10-82Z" fill="#d6b46a" stroke="#92723f"/>
    <path d="m19 141-6 76m10-76v79m4-79 6 76" stroke="#f1db97" strokeWidth="1.5"/>
    <path d="M17 139h12" stroke="#425e4e" strokeWidth="6"/>
  </svg>;
}

function RewardEmblem({ kind }: { kind: string }) {
  const [failedKind, setFailedKind] = useState<string | null>(null);
  const reward = REWARDS[kind];
  if (!reward || failedKind === kind) return <span className="activity-reward-art activity-reward-fallback" aria-hidden="true" data-image-unavailable="true"><Icon name={reward?.icon ?? 'star'}/></span>;
  return <img className={`activity-reward-art reward-${kind}`} src={`/assets/activity/reward-${kind}.webp`} width="512" height="512" alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFailedKind(kind)}/>;
}

function EventMark({ entry }: { entry: EventEntry }) {
  return entry.themeKey === 'frost' ? <RewardEmblem kind="ginkgo"/> : <Icon name={entry.iconKey}/>;
}

export default function ActivityScreen(props: ActivityScreenProps) {
  const { open, reducedMotion, quality, discoveredIds } = props;
  const callbacks = useRef(props); callbacks.current = props;
  const screen = useRef<HTMLElement>(null);
  const navigator = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const rewardTooltipRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollPosition = useRef(0);
  const [selectedId, setSelectedId] = useState(EVENTS[0].id);
  const selectedRef = useRef(selectedId); selectedRef.current = selectedId;
  const [phase, setPhase] = useState<Phase>('closed');
  const phaseRef = useRef<Phase>('closed');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const openRef = useRef(open); openRef.current = open;
  const reducedRef = useRef(reducedMotion);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(document.hidden);
  const [chapterKey, setChapterKey] = useState(0);
  const [rewardId, setRewardId] = useState<string | null>(null);
  const [hoverRewardId, setHoverRewardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const hasOpened = useRef(false);
  const [returning, setReturning] = useState(false);
  const reduced = reducedMotion || systemReduced;
  reducedRef.current = reduced;

  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const cancel = useCallback(() => { clearTimeout(timer.current); generation.current += 1; }, []);
  const later = useCallback((delay: number, callback: () => void) => {
    const current = generation.current;
    timer.current = setTimeout(() => { if (current === generation.current && openRef.current) callback(); }, reducedRef.current ? 0 : delay);
  }, []);
  const saveScroll = useCallback(() => { scrollPosition.current = navigator.current?.scrollTop ?? scrollPosition.current; }, []);
  const finishClose = useCallback(() => {
    cancel(); saveScroll(); changePhase('closed');
    callbacks.current.onClose();
  }, [cancel, changePhase, saveScroll]);
  const close = useCallback(() => {
    if (phaseRef.current === 'closed') return;
    if (phaseRef.current === 'closing') { finishClose(); return; }
    cancel(); setRewardId(null); setHoverRewardId(null); changePhase('closing');
    later(420, finishClose);
  }, [cancel, changePhase, finishClose, later]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const mediaChange = () => setSystemReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', mediaChange);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', mediaChange); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    cancel(); setRewardId(null); setHoverRewardId(null); setNavigationError(null);
    if (!open) { saveScroll(); changePhase('closed'); return; }
    setReturning(hasOpened.current);
    changePhase('opening');
    const frame = requestAnimationFrame(() => {
      if (navigator.current) navigator.current.scrollTop = scrollPosition.current;
      if (!screen.current?.closest('[inert]')) tabRefs.current[EVENTS.findIndex(item => item.id === selectedRef.current)]?.focus({ preventScroll: true });
    });
    later(hasOpened.current ? 360 : 950, () => changePhase('open'));
    hasOpened.current = true;
    return () => { cancelAnimationFrame(frame); cancel(); };
  }, [open, cancel, changePhase, later, saveScroll]);

  useEffect(() => () => cancel(), [cancel]);

  useEffect(() => {
    if (!notice || !open) return;
    const frame = requestAnimationFrame(() => noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [notice, open, reduced]);
  useEffect(() => {
    if (!rewardId || !open) return;
    const frame = requestAnimationFrame(() => rewardTooltipRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [rewardId, open, reduced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const dialog = screen.current;
      if (!dialog || dialog.hidden || dialog.closest('[inert]')) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (rewardId || hoverRewardId) { setRewardId(null); setHoverRewardId(null); return; }
        close(); return;
      }
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'));
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, rewardId, hoverRewardId, close]);

  const selectedIndex = Math.max(0, EVENTS.findIndex(item => item.id === selectedId));
  const entry = EVENTS[selectedIndex];
  const action = resolveEventAction(entry);
  const mapPreview = previewMapTarget(entry);
  const recorded = recordedLandmarkCount(discoveredIds);
  const present = open || phase !== 'closed';
  const busy = phase === 'navigating' || phase === 'closing';
  const visibleRewardId = rewardId ?? hoverRewardId;

  const select = (index: number, focus = false) => {
    if (phaseRef.current === 'navigating' || phaseRef.current === 'closing' || phaseRef.current === 'closed') return;
    const next = EVENTS[(index + EVENTS.length) % EVENTS.length];
    if (focus) { tabRefs.current[(index + EVENTS.length) % EVENTS.length]?.focus(); tabRefs.current[(index + EVENTS.length) % EVENTS.length]?.scrollIntoView({ block: 'nearest' }); }
    if (next.id === selectedRef.current) return;
    cancel(); selectedRef.current = next.id;
    setSelectedId(next.id); setNotice(null); setRewardId(null); setHoverRewardId(null); setNavigationError(null);
    setChapterKey(key => key + 1); changePhase('switching');
    later(540, () => changePhase('open'));
  };
  const navigate = (destination: { kind: 'map'; landmarkId: string } | { kind: 'collection' }) => {
    if (phaseRef.current === 'navigating' || phaseRef.current === 'closing' || phaseRef.current === 'closed') return;
    cancel(); setRewardId(null); setHoverRewardId(null); setNavigationError(null); changePhase('navigating');
    later(580, () => {
      try {
        saveScroll();
        if (destination.kind === 'map') callbacks.current.onVisitMap(destination.landmarkId);
        else callbacks.current.onViewCollection();
        changePhase('closed');
      } catch {
        changePhase('open'); setNavigationError('暂时未能展开目的地，请重试或返回地图。');
      }
    });
  };
  const primary = () => {
    if (phaseRef.current === 'switching' || phaseRef.current === 'navigating' || phaseRef.current === 'closing') return;
    const current = EVENTS.find(item => item.id === selectedRef.current);
    if (!current) return;
    const nextAction = resolveEventAction(current);
    if (nextAction.kind === 'map') navigate(nextAction);
    else if (nextAction.kind === 'collection') navigate(nextAction);
    else setNotice(previous => previous === nextAction.message ? null : nextAction.message);
  };

  return <section ref={screen} className={`activity-screen ${reduced ? 'is-reduced' : ''} ${hidden ? 'is-paused' : ''} ${returning ? 'is-returning' : ''}`}
    hidden={!present} role="dialog" aria-modal="true" aria-labelledby="activity-screen-title" tabIndex={-1}
    data-testid="activity-screen" data-phase={phase} data-event-id={entry.id} data-theme={entry.themeKey}
    aria-busy={phase === 'navigating' || phase === 'switching'}
    onPointerDown={event => { event.stopPropagation(); if (!(event.target as HTMLElement).closest('.activity-rewards')) setRewardId(null); }}
    onWheel={event => event.stopPropagation()}>
    <div className="activity-ambient" aria-hidden="true"/>
    <div className="activity-dimmer" aria-hidden="true"/>
    <header className="activity-page-header"><span className="activity-header-icon"><Icon name="scroll"/></span><div><p>校园纪事 · 理韵寻踪</p><h2 id="activity-screen-title">活动一览</h2></div><span className="activity-header-rule" aria-hidden="true">◇</span></header>
    <button type="button" className="activity-close" onClick={close} aria-label="关闭活动一览" data-testid="activity-close"><Icon name="close"/></button>

    <div className="activity-strip">
      <div className="activity-strip-border" aria-hidden="true"/>
      <div className="activity-art-host">
        {present && <div className={`activity-art-current ${phase === 'switching' ? 'is-changing' : ''}`}><ThemeArtwork themeKey={entry.themeKey} reducedMotion={reduced} quality={quality} paused={hidden || phase === 'closing' || phase === 'navigating'}/></div>}
      </div>
      <article className={`activity-paper ${entry.title.length > 4 ? 'has-long-title' : ''}`} aria-labelledby="activity-event-title" id="activity-event-panel" role="tabpanel" aria-live="polite">
        <div className="activity-paper-inner" key={`paper-${chapterKey}`}>
          <div className="activity-event-heading"><span className="activity-category">{entry.category}</span><h3 id="activity-event-title">{entry.title}</h3><p className="activity-subtitle"><span/>{entry.subtitle}<span/></p></div>
          <div className="activity-information">
            <p className="activity-summary">{entry.summary}</p>
            {entry.themeKey === 'archive' && <p className="activity-record-count">已点亮 <strong>{recorded}</strong> 处地标<span>真实探索记录 · 未点亮的地标仍待你抵达</span></p>}
            {entry.rewardKeys.length > 0 && <div className="activity-rewards">
              <h4><span>◇</span> 主题奖励 <small>构想示意</small><i/></h4>
              <div className="activity-reward-row">{entry.rewardKeys.map((key, index) => {
                const reward = REWARDS[key]; if (!reward) return null;
                return <div className="activity-reward-slot" key={key}>
                  <button type="button" className="activity-reward" aria-label={`${reward.title}，奖励构想说明`} aria-expanded={visibleRewardId === key} aria-describedby={visibleRewardId === key ? `activity-reward-${key}` : undefined}
                    style={{ '--reward-index': index } as CSSProperties} onClick={() => setRewardId(previous => previous === key ? null : key)}
                    onPointerEnter={event => { if (event.pointerType === 'mouse') setHoverRewardId(key); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setHoverRewardId(null); }} disabled={busy}>
                    <RewardEmblem kind={key}/><span className="activity-reward-caption">{reward.title}</span>
                  </button>
                </div>;
              })}</div>
              {visibleRewardId && REWARDS[visibleRewardId] && <div className="activity-reward-tooltip" ref={rewardTooltipRef} id={`activity-reward-${visibleRewardId}`} role="status"><strong>{REWARDS[visibleRewardId].title}</strong><span>{REWARDS[visibleRewardId].description}</span></div>}
            </div>}
            {notice && <div className="activity-notice" ref={noticeRef} role="status" data-testid="activity-notice"><strong>{STATUS_LABELS[entry.status]}</strong><p>{notice}</p></div>}
            {navigationError && <p className="activity-navigation-error" role="alert">{navigationError}</p>}
          </div>
          <div className="activity-footer"><p className="activity-availability"><span/>{entry.availability}</p><div className="activity-actions">
            <button type="button" className="activity-primary" data-testid="activity-cta" data-action={action.kind} disabled={busy || phase === 'switching'} onClick={primary}>
              <span>{phase === 'navigating' ? '正在展开…' : action.label}</span><span className={phase === 'navigating' ? 'activity-action-spinner' : 'activity-action-arrow'} aria-hidden="true">{phase === 'navigating' ? '' : '›'}</span>
            </button>
            {mapPreview && <button type="button" className="activity-map-preview" data-testid="activity-map-preview" disabled={busy || phase === 'switching'} onClick={() => navigate({ kind: 'map', landmarkId: mapPreview })}>{mapPreview === 'beihu' ? '北湖地图预览' : '图书馆地图预览'}<span aria-hidden="true"> ↗</span></button>}
          </div></div>
        </div>
      </article>
    </div>

    <aside className="activity-scroll" aria-label="活动卷轴目录">
      <Tassel/><Tassel right/>
      <div className="activity-scroll-paper"><p className="activity-scroll-caption">四时有信 · 展卷寻踪</p><div className="activity-nav-viewport" ref={navigator} onScroll={saveScroll}>
        <div className="activity-nav-list" role="tablist" aria-label="活动目录" aria-orientation="vertical" style={{ '--selected-index': selectedIndex } as CSSProperties}>
          <div className="activity-selection" aria-hidden="true"><i/><b>◇</b></div>
          {EVENTS.map((item, index) => <button type="button" key={item.id} ref={element => { tabRefs.current[index] = element; }}
            className={`activity-tab ${item.id === selectedId ? 'is-selected' : ''}`} role="tab" aria-selected={item.id === selectedId} aria-controls="activity-event-panel"
            tabIndex={item.id === selectedId ? 0 : -1} disabled={busy} data-testid={`activity-tab-${item.id}`} data-event-id={item.id} onClick={() => select(index)}
            onKeyDown={event => {
              let next: number | null = null;
              if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index + 1;
              if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index - 1;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = EVENTS.length - 1;
              if (next !== null) { event.preventDefault(); event.stopPropagation(); select(next, true); }
            }}>
            <span className="activity-tab-icon"><EventMark entry={item}/></span><span className="activity-tab-copy"><strong>{item.title}</strong><small>{item.status === 'archived' ? '个人回顾' : STATUS_LABELS[item.status]}</small></span><span className="activity-tab-seal" aria-hidden="true">{item.category}</span>
          </button>)}
        </div>
      </div><div className="activity-scroll-landscape" aria-hidden="true"><span/><i/><b>理韵</b></div></div>
      <ScrollHardware/><ScrollHardware lower/>
    </aside>
    <p className="activity-page-hint"><span>↑ ↓ 翻阅篇章</span><i>◇</i><span>Esc 收起画卷</span></p>
    <div className="activity-transition-veil" aria-hidden="true"><span/><span/><span/></div>
  </section>;
}
