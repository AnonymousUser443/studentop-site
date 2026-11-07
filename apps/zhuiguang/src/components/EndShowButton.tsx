import { useRef, useState } from 'react';
import { showRequest, ShowApiError, type ShowSession } from '../core/show-api';
import { roomApiPath } from '../core/url';

export function EndShowButton({ show, onEnded, disabled = false }: {
  show: ShowSession;
  onEnded: (show: ShowSession) => void;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (show.endedAt != null) return null;
  return <>
    <button className="room-end-button" type="button" disabled={disabled}
      onClick={() => { setError(''); dialog.current?.showModal(); }}>结束本场</button>
    <dialog ref={dialog} className="room-confirm" aria-label="确认结束本场"
      onCancel={event => { if (busy) event.preventDefault(); }}>
      <form onSubmit={async event => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          const response = await showRequest<{ show: ShowSession }>(roomApiPath(show.id, '/end'), { confirm: true });
          dialog.current?.close();
          onEnded(response.show);
        } catch (reason) {
          setError(reason instanceof ShowApiError ? reason.message : '暂时无法结束本场，请检查连接后重试。');
        } finally { setBusy(false); }
      }}>
        <span className="eyebrow">场次 {show.id}</span>
        <h2>结束「{show.name}」？</h2>
        <p>确认后，入场和互动将关闭。本场的投票、留言、私信和抽签结果会保留在场次记录中。</p>
        {error && <p role="alert" className="room-error">{error}</p>}
        <div className="room-confirm-actions">
          <button type="button" autoFocus disabled={busy} onClick={() => dialog.current?.close()}>继续本场</button>
          <button type="submit" disabled={busy}>{busy ? '正在结束…' : '确认结束'}</button>
        </div>
      </form>
    </dialog>
  </>;
}
