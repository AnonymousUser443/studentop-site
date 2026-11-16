import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { LyricLine, MusicHost, MusicRuntime } from "../domain";
import { findLyricLineIndex, findLyricWordIndex, lyricWordProgress } from "../lyrics";
import { connectLyricClock } from "../lyrics/lyricClock";
import { Icon, TideMark } from "./icons";
import { IconButton } from "./shared";
import { readStored, shallowEqual, usePlayback, writeStored } from "./hooks";
import s from "./DesktopLyrics.module.css";

interface Position { x: number; y: number }
interface Viewport { width: number; height: number; bottom: number }
interface Size { width: number; height: number }
interface WordTarget { style: { setProperty(name: string, value: string): void } }
const POSITION_KEY = "aiden.music.desktopLyrics.position";
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

/** Keep every control reachable after a viewport change, including above the taskbar. */
export function clampDesktopLyricsPosition(position: Position, viewport: Viewport, size: Size): Position {
  const maxX = Math.max(12, viewport.width - size.width - 12);
  const maxY = Math.max(12, viewport.height - viewport.bottom - size.height - 12);
  return {
    x: Math.max(12, Math.min(maxX, finite(position.x, maxX / 2))),
    y: Math.max(12, Math.min(maxY, finite(position.y, maxY))),
  };
}

export function defaultDesktopLyricsPosition(viewport: Viewport, size: Size): Position {
  const bottom = clampDesktopLyricsPosition({x: (viewport.width - size.width) / 2, y: viewport.height}, viewport, size);
  // Closing the main window reveals the 154px mini player; leave it its own row.
  return {...bottom, y: Math.max(12, bottom.y - 170)};
}

/** Only the current word changes every frame. Completed words are painted once. */
export function createDesktopWordPainter() {
  let previousLine: LyricLine | null = null, previousWord = -1, previousFill = "";
  return (line: LyricLine, positionMs: number, targets: readonly (WordTarget | null)[]) => {
    const currentWord = findLyricWordIndex(line, positionMs);
    const reset = line !== previousLine || currentWord < previousWord;
    if (reset) {
      targets.forEach((target, index) => target?.style.setProperty("--word-fill", index < currentWord ? "100%" : "0%"));
      previousFill = "";
    } else if (currentWord > previousWord) {
      for (let index = Math.max(0, previousWord); index < currentWord; index++) targets[index]?.style.setProperty("--word-fill", "100%");
      previousFill = "";
    }
    if (currentWord >= 0 && line.words[currentWord]) {
      const fill = (lyricWordProgress(line.words[currentWord], positionMs) * 100).toFixed(1) + "%";
      if (fill !== previousFill) targets[currentWord]?.style.setProperty("--word-fill", fill);
      previousFill = fill;
    }
    previousLine = line;
    previousWord = currentWord;
  };
}

function viewport(): Viewport {
  if (typeof window === "undefined") return {width: 1280, height: 800, bottom: 56};
  const taskbar = document.getElementById("taskbar")?.getBoundingClientRect();
  return {width: window.innerWidth, height: window.innerHeight, bottom: taskbar?.height || 56};
}
function defaultSize(): Size { return {width: Math.min(680, Math.max(160, viewport().width - 24)), height: 146}; }
function initialPosition() {
  const view = viewport(), size = defaultSize();
  const saved = readStored<Position | null>(POSITION_KEY, null);
  return clampDesktopLyricsPosition(saved && typeof saved === "object" ? saved : defaultDesktopLyricsPosition(view, size), view, size);
}

