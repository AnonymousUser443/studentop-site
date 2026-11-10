import { useEffect, useState } from 'react';
import { authorizeHost, getShow, showRequest, ShowApiError, type ShowSession } from '../core/show-api';
import { roleUrl, roomApiPath, roomManagerUrl, validShowId } from '../core/url';
import type { LiveMessage, PollResults, RaffleView, SyncState } from '../core/sync';
import { EndShowButton } from '../components/EndShowButton';
import { useAudienceQr } from '../components/RoomQr';
import deck from '../content/deck.json';

type JoinRole = 'display' | 'audience';
type Access = 'loading' | 'locked' | 'ready';
interface Archive {
  show: ShowSession;
  state: SyncState;
  messages: (LiveMessage & { private?: boolean })[];
  results: PollResults;
  raffle: RaffleView | null;
}

const prompts = new Map(deck.flatMap(slide => slide.interaction ? [[slide.interaction.id, slide.interaction] as const] : []));
const dateTime = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
const formatTime = (time: number) => dateTime.format(time);
const errorMessage = (error: unknown, fallback: string) => error instanceof ShowApiError ? error.message : fallback;

function RoomJoin({ role }: { role: JoinRole }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(() => new URLSearchParams(location.search).has('show') ? '请输入有效的六位场次号。' : '');
  const [busy, setBusy] = useState(false);
  const roleName = role === 'display' ? '大屏端' : '观众端';
  return <main className="room-lobby">
    <section className="room-lobby-paper" aria-labelledby="room-entry-title">
      <div className="room-lobby-heading">
        <span className="room-eyebrow">睿信之星 · 现场演讲</span>
        <h1 id="room-entry-title">追光者</h1>
        <p>输入演讲者提供的场次号，进入同一场演讲。</p>
      </div>
      <form className="room-entry-form" onSubmit={async event => {
        event.preventDefault();
        if (!validShowId(code)) { setError('请输入六位数字。'); return; }
        setBusy(true); setError('');
        try {
          const { show } = await getShow(code);
          if (show.endedAt != null) { setError('本场演讲已经结束。'); return; }
          location.assign(roleUrl(role, false, show.id));
        } catch (reason) {
          setError(errorMessage(reason, '暂时无法确认场次，请检查网络后重试。'));
        } finally { setBusy(false); }
      }}>
        <span className="room-role">{roleName}</span>
        <label htmlFor="room-code">六位场次号</label>
        <input id="room-code" className="room-code-input" type="text" inputMode="numeric" autoComplete="off"
          pattern="[0-9]{6}" maxLength={6} value={code} placeholder="000000"
          aria-invalid={Boolean(error)} aria-describedby={error ? 'room-entry-error' : undefined}
          onChange={event => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }} required />
        {error && <p id="room-entry-error" className="room-error" role="alert">{error}</p>}
        <button className="room-primary" type="submit" disabled={busy || !validShowId(code)}>{busy ? '正在查找场次…' : '加入场次'}</button>
        <nav aria-label="演讲入口">
          <a href={roleUrl(role === 'display' ? 'audience' : 'display', false, null)}>{role === 'display' ? '切换观众端' : '切换大屏端'}</a>
          <a href={roomManagerUrl()}>演讲者入口</a>
          {role === 'display' && <a href={roleUrl('display', true)}>本机彩排</a>}
        </nav>
      </form>
    </section>
  </main>;
}

function Invite({ show }: { show: ShowSession }) {
  const qr = useAudienceQr(show.id);
  return <figure className="room-invite">
    {qr.src ? <img src={qr.src} alt={`扫码加入场次 ${show.id} 的观众端`}/> : <p role="status">{qr.failed ? '二维码暂不可用' : '正在生成二维码…'}</p>}
    <figcaption><a href={qr.url} target="_blank" rel="noreferrer">场次 {show.id} · 观众入口 ↗</a></figcaption>
  </figure>;
}

