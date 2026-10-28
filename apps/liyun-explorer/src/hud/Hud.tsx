import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AccountUser, HudProps, IconName, PanelId } from '../types';
import { Icon } from './Icon';
import { BrandGate, CompassRose, EdgeOrnaments, MenuShape } from './Ornaments';
import './hud.css';

const NAV: { id: PanelId; title: string; subtitle: string; icon: IconName; notice?: boolean }[] = [
  { id: 'main', title: '校园主线', subtitle: '探寻北理的昨日与今朝', icon: 'book' },
  { id: 'season', title: '时令纪事', subtitle: '四时流转 · 校园风物', icon: 'flower', notice: true },
  { id: 'festival', title: '霜降雅集', subtitle: '限时活动 · 秋意同游', icon: 'leaf', notice: true },
  { id: 'stories', title: '校园异闻录', subtitle: '未知的故事与相遇', icon: 'scroll' },
  { id: 'party', title: '多人同行', subtitle: '与同学一起探索', icon: 'people' }
];

function Modal({ title, eyebrow, icon, children, onClose, className = '' }: { title: string; eyebrow: string; icon: IconName; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
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
  }, [onClose]);
  return <div className="hud-modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`hud-modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <header className="modal-heading"><span className="modal-emblem"><Icon name={icon}/></span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="modal-close" aria-label="关闭面板" onClick={onClose}><Icon name="close"/></button></header>
      <div className="modal-body">{children}</div>
      <span className="modal-corner corner-tl"/><span className="modal-corner corner-tr"/><span className="modal-corner corner-bl"/><span className="modal-corner corner-br"/>
    </div>
  </div>;
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

