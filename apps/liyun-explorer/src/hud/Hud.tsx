import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { HudProps, IconName, PanelId } from '../types';
import { Icon } from './Icon';
import { BrandGate, CompassRose, EdgeOrnaments, MenuShape } from './Ornaments';
import { EVENT_ART, EventDuo, EventThumb } from './EventArt';
import './hud.css';

const NAV: { id: PanelId; title: string; subtitle: string; icon: IconName; notice?: boolean }[] = [
  { id: 'main', title: '校园主线', subtitle: '探寻北理的昨日与今朝', icon: 'book' },
  { id: 'events', title: '活动', subtitle: '限时活动 · 与友同行', icon: 'leaf', notice: true }
];

type EventId = 'festival' | 'party';
const EVENTS: { id: EventId; title: string; subtitle: string; tag: string; status: string; icon: IconName; tone: EventId }[] = [
  { id: 'festival', title: '霜降雅集', subtitle: '限时活动 · 秋意同游', tag: '限时', status: '10月24日 — 11月7日', icon: 'leaf', tone: 'festival' },
  { id: 'party', title: '多人同行', subtitle: '同游有伴 · 山水有期', tag: '筹备中', status: '即将开启', icon: 'people', tone: 'party' }
];

/**
 * Placeholder identity for the profile panel.
 * TODO: replace with the signed-in student once the backend login is wired up.
 */
const PROFILE = { name: '未登录', studentId: '——' };

