import { appUrl } from '../core/url';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSync } from '../core/sync';
import { useShowAssets, type ShowAssets } from '../core/use-show-assets';
import { deck, reducedMotion, slideById } from '../core/deck';
import { audio } from '../core/audio';
import { pageTimeline } from '../core/timeline';
import { sceneKey } from '../production/story/registry';
import { Stage } from '../components/Stage';
import { SlideView } from '../components/SlideView';
import { Seal } from '../components/Seal';
import { Icon, timecode, type Sync } from '../components/Controls';
import './audience-show.css';

function AudienceAssets({ ready, offlineReady, progress, retry }: ShowAssets) {
  const failed = progress.phase === 'error';
  const size = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  return <section className="audience-assets" data-assets-ready={ready} data-offline-ready={offlineReady} aria-label="演讲资源准备">
    <div className="audience-assets-title">
      <strong>{failed ? '资源准备未完成' : ready ? '演讲资源已准备' : '正在准备完整演讲'}</strong>
      <span className="mono">{progress.percent}%</span>
    </div>
    <progress value={progress.percent} max={100} aria-label="资源预下载进度"/>
    {progress.total > 0 && <small>{progress.loaded} / {progress.total} 项 · {size(progress.bytesLoaded)} / {size(progress.totalBytes)} MiB</small>}
    <p role="status">{failed ? progress.current : ready ? offlineReady ? '图片、影片和声音已缓存。' : '图片、影片和声音已下载，请保持联网。' : '正在预下载图片、影片和声音。'}</p>
    {failed && <button className="secondary-button" type="button" onClick={retry}>重试未完成的下载</button>}
  </section>;
}

