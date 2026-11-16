import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import type { MusicHost, MusicRuntime, Track } from "../domain";
import { Icon, TideMark } from "./icons";
import { Cover, IconButton } from "./shared";
import { Progress, Transport } from "./Player";
import { DesktopLyrics } from "./DesktopLyrics";
import {
  formatTime,
  readStored,
  writeStored,
  shallowEqual,
  useDocumentVisible,
  useHost,
  usePlayback,
} from "./hooks";
import s from "./music.module.css";
import f from "./surfaces.module.css";

export function MusicSurface({
  runtime,
  host,
  type,
  visible = true,
}: {
  runtime: MusicRuntime;
  host: MusicHost;
  type: "mini" | "lock" | "tray" | "lyrics";
  visible?: boolean;
}) {
  const { locked, reduced } = useHost(host),
    documentShown = useDocumentVisible(),
    documentVisible = documentShown && visible;
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <div
          className={`${s.palette} ${f.surfaceBase}`}
          data-music-theme={host.theme()}
          data-music-controls="true"
          data-reduced-motion={reduced ? "true" : "false"}
          data-visible={documentVisible ? "true" : "false"}
          onPointerDown={(event) => {
            if (type === "lock") event.stopPropagation();
          }}
          onPointerUp={(event) => {
            if (type === "lock") event.stopPropagation();
          }}
          onClick={(event) => {
            if (type === "lock") event.stopPropagation();
          }}
          onWheel={(event) => {
            if (type === "lock") event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (type === "lock") event.stopPropagation();
          }}
        >
          {type === "mini" ? (
            !locked && (
              <MiniPlayer
                runtime={runtime}
                host={host}
                active={documentVisible}
              />
            )
          ) : type === "lyrics" ? (
            !locked && host.desktopLyricsEnabled?.() === true && (
              <DesktopLyrics runtime={runtime} host={host} active={documentVisible}/>
            )
          ) : type === "lock" ? (
            locked && (
              <LockPlayer
                runtime={runtime}
                host={host}
                active={documentVisible}
              />
            )
          ) : (
            <TrayPlayer
              runtime={runtime}
              host={host}
              active={documentVisible}
            />
          )}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
function MiniPlayer({
  runtime,
  host,
  active,
}: {
  runtime: MusicRuntime;
  host: MusicHost;
  active: boolean;
}) {
  const [hidden, setHidden] = useState(false),
    state = usePlayback(
      runtime,
      (v) => ({ track: v.currentTrack, status: v.status, mode: v.mode }),
      shallowEqual,
      active && !hidden,
    );
  const bounds = () => ({
    width: Math.min(356, window.innerWidth - 24),
    height: 154,
    maxX: Math.max(12, window.innerWidth - 368),
    maxY: Math.max(12, window.innerHeight - 224),
  });
  const [position, setPosition] = useState(() => {
    const saved = readStored<{ x: number; y: number } | null>(
        "tingchao.mini.position",
        null,
      ),
      b = bounds();
    return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      ? {
          x: Math.max(12, Math.min(b.maxX, saved.x)),
          y: Math.max(12, Math.min(b.maxY, saved.y)),
        }
      : { x: b.maxX, y: b.maxY };
  });
  const drag = useRef<{
      id: number;
      x: number;
      y: number;
      fromX: number;
      fromY: number;
    } | null>(null),
    [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!active || hidden) return;
    const resize = () =>
      setPosition((p) => {
        const b = bounds();
        return {
          x: Math.max(12, Math.min(b.maxX, p.x)),
          y: Math.max(12, Math.min(b.maxY, p.y)),
        };
      });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [active, hidden]);
  useEffect(() => {
    if (!active) {
      drag.current = null;
      setDragging(false);
    }
  }, [active]);
  useEffect(() => {
    if (!dragging) writeStored("tingchao.mini.position", position);
  }, [position, dragging]);
  const move = (event: ReactPointerEvent) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const b = bounds();
    setPosition({
      x: Math.max(
        12,
        Math.min(
          window.innerWidth - b.width - 12,
          start.fromX + event.clientX - start.x,
        ),
      ),
      y: Math.max(12, Math.min(b.maxY, start.fromY + event.clientY - start.y)),
    });
  };
  const end = (event: ReactPointerEvent) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    const b = bounds();
    setPosition((p) => ({
      x:
        p.x < 52
          ? 12
          : p.x > window.innerWidth - b.width - 52
            ? window.innerWidth - b.width - 12
            : p.x,
      y: p.y,
    }));
  };
  if (!state.track || hidden) return null;
  return (
    <m.section
      className={`${f.miniPlayer} ${dragging ? f.dragging : ""}`}
      style={{ left: position.x, top: position.y, width: bounds().width }}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 330, damping: 28 }}
      aria-label="听潮迷你播放器"
    >
      <header
        className={f.miniHeader}
        onPointerDown={(event) => {
          if (
            (event.target as HTMLElement).closest("button") ||
            event.button !== 0
          )
            return;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            fromX: position.x,
            fromY: position.y,
          };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span>
          <TideMark size={17} />
          听潮 <i />
          {state.status === "playing" ? "音乐仍在继续" : "留在这一刻"}
        </span>
        <div>
          <IconButton
            icon="expand"
            label="恢复听潮主窗口"
            onClick={() => host.openMain()}
          />
          <IconButton
            icon="close"
            label="隐藏迷你播放器，音乐继续"
            onClick={() => setHidden(true)}
          />
        </div>
      </header>
      <div className={f.miniBody}>
        <button
          className={f.miniCover}
          type="button"
          onClick={() => host.openMain()}
          aria-label="打开听潮主窗口"
        >
          <Cover src={state.track.coverUrl} />
          <span>
            <Icon name="expand" size={15} />
          </span>
        </button>
        <div className={f.miniIdentity}>
          <button
            type="button"
            onClick={() => host.openMain()}
            title={state.track.title}
          >
            {state.track.title}
          </button>
          <span>{state.track.artists.map((x) => x.name).join(" / ")}</span>
          <Transport
            runtime={runtime}
            active={active}
            small
            onError={(error) =>
              host.notify(
                error instanceof Error ? error.message : "播放暂时不可用。",
              )
            }
          />
        </div>
      </div>
      <div className={f.miniProgress}>
        <Progress runtime={runtime} active={active} compact />
      </div>
    </m.section>
  );
}
function LockPlayer({
  runtime,
  host,
  active,
}: {
  runtime: MusicRuntime;
  host: MusicHost;
  active: boolean;
}) {
  const state = usePlayback(
    runtime,
    (v) => ({ track: v.currentTrack, status: v.status, source: v.source }),
    shallowEqual,
    active,
  );
  if (!state.track) return null;
  return (
    <m.section
      className={f.lockPlayer}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="听潮锁屏媒体控制"
    >
      <div className={f.lockIdentity}>
        <Cover src={state.track.coverUrl} />
        <div>
          <span className={f.lockSource}>
            <TideMark size={12} />
            听潮 · AidenOS Music
          </span>
          <strong>{state.track.title}</strong>
          <span className={f.lockArtist}>
            {state.track.artists.map((x) => x.name).join(" / ")}
            {state.source?.availability === "preview" && <small>试听</small>}
          </span>
        </div>
        <span
          className={`${f.lockIndicator} ${state.status === "playing" ? f.indicatorPlaying : ""}`}
          aria-label={state.status === "playing" ? "正在播放" : "已暂停"}
        >
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className={f.lockTransport}>
        <Transport
          runtime={runtime}
          active={active}
          onError={(error) =>
            host.notify(
              error instanceof Error ? error.message : "请解锁桌面后继续播放。",
            )
          }
        />
      </div>
      <Progress runtime={runtime} active={active} />
    </m.section>
  );
}
function TrayPlayer({
  runtime,
  host,
  active,
}: {
  runtime: MusicRuntime;
  host: MusicHost;
  active: boolean;
}) {
  const state = usePlayback(
    runtime,
    (v) => ({ track: v.currentTrack, status: v.status }),
    shallowEqual,
    active,
  );
  if (!state.track) return null;
  return (
    <button
      className={`${f.trayPlayer} ${state.status === "playing" ? f.trayPlaying : ""}`}
      type="button"
      onClick={() => host.openMain()}
      title={`${state.track.title} · ${state.track.artists.map((x) => x.name).join(" / ")} · 点击打开听潮`}
      aria-label={`听潮：${state.track.title}，${state.status === "playing" ? "正在播放" : "已暂停"}，点击打开`}
    >
      <span className={f.trayMark}>
        <TideMark size={21} />
      </span>
      <span className={f.trayTitle}>{state.track.title}</span>
      <span className={f.trayBars}>
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
