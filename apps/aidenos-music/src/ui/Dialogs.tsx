import { useEffect, useRef, useState } from "react";
import type {
  MusicService,
  MusicSession,
  Playlist,
  QrChallenge,
  QrStatus,
  Track,
} from "../domain";
import { Dialog, Cover, IconButton, Loading, EmptyState } from "./shared";
import { Icon } from "./icons";
import { useResource } from "./hooks";
import s from "./music.module.css";
import { useListEntrance } from "./ListEntrance";

export function LoginDialog({
  service,
  visible,
  onClose,
  onSuccess,
}: {
  service: MusicService;
  visible: boolean;
  onClose: () => void;
  onSuccess: (session: MusicSession) => void;
}) {
  const [challenge, setChallenge] = useState<QrChallenge | null>(null),
    [status, setStatus] = useState<QrStatus["status"]>("waiting"),
    [error, setError] = useState(""),
    [generation, setGeneration] = useState(0),
    [now, setNow] = useState(Date.now());
  const done = useRef(onSuccess);
  done.current = onSuccess;
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let pollTimer: number | undefined;
    setChallenge(null);
    setError("");
    setStatus("waiting");
    const poll = async (id: string) => {
      try {
        const result = await service.checkQr(id, controller.signal);
        if (controller.signal.aborted) return;
        setStatus(result.status);
        if (result.status === "authorized") {
          const session =
            result.session || (await service.session(controller.signal));
          if (!controller.signal.aborted) done.current(session);
          return;
        }
        if (result.status !== "expired")
          pollTimer = window.setTimeout(() => void poll(id), 2000);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "扫码状态暂时不可用，请刷新二维码。",
          );
      }
    };
    void service
      .createQr(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setChallenge(value);
        setNow(Date.now());
        pollTimer = window.setTimeout(() => void poll(value.id), 1400);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "二维码暂时无法生成。");
      });
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      controller.abort();
      clearTimeout(pollTimer);
      clearInterval(clock);
    };
  }, [service, visible, generation]);
  const expired =
      status === "expired" || !!(challenge && now >= challenge.expiresAt),
    remaining = challenge
      ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000))
      : 0;
  return (
    <Dialog title="让喜欢的声音，在此相遇" onClose={onClose}>
      <div className={s.qrIntro}>
        <span className={s.providerDot} />
        网易云音乐扫码登录
      </div>
      <p className={s.dialogCopy}>
        打开网易云音乐 App 扫描二维码。你的歌单和喜欢，会在听潮里继续。
      </p>
      <div
        className={`${s.qrFrame} ${expired ? s.qrExpired : ""}`}
        aria-busy={!challenge && !error}
      >
        {challenge ? (
          <img
            src={challenge.imageUrl}
            alt="使用网易云音乐App扫描此二维码登录"
          />
        ) : error ? (
          <Icon name="refresh" size={42} />
        ) : (
          <Loading compact />
        )}
        {(expired || status === "scanned") && (
          <div className={s.qrOverlay}>
            <span className={s.qrStateIcon}>
              <Icon
                name={status === "scanned" && !expired ? "check" : "refresh"}
                size={29}
              />
            </span>
            <strong>
              {expired ? "二维码已过期" : "已扫描，请在手机上确认"}
            </strong>
            {expired && (
              <button
                type="button"
                className={s.primaryButton}
                onClick={() => setGeneration((x) => x + 1)}
              >
                换一张二维码
              </button>
            )}
          </div>
        )}
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className={s.qrStatus} role="status" aria-live="polite">
        {error ? (
          <span className={s.inlineError}>
            {error}
            <button
              type="button"
              className={s.textButton}
              onClick={() => setGeneration((x) => x + 1)}
            >
              重新生成
            </button>
          </span>
        ) : expired ? (
          "重新生成后，便可继续。"
        ) : status === "scanned" ? (
          "等待手机确认…"
        ) : challenge ? (
          <>
            <span className={s.pulseDot} />
            等待扫描 · {remaining} 秒
          </>
        ) : (
          "正在准备二维码…"
        )}
      </div>
      <p className={s.privacyCopy}>
        <Icon name="lock" size={13} />
        登录状态仅属于当前浏览器，账号内容不会与其他访客共享。
      </p>
    </Dialog>
  );
}
export function CreatePlaylistDialog({
  service,
  onClose,
  onCreated,
}: {
  service: MusicService;
  onClose: () => void;
  onCreated: (playlist: Playlist) => void;
}) {
  const [name, setName] = useState(""),
    [privacy, setPrivacy] = useState<"public" | "private">("public"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  return (
    <Dialog title="为一段心绪，新建歌单" onClose={onClose}>
      <form
        className={s.playlistForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !name.trim()) return;
          setBusy(true);
          setError("");
          void service
            .createPlaylist(name.trim(), privacy)
            .then((playlist) => {
              if (mounted.current) onCreated(playlist);
            })
            .catch((err) => {
              if (mounted.current)
                setError(
                  err instanceof Error ? err.message : "歌单暂时未能创建。",
                );
            })
            .finally(() => {
              if (mounted.current) setBusy(false);
            });
        }}
      >
        <label className={s.formLabel}>
          歌单名称
          <input
            data-autofocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={40}
            placeholder="给这些歌，取一个名字"
            required
          />
          <span className={s.characterCount}>{name.length} / 40</span>
        </label>
        <fieldset className={s.privacyOptions}>
          <legend>谁能看见</legend>
          <label className={privacy === "public" ? s.privacySelected : ""}>
            <input
              type="radio"
              name="privacy"
              checked={privacy === "public"}
              onChange={() => setPrivacy("public")}
            />
            <Icon name="headphones" />
            <span>
              <strong>普通歌单</strong>
              <small>让同频的人，也能听见</small>
            </span>
          </label>
          <label className={privacy === "private" ? s.privacySelected : ""}>
            <input
              type="radio"
              name="privacy"
              checked={privacy === "private"}
              onChange={() => setPrivacy("private")}
            />
            <Icon name="lock" />
            <span>
              <strong>私密歌单</strong>
              <small>只属于你的一小片海</small>
            </span>
          </label>
        </fieldset>
        {error && (
          <p className={s.formError} role="alert">
            {error}
          </p>
        )}
        <div className={s.dialogActions}>
          <button className={s.secondaryButton} type="button" onClick={onClose}>
            取消
          </button>
          <button
            className={s.primaryButton}
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy ? "正在创建…" : "创建歌单"}
            <Icon name="plus" size={16} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function AddToPlaylistDialog({
  service,
  tracks,
  visible,
  onClose,
  onAdded,
}: {
  service: MusicService;
  tracks: Track[];
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const library = useResource(
    (signal) => service.library(signal),
    "add-playlist",
    visible,
  );
  const [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [privacy, setPrivacy] = useState<"public" | "private">("public"),
    [newPlaylistId, setNewPlaylistId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true);
  const picker = useRef<HTMLDivElement>(null);
  useListEntrance(picker, { key: "playlist-picker", active: visible, phase: 100 });
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const playlists = library.value?.created.filter((p) => p.editable) || [];
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let id = creating ? newPlaylistId : selected;
      if (creating && !id) {
        const playlist = await service.createPlaylist(name.trim(), privacy);
        id = playlist.id;
        if (mounted.current) setNewPlaylistId(id);
      }
      if (!id) throw new Error("先选一个歌单吧。");
      await service.editPlaylistTracks(
        id,
        "add",
        tracks.map((t) => t.id),
      );
      if (mounted.current) onAdded();
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : "暂时未能加入歌单。");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Dialog title="收藏到歌单" onClose={onClose}>
      <div className={s.addTrackSummary}>
        <Cover src={tracks[0]?.coverUrl} className={s.addTrackCover} />
        <div>
          <strong>
            {tracks.length === 1
              ? tracks[0]?.title
              : `已选择 ${tracks.length} 首歌曲`}
          </strong>
          <span>
            {tracks.length === 1
              ? tracks[0]?.artists.map((x) => x.name).join(" / ")
              : "让喜欢的声音有处安放"}
          </span>
        </div>
      </div>
      <button
        className={`${s.newPlaylistChoice} ${creating ? s.newPlaylistChosen : ""}`}
        type="button"
        onClick={() => setCreating((v) => !v)}
      >
        <span>
          <Icon name="plus" size={21} />
        </span>
        <strong>新建歌单</strong>
        <Icon name={creating ? "check" : "chevron"} size={16} />
      </button>
      {creating ? (
        <div className={s.inlineCreate}>
          <label className={s.formLabel}>
            歌单名称
            <input
              data-autofocus
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="给这段旋律一个名字"
              disabled={!!newPlaylistId}
            />
          </label>
          <label className={s.checkboxLabel}>
            <input
              type="checkbox"
              checked={privacy === "private"}
              onChange={(event) =>
                setPrivacy(event.currentTarget.checked ? "private" : "public")
              }
              disabled={!!newPlaylistId}
            />
            <Icon name="lock" size={14} />
            设为私密歌单
          </label>
          {newPlaylistId && (
            <p className={s.dialogCopy}>歌单已创建，正在为你放入歌曲。</p>
          )}
        </div>
      ) : (
        <div className={s.playlistPicker} ref={picker}>
          {library.loading && !library.value ? (
            <Loading compact />
          ) : library.error ? (
            <EmptyState
              title="歌单暂时没有接通"
              body={library.error.message}
              action={
                <button className={s.textButton} onClick={library.retry}>
                  重新载入
                </button>
              }
            />
          ) : !playlists.length ? (
            <p className={s.dialogCopy}>
              还没有可编辑的歌单，先为这首歌新建一个吧。
            </p>
          ) : (
            playlists.map((playlist) => (
              <button
                type="button"
                key={playlist.id}
                data-list-item data-list-key={playlist.id}
                className={`${s.playlistOption} ${selected === playlist.id ? s.playlistSelected : ""}`}
                onClick={() => setSelected(playlist.id)}
              >
                <Cover src={playlist.coverUrl} />
                <span>
                  <strong>
                    {playlist.title}
                    {playlist.privacy === "private" && (
                      <Icon name="lock" size={12} />
                    )}
                  </strong>
                  <small>{playlist.trackCount} 首</small>
                </span>
                {selected === playlist.id && <Icon name="check" size={18} />}
              </button>
            ))
          )}
        </div>
      )}
      {error && (
        <p className={s.formError} role="alert">
          {error}
        </p>
      )}
      <div className={s.dialogActions}>
        <button type="button" className={s.secondaryButton} onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className={s.primaryButton}
          disabled={
            busy || (creating ? !name.trim() && !newPlaylistId : !selected)
          }
          onClick={() => void submit()}
        >
          {busy ? "正在收藏…" : "放进歌单"}
          <Icon name="check" size={16} />
        </button>
      </div>
    </Dialog>
  );
}
export function TrackMenuDialog({
  track,
  onClose,
  onNext,
  onEnqueue,
  onAdd,
  onArtist,
  onAlbum,
  onComments,
}: {
  track: Track;
  onClose: () => void;
  onNext: () => void;
  onEnqueue: () => void;
  onAdd: () => void;
  onArtist: () => void;
  onAlbum: () => void;
  onComments: () => void;
}) {
  const items = useRef<HTMLDivElement>(null);
  useListEntrance(items, { key: `track-menu:${track.id}`, phase: 100 });
  const choose = (action: () => void) => {
    onClose();
    action();
  };
  return (
    <Dialog title="这首歌，还可以…" onClose={onClose}>
      <div className={s.addTrackSummary}>
        <Cover src={track.coverUrl} className={s.addTrackCover} />
        <div>
          <strong>{track.title}</strong>
          <span>{track.artists.map((x) => x.name).join(" / ")}</span>
        </div>
      </div>
      <div className={s.trackMenuActions} ref={items}>
        <button data-list-item data-list-key="comments" onClick={() => choose(onComments)}>
          <Icon name="lyrics" />
          查看评论与回复
          <Icon name="forward" size={15} />
        </button>
        <button data-list-item data-list-key="next" onClick={() => choose(onNext)}>
          <Icon name="next" />
          下一首播放
          <Icon name="forward" size={15} />
        </button>
        <button data-list-item data-list-key="enqueue" onClick={() => choose(onEnqueue)}>
          <Icon name="queue" />
          加入播放队列
          <Icon name="forward" size={15} />
        </button>
        <button data-list-item data-list-key="add" onClick={() => choose(onAdd)}>
          <Icon name="plus" />
          收藏到歌单
          <Icon name="forward" size={15} />
        </button>
        <span />
        <button data-list-item data-list-key="artist" disabled={!/^[1-9][0-9]*$/.test(track.artists[0]?.id || "")} onClick={() => choose(onArtist)}>
          <Icon name="artist" />
          查看歌手
          <Icon name="forward" size={15} />
        </button>
        <button data-list-item data-list-key="album" disabled={!/^[1-9][0-9]*$/.test(track.album.id)} onClick={() => choose(onAlbum)}>
          <Icon name="album" />
          查看专辑
          <Icon name="forward" size={15} />
        </button>
      </div>
    </Dialog>
  );
}