function Modal({ title, eyebrow, icon, children, onClose, className = '', scroll = false }: { title: string; eyebrow: string; icon: IconName; children: ReactNode; onClose: () => void; className?: string; scroll?: boolean }) {
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
    <div className={`hud-modal ${className} ${scroll ? 'is-scroll' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <header className="modal-heading"><span className="modal-emblem"><Icon name={icon}/></span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="modal-close" aria-label="关闭面板" onClick={onClose}><Icon name="close"/></button></header>
      <div className="modal-body">{children}</div>
      <span className="modal-corner corner-tl"/><span className="modal-corner corner-tr"/><span className="modal-corner corner-bl"/><span className="modal-corner corner-br"/>
    </div>
  </div>;
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <div className="setting-row"><div><label>{label}</label>{description && <small>{description}</small>}</div><button type="button" className={`ornate-toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span/></button></div>;
}

function Panels(p: HudProps) {
  const [resetArmed, setResetArmed] = useState(false);
  const [eventId, setEventId] = useState<EventId>('festival');
  useEffect(() => { setResetArmed(false); setEventId('festival'); }, [p.activePanel]);
  const settings = p.state.settings;
  if (p.selected) {
    const item = p.selected;
    return <Modal title={item.name} eyebrow={item.subtitle} icon={item.icon} onClose={p.onClose} className="landmark-modal">
      <div className={`landmark-seal ${item.isBeacon ? 'beacon-seal' : ''}`}><div className="seal-orbit"/><Icon name={item.icon}/><span>{p.discovered ? '已 点 亮' : '待 发 现'}</span></div>
      <p className="landmark-verse">{item.verse}</p><div className="ornament-divider"><span>◆</span></div><p className="landmark-description">{item.description}</p>
      <div className="landmark-reward"><span><Icon name="star"/>{p.discovered ? '这段旅途已收入记忆' : `探索度 +${item.progress}%`}</span><span><Icon name="book"/>{p.discovered ? '地标已收录' : '收录校园地标'}</span></div>
      {p.discovered ? <button className="parchment-button" onClick={() => { p.onClose(); p.onCenter(); }}>返回地图<Icon name="compass"/></button> : <button className="parchment-button" onClick={p.onExplore}>前往探索<Icon name="star"/></button>}
      {!p.discovered && <p className="panel-footnote">循着指引，点亮此处的校园记忆</p>}
    </Modal>;
  }
  if (!p.activePanel) return null;
  const common = { onClose: p.onClose };
  switch (p.activePanel) {
    case 'profile': return <Modal title="个人主页" eyebrow="旅途中的你" icon="people" {...common} className="profile-modal">
      <div className="profile-card">
        <span className="profile-avatar"><Icon name="gate"/></span>
        <div className="profile-identity">
          <strong className="profile-name">{PROFILE.name}</strong>
          <span className="profile-id">学号 · {PROFILE.studentId}</span>
        </div>
      </div>
      <p className="profile-verse">一人一页，写进这座校园。</p>
      <div className="profile-meta">
        <div><span>已点亮地标</span><strong>{p.collected}<em>/{p.landmarks.length}</em></strong></div>
        <div><span>探索度</span><strong>{Math.round(p.progress)}<em>%</em></strong></div>
        <div><span>校园编号</span><strong>LY0611<em>2403</em></strong></div>
      </div>
      <p className="panel-footnote">学号与姓名在登录后显示，当前为界面占位</p>

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
      <p className="collection-intro">把走过的风景，珍藏成一页页记忆。</p><div className="collection-grid">{p.landmarks.map(item => { const known = p.state.discoveredIds.includes(item.id); return <button key={item.id} className={`collection-item ${known ? 'is-known' : ''}`} onClick={() => p.onSelect(item.id)}><span className="collection-mark"><Icon name={known ? item.icon : 'lock'}/></span><strong>{item.name}</strong><small>{known ? '已收入图鉴' : '待发现'}</small></button>; })}</div>
    </Modal>;
    case 'main': return <Modal title="校园主线" eyebrow="第一卷 · 初见良乡" icon="book" {...common}>
      <div className="chapter-art"><Icon name="gate"/><span>循光入境</span></div><p className="landmark-verse">校园的故事，从你的第一步开始。</p><p className="landmark-description">从文萃楼出发，跟随探索信标，点亮北湖、图书馆与更多熟悉的校园地标。</p><div className="chapter-progress"><span>校园探索</span><strong>{Math.round(p.progress)}%</strong><progress value={p.progress} max="100"/></div><button className="parchment-button" onClick={() => p.onSelect('tower')}>追寻金色信标<Icon name="tower"/></button>
    </Modal>;
    case 'events': {
      const current = EVENTS.find(item => item.id === eventId) ?? EVENTS[0];
      return <Modal title="活动" eyebrow="新章待启 · 共赴良乡" icon="leaf" {...common} className="events-modal" scroll>
        <div className="events-layout">
          <aside className="events-list" aria-label="活动列表">
            {EVENTS.map((item, index) => (
              <button key={item.id} className={`event-entry ${item.tone} ${item.id === current.id ? 'is-active' : ''}`} onClick={() => setEventId(item.id)} aria-pressed={item.id === current.id}>
                <span className="event-index">{index === 0 ? '壹' : '贰'}</span>
                <span className="event-medallion"><EventThumb art={EVENT_ART[item.id]} alt="" side={item.id === 'festival' ? 'left' : 'right'}/></span>
                <span className="event-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                <span className="event-tag">{item.tag}</span>
              </button>
            ))}
            <p className="event-list-foot">◇ 更多篇章 · 敬请期待 ◇</p>
          </aside>
          <div className={`event-hero ${current.tone}`}>
            <div className="event-stage"><EventDuo art={EVENT_ART[current.id]}/></div>
            <p className="event-motto">延安根 · 军工魂 · 良乡秋</p>
            {current.id === 'festival' ? <>
              <p className="landmark-verse">把校园的秋，收进你的行囊。</p>
              <p className="landmark-description">银杏渐黄，湖风微凉。沿着校园地图漫游，在熟悉的转角遇见这一季的风物。</p>
              <div className="festival-date"><span>霜降 · 校园同游</span><strong>10月24日 — 11月7日</strong></div>
              <button className="parchment-button" onClick={() => p.onPanel('festival')}>进入活动<Icon name="leaf"/></button>
            </> : <>
              <p className="landmark-verse">下一程，约上同行的人。</p>
              <p className="landmark-description">组队探索与合作玩法即将启程。当前地图可独自漫游，顶部同行人数为界面演示数据。</p>
              <div className="festival-date"><span>同游有伴 · 山水有期</span><strong>即将开启</strong></div>
              <button className="parchment-button" onClick={() => p.onPanel('party')}>进入活动<Icon name="people"/></button>
            </>}
            <p className="panel-footnote">活动奖励与日程以游戏内公告为准</p>
          </div>
        </div>
      </Modal>;
    }
    case 'festival': return <Modal title="霜降雅集" eyebrow="时令篇章 · 秋意同游" icon="leaf" {...common} className="festival-modal" scroll>
      <div className="event-stage event-stage-large"><EventDuo art={EVENT_ART.festival} large/></div>
      <p className="event-motto">霜降水返壑 · 风落木归山</p><p className="landmark-verse">把校园的秋，收进你的行囊。</p><p className="landmark-description">银杏渐黄，湖风微凉。沿着校园地图漫游，在熟悉的转角遇见这一季的风物。</p><div className="festival-date"><span>霜降 · 校园同游</span><strong>10月24日 — 11月7日</strong></div><button className="parchment-button" onClick={() => p.onSelect('beihu')}>去北湖赏秋<Icon name="leaf"/></button><p className="panel-footnote">当前为秋日活动主题展示</p>
    </Modal>;
    case 'party': return <Modal title="多人同行" eyebrow="同游有伴 · 山水有期" icon="people" {...common} className="party-modal" scroll>
      <div className="event-stage event-stage-large"><EventDuo art={EVENT_ART.party} large/></div>
      <p className="event-motto">同行的路，比远方更远</p><p className="landmark-verse">下一程，约上同行的人。</p><p className="landmark-description">组队探索与合作玩法即将启程。当前地图可独自漫游，顶部同行人数为界面演示数据。</p><button className="parchment-button" onClick={p.onClose}>继续我的旅程<Icon name="compass"/></button>
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
      <div className="brand">
        <button className="brand-gate" onClick={() => p.onPanel('profile')} aria-label="打开个人主页" title="个人主页"><BrandGate/></button>
        <button className="brand-copy" onClick={p.onCenter} aria-label="理韵寻踪，回到校园中心"><strong>理韵寻踪</strong><span className="brand-subtitle">— 北理校园探索 —</span><span className="brand-rule"/></button>
        <span className="brand-seal">理<br/>韵</span>
      </div>
      <nav className="story-nav" aria-label="探索篇章"><span className="nav-timeline"/>{NAV.map(item => {
        const active = p.activePanel === item.id || (!p.activePanel && item.id === 'main'); const variant = item.id === 'events' && !active ? 'gold' : active ? 'light' : 'dark';
        return <button key={item.id} className={`story-button ${variant} ${active ? 'is-active' : ''}`} onClick={() => p.onPanel(item.id)} aria-pressed={active}><MenuShape variant={variant}/><span className="nav-medallion"><Icon name={item.icon}/></span><span className="nav-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>{item.id === 'events' && <Icon name="leaf" className="festival-leaf"/>}{item.notice && <span className="notice-dot"/>}</button>;
      })}</nav>
      <div className="resource-bar" aria-label="旅途状态">
        <button className="resource-pill" onClick={() => p.onPanel('collection')} aria-label={`收录 ${p.collected}/36，打开图鉴`}><Icon name="book"/><span className="resource-label">收录</span><strong>{p.collected}<span>/36</span></strong></button>
        <button className="resource-pill" onClick={() => p.onPanel('party')} aria-label="同行演示，打开多人同行"><Icon name="people"/><span className="resource-label">在线</span><strong>4<span>人</span></strong></button>
      </div>
      <button className="fullscreen-control" onClick={p.onFullscreen} aria-label={p.isFullscreen ? '退出全屏' : '进入全屏'} title={p.isFullscreen ? '退出全屏' : '进入全屏'}><Icon name="fullscreen"/></button>
      <button className="map-compass" onClick={p.onCenter} aria-label="回到当前探索位置"><span>北</span><CompassRose/></button>
      <div className="campus-progress" aria-label={`良乡校区，探索度 ${Math.round(p.progress)}%`}><div className="campus-name">良乡校区<span className="campus-seal">寻</span></div><p>探索度 <strong>{Math.round(p.progress)}<span>%</span></strong></p><div className="progress-track"><span style={{ width: `${Math.min(100, p.progress)}%` }}/><i/></div><small>UID: LY06112403</small></div>
      <div className="map-help"><span className="help-diamond">◇</span><span className="desktop-help">拖动地图 · 滚轮缩放</span><span className="touch-help">拖动地图 · 双指缩放</span></div>
    </div>
    {p.entered && <Panels {...p}/>}
    {p.toast && p.entered && <div className="game-toast" role="status"><Icon name="star"/><span>{p.toast}</span></div>}
    {!p.entered && <div className="entrance-overlay"><div className="entry-card"><div className="entry-flourish">◇ <span/> 良乡 · 秋日 <span/> ◇</div><p>一纸山水，万般理韵</p><button className="enter-campus" onClick={p.onEnter}><span>进入校园</span><Icon name="star"/></button><small>轻触启程 · 开启声音与沉浸体验</small></div></div>}
  </>;
}
