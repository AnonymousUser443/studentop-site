import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AccountUser, HudProps, IconName } from '../types';
import { Icon } from './Icon';
import { EdgeOrnaments } from './Ornaments';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { ScrollFurniture, ScrollText, useScrollState } from '../ui/scrollDialog/ScrollFurniture';
import { entryScrim, scrollIcon, scrollPaper, scrollPart, scrollScrim } from '../ui/scrollDialog/motion';
import { useScrollFocus } from '../ui/scrollDialog/useScrollFocus';
import HudFrame from './HudFrame';
import Brand from './Brand';
import StatusBar from './StatusBar';
import ActionDock, { type DockAction } from './ActionDock';
import AnnounceLayer from './AnnounceLayer';
import ProgressRing from './ProgressRing';
import CollectionPanel from './panels/CollectionPanel';
import LandmarkPanel from './panels/LandmarkPanel';
import './hud.css';
import './hud-frame.css';
import './progress-ring.css';
import './hud-shells.css';

const closePart = scrollPart(.05, 6, 0);
const shortCopy = scrollPart(.12, -6, 4);
const entryFormPart = scrollPart(.20, 0, 9);
const entryFootPart = scrollPart(.27, 0, 7);
const titlePart = scrollPart(.17, -2, 6);
const artPart = scrollPart(.03, 0, 3);
const ornaments = <EdgeOrnaments />;
const MapBrand = memo(Brand);
const MapStatus = memo(StatusBar);
const MapDock = memo(ActionDock);
const MapProgress = memo(ProgressRing);
const MapAnnouncement = memo(AnnounceLayer);

function PanelScrim({ reduced, onClose }: { reduced: boolean; onClose: () => void }) {
  const state = useScrollState();
  return <motion.div className="hud-modal-backdrop" data-scroll-state={state} aria-hidden="true"
    initial="rolled" animate="open" exit="closing" custom={reduced} variants={scrollScrim}
    onPointerDown={event => { if (state === 'open' && event.target === event.currentTarget) onClose(); }} />;
}

