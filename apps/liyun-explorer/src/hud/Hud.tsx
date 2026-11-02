import { useEffect, useRef, useState, type ReactNode } from 'react';
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

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <div className="setting-row"><div><label>{label}</label>{description && <small>{description}</small>}</div><button type="button" className={`ornate-toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span/></button></div>;
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
  const [resetArmed, setResetArmed] = useState(false);
  useEffect(() => setResetArmed(false), [p.activePanel]);
  const settings = p.state.settings;
  if (p.selected) {
    const item = p.selected;
    return <Modal title={item.name} eyebrow={item.subtitle} icon={item.icon} onClose={p.onClose} returnFocus={p.returnFocus} className="landmark-modal">
      <div className={`landmark-seal ${item.isBeacon ? 'beacon-seal' : ''}`}><div className="seal-orbit"/><Icon name={item.icon}/><span>{p.discovered ? '已 点 亮' : '待 发 现'}</span></div>
      <p className="landmark-verse">{item.verse}</p><div className="ornament-divider"><span>◆</span></div><p className="landmark-description">{item.description}</p>
      <div className="landmark-reward"><span><Icon name="star"/>{p.discovered ? '这段旅途已收入记忆' : `探索度 +${item.progress}%`}</span><span><Icon name="book"/>{p.discovered ? '地标已收录' : '收录校园地标'}</span></div>
      {!p.discovered && <div className={`check-in-status ${p.checkIn?.allowed ? 'is-ready' : ''}`} data-testid="check-in-status" data-reason={p.checkIn?.reason} role="status">
        <p>{p.checkIn?.message}</p>
        <small>{item.isBeacon ? '虚构信标按地图标记位置判定，无实体塔楼。' : ''}打卡范围：{item.checkInRadius}米{p.checkIn?.distance !== null && p.checkIn?.distance !== undefined ? ` · 当前直线距离约${Math.ceil(p.checkIn.distance)}米` : ''}</small>
      </div>}
      {p.discovered ? <button className="parchment-button" onClick={() => { p.onClose(); p.onCenter(); }}>返回地图<Icon name="compass"/></button> : <>
        <button className="parchment-button" data-testid="check-in-button" disabled={!p.checkIn?.allowed} onClick={p.onExplore}>{p.checkIn?.allowed ? '确认打卡' : '到达范围后可打卡'}<Icon name="star"/></button>
        {!p.checkIn?.allowed && <button className="outline-button check-in-locate" onClick={p.onLocate}>定位并显示朝向<Icon name="compass"/></button>}
      </>}
      {!p.discovered && <p className="panel-footnote">到达地图点位附近，使用有效定位完成打卡</p>}
    </Modal>;
  }
  if (!p.activePanel) return null;
  const common = { onClose: p.onClose, returnFocus: p.returnFocus };
  switch (p.activePanel) {
    case 'profile': return <Modal title="个人主页" eyebrow="旅途中的你" icon="people" {...common} className="profile-modal">
      <div className="profile-card">
        <span className="profile-avatar"><Icon name="gate"/></span>
        <div className="profile-identity">
          <strong className="profile-name">{p.account?.nickname ?? '游客'}</strong>
          <span className="profile-id">{p.account ? `学号 / ID · ${p.account.studentId}` : '本机旅途 · 未登录账号'}</span>
          {p.account && <span className="profile-id">UID · {p.account.uid}</span>}
        </div>
      </div>
      <div className="profile-account-actions"><span>{p.account ? '已登录账号' : '进度保存在当前浏览器'}</span><button className="outline-button" onClick={p.account ? p.onLogout : p.onLoginPrompt}>{p.account ? '退出登录' : '登录账号'}</button></div>
      <p className="profile-verse">一人一页，写进这座校园。</p>
      <div className="profile-meta">
        <div><span>已点亮地标</span><strong>{p.collected}<em>/{p.landmarks.length}</em></strong></div>
        <div><span>探索度</span><strong>{Math.round(p.progress)}<em>%</em></strong></div>
        <div><span>存档方式</span><strong>{p.account ? '账号' : '本机'}</strong></div>
      </div>
      {!p.account && <p className="panel-footnote">登录账号后，可接续你的云端旅途</p>}

      <h3 className="profile-section">设置 <span>让旅途自在一些</span></h3>
      <Toggle label="校园配乐" description="与风同行，让旋律伴你漫游" checked={settings.music} onChange={music => p.onSettings({ music })}/>
      <div className="setting-row"><label htmlFor="music-volume">音乐音量</label><div className="range-wrap"><input id="music-volume" type="range" min="0" max="1" step=".05" value={settings.volume} onChange={e => p.onSettings({ volume: +e.target.value })}/><output>{Math.round(settings.volume * 100)}%</output></div></div>
      <div className="setting-row"><label htmlFor="music-track">当前曲目</label><select id="music-track" value={settings.track} onChange={e => p.onSettings({ track: +e.target.value })}><option value="0">校园配乐 · 壹</option><option value="1">校园配乐 · 贰</option><option value="2">校园配乐 · 叁</option></select></div>
      {p.audioBlocked && <p className="setting-note">声音尚未开启，可关闭再开启配乐重试。</p>}
      <div className="setting-row"><label htmlFor="scene-quality">画面效果</label><select id="scene-quality" value={settings.quality} onChange={e => p.onSettings({ quality: e.target.value as 'high' | 'low' })}><option value="high">精致 · 完整光影</option><option value="low">流畅 · 轻量光影</option></select></div>
      <Toggle label="减少动态效果" description="保留必要反馈，减少飘叶和镜头运动" checked={settings.reducedMotion} onChange={reducedMotion => p.onSettings({ reducedMotion })}/>
      <div className="settings-actions"><button className="outline-button" onClick={p.onFullscreen}><Icon name="fullscreen"/>{p.isFullscreen ? '退出全屏' : '进入全屏'}</button><button className={`outline-button ${resetArmed ? 'danger-button' : ''}`} onClick={() => { if (resetArmed) { p.onReset(); setResetArmed(false); } else setResetArmed(true); }}>{resetArmed ? '确认重新出发' : '重置探索进度'}</button></div>
      {resetArmed && <div className="reset-confirm" role="alert"><p>将清除已点亮的地标，回到初见校园时。</p><button onClick={() => setResetArmed(false)}>保留当前旅程</button></div>}

      <button className="parchment-button" onClick={p.onClose}>继续探索<Icon name="compass"/></button>
    </Modal>;
    case 'collection': return <Modal title="收集图鉴" eyebrow={`校园记忆 · 已点亮 ${p.collected} 处`} icon="chest" {...common} className="collection-modal">
      {p.activityReturn && <button className="outline-button collection-return" onClick={() => p.onPanel('activities')}><span aria-hidden="true">←</span>返回活动一览</button>}
      <p className="collection-intro">把走过的风景，珍藏成一页页记忆。</p><div className="collection-grid">{p.landmarks.map(item => { const known = p.state.discoveredIds.includes(item.id); return <button key={item.id} className={`collection-item ${known ? 'is-known' : ''}`} onClick={() => p.onSelect(item.id)}><span className="collection-mark"><Icon name={known ? item.icon : 'lock'}/></span><strong>{item.name}</strong><small>{known ? '已收入图鉴' : '待发现'}</small></button>; })}</div>
    </Modal>;
    case 'activities': return null;
  }
}

export interface HudExtraProps extends HudProps {
  /** 打开派蒙式旅途菜单 */
  onOpenMenu: () => void;
  context?: ReactNode;
}

export default function Hud(p: HudExtraProps) {
  const chromeInert = !p.entered || Boolean(p.activePanel) || Boolean(p.selected);
  const modalOpen = Boolean(p.selected || (p.activePanel && p.activePanel !== 'activities'));
  const wasModalOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  // 在 inert 提交到 DOM 之前保存触发者；提交后浏览器已把原焦点移到 body。
  if (modalOpen && !wasModalOpen.current) returnFocus.current = document.activeElement as HTMLElement | null;
  wasModalOpen.current = modalOpen;
  const announceItems = p.toast ? [{ id: p.toast, text: p.toast }] : [];
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
      {p.entered && (p.selected || (p.activePanel && p.activePanel !== 'activities')) &&
        <Panels key={p.selected?.id ?? p.activePanel} {...p} returnFocus={returnFocus.current}/>}
    </AnimatePresence>
    {!p.entered && <EntryGate account={p.account} loginBusy={p.loginBusy} loginError={p.loginError} onEnter={p.onEnter} onLogin={p.onLogin} onGuest={p.onGuest} onLogout={p.onLogout}/>}
  </>;
}