export function VisualSettingsDialog({
  spectrumEnabled,
  onSpectrumChange,
  beatThisEnabled,
  onBeatThisChange,
  spectrumAvailable,
  beatThisReady,
  beatThisStatus,
  onClose,
}: {
  spectrumEnabled: boolean;
  onSpectrumChange: (enabled: boolean) => void;
  beatThisEnabled: boolean;
  onBeatThisChange: (enabled: boolean) => void;
  spectrumAvailable: boolean;
  beatThisReady: boolean;
  beatThisStatus: string;
  onClose: () => void;
}) {
  return (
    <Dialog title="听潮实验开关" onClose={onClose} className={s.settingsDialog}>
      <p className={s.settingsIntro}>
        视觉分析默认关闭。每一项都只影响当前浏览器，不改变播放、队列或账号状态。
      </p>
      <div className={s.settingsList}>
        <label className={s.settingsRow}>
          <span className={s.settingsRowIcon}>
            <Icon name="waveform" size={18} />
          </span>
          <span className={s.settingsRowText}>
            <strong>实时频谱与能量</strong>
            <small>
              {spectrumAvailable
                ? "驱动潮光背景和 Folia 音频反馈"
                : "播放中的跨域音源可能不提供 Web Audio 取样"}
            </small>
          </span>
          <input
            type="checkbox"
            checked={spectrumEnabled}
            onChange={(event) => onSpectrumChange(event.currentTarget.checked)}
          />
          <span className={s.settingsSwitch} aria-hidden="true">
            <i />
          </span>
        </label>
        <label className={s.settingsRow}>
          <span className={s.settingsRowIcon}>
            <Icon name="pulse" size={18} />
          </span>
          <span className={s.settingsRowText}>
            <strong>
              Beat This small0 <em>实验性</em>
            </strong>
            <small>{beatThisStatus}</small>
          </span>
          <input
            type="checkbox"
            checked={beatThisEnabled}
            disabled={!beatThisReady}
            onChange={(event) => onBeatThisChange(event.currentTarget.checked)}
          />
          <span className={s.settingsSwitch} aria-hidden="true">
            <i />
          </span>
        </label>
      </div>
      <p className={s.settingsFootnote}>
        {beatThisReady
          ? "small0 会在你手动打开后进入 Worker，首次分析可能需要几秒。"
          : "small0 开关会在模型资源准备好后启用；当前保持不可选，避免伪造分析结果。"}
      </p>
    </Dialog>
  );
}