export default function AudienceApp() {
  const sync = useSync('audience');
  const ended = !!sync.state.show?.endedAt;
  // Register the browser and prepare its package concurrently.
  const assets = useShowAssets(sync.admitted !== null && (!ended || sync.admitted));
  const watching = sync.admitted === true && assets.ready;
  const slide = slideById(sync.state.startedAt===null&&sync.state.pageId==='P0-02' ? 'P0-01' : sync.state.pageId);
  const interaction = slide.interaction?.id === sync.state.interaction?.id ? slide.interaction : undefined;
  const round = interaction && sync.state.interaction;
  const [dismissed, setDismissed] = useState<string>();
  const roundKey = round ? round.id + ':' + round.deadline : undefined;
  const [now, setNow] = useState(Date.now);
  const [latency, setLatency] = useState<number | null>(null);
  const [orientationHint, setOrientationHint] = useState(true);
  const [filmNeedsTap, setFilmNeedsTap] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [entering, setEntering] = useState(false);
  const attemptedEntry = useRef(false);
  const { admitted, connected, admit } = sync;
  const stage = useRef<HTMLDivElement>(null);
  const previous = useRef<string>();
  const active = !ended && !!round?.open && dismissed !== roundKey && !sync.state.blackout;
  const seconds = round ? Math.max(0, Math.ceil((round.deadline - now) / 1000)) : 0;
  const page = deck.indexOf(slide) + 1;

  useEffect(() => {
    if (ended || admitted !== false || !connected || attemptedEntry.current) return;
    attemptedEntry.current = true;
    setEntering(true);
    setEntryError('');
    void admit().then(result => {
      if (!result.ok) setEntryError(result.error || '暂时无法入场，请重试。');
      setEntering(false);
    });
  }, [ended, admitted, connected, admit]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!watching) return;
    const hint = setTimeout(() => setOrientationHint(false), 5500);
    return () => clearTimeout(hint);
  }, [watching]);
  useEffect(() => {
    if (!sync.admitted || !sync.connected) { setLatency(null); return; }
    let cancelled = false;
    const measure = () => { if (!document.hidden) void sync.measureLatency().then(ms => { if (!cancelled) setLatency(ms); }); };
    measure();
    const timer = setInterval(measure, 12000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [sync.admitted, sync.connected, sync.measureLatency]);
  useLayoutEffect(() => {
    if (!watching || !stage.current) return;
    audio.setMuted(true);
    const root = stage.current;
    const prior = previous.current;
    previous.current = slide.id;
    const tl = pageTimeline(root, slide, () => {}, prior);
    tl.play(0);
    return () => { tl.kill(); root.getAnimations().forEach(animation => animation.cancel()); };
  }, [slide, watching]);

  const { pageId: filmPage, playing: filmPlaying, position: filmPosition, sampledAt: filmSampledAt } = sync.state.media ?? {};
  const followFilm = watching && sync.connected && !ended && filmPage === slide.id;
  useEffect(() => {
    setFilmNeedsTap(false);
    const video = stage.current?.querySelector('video');
    if (!video) return;
    if (!followFilm || filmPosition == null || filmSampledAt == null) { video.pause(); return; }
    video.muted = true;
    video.defaultMuted = true;
    const align = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const elapsed = filmPlaying ? Math.max(0, (Date.now() - filmSampledAt) / 1000) : 0;
      const target = Math.min(filmPosition + elapsed, video.duration);
      if (Math.abs(video.currentTime - target) > .35) video.currentTime = target;
    };
    video.addEventListener('loadedmetadata', align);
    if (video.readyState >= 1) align();
    if (!filmPlaying) {
      video.pause();
      return () => video.removeEventListener('loadedmetadata', align);
    }

    let current = true;
    const started = () => setFilmNeedsTap(false);
    const interrupted = () => { if (!video.ended) setFilmNeedsTap(true); };
    video.addEventListener('playing', started);
    video.addEventListener('pause', interrupted);
    video.addEventListener('error', interrupted);
    // Some embedded browsers reject autoplay or leave play() pending until a tap.
    const timeout = window.setTimeout(() => {
      if (video.paused || video.readyState < 2) interrupted();
    }, 1800);
    void Promise.resolve(video.play()).catch(() => { if (current) interrupted(); });
    return () => {
      current = false;
      clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', align);
      video.removeEventListener('playing', started);
      video.removeEventListener('pause', interrupted);
      video.removeEventListener('error', interrupted);
    };
  }, [slide.id, followFilm, filmPlaying, filmPosition, filmSampledAt]);

  const showFilmPlay = followFilm && filmPlaying && filmNeedsTap;
  function playFilmFromTap() {
    const video = stage.current?.querySelector('video');
    if (!showFilmPlay || !video) return;
    if (video.error) video.load();
    void Promise.resolve(video.play()).catch(() => setFilmNeedsTap(true));
  }

  if (sync.joinError && !sync.admitted) return <main className="audience-entry"><section className="audience-entry-card">
    <span className="eyebrow">睿信之星 · 2026</span><h1>追光者</h1>
    <p role="alert">{sync.joinError}</p>
    <button className="primary-button" type="button" onClick={sync.retryConnection}>重新连接</button>
    <a className="audience-change-room" href={appUrl('/?role=audience')}>更换场次</a>
  </section></main>;
  if (sync.admitted === null) return <main className="audience-entry"><section className="audience-entry-card">
    <span className="eyebrow">睿信之星 · 2026</span><h1>追光者</h1>
    <p role="status">正在连接演讲现场…</p>
    <a className="audience-change-room" href={appUrl('/?role=audience')}>更换场次</a>
  </section></main>;
  if (!watching) return <main className="audience-entry"><section className="audience-entry-card">
    <span className="eyebrow">场次 {sync.state.show?.id}</span>
    <h1>追光者</h1>
    <AudienceAssets {...assets}/>
    {entryError && <p role="alert" className="form-error">{entryError}</p>}
    {!admitted && connected && attemptedEntry.current && !entering && (entryError || assets.ready) &&
      <button className="secondary-button" type="button" onClick={() => {
        attemptedEntry.current = false;
        sync.retryConnection();
      }}>重新入场</button>}
    {assets.progress.phase !== 'error' && !entryError && <p>准备完成后会自动跟上大屏。</p>}
    <a className="audience-change-room" href={appUrl('/?role=audience')}>更换场次</a>
  </section></main>;
  return <div className="audience-show">
    <div className="audience-landscape" aria-hidden={active || undefined}>
      <Stage className="audience-stage"><div className="animated-slide" ref={stage} key={sceneKey(slide.id)} data-spectator>
        <SlideView slide={slide} staticMode={reducedMotion} spectator state={sync.state} messages={sync.publicMessages} results={sync.results}/>
      </div>{sync.state.blackout && <div className="display-blackout"/>}</Stage>
      <div className="audience-meter" aria-label="连接状态与全场进度">
        <span>{sync.connected ? latency === null ? '已连接' : latency + ' ms' : '重连中'}</span>
        <progress aria-label="演讲进度" value={page} max={deck.length}/>
        <span>{page} / {deck.length}</span>
      </div>
      {showFilmPlay && <button className="audience-film-play" type="button" onClick={playFilmFromTap}><Icon name="play" size={17}/>点按播放影片</button>}
      {orientationHint && !showFilmPlay && !ended && !sync.joinError && <span className="audience-turn-hint" role="status">将手机横放，即可全屏观看</span>}
      {!ended && !active && round?.open && <button className="audience-return" onClick={() => setDismissed(undefined)}>回到本轮互动</button>}
    </div>
    {(ended || sync.joinError) && <aside className="audience-session-status" role="status">
      <span>{ended ? '本场已结束，感谢参与。' : sync.joinError}</span>
      <a href={appUrl('/?role=audience')}>返回场次入口</a>
    </aside>}
    {sync.raffleTicket && <aside className="raffle-ticket" role="status"><small>你抽中了 · 请出示本页领奖</small><strong>{sync.raffleTicket}</strong></aside>}
    {active && interaction && <Interaction key={roundKey} interaction={interaction} sync={sync} seconds={seconds} onDismiss={() => setDismissed(roundKey)}/>}
  </div>;
}