function Panels(p: HudProps) {
  const [resetArmed, setResetArmed] = useState(false);
  useEffect(() => setResetArmed(false), [p.activePanel]);
  const settings = p.state.settings;
  if (p.selected) {
    const item = p.selected;
    return <Modal title={item.name} eyebrow={item.subtitle} icon={item.icon} onClose={p.onClose} className="landmark-modal">
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
  const common = { onClose: p.onClose };
  switch (p.activePanel) {
    case 'settings': return <Modal title="设置" eyebrow="让旅途自在一些" icon="settings" {...common}>
      <div className="account-card">
        {p.account ? <>
          <span className="account-avatar"><Icon name="people"/></span>
          <div className="account-meta"><strong>{p.account.nickname}</strong><small>{p.account.studentId} · {p.account.uid}</small></div>
          <button className="outline-button" onClick={p.onLogout}>退出登录</button>
        </> : <>
          <span className="account-avatar"><Icon name="people"/></span>
          <div className="account-meta"><strong>游客模式</strong><small>进度仅保存在本机</small></div>
          <button className="outline-button" onClick={p.onLoginPrompt}>登录账号</button>
        </>}
      </div>
      <Toggle label="校园配乐" description="与风同行，让旋律伴你漫游" checked={settings.music} onChange={music => p.onSettings({ music })}/>
      <div className="setting-row"><label htmlFor="music-volume">音乐音量</label><div className="range-wrap"><input id="music-volume" type="range" min="0" max="1" step=".05" value={settings.volume} onChange={e => p.onSettings({ volume: +e.target.value })}/><output>{Math.round(settings.volume * 100)}%</output></div></div>
      <div className="setting-row"><label htmlFor="music-track">当前曲目</label><select id="music-track" value={settings.track} onChange={e => p.onSettings({ track: +e.target.value })}><option value="0">校园配乐 · 壹</option><option value="1">校园配乐 · 贰</option><option value="2">校园配乐 · 叁</option></select></div>
      {p.audioBlocked && <p className="setting-note">声音尚未开启，可关闭再开启配乐重试。</p>}
      <div className="setting-row"><label htmlFor="scene-quality">画面效果</label><select id="scene-quality" value={settings.quality} onChange={e => p.onSettings({ quality: e.target.value as 'high' | 'low' })}><option value="high">精致 · 完整光影</option><option value="low">流畅 · 轻量光影</option></select></div>
      <Toggle label="减少动态效果" description="保留必要反馈，减少飘叶和镜头运动" checked={settings.reducedMotion} onChange={reducedMotion => p.onSettings({ reducedMotion })}/>
      <div className="settings-actions"><button className="outline-button" onClick={p.onFullscreen}><Icon name="fullscreen"/>{p.isFullscreen ? '退出全屏' : '进入全屏'}</button><button className={`outline-button ${resetArmed ? 'danger-button' : ''}`} onClick={() => { if (resetArmed) { p.onReset(); setResetArmed(false); } else setResetArmed(true); }}>{resetArmed ? '确认重新出发' : '重置探索进度'}</button></div>
      {resetArmed && <div className="reset-confirm" role="alert"><p>将清除已点亮的地标，回到初见校园时。</p><button onClick={() => setResetArmed(false)}>保留当前旅程</button></div>}
    </Modal>;
    case 'guide': return <Modal title="探索指引" eyebrow="循光而行 · 山水可期" icon="compass" {...common}>
      <ol className="guide-steps"><li><span>壹</span><div><h3>展开校园</h3><p>拖动地图自在漫游。电脑滚轮、手机双指，都可以拉近眼前的风景。</p></div></li><li><span>贰</span><div><h3>开启定位</h3><p>点击「定位到我」，允许定位后，在地图上查看实际位置和点位距离。</p></div></li><li><span>叁</span><div><h3>到达打卡</h3><p>走进点位允许范围，在详情页确认打卡。定位有效且精度满足要求后才能解锁，记录会自动保存。</p></div></li></ol>
      <button className="parchment-button" onClick={() => p.onSelect(p.landmarks.find(x => !p.state.discoveredIds.includes(x.id) && x.isBeacon)?.id ?? p.landmarks.find(x => !p.state.discoveredIds.includes(x.id))?.id ?? p.landmarks[0].id)}>循光去看看<Icon name="star"/></button>
    </Modal>;
    case 'collection': return <Modal title="收集图鉴" eyebrow={`校园记忆 · 已点亮 ${p.collected} 处`} icon="chest" {...common} className="collection-modal">
      <p className="collection-intro">把走过的风景，珍藏成一页页记忆。</p><div className="collection-grid">{p.landmarks.map(item => { const known = p.state.discoveredIds.includes(item.id); return <button key={item.id} className={`collection-item ${known ? 'is-known' : ''}`} onClick={() => p.onSelect(item.id)}><span className="collection-mark"><Icon name={known ? item.icon : 'lock'}/></span><strong>{item.name}</strong><small>{known ? '已收入图鉴' : '待发现'}</small></button>; })}</div>
    </Modal>;
    case 'main': return <Modal title="校园主线" eyebrow="第一卷 · 初见良乡" icon="book" {...common}>
      <div className="chapter-art"><Icon name="gate"/><span>循光入境</span></div><p className="landmark-verse">校园的故事，从你的第一步开始。</p><p className="landmark-description">从文萃楼出发，跟随探索信标，点亮北湖、图书馆与更多熟悉的校园地标。</p><div className="chapter-progress"><span>校园探索</span><strong>{Math.round(p.progress)}%</strong><progress value={p.progress} max="100"/></div><button className="parchment-button" onClick={() => p.onSelect('tower')}>追寻金色信标<Icon name="tower"/></button>
    </Modal>;
    case 'festival': return <Modal title="霜降雅集" eyebrow="时令篇章 · 秋意同游" icon="leaf" {...common} className="festival-modal">
      <div className="festival-illustration"><Icon name="leaf"/><span>一叶知秋</span><Icon name="leaf"/></div><p className="landmark-verse">把校园的秋，收进你的行囊。</p><p className="landmark-description">银杏渐黄，湖风微凉。沿着校园地图漫游，在熟悉的转角遇见这一季的风物。</p><div className="festival-date"><span>霜降 · 校园同游</span><strong>10月24日 — 11月7日</strong></div><button className="parchment-button" onClick={() => p.onSelect('beihu')}>去北湖赏秋<Icon name="leaf"/></button><p className="panel-footnote">当前为秋日活动主题展示</p>
    </Modal>;
    case 'season': return <Modal title="时令纪事" eyebrow="四时流转 · 校园风物" icon="flower" {...common}>
      <div className="season-poem"><span>秋</span><p>风从湖上来<br/>叶落在书页间</p></div><p className="landmark-description">校园的四季各有回响。这一程，先把目光交给金黄的树梢与澄澈的湖水。</p><button className="parchment-button" onClick={() => p.onSelect('beihu')}>寻访秋日湖光<Icon name="lake"/></button>
    </Modal>;
    case 'stories': return <Modal title="校园异闻录" eyebrow="未知的故事与相遇" icon="scroll" {...common}>
      <div className="chapter-art"><Icon name="scroll"/><span>待君续写</span></div><p className="landmark-verse">每条熟悉的路，都藏着未读的故事。</p><p className="landmark-description">校园叙事篇章正在筹备。此刻，先去图书馆点亮一页属于你的探索记忆。</p><button className="parchment-button" onClick={() => p.onSelect('library')}>寻访书海<Icon name="book"/></button>
    </Modal>;
    case 'party': return <Modal title="多人同行" eyebrow="同游有伴 · 山水有期" icon="people" {...common}>
      <div className="companion-portraits"><span><Icon name="people"/></span><span><Icon name="star"/></span><span><Icon name="flower"/></span><span><Icon name="leaf"/></span></div><p className="landmark-verse">下一程，约上同行的人。</p><p className="landmark-description">组队探索与合作玩法即将启程。当前地图可独自漫游，顶部同行人数为界面演示数据。</p><button className="parchment-button" onClick={p.onClose}>继续我的旅程<Icon name="compass"/></button>
    </Modal>;
    case 'stamina': return <Modal title="行旅体力" eyebrow="步履从容 · 随心探索" icon="moon" {...common}>
      <div className="stamina-display"><Icon name="moon"/><strong>164<span>/ 200</span></strong></div><p className="landmark-description">山水之间，留一点从容。当前探索体验不消耗体力，可以自在点亮校园的每一处微光。</p><button className="parchment-button" onClick={p.onClose}>继续探索<Icon name="compass"/></button>
    </Modal>;
    case 'chapter': return <Modal title="第3章 · 理韵悠长" eyebrow="旅途手札" icon="star" {...common}>
      <div className="chapter-art"><Icon name="book"/><span>理韵悠长</span></div><p className="landmark-description">以地图为纸，以足迹为笔。在这一卷旅途中，校园里那些熟悉的名字，正等待你重新发现。</p><button className="parchment-button" onClick={() => p.onPanel('collection')}>翻阅我的图鉴<Icon name="chest"/></button>
    </Modal>;
  }
}

export default function Hud(p: HudProps) {
  return <>
    <EdgeOrnaments/>
    <div className="game-hud" inert={!p.entered}>
      <button className="brand" onClick={p.onCenter} aria-label="理韵寻踪，回到校园中心"><BrandGate/><span className="brand-copy"><strong>理韵寻踪</strong><span className="brand-subtitle">— 北理校园探索 —</span><span className="brand-rule"/></span><span className="brand-seal">理<br/>韵</span></button>
      <nav className="story-nav" aria-label="探索篇章"><span className="nav-timeline"/>{NAV.map(item => {
        const active = p.activePanel === item.id || (!p.activePanel && item.id === 'main'); const variant = item.id === 'festival' ? 'gold' : active ? 'light' : 'dark';
        return <button key={item.id} className={`story-button ${variant} ${active ? 'is-active' : ''}`} onClick={() => p.onPanel(item.id)} aria-pressed={active}><MenuShape variant={variant}/><span className="nav-medallion"><Icon name={item.icon}/></span><span className="nav-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>{item.id === 'festival' && <Icon name="leaf" className="festival-leaf"/>}{item.notice && <span className="notice-dot"/>}</button>;
      })}</nav>
      <div className="resource-bar" aria-label="旅途状态">
        <button className="resource-pill" onClick={() => p.onPanel('collection')} aria-label={`收录 ${p.collected}/36，打开图鉴`}><Icon name="book"/><span className="resource-label">收录</span><strong>{p.collected}<span>/36</span></strong></button>
        <button className="resource-pill stamina-pill" onClick={() => p.onPanel('stamina')} aria-label="体力164/200，查看说明"><Icon name="moon"/><span className="resource-label">体力</span><strong>164<span>/200</span></strong><span className="resource-plus"><Icon name="plus"/></span></button>
        <button className="resource-pill" onClick={() => p.onPanel('party')} aria-label="同行演示，打开多人同行"><Icon name="people"/><span className="resource-label">在线</span><strong>4<span>人</span></strong></button>
        <button className="resource-pill chapter-pill" onClick={() => p.onPanel('chapter')}><Icon name="star"/><strong>第3章</strong></button>
      </div>
      <button className="fullscreen-control" onClick={p.onFullscreen} aria-label={p.isFullscreen ? '退出全屏' : '进入全屏'} title={p.isFullscreen ? '退出全屏' : '进入全屏'}><Icon name="fullscreen"/></button>
      <button className="map-compass" onClick={p.onCenter} aria-label="回到当前探索位置"><span>北</span><CompassRose/></button>
      <nav className="utility-nav" aria-label="旅途工具">{([{ id: 'settings', icon: 'settings', title: '设置' }, { id: 'guide', icon: 'compass', title: '探索指引' }, { id: 'collection', icon: 'chest', title: '收集图鉴' }] as const).map(item => <button key={item.id} onClick={() => p.onPanel(item.id)}><span className="utility-disc"><Icon name={item.icon}/>{item.id === 'collection' && <span className="notice-dot"/>}</span><strong>{item.title}</strong></button>)}</nav>
      <div className="campus-progress" aria-label={`良乡校区，探索度 ${Math.round(p.progress)}%`}><div className="campus-name">良乡校区<span className="campus-seal">寻</span></div><p>探索度 <strong>{Math.round(p.progress)}<span>%</span></strong></p><div className="progress-track"><span style={{ width: `${Math.min(100, p.progress)}%` }}/><i/></div><small>{p.account ? `${p.account.nickname} · UID ${p.account.uid}` : '游客 · 本机存档'}</small></div>
      <div className="map-help"><span className="help-diamond">◇</span><span className="desktop-help">拖动地图 · 滚轮缩放</span><span className="touch-help">拖动地图 · 双指缩放</span></div>
    </div>
    {p.entered && <Panels {...p}/>}
    {p.toast && p.entered && <div className="game-toast" role="status"><Icon name="star"/><span>{p.toast}</span></div>}
    {!p.entered && <EntryGate account={p.account} loginBusy={p.loginBusy} loginError={p.loginError} onEnter={p.onEnter} onLogin={p.onLogin} onGuest={p.onGuest} onLogout={p.onLogout}/>}
  </>;
}