function Modal({ title, eyebrow, icon, children, onClose, className = '', reduced }: { title: string; eyebrow: string; icon: IconName; children: ReactNode; onClose: () => void; className?: string; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useScrollState();
  useScrollFocus(ref, state === 'open', onClose, '.modal-close');
  return <motion.div className={`hud-modal scroll-surface ${className}`} role="dialog" aria-modal="true"
    aria-label={title} tabIndex={-1} ref={ref} data-scroll-state={state} inert={state === 'closing' || undefined}
    initial="rolled" animate="open" exit="closing" custom={reduced} variants={scrollPaper}>
    <ScrollFurniture reduced={reduced} framed={className !== 'collection-modal'} />
    <header className="modal-heading">
      <motion.p className="modal-edition" variants={shortCopy} custom={reduced}>{className === 'collection-modal' ? '理韵 · 校园手记' : '理韵 · 地标札记'}</motion.p>
      <motion.span className="modal-emblem-flight" variants={scrollIcon} custom={reduced} aria-hidden="true"><span className="modal-emblem"><Icon name={icon}/></span></motion.span>
      <motion.button type="button" className="modal-close" aria-label="关闭面板" onClick={onClose} variants={closePart} custom={reduced}><Icon name="close"/></motion.button>
    </header>
    <div className="modal-body">
      <div className="letter-title-block">
        <h2><ScrollText text={title} reduced={reduced} delay={.11} /></h2>
        <motion.p className="eyebrow" variants={titlePart} custom={reduced}>{eyebrow}</motion.p>
      </div>
      {children}
    </div>
  </motion.div>;
}

const EntryGate = memo(function EntryGate({ account, loginBusy, loginError, onEnter, onLogin, onGuest, onLogout, reduced }: {
  account: AccountUser | null;
  loginBusy: boolean;
  loginError: string | null;
  onEnter: () => void;
  onLogin: (nickname: string, studentId: string, password: string) => void;
  onGuest: () => void;
  onLogout: () => void;
  reduced: boolean;
}) {
  const [nickname, setNickname] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const state = useScrollState();
  useScrollFocus(card, state === 'open');
  useEffect(() => setPassword(''), [account]);
  return <motion.div className="entrance-overlay" data-scroll-state={state} inert={state === 'closing' || undefined}
    initial="rolled" animate="open" exit="closing" variants={entryScrim} custom={reduced}>
    <motion.div className="entry-card scroll-surface" role="dialog" aria-modal="true" aria-label={account ? '继续旅程' : '登录或以游客身份启程'}
      ref={card} tabIndex={-1} data-scroll-state={state} variants={scrollPaper} custom={reduced}>
    <ScrollFurniture reduced={reduced} />
    <motion.div className="entry-scene-motion" aria-hidden="true" variants={artPart} custom={reduced}>
    <div className="entry-scene">
      <span className="scene-cloud scene-cloud-1"/><span className="scene-cloud scene-cloud-2"/><span className="scene-cloud scene-cloud-3"/>
      <svg className="scene-mountains" viewBox="0 0 420 150" preserveAspectRatio="none">
        <path className="mountain-far" d="M0 150 0 95 55 58 110 98 165 52 225 100 280 62 340 102 385 70 420 96 420 150 Z"/>
        <path className="mountain-near" d="M0 150 0 116 70 82 132 122 190 88 250 124 305 94 360 126 420 108 420 150 Z"/>
      </svg>
      <div className="scene-water"><span className="wave wave-a"/><span className="wave wave-b"/></div>
    </div></motion.div>
    <div className="entry-content">
      <motion.div className="entry-flourish" variants={shortCopy} custom={reduced}>◇ <span/> 良乡 · 秋日 <span/> ◇</motion.div>
      <p><ScrollText text="一纸山水，万般理韵" reduced={reduced} delay={.15} /></p>
      {account ? <>
        <motion.div className="account-chip" variants={entryFormPart} custom={reduced}><motion.span variants={scrollIcon} custom={reduced} aria-hidden="true"><Icon name="people"/></motion.span><div><strong>{account.nickname}</strong><small>UID {account.uid} · 学号 {account.studentId}</small></div></motion.div>
        <motion.button className="enter-campus" onClick={onEnter} variants={entryFootPart} custom={reduced}><span>继续旅程</span><Icon name="star"/></motion.button>
        <motion.button className="entry-alt" onClick={onLogout} disabled={loginBusy} variants={entryFootPart} custom={reduced}>退出登录 · 以游客身份进入</motion.button>
      </> : <>
        <motion.form className="entry-login" variants={entryFormPart} custom={reduced} autoComplete="off" onSubmit={e => { e.preventDefault(); if (!loginBusy) { const submitted = password; setPassword(''); onLogin(nickname.trim(), studentId.trim(), submitted); } }}>
          <label><span>昵称</span><input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="游戏昵称，请勿用真实姓名" required maxLength={24} autoComplete="off" disabled={loginBusy}/></label>
          <label><span>学号 / ID</span><input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="可用测试游戏 ID，不作实名核验" required maxLength={32} autoComplete="off" spellCheck={false} disabled={loginBusy}/></label>
          <label><span>访问口令</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8–128 个字符，请勿复用学校密码" required minLength={8} maxLength={128} autoComplete="off" spellCheck={false} aria-describedby="entry-account-help" disabled={loginBusy}/></label>
          <div id="entry-account-help" className="entry-login-help">首次使用该 ID 会创建存档与访问口令；下次须用相同口令。旧版无口令存档请联系管理员核验迁移。口令提交后即清空，不写入本机存档。</div>
          <button className="enter-campus" type="submit" disabled={loginBusy}><span>{loginBusy ? '登录中…' : '登录并进入'}</span><Icon name="star"/></button>
        </motion.form>
        <motion.button className="entry-alt" onClick={() => { setPassword(''); onGuest(); }} disabled={loginBusy} variants={entryFootPart} custom={reduced}>游客模式 · 进度仅保存在本机</motion.button>
        {loginError && <motion.p className="entry-error" role="alert" variants={entryFormPart} custom={reduced}>{loginError}</motion.p>}
      </>}
      <motion.small variants={entryFootPart} custom={reduced}>轻触启程 · 开启声音与沉浸体验</motion.small>
    </div>
  </motion.div></motion.div>;
});


function Panels(p: HudProps & { reduced: boolean }) {
  const item = p.selected;
  if (!item && p.activePanel !== 'collection') return null;
  return <Modal title={item?.name ?? '收集图鉴'} eyebrow={item?.subtitle ?? `校园记忆 · 已点亮 ${p.collected} 处`} icon={item?.icon ?? 'chest'} onClose={p.onClose} reduced={p.reduced} className={item ? 'landmark-modal' : 'collection-modal'}>
    {item ? <LandmarkPanel item={item} discovered={p.discovered} checkIn={p.checkIn} onClose={p.onClose} onCenter={p.onCenter} onExplore={p.onExplore} onLocate={p.onLocate} reduced={p.reduced} /> : <CollectionPanel activityReturn={p.activityReturn} onPanel={p.onPanel} landmarks={p.landmarks} state={p.state} onSelect={p.onSelect} reduced={p.reduced} />}
  </Modal>;
}

export interface HudExtraProps extends HudProps {
  /** 打开派蒙式旅途菜单 */
  onOpenMenu: () => void;
  onEntryDismissed?: () => void;
  entryVisible?: boolean;
  context?: ReactNode;
  announcement?: { id: string | number; text: string };
}

export default function Hud(p: HudExtraProps) {
  const { reducedMotion: reduced } = useMotionPreferences();
  const chromeInert = !p.entered || Boolean(p.activePanel) || Boolean(p.selected);
  const modalOpen = p.entered && Boolean(p.selected || p.activePanel === 'collection');
  const wasModalOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  // 在 inert 提交到 DOM 之前保存触发者；提交后浏览器已把原焦点移到 body。
  if (modalOpen && !wasModalOpen.current) returnFocus.current = document.activeElement as HTMLElement | null;
  wasModalOpen.current = modalOpen;
  const restorePanelFocus = () => {
    const active = document.activeElement;
    if (wasModalOpen.current || !p.entered || (active && active !== document.body)) return;
    const target = returnFocus.current;
    if (target?.isConnected && !target.closest('[inert], [aria-hidden="true"]')) target.focus({ preventScroll: true });
    else {
      const badge = document.querySelector<HTMLElement>('.hud-brand-badge');
      if (badge && !badge.closest('[inert], [aria-hidden="true"]')) badge.focus({ preventScroll: true });
    }
  };
  const { onPanel, announcement, toast } = p;
  const openCollection = useCallback(() => onPanel('collection'), [onPanel]);
  const dockActions = useMemo<DockAction[]>(() => [
    { id: 'activities', label: '活动一览', icon: 'scroll', key: 'A', emphasis: true, onClick: () => onPanel('activities') },
    { id: 'collection', label: '收集图鉴', icon: 'chest', key: 'C', onClick: openCollection },
  ], [onPanel, openCollection]);
  const announceItems = useMemo(() => announcement ? [announcement] : toast ? [{ id: toast, text: toast }] : [], [announcement, toast]);
  return <>
    {ornaments}
    <HudFrame
      visible={p.entered}
      inert={chromeInert}
      compact={Boolean(p.activePanel) || Boolean(p.selected)}
      brand={<MapBrand onOpenMenu={p.onOpenMenu} onCenter={p.onCenter}/>}
      status={<MapStatus
        collected={p.collected}
        total={p.landmarks.length}
        accountName={p.account?.nickname ?? null}
        isFullscreen={p.isFullscreen}
        onOpenCollection={openCollection}
        onOpenProfile={p.onOpenMenu}
        onToggleFullscreen={p.onFullscreen}
      />}
      dock={<MapDock actions={dockActions}/>}
      progress={<MapProgress
        progress={p.progress}
        collected={p.collected}
        total={p.landmarks.length}
        saveLabel={p.account ? `UID: ${p.account.uid}` : '游客 · 本机存档'}
        onClick={p.onCenter}
      />}
      context={p.context}
      announce={<MapAnnouncement items={announceItems}/>}
    />
    <AnimatePresence custom={reduced}>
      {modalOpen && <PanelScrim reduced={reduced} onClose={p.onClose} />}
    </AnimatePresence>
    <div className="hud-modal-stage">
      <AnimatePresence mode="wait" custom={reduced} onExitComplete={restorePanelFocus}>
        {modalOpen && <Panels key={p.selected?.id ?? p.activePanel} {...p} reduced={reduced} />}
      </AnimatePresence>
    </div>
    <AnimatePresence custom={reduced} onExitComplete={p.entered ? p.onEntryDismissed : undefined}>
      {!p.entered && p.entryVisible !== false && <EntryGate account={p.account} loginBusy={p.loginBusy} loginError={p.loginError} onEnter={p.onEnter} onLogin={p.onLogin} onGuest={p.onGuest} onLogout={p.onLogout} reduced={reduced}/>}
    </AnimatePresence>
  </>;
}
