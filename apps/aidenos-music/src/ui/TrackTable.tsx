import { memo, useEffect, useRef, useState } from "react";
import type { Artist, MusicRuntime, Track } from "../domain";
import { usePlayback, formatTime } from "./hooks";
import { Cover, IconButton } from "./shared";
import { Icon } from "./icons";
import { useScrollMemory } from "./cache";
import { useListEntrance } from "./ListEntrance";
import s from "./music.module.css";

export interface TrackActions {
  play: (tracks: Track[], index: number) => void;
  like: (track: Track) => void;
  add: (track: Track) => void;
  menu: (track: Track) => void;
  album: (id: string) => void;
  artist: (artist: Artist) => void;
  remove?: (track: Track) => void;
}
interface TrackTableProps {
  tracks: Track[];
  runtime: MusicRuntime;
  actions: TrackActions;
  likedIds: Set<string>;
  offset?: number;
  compact?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onMore?: () => void;
  className?: string;
  entranceKey?: string;
  entrancePhase?: number;
}
export const TRACK_ROW_HEIGHT = 90;
const ROW_HEIGHT = TRACK_ROW_HEIGHT;
export function TrackTable({
  tracks,
  runtime,
  actions,
  likedIds,
  offset = 0,
  compact = false,
  hasMore = false,
  loadingMore = false,
  onMore,
  className = "",
  entranceKey,
  entrancePhase = 220,
}: TrackTableProps) {
  const playingId = usePlayback(
    runtime,
    (state) => state.currentTrack?.id || "",
  );
  const scroll = useRef<HTMLDivElement>(null),
    [view, setView] = useState({ top: 0, height: 600 });
  useScrollMemory(scroll, "tracks", tracks.length);
  useListEntrance(scroll, {
    key: entranceKey || `tracks:${compact ? "compact" : "full"}:${tracks[0]?.id || "empty"}`,
    phase: entrancePhase,
    stagger: 220,
    distance: 26,
  });
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const measure = () =>
      setView((v) => ({ ...v, height: node.clientHeight || 600 }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const virtual = !compact && tracks.length > 160;
  const start = virtual
    ? Math.max(0, Math.floor(view.top / ROW_HEIGHT) - 6)
    : 0;
  const end = virtual
    ? Math.min(tracks.length, start + Math.ceil(view.height / ROW_HEIGHT) + 13)
    : tracks.length;
  return (
    <div
      className={`${s.trackTable} ${compact ? s.compactTable : ""} ${className}`}
      role="table"
      aria-label="歌曲列表"
      aria-rowcount={tracks.length + 1}
    >
      {!compact && (
        <div className={s.trackHead} role="row" data-list-item data-list-key="track-heading" data-list-phase={170}>
          <span role="columnheader">#</span>
          <span />
          <span role="columnheader">歌曲 / 歌手</span>
          <span role="columnheader" className={s.albumColumn}>
            专辑
          </span>
          <span role="columnheader" className={s.durationColumn}>
            时长
          </span>
          <span role="columnheader" className={s.actionColumn}>
            操作
          </span>
        </div>
      )}
      <div
        className={s.trackRows}
        ref={scroll}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          if (virtual)
            setView((v) => ({ ...v, top }));
        }}
      >
        {start > 0 && (
          <div style={{ height: start * ROW_HEIGHT }} aria-hidden="true" />
        )}
        {tracks.slice(start, end).map((track, relativeIndex) => {
          const index = start + relativeIndex;
          return (
            <TrackRow
              key={`${track.id}-${index}`}
              track={track}
              index={index + offset}
              active={playingId === track.id}
              liked={likedIds.has(track.id)}
              compact={compact}
              onPlay={() => actions.play(tracks, index)}
              onLike={() => actions.like(track)}
              onAdd={() => actions.add(track)}
              onMenu={() => actions.menu(track)}
              onAlbum={() => actions.album(track.album.id)}
              onArtist={() =>
                track.artists[0] && actions.artist(track.artists[0])
              }
              onRemove={
                actions.remove ? () => actions.remove!(track) : undefined
              }
            />
          );
        })}
        {end < tracks.length && (
          <div
            style={{ height: (tracks.length - end) * ROW_HEIGHT }}
            aria-hidden="true"
          />
        )}
        {hasMore && (
          <button
            className={s.loadMore}
            type="button"
            disabled={loadingMore}
            onClick={onMore}
          >
            {loadingMore ? "正在接续…" : "再听远一点 · 加载更多"}
            <Icon name={loadingMore ? "refresh" : "chevron"} size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
const TrackRow = memo(function TrackRow({
  track,
  index,
  active,
  liked,
  compact,
  onPlay,
  onLike,
  onAdd,
  onMenu,
  onAlbum,
  onArtist,
  onRemove,
}: {
  track: Track;
  index: number;
  active: boolean;
  liked: boolean;
  compact: boolean;
  onPlay: () => void;
  onLike: () => void;
  onAdd: () => void;
  onMenu: () => void;
  onAlbum: () => void;
  onArtist: () => void;
  onRemove?: () => void;
}) {
  const unavailable = track.availability === "unavailable";
  const hasArtist = /^[1-9][0-9]*$/.test(track.artists[0]?.id || "");
  const hasAlbum = /^[1-9][0-9]*$/.test(track.album.id);
  return (
    <div
      className={`${s.trackRow} ${active ? s.trackCurrent : ""} ${unavailable ? s.trackUnavailable : ""}`}
      role="row"
      aria-rowindex={index + 2}
      data-list-item
      data-list-key={`track:${track.id}:${index}`}
      data-list-index={index}
      tabIndex={0}
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest("button")) onPlay();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.code === "Space") {
          event.preventDefault();
          event.stopPropagation();
          onPlay();
        }
      }}
    >
      <div className={s.trackIndex} role="cell">
        <span>
          {active ? (
            <span className={s.playingBars}>
              <i />
              <i />
              <i />
            </span>
          ) : (
            String(index + 1).padStart(2, "0")
          )}
        </span>
        <button
          aria-label={`播放 ${track.title}`}
          type="button"
          onClick={onPlay}
          disabled={unavailable}
        >
          <Icon name="play" size={15} />
        </button>
      </div>
      <button
        type="button"
        className={s.trackCoverButton}
        onClick={onPlay}
        disabled={unavailable}
        aria-label={`播放 ${track.title}`}
      >
        <Cover src={track.coverUrl} className={s.trackCover} />
        <span>
          <Icon name="play" size={17} />
        </span>
      </button>
      <div className={s.trackIdentity} role="cell">
        <button
          type="button"
          className={s.trackTitle}
          onClick={onPlay}
          disabled={unavailable}
          title={track.title}
        >
          {track.title}
          {track.availability === "preview" && (
            <small className={s.previewTag}>试听</small>
          )}
          {track.availability === "login_required" && (
            <small className={s.previewTag}>需登录</small>
          )}
        </button>
        <button
          className={s.artistLink}
          type="button"
          disabled={!hasArtist}
          onClick={onArtist}
          title={track.artists.map((x) => x.name).join(" / ")}
        >
          {track.artists.map((x) => x.name).join(" / ") || "未知歌手"}
          {track.alias && <span> · {track.alias}</span>}
        </button>
      </div>
      <button
        className={`${s.albumLink} ${s.albumColumn}`}
        type="button"
        disabled={!hasAlbum}
        onClick={onAlbum}
        title={track.album.title}
      >
        {track.album.title || "未知专辑"}
      </button>
      <span className={`${s.trackDuration} ${s.durationColumn}`} role="cell">
        {formatTime(track.durationMs)}
      </span>
      <div className={s.trackActions} role="cell">
        <IconButton
          icon="heart"
          label={liked ? `取消喜欢 ${track.title}` : `喜欢 ${track.title}`}
          active={liked}
          className={liked ? s.filledHeart : ""}
          onClick={onLike}
        />
        {!compact && (
          <IconButton
            icon={onRemove ? "remove" : "plus"}
            label={
              onRemove
                ? `从歌单移出 ${track.title}`
                : `收藏 ${track.title} 到歌单`
            }
            onClick={onRemove || onAdd}
          />
        )}
        <IconButton
          icon="more"
          label={`${track.title} 的更多操作`}
          onClick={onMenu}
        />
      </div>
    </div>
  );
});
