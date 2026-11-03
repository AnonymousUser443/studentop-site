import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import type { AccountUser, HudProps, IconName } from '../types';
import { Icon } from './Icon';
import { EdgeOrnaments } from './Ornaments';
import { tween } from '../motion/transitions';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import HudFrame from './HudFrame';
import Brand from './Brand';
import StatusBar from './StatusBar';
import ActionDock from './ActionDock';
import AnnounceLayer from './AnnounceLayer';
import ProgressRing from './ProgressRing';
import './hud.css';
import './hud-frame.css';
import './progress-ring.css';
import './hud-shells.css';

const loadCollectionPanel = () => import('./panels/CollectionPanel');
const loadLandmarkPanel = () => import('./panels/LandmarkPanel');
const CollectionPanel = lazy(loadCollectionPanel);
const LandmarkPanel = lazy(loadLandmarkPanel);
/** Optional idle prefetch. Importing Hud itself does not request either panel body. */
export const preloadHudPanels = () => Promise.all([loadCollectionPanel(), loadLandmarkPanel()]).then(() => undefined);

function Modal({ title, eyebrow, icon, children, onClose, className = '', returnFocus }: { title: string; eyebrow: string; icon: IconName; children: ReactNode; onClose: () => void; className?: string; returnFocus?: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();
  const { reducedMotion } = useMotionPreferences();
  useEffect(() => {
    if (!isPresent) return;
    const previous = returnFocus ?? document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const targets = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [tabindex="0"]') ?? []);
    targets()[0]?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const all = targets(); const first = all[0]; const last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => { document.removeEventListener('keydown', handleKey, true); previous?.focus(); };
  }, [onClose, title, isPresent]);
  const inner = <>
    <header className="modal-heading"><span className="modal-emblem"><Icon name={icon}/></span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="modal-close" aria-label="关闭面板" onClick={onClose}><Icon name="close"/></button></header>
    <div className="modal-body">{children}</div>
    <span className="modal-corner corner-tl"/><span className="modal-corner corner-tr"/><span className="modal-corner corner-bl"/><span className="modal-corner corner-br"/>
  </>;
  return <motion.div className="hud-modal-backdrop" inert={!isPresent || undefined}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast}
    onPointerDown={e => { if (isPresent && e.target === e.currentTarget) onClose(); }}>
    <motion.div className={`hud-modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: .98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: .99 }}
      transition={reducedMotion ? tween.tap : isPresent ? tween.slow : tween.fast}>{inner}</motion.div>
  </motion.div>;
}

function EntryGate({ account, loginBusy, loginError, onEnter, onLogin, onGuest, onLogout }: {
  account: AccountUser | null;
  loginBusy: boolean;
  loginError: string | null;
  onEnter: () => void;
  onLogin: (nickname: string, studentId: string, password: string) => void;
  onGuest: () => void;
  onLogout: () => void;
}) {
  const [nickname, setNickname] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => setPassword(''), [account]);
  return <div className="entrance-overlay"><div className="entry-card">
    <span className="entry-frame" aria-hidden="true"/>
    <div className="entry-scene" aria-hidden="true">
      <span className="scene-cloud scene-cloud-1"/><span className="scene-cloud scene-cloud-2"/><span className="scene-cloud scene-cloud-3"/>
      <svg className="scene-mountains" viewBox="0 0 420 150" preserveAspectRatio="none">
        <path className="mountain-far" d="M0 150 0 95 55 58 110 98 165 52 225 100 280 62 340 102 385 70 420 96 420 150 Z"/>
        <path className="mountain-near" d="M0 150 0 116 70 82 132 122 190 88 250 124 305 94 360 126 420 108 420 150 Z"/>
      </svg>
      <div className="scene-water"><span className="wave wave-a"/><span className="wave wave-b"/></div>
    </div>
    <div className="entry-content">
      <div className="entry-flourish">◇ <span/> 良乡 · 秋日 <span/> ◇</div>
      <p>一纸山水，万般理韵</p>
      {account ? <>
        <div className="account-chip"><Icon name="people"/><div><strong>{account.nickname}</strong><small>UID {account.uid} · 学号 {account.studentId}</small></div></div>
        <button className="enter-campus" onClick={onEnter}><span>继续旅程</span><Icon name="star"/></button>
        <button className="entry-alt" onClick={onLogout} disabled={loginBusy}>退出登录 · 以游客身份进入</button>
      </> : <>
        <form className="entry-login" autoComplete="off" onSubmit={e => { e.preventDefault(); if (!loginBusy) { const submitted = password; setPassword(''); onLogin(nickname.trim(), studentId.trim(), submitted); } }}>
          <label><span>昵称</span><input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="游戏昵称，请勿用真实姓名" required maxLength={24} autoComplete="off" disabled={loginBusy}/></label>
          <label><span>学号 / ID</span><input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="可用测试游戏 ID，不作实名核验" required maxLength={32} autoComplete="off" spellCheck={false} disabled={loginBusy}/></label>
          <label><span>访问口令</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8–128 个字符，请勿复用学校密码" required minLength={8} maxLength={128} autoComplete="off" spellCheck={false} aria-describedby="entry-account-help" disabled={loginBusy}/></label>
          <div id="entry-account-help" className="entry-login-help">首次使用该 ID 会创建存档与访问口令；下次须用相同口令。旧版无口令存档请联系管理员核验迁移。口令提交后即清空，不写入本机存档。</div>
          <button className="enter-campus" type="submit" disabled={loginBusy}><span>{loginBusy ? '登录中…' : '登录并进入'}</span><Icon name="star"/></button>
        </form>
        <button className="entry-alt" onClick={() => { setPassword(''); onGuest(); }} disabled={loginBusy}>游客模式 · 进度仅保存在本机</button>
        {loginError && <p className="entry-error" role="alert">{loginError}</p>}
      </>}
      <small>轻触启程 · 开启声音与沉浸体验</small>
    </div>
  </div></div>;
}


function Panels(p: HudProps & { returnFocus?: HTMLElement | null }) {
  const item = p.selected;
  if (!item && p.activePanel !== 'collection') return null;
  return <Modal title={item?.name ?? '收集图鉴'} eyebrow={item?.subtitle ?? `校园记忆 · 已点亮 ${p.collected} 处`} icon={item?.icon ?? 'chest'} onClose={p.onClose} returnFocus={p.returnFocus} className={item ? 'landmark-modal' : 'collection-modal'}>
    <Suspense fallback={<div className="hud-panel-loading" role="status"><Icon name="scroll" /><span>正在翻开校园记忆…</span></div>}>
      {item ? <LandmarkPanel item={item} discovered={p.discovered} checkIn={p.checkIn} onClose={p.onClose} onCenter={p.onCenter} onExplore={p.onExplore} onLocate={p.onLocate} /> : <CollectionPanel activityReturn={p.activityReturn} onPanel={p.onPanel} landmarks={p.landmarks} state={p.state} onSelect={p.onSelect} />}
    </Suspense>
  </Modal>;
}

export interface HudExtraProps extends HudProps {
  /** 打开派蒙式旅途菜单 */
  onOpenMenu: () => void;
  context?: ReactNode;
  announcement?: { id: string | number; text: string };
}

export default function Hud(p: HudExtraProps) {
  const chromeInert = !p.entered || Boolean(p.activePanel) || Boolean(p.selected);
  const modalOpen = Boolean(p.selected || p.activePanel === 'collection');
  const wasModalOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  // 在 inert 提交到 DOM 之前保存触发者；提交后浏览器已把原焦点移到 body。
  if (modalOpen && !wasModalOpen.current) returnFocus.current = document.activeElement as HTMLElement | null;
  wasModalOpen.current = modalOpen;
  const announceItems = p.announcement ? [p.announcement] : p.toast ? [{ id: p.toast, text: p.toast }] : [];
  return <>
    <EdgeOrnaments/>
    <HudFrame
      visible={p.entered}
      inert={chromeInert}
      compact={Boolean(p.activePanel) || Boolean(p.selected)}
      brand={<Brand onOpenMenu={p.onOpenMenu} onCenter={p.onCenter}/>}
      status={<StatusBar
        collected={p.collected}
        total={p.landmarks.length}
        accountName={p.account?.nickname ?? null}
        isFullscreen={p.isFullscreen}
        onOpenCollection={() => p.onPanel('collection')}
        onOpenProfile={p.onOpenMenu}
        onToggleFullscreen={p.onFullscreen}
      />}
      dock={<ActionDock actions={[
        { id: 'activities', label: '活动一览', icon: 'scroll', key: 'A', emphasis: true, onClick: () => p.onPanel('activities') },
        { id: 'collection', label: '收集图鉴', icon: 'chest', key: 'C', onClick: () => p.onPanel('collection') },
      ]}/>}
      progress={<ProgressRing
        progress={p.progress}
        collected={p.collected}
        total={p.landmarks.length}
        saveLabel={p.account ? `UID: ${p.account.uid}` : '游客 · 本机存档'}
        onClick={p.onCenter}
      />}
      context={p.context}
      announce={<AnnounceLayer items={announceItems}/>}
    />
    <AnimatePresence mode="wait">
      {p.entered && (p.selected || p.activePanel === 'collection') &&
        <Panels key={p.selected?.id ?? p.activePanel} {...p} returnFocus={returnFocus.current}/>}
    </AnimatePresence>
    {!p.entered && <EntryGate account={p.account} loginBusy={p.loginBusy} loginError={p.loginError} onEnter={p.onEnter} onLogin={p.onLogin} onGuest={p.onGuest} onLogout={p.onLogout}/>}
  </>;
}
