import { roleUrl, roomManagerUrl } from '../core/url';
import { useEffect, useRef, useState } from 'react';
import { chapters, deck, chapterById, type Slide } from '../core/deck';
import { useSync } from '../core/sync';
import { Seal } from './Seal';
import { Stage } from './Stage';
import { SlideView } from './SlideView';
export type Sync=ReturnType<typeof useSync>;
export function Status({sync}:{sync:Sync}){return <span className={`connection-status ${sync.connected?'online':''}`}><i/>{sync.rehearsal?'本地彩排':sync.connected?'实时连接':'正在重连'}</span>}
export function Icon({name,size=20}:{name:string;size?:number}){const paths:Record<string,React.ReactNode>={next:<path d="M9 5L16 12L9 19"/>,prev:<path d="M15 5L8 12L15 19"/>,grid:<><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></>,fullscreen:<path d="M4 9V4H9M15 4H20V9M20 15V20H15M9 20H4V15"/>,sound:<><path d="M11 4L5 9H2V15H5L11 20Z"/><path d="M15 8Q20 12 15 16M18 4Q26 12 18 20"/></>,mute:<><path d="M11 4L5 9H2V15H5L11 20Z"/><path d="M16 9L22 15M22 9L16 15"/></>,blackout:<><rect x="3" y="4" width="18" height="13"/><path d="M8 21H16M12 17V21M3 4L21 17"/></>,play:<path d="M8 4L20 12L8 20Z"/>,pause:<><path d="M8 4V20M16 4V20"/></>,close:<path d="M5 5L19 19M19 5L5 19"/>,lock:<><rect x="5" y="10" width="14" height="11"/><path d="M8 10V7A4 4 0 0 1 16 7V10"/></>,teleprompter:<><rect x="3" y="4" width="18" height="13" rx="1"/><path d="M7 8H17M7 12H14M8 21H16M12 17V21"/></>,qr:<><path d="M3 8V3H8M16 3H21V8M21 16V21H16M8 21H3V16"/><rect x="7" y="7" width="4" height="4"/><rect x="14" y="7" width="3" height="3"/><path d="M7 15H11V18H7ZM14 13V15H17V18H14"/></>,gallery:<><rect x="3" y="5" width="14" height="12" rx="1"/><path d="M7 17L10 13L12 15L14 12L17 15M7 20H21V9"/><circle cx="8" cy="9" r="1"/></>,external:<path d="M14 3H21V10M21 3L12 12M10 5H4V20H19V14"/>,letter:<><rect x="3" y="5" width="18" height="14"/><path d="M3 5L12 13L21 5"/></>};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{paths[name]||paths.grid}</svg>}
export function AuthPanel({sync,onClose}:{sync:Sync;onClose?:()=>void}) {
  const [pin,setPin]=useState('');
  const [busy,setBusy]=useState(false);
  const role=new URLSearchParams(location.search).get('role')||'display';
  return <div className="auth-backdrop">
    <form className="auth-panel" onSubmit={async event=>{
      event.preventDefault(); setBusy(true);
      try { if (await sync.connectControl(pin)) { setPin(''); onClose?.(); } }
      finally { setBusy(false); }
    }}>
      <div className="auth-brand"><Seal text="光" size={42}/><span className="eyebrow">演讲者授权</span></div>
      {onClose&&<button type="button" className="auth-close icon-button" onClick={onClose} aria-label="关闭"><Icon name="close"/></button>}
      <h2>把舞台，<br/>交给你。</h2>
      <p>使用演讲口令授权当前设备的舞台控制。</p>
      {!sync.connected&&<p className="auth-join-status" role="status">{sync.joinError||'正在连接场次…'} {sync.joinError&&<button type="button" className="auth-join-retry" onClick={sync.retryConnection}>重试连接</button>}</p>}
      <label htmlFor="control-pin">演讲口令</label>
      <input id="control-pin" value={pin} onChange={event=>setPin(event.target.value)} autoComplete="current-password"
        type="password" placeholder="输入口令" autoFocus required/>
      <button type="submit" className="primary-button" disabled={busy||!pin||!sync.connected}>
        {busy?'正在授权…':sync.connected?'授权当前设备':'等待连接'}<Icon name="next"/>
      </button>
      {sync.error&&<p className="form-error" role="alert">{sync.error}</p>}
      <div className="auth-join-links">
        <a className="auth-rehearsal" href={roleUrl(role,true)}>只在此设备彩排 ↗</a>
        <a className="auth-rehearsal" href={role==='presenter'?roomManagerUrl():roleUrl(role,false,null)}>{role==='presenter'?'场次管理':'更换场次'}</a>
      </div>
    </form>
  </div>;
}
function DirectoryThumbnail({slide}:{slide:Slide}) {
  const frame=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if (!frame.current) return;
    const observe=new IntersectionObserver(([entry])=>{
      if (entry.isIntersecting) { setVisible(true); observe.disconnect(); }
    },{rootMargin:'180px'});
    observe.observe(frame.current);
    return ()=>observe.disconnect();
  },[]);
  return <div ref={frame} className="navigator-thumbnail" aria-hidden="true">
    {visible&&<Stage><SlideView slide={slide} staticMode compact/></Stage>}
  </div>;
}
export function Navigator({onGo,onClose,current}:{onGo:(id:string)=>void;onClose:()=>void;current:string}) {
  const [search,setSearch]=useState('');
  const [chapter,setChapter]=useState(chapterById(Number(current[1])).id);
  const query=search.trim().toLowerCase();
  const pages=deck.filter(slide=>query?`${slide.id}${slide.title}${slide.content.join('')}`.toLowerCase().includes(query):slide.chapter===chapter);
  useEffect(()=>{
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
    window.addEventListener('keydown',close);
    return ()=>window.removeEventListener('keydown',close);
  },[onClose]);
  return <div className="navigator-backdrop"><section className="navigator" role="dialog" aria-modal="true" aria-label="节目单">
    <header><div><span className="eyebrow">SHOW DIRECTORY</span><h2>节目单</h2></div>
    <button className="icon-button" onClick={onClose} aria-label="关闭目录"><Icon name="close"/></button></header>
    <div className="navigator-layout">
      <aside>{chapters.map(item=><button key={item.id} className={item.id===chapter?'active':''} onClick={()=>{setChapter(item.id);setSearch('')}}>
        <span className="mono">{String(item.id).padStart(2,'0')}</span>{item.name}<small>{item.code}</small>
      </button>)}</aside>
      <div className="navigator-pages navigator-gallery">
        <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="查找一句话，或页面编号…" aria-label="搜索页面"/>
        <div className="navigator-gallery-grid">{pages.map(slide=><button key={slide.id} className={slide.id===current?'current':''} onClick={()=>{onGo(slide.id);onClose()}}>
          <DirectoryThumbnail slide={slide}/>
          <span className="mono">{slide.id}</span><strong>{slide.title}</strong>
        </button>)}</div>
      </div>
    </div>
  </section></div>;
}
export function LongPressChapter({chapter,onGo,active,disabled=false}:{chapter:number;onGo:(id:string)=>void;active:boolean;disabled?:boolean}){const timer=useRef<ReturnType<typeof setTimeout>>();const [pressing,setPressing]=useState(false);const c=chapterById(chapter);const clear=()=>{clearTimeout(timer.current);setPressing(false)};useEffect(()=>()=>clearTimeout(timer.current),[]);return <button className={`chapter-jump ${active?'active':''} ${pressing?'pressing':''}`} title={`长按进入 ${c.code} ${c.name}`} disabled={disabled} onPointerDown={()=>{setPressing(true);timer.current=setTimeout(()=>{onGo(chapter===0?'P0-02':`P${chapter}-01`);setPressing(false)},800)}} onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear} onKeyDown={e=>{if(e.key==='Enter')onGo(chapter===0?'P0-02':`P${chapter}-01`)}}><i/><span>{c.name}</span></button>}
export function timecode(seconds:number){const n=Math.max(0,Math.floor(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
export function useElapsed(sync:Sync){const [now,setNow]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);return sync.state.startedAt?((sync.state.paused&&sync.state.pausedAt?sync.state.pausedAt:sync.state.show?.endedAt??now)-sync.state.startedAt)/1000:0}
export function LiveInteractionButton({slide,sync,iconOnly=false}:{slide:Slide;sync:Sync;iconOnly?:boolean}){
  const round=slide.interaction;
  if(!round||round.mode==='hands')return null;
  const open=sync.state.interaction?.id===round.id&&sync.state.interaction.open;
  const label=open?'收拢这一轮互动':'开启这一轮互动';
  const className=iconOnly?'icon-button interaction-icon':'interaction-toggle';
  return <button className={className+(open?' is-open':'')} title={label} aria-label={label} aria-pressed={open}
    onClick={()=>open?sync.closeInteraction():sync.openInteraction(round.id)} disabled={!sync.authorized||sync.state.show?.endedAt!=null}>
    <Icon name="letter"/>{!iconOnly&&<>{label}<span>{open?'LIVE':'OPEN'}</span></>}
  </button>;
}