function ArchiveView({ record }: { record: Archive }) {
  const publicCount = record.messages.filter(message => !message.private).length;
  const votes = Object.values(record.results).reduce((sum, vote) => sum + vote.total, 0);
  return <section className="room-archive">
    <header>
      <span className="room-eyebrow">场次 {record.show.id} · {record.show.endedAt != null ? '已结束' : '可加入'}</span>
      <h2>{record.show.name}</h2>
      <p>最后呈现页 {record.state.pageId} · 建立于 {formatTime(record.show.createdAt)}</p>
    </header>
    <dl className="room-stats">
      <div><dt>现场留言</dt><dd>{publicCount}</dd></div>
      <div><dt>私密信件</dt><dd>{record.messages.length - publicCount}</dd></div>
      <div><dt>投票</dt><dd>{votes}</dd></div>
    </dl>
    <div className="room-archive-columns">
      <section>
        <h3>互动记录</h3>
        {record.messages.length ? <ul className="room-archive-messages">{record.messages.slice().reverse().map(message => <li key={message.id}>
          <small>{message.private ? '私密信件' : '现场留言'}{message.hidden && ' · 已沉底'} · {formatTime(message.createdAt)}</small>
          <p>{message.emoji} {message.text}</p>
        </li>)}</ul> : <p>本场还没有留言或私信。</p>}
      </section>
      <section>
        <h3>投票结果</h3>
        {Object.entries(record.results).length ? Object.entries(record.results).map(([id, result]) => <div className="room-archive-poll" key={id}>
          <h4>{prompts.get(id)?.prompt || id}</h4>
          <ul>{result.counts.map((count, index) => <li key={index}>
            <span>{prompts.get(id)?.options?.[index] || `选项 ${index + 1}`}</span><strong>{count} 票</strong>
          </li>)}</ul>
        </div>) : <p>本场还没有投票。</p>}
        <h3>抽签结果</h3>
        {record.raffle?.winners.length ? <ol className="room-archive-winners">{record.raffle.winners.map(code => <li key={code}>{code}</li>)}</ol> : <p>本场还没有开奖。</p>}
      </section>
    </div>
  </section>;
}