export function DesktopLyrics({runtime, host, active}: {runtime: MusicRuntime; host: MusicHost; active: boolean}) {
  const state = usePlayback(runtime, value => ({track: value.currentTrack, status: value.status}), shallowEqual, active);
  const root = useRef<HTMLElement>(null), handle = useRef<HTMLButtonElement>(null), [position, setPosition] = useState(initialPosition), [dragging, setDragging] = useState(false);
  const drag = useRef<{id: number; x: number; y: number; from: Position} | null>(null);
  const size = (): Size => {
    const rect = root.current?.getBoundingClientRect();
    return rect?.width && rect.height ? {width: rect.width, height: rect.height} : defaultSize();
  };
  const relocate = (next: Position) => setPosition(old => {
    const bounded = clampDesktopLyricsPosition(next, viewport(), size());
    return old.x === bounded.x && old.y === bounded.y ? old : bounded;
  });
  const resetPosition = () => relocate(defaultDesktopLyricsPosition(viewport(), size()));
  useEffect(() => {
    if (!active) { drag.current = null; setDragging(false); return; }
    const resize = () => setPosition(old => {
      const next = clampDesktopLyricsPosition(old, viewport(), size());
      return old.x === next.x && old.y === next.y ? old : next;
    });
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (root.current) observer?.observe(root.current);
    window.addEventListener("resize", resize);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); drag.current = null; };
  }, [active, state.track?.id]);
  useEffect(() => { if (!dragging) writeStored(POSITION_KEY, position); }, [position, dragging]);

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    relocate({x: start.from.x + event.clientX - start.x, y: start.from.y + event.clientY - start.y});
  };
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      // A focused draggable control owns these keys before document-level
      // media extensions can consume them. No other target or shortcut is changed.
      if (event.target !== handle.current || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.shiftKey ? 24 : 8;
      const directions: Record<string, Position> = {ArrowLeft: {x: -step, y: 0}, ArrowRight: {x: step, y: 0}, ArrowUp: {x: 0, y: -step}, ArrowDown: {x: 0, y: step}};
      const delta = directions[event.key];
      if (event.key !== "Home" && !delta) return;
      event.preventDefault(); event.stopPropagation();
      setPosition(old => event.key === "Home"
        ? defaultDesktopLyricsPosition(viewport(), size())
        : clampDesktopLyricsPosition({x: old.x + delta.x, y: old.y + delta.y}, viewport(), size()));
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [active]);
  if (!state.track) return null;
  return <section
    ref={root}
    className={`${s.desktopLyrics} ${dragging ? s.dragging : ""}`}
    style={{left: position.x, top: position.y}}
    hidden={!active}
    data-desktop-lyrics
    data-theme={host.theme()}
    data-status={state.status}
    role="region"
    aria-label="听潮桌面歌词"
  >
    <header className={s.toolbar}>
      <button
        ref={handle}
        className={s.dragHandle}
        type="button"
        aria-label="移动桌面歌词，方向键微调，Home 键归位"
        title="拖动歌词 · 方向键微调 · Home 键归位"
        onPointerDown={event => {
          if (!active || event.button !== 0) return;
          event.preventDefault();
          drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, from: position};
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus({preventScroll: true});
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={() => {drag.current = null; setDragging(false);}}
        onDoubleClick={resetPosition}
      ><span className={s.grip} aria-hidden="true"/><TideMark size={15}/><span>桌面歌词</span></button>
      <span className={s.trackIdentity} title={`${state.track.title} · ${state.track.artists.map(artist => artist.name).join(" / ")}`}>{state.track.title}<i/> {state.track.artists.map(artist => artist.name).join(" / ")}</span>
      <div className={s.controls}>
        <IconButton icon={state.status === "playing" ? "pause" : "play"} label={state.status === "playing" ? "暂停播放" : "继续播放"} onClick={() => void runtime.togglePlay().catch(error => host.notify(error instanceof Error ? error.message : "播放暂时不可用。"))}/>
        <IconButton icon="expand" label="从桌面歌词恢复听潮主窗口" onClick={() => host.openMain()}/>
        <IconButton icon="close" label="关闭桌面歌词，音乐继续" onClick={() => host.setDesktopLyricsEnabled?.(false)}/>
      </div>
    </header>
    <DesktopLyricText runtime={runtime} active={active}/>
    <span className={s.edgeMark} aria-hidden="true"><Icon name="lyrics" size={11}/><i/></span>
  </section>;
}

const DesktopLyricText = memo(function DesktopLyricText({runtime, active}: {runtime: MusicRuntime; active: boolean}) {
  const {lyrics, track} = usePlayback(runtime, value => ({lyrics: value.lyrics, track: value.currentTrack}), shallowEqual, active);
  const [index, setIndex] = useState(() => findLyricLineIndex(lyrics?.lines || [], runtime.getSnapshot().positionMs));
  const current = lyrics?.lines[index], lineNode = useRef<HTMLParagraphElement>(null);
  const words = useRef<Array<HTMLSpanElement | null>>([]), clockMs = useRef(runtime.getSnapshot().positionMs);
  const renderedLine = useRef(current); renderedLine.current = current;
  const paint = useRef(createDesktopWordPainter());
  useLayoutEffect(() => {
    if (current) paint.current(current, clockMs.current, words.current);
  }, [current, active]);
  useEffect(() => {
    if (!active || !lyrics?.lines.length) return;
    let previousIndex = findLyricLineIndex(lyrics.lines, runtime.getSnapshot().positionMs);
    setIndex(previousIndex);
    return connectLyricClock(runtime, {set(seconds) {
      clockMs.current = seconds * 1_000;
      const nextIndex = findLyricLineIndex(lyrics.lines, clockMs.current);
      if (previousIndex !== nextIndex) { previousIndex = nextIndex; setIndex(nextIndex); }
      const line = lyrics.lines[nextIndex];
      if (line && renderedLine.current === line && lineNode.current?.dataset.lyricId === line.id) paint.current(line, clockMs.current, words.current);
    }}, 0);
  }, [runtime, lyrics, active]);
  const secondary = current?.translation || lyrics?.lines[index + 1]?.text;
  return <div className={s.lyricBody}>
    <p ref={lineNode} className={s.currentLine} data-lyric-id={current?.id} aria-live="polite" aria-atomic="true">
      {current ? current.words.length ? current.words.map((word, wordIndex) => <span key={`${current.id}-${wordIndex}`} ref={node => {words.current[wordIndex] = node;}} className={s.word}>{word.text}</span>) : current.text : track?.title || "听见此刻"}
    </p>
    <p className={s.secondaryLine}>{current ? secondary || "♪" : lyrics?.instrumental ? "纯音乐，让旋律继续。" : lyrics?.lines.length ? "等待第一句歌词" : lyrics ? "这首歌暂时没有可用歌词" : "歌词正在路上…"}</p>
  </div>;
});
