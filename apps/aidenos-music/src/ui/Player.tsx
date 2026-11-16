import { useState } from "react";
import type { MusicHost, MusicRuntime, Quality, Track } from "../domain";
import { usePlayback, shallowEqual, formatTime } from "./hooks";
import { Cover, IconButton } from "./shared";
import { Icon } from "./icons";
import s from "./music.module.css";

const QUALITY_NAMES: Record<Quality, string> = {
  standard: "标准",
  higher: "较高",
  exhigh: "极高",
  lossless: "无损",
};

export function Progress({
  runtime,
  compact = false,
  active,
}: {
  runtime: MusicRuntime;
  compact?: boolean;
  active?: boolean;
}) {
  const state = usePlayback(
    runtime,
    (value) => ({
      position: value.positionMs,
      duration: value.durationMs,
      status: value.status,
    }),
    shallowEqual,
    active,
  );
  const [scrub, setScrub] = useState<number | null>(null),
    duration = Math.max(0, state.duration),
    position = Math.min(duration, scrub ?? state.position);
  return (
    <div className={`${s.progressRow} ${compact ? s.progressCompact : ""}`}>
      <span>{formatTime(position)}</span>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={250}
        value={position}
        disabled={!duration}
        aria-label="播放进度"
        aria-valuetext={`${formatTime(position)} / ${formatTime(duration)}`}
        style={
          {
            "--progress": `${duration ? (position / duration) * 100 : 0}%`,
          } as React.CSSProperties
        }
        onPointerDown={() => setScrub(state.position)}
        onInput={(event) => {
          const value = Number(event.currentTarget.value);
          setScrub(value);
          runtime.seek(value);
        }}
        onChange={(event) => runtime.seek(Number(event.currentTarget.value))}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
        onBlur={() => setScrub(null)}
      />
      <span>{formatTime(duration)}</span>
    </div>
  );
}
export function Transport({
  runtime,
  onError,
  small = false,
  active,
}: {
  runtime: MusicRuntime;
  onError?: (error: unknown) => void;
  small?: boolean;
  active?: boolean;
}) {
  const { status, track } = usePlayback(
    runtime,
    (state) => ({ status: state.status, track: state.currentTrack }),
    shallowEqual,
    active,
  );
  const run = (action: () => Promise<void>) => {
    void action().catch((error) => onError?.(error));
  };
  return (
    <div className={`${s.transport} ${small ? s.transportSmall : ""}`}>
      <IconButton
        icon="previous"
        label="上一首"
        disabled={!track}
        onClick={() => run(() => runtime.previous())}
      />
      <button
        className={s.playButton}
        type="button"
        aria-label={status === "playing" ? "暂停播放" : "开始播放"}
        title={status === "playing" ? "暂停" : "播放"}
        disabled={!track || status === "loading"}
        onClick={() => run(() => runtime.togglePlay())}
      >
        {status === "loading" ? (
          <span className={s.spinner} />
        ) : (
          <Icon
            name={status === "playing" ? "pause" : "play"}
            size={small ? 19 : 23}
          />
        )}
      </button>
      <IconButton
        icon="next"
        label="下一首"
        disabled={!track}
        onClick={() => run(() => runtime.next())}
      />
    </div>
  );
}
export function Player({
  runtime,
  host,
  liked,
  onLike,
  onImmersive,
  onQueue,
  queueOpen,
  immersive,
  onError,
}: {
  runtime: MusicRuntime;
  host: MusicHost;
  liked: boolean;
  onLike: (track: Track) => void;
  onImmersive: () => void;
  onQueue: () => void;
  queueOpen: boolean;
  immersive: boolean;
  onError: (error: unknown) => void;
}) {
  const state = usePlayback(
    runtime,
    (value) => ({
      track: value.currentTrack,
      mode: value.mode,
      volume: value.volume,
      muted: value.muted,
      quality: value.quality,
      source: value.source,
      queueLength: value.queue.length,
    }),
    shallowEqual,
  );
  const track = state.track,
    actualQuality = state.source ? QUALITY_NAMES[state.source.quality] : null,
    qualityMismatch = !!state.source && state.source.quality !== state.quality;
  const qualityTitle = actualQuality
    ? qualityMismatch
      ? `请求音质：${QUALITY_NAMES[state.quality]}；实际音质：${actualQuality}`
      : `实际音质：${actualQuality}`
    : `请求音质：${QUALITY_NAMES[state.quality]}`;
  return (
    <footer className={s.player} aria-label="音乐播放器" title={qualityTitle}>
      <div className={s.playerIdentity}>
        <button
          type="button"
          className={s.playerCoverButton}
          data-player-cover
          onClick={onImmersive}
          disabled={!track}
          title="展开沉浸歌词"
          aria-label="展开沉浸歌词"
        >
          <Cover src={track?.coverUrl} className={s.playerCover} eager />
          <span>
            <Icon name="expand" size={16} />
          </span>
        </button>
        <div>
          <button
            type="button"
            className={s.playerTitle}
            onClick={onImmersive}
            disabled={!track}
          >
            {track?.title || "让声音，陪你片刻"}
          </button>
          <span className={s.playerArtist} title={qualityTitle}>
            {track
              ? track.artists.map((x) => x.name).join(" / ")
              : "挑一首喜欢的歌，开始听潮"}
            {state.source?.availability === "preview" && (
              <small className={s.previewTag}>试听</small>
            )}
          </span>
        </div>
        {track && (
          <IconButton
            icon="heart"
            label={liked ? "取消喜欢" : "喜欢这首歌"}
            active={liked}
            className={liked ? s.filledHeart : ""}
            onClick={() => onLike(track)}
          />
        )}
      </div>
      <div className={s.playerCenter}>
        <div className={s.playerTransportRow}>
          <IconButton
            icon={
              state.mode === "shuffle"
                ? "shuffle"
                : state.mode === "repeat-one"
                  ? "repeat-one"
                  : "repeat"
            }
            label={
              state.mode === "sequence"
                ? "顺序播放，点击随机"
                : state.mode === "shuffle"
                  ? "随机播放，点击单曲循环"
                  : "单曲循环，点击顺序播放"
            }
            active={state.mode !== "sequence"}
            onClick={() =>
              runtime.setMode(
                state.mode === "sequence"
                  ? "shuffle"
                  : state.mode === "shuffle"
                    ? "repeat-one"
                    : "sequence",
              )
            }
          />
          <Transport runtime={runtime} onError={onError} />
          <IconButton
            icon="lyrics"
            label={immersive ? "收起歌词" : "沉浸歌词"}
            active={immersive}
            disabled={!track}
            onClick={onImmersive}
          />
        </div>
        <Progress runtime={runtime} />
      </div>
      <div className={s.playerTools}>
        <div className={s.qualityControl}>
          <label className={s.qualitySelect} title={qualityTitle}>
            <span className={s.srOnly}>请求播放音质</span>
            <select
              aria-label="请求播放音质"
              value={state.quality}
              onChange={(event) =>
                runtime.setQuality(
                  event.currentTarget.value as typeof state.quality,
                )
              }
            >
              <option value="standard">标准</option>
              <option value="higher">较高</option>
              <option value="exhigh">极高</option>
              <option value="lossless">无损</option>
            </select>
            <Icon name="chevron" size={10} />
          </label>
          {qualityMismatch && (
            <small className={s.actualQuality} title={qualityTitle}>
              实际 {actualQuality}
            </small>
          )}
        </div>
        <div className={s.volumeControl}>
          <IconButton
            icon={state.muted || state.volume === 0 ? "muted" : "volume"}
            label={state.muted ? "恢复声音" : "静音"}
            onClick={() => runtime.setMuted(!state.muted)}
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.muted ? 0 : state.volume}
            aria-label="音乐音量"
            onChange={(event) =>
              runtime.setVolume(Number(event.currentTarget.value))
            }
          />
        </div>
        <button
          type="button"
          className={`${s.queueButton} ${queueOpen ? s.iconActive : ""}`}
          onClick={onQueue}
          title="播放队列"
          aria-label={`播放队列，${state.queueLength}首`}
          aria-expanded={queueOpen}
        >
          <Icon name="queue" size={21} />
          <span>{state.queueLength}</span>
        </button>
      </div>
    </footer>
  );
}