function RoomManager() {
  const [access, setAccess] = useState<Access>('loading');
  const [shows, setShows] = useState<ShowSession[]>([]);
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [archive, setArchive] = useState<Archive | null>(null);
  const archiveParam = new URLSearchParams(location.search).get('archive');
  const archiveId = validShowId(archiveParam) ? archiveParam : null;

  async function loadShows(signal?: AbortSignal) {
    try {
      const response = await showRequest<{ shows: ShowSession[] }>('/api/rooms', undefined,
        signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : undefined);
      setShows(response.shows);
      setAccess('ready');
    } catch (reason) {
      if (signal?.aborted) return;
      setAccess('locked');
      if (!(reason instanceof ShowApiError && (reason.status === 401 || reason.status === 403))) {
        setError(errorMessage(reason, '暂时无法连接场次管理，请稍后重试。'));
      }
    }
  }
  useEffect(() => {
    const cancel = new AbortController();
    void loadShows(cancel.signal);
    return () => cancel.abort();
  }, []);

  useEffect(() => {
    if (access !== 'ready' || !archiveId) return;
    const cancel = new AbortController();
    void showRequest<Archive>(roomApiPath(archiveId, '/archive'), undefined,
      AbortSignal.any([cancel.signal, AbortSignal.timeout(8000)])).then(setArchive).catch(reason => {
      if (cancel.signal.aborted) return;
      if (reason instanceof ShowApiError && (reason.status === 401 || reason.status === 403)) setAccess('locked');
      setError(errorMessage(reason, '暂时无法读取本场记录。'));
    });
    return () => cancel.abort();
  }, [access, archiveId]);

  const invite = shows.find(show => show.id === inviteId && show.endedAt == null);
  return <main className="room-manager">
    <header className="room-manager-header">
      <div><span className="room-eyebrow">追光者 · 演讲者视图</span><h1>场次管理</h1></div>
      <nav aria-label="场次管理入口">
        {archiveId && <a href={roomManagerUrl()}>全部场次</a>}
        <a href={roleUrl('display', true, null)}>本机彩排</a>
        <a href={roleUrl('display', false, null)}>大屏入口</a>
        <a href={roleUrl('audience', false, null)}>观众入口</a>
      </nav>
    </header>
    {access === 'loading' && <p className="room-manager-placeholder" role="status">正在连接场次管理…</p>}
    {access === 'locked' && <form className="room-manager-login room-card" onSubmit={async event => {
      event.preventDefault();
      setBusy(true); setError('');
      try { await authorizeHost(pin); setPin(''); await loadShows(); }
      catch (reason) { setError(errorMessage(reason, '暂时无法完成授权，请检查网络后重试。')); }
      finally { setBusy(false); }
    }}>
      <h2>演讲者授权</h2>
      <label htmlFor="host-pin">演讲口令</label>
      <input id="host-pin" type="password" autoComplete="current-password" value={pin}
        onChange={event => setPin(event.target.value)} required />
      <button className="room-primary" type="submit" disabled={busy || !pin}>{busy ? '正在授权…' : '进入场次管理'}</button>
    </form>}
    {error && <p className="room-error room-manager-alert" role="alert">{error}</p>}
    {access === 'ready' && (archiveId ? archive ? <ArchiveView record={archive}/> : !error && <p role="status">正在读取本场记录…</p> :
      <div className="room-manager-grid">
        <section aria-labelledby="room-list-title">
          <h2 id="room-list-title">全部场次</h2>
          <div className="room-show-list">
            {!shows.length && <p className="room-card">创建一场演讲，即可用同一个号码连接提词器、大屏和观众。</p>}
            {shows.map(show => <article className="room-card room-show" key={show.id}>
              <header><div><span className="room-show-number">{show.id}</span><span className="room-show-state">{show.endedAt != null ? '已结束' : '可加入'}</span><h3>{show.name}</h3></div><time dateTime={new Date(show.createdAt).toISOString()}>{formatTime(show.createdAt)}</time></header>
              <nav aria-label={`${show.name}的操作`}>
                {show.endedAt == null && <>
                  <a className="room-main-link" href={roleUrl('presenter', false, show.id)}>打开提词器</a>
                  <a href={roleUrl('display', false, show.id)} target="_blank" rel="noreferrer">打开大屏 ↗</a>
                  <button type="button" onClick={() => setInviteId(current => current === show.id ? null : show.id)}
                    aria-expanded={inviteId === show.id}>观众二维码</button>
                </>}
                <a href={roomManagerUrl(show.id)}>查看记录</a>
                <EndShowButton show={show} onEnded={ended => {
                  setShows(current => current.map(item => item.id === ended.id ? ended : item));
                  setNotice(`场次 ${ended.id} 已结束。`);
                }}/>
              </nav>
            </article>)}
          </div>
        </section>
        <aside>
          <form className="room-card room-create-form" onSubmit={async event => {
            event.preventDefault();
            setBusy(true); setError(''); setNotice('');
            try {
              const { show } = await showRequest<{ show: ShowSession }>('/api/rooms', { name: name.trim() });
              setShows(current => [show, ...current]); setInviteId(show.id); setName('');
              setNotice(`已创建场次 ${show.id}。`);
            } catch (reason) {
              if (reason instanceof ShowApiError && (reason.status === 401 || reason.status === 403)) setAccess('locked');
              setError(errorMessage(reason, '场次未能创建，请稍后重试。'));
            } finally { setBusy(false); }
          }}>
            <h2>创建场次</h2>
            <label htmlFor="show-name">场次名称</label>
            <input id="show-name" value={name} onChange={event => setName(event.target.value)}
              placeholder="例如 周五分享会" maxLength={60} required />
            <button className="room-primary" type="submit" disabled={busy || !name.trim()}>{busy ? '正在创建…' : '创建并获取场次号'}</button>
            {notice && <p className="room-notice" role="status">{notice}</p>}
          </form>
          {invite && <Invite show={invite}/>}
        </aside>
      </div>)}
  </main>;
}

export default function RoomPortal({ role }: { role: 'presenter' | JoinRole }) {
  return role === 'presenter' ? <RoomManager/> : <RoomJoin role={role}/>;
}