function Interaction({ interaction, sync, seconds, onDismiss }: {
  interaction: NonNullable<(typeof deck)[number]['interaction']>;
  sync: Sync;
  seconds: number;
  onDismiss: () => void;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [emoji, setEmoji] = useState('😊');
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const request = useRef<{ text: string; id: string }>();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const isPoll = interaction.mode === 'poll';
  const isPrivate = interaction.mode === 'private';
  const impressions = interaction.id === 'initial-impression';
  const postshow = interaction.id === 'postshow-letter';
  const maxLength = postshow ? 600 : impressions ? 30 : 60;

  return <div className="audience-live-scrim"><section className="audience-interaction" aria-label="现场互动">
    <div className="audience-interaction-label">
      <span className="eyebrow">{isPrivate ? '私密信笺' : '现场互动'}</span>
      <span className="mono">{timecode(seconds)}</span>
      <button type="button" className="icon-button" onClick={onDismiss} aria-label="回到幻灯片"><Icon name="close"/></button>
    </div>
    {postshow && <img className="audience-letter-lanyan" src={appUrl("/assets/art/story678/fi-postshow-lanyan.png")} alt="蓝砚邀请你写一封信"/>}
    <h1>{interaction.prompt}</h1>
    {isPrivate && <p className="private-promise"><Icon name="lock" size={15}/>只给演讲者，这句话不会出现在大屏。</p>}
    {sent ? <div className="audience-submitted"><Seal text={isPoll ? '已投' : '已寄'} size={66}/><p>已送达。</p>
      {isPoll && <div className="audience-results">{interaction.options?.map((option, index) => {
        const result = sync.results[interaction.id];
        const percent = result?.total ? Math.round((result.counts[index] || 0) / result.total * 100) : 0;
        return <div key={option}><span>{option}</span><b className="mono">{percent}%</b><i style={{width: percent + '%'}}/></div>;
      })}</div>}
      <button className="secondary-button" onClick={onDismiss}>回到幻灯片</button>
    </div> : <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      if (postshow && request.current?.text !== text) request.current = { text, id: crypto.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2) };
      const reply = await sync.submit({ requestId: request.current?.id, interactionId: interaction.id, ...(isPoll ? { choice: choice ?? undefined } : { text, emoji: impressions ? emoji : undefined, anonymous }) });
      setBusy(false);
      if (reply.ok) { setSent(true); setText(''); }
      else setError(reply.error || '这句话还没有送达，请再试一次。');
    }}>
      {isPoll ? <div className="audience-options">{interaction.options?.map((option, index) => <button type="button" key={option} className={choice === index ? 'selected' : ''} onClick={() => setChoice(index)}><b className="mono">{'ABCDE'[index]}</b><span>{option}</span></button>)}</div> : <>
        {impressions && <div className="emoji-options">{['😊','😑','😐','🤯','😂','🙌'].map(mark => <button type="button" className={emoji === mark ? 'selected' : ''} key={mark} onClick={() => setEmoji(mark)} aria-label={mark}>{mark}</button>)}</div>}
        <label className="text-entry"><textarea value={text} onChange={event => setText(event.target.value)} maxLength={maxLength} placeholder={postshow ? '写给学长…' : isPrivate ? '有一句话，想对身边的人说…' : '写下此刻的想法…'} rows={postshow ? 5 : 3} required/><span className="mono">{text.length} / {maxLength}</span></label>
        {isPrivate && !postshow && <label className="anonymous-toggle"><input type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)}/>匿名寄出</label>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button audience-submit" disabled={busy || !sync.connected || seconds === 0 || (isPoll ? choice === null : !text.trim())}>{busy ? '正在送出…' : isPoll ? '留下我的选择' : '送出'}<Icon name="next"/></button>
    </form>}
  </section></div>;
}
