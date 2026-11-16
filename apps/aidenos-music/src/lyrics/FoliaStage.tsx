import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MusicRuntime } from "../domain";
import type { Theme } from "../vendor/folia/types";
import type { SonnetPixiRuntime } from "../vendor/folia/components/visualizer/sonnet/createSonnetPixiRuntime";
import { compileSonnetProgram } from "../vendor/folia/components/visualizer/sonnet/sonnetProgram";
import { connectLyricClock } from "./lyricClock";
import { findLyricIndex, readFoliaTheme, TINGCHAO_SONNET_TUNING, toFoliaLines } from "./foliaAdapter";
import { shallowEqual, usePlayback } from "../ui/hooks";
import s from "./FoliaStage.module.css";

class RenderBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

interface StageProps {
  runtime: MusicRuntime;
  active: boolean;
  appearance: "light" | "dark";
  translation: boolean;
  offset: number;
  fallback: ReactNode;
}

export default function FoliaStage(props: StageProps) {
  return <RenderBoundary fallback={props.fallback}><Stage {...props} /></RenderBoundary>;
}

function Stage({ runtime, active, appearance, translation, offset, fallback }: StageProps) {
  const root = useRef<HTMLDivElement>(null), canvasHost = useRef<HTMLDivElement>(null);
  const engine = useRef<SonnetPixiRuntime | null>(null);
  const clock = useMotionValue(0);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [fits, setFits] = useState(false), [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false), [revision, setRevision] = useState(0);
  const [index, setIndex] = useState(-1), indexRef = useRef(-1);
  const state = usePlayback(runtime, (v) => ({
    lyrics: v.lyrics, track: v.currentTrack, status: v.status,
  }), shallowEqual, active);
  const lines = useMemo(() => toFoliaLines(state.lyrics), [state.lyrics]);
  const seed = state.track ? `netease:${state.track.id}` : "";
  const program = useMemo(() => compileSonnetProgram(lines, seed), [lines, seed]);
  const enabled = active && fits && !failed && theme !== null && lines.length > 0;
  const paused = state.status !== "playing";
  const latest = useRef({ theme, program, seed, paused });
  latest.current = { theme, program, seed, paused };

  useLayoutEffect(() => {
    if (root.current) setTheme(readFoliaTheme(root.current));
  }, [appearance]);
  useLayoutEffect(() => {
    const node = canvasHost.current;
    if (!node) return;
    const measure = () => setFits(node.clientWidth >= 420 && node.clientHeight >= 250);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!enabled) return;
    return connectLyricClock(runtime, clock, offset);
  }, [runtime, clock, offset, enabled]);

  const updateIndex = (time: number) => {
    const next = findLyricIndex(lines, time);
    if (next !== indexRef.current) { indexRef.current = next; setIndex(next); }
  };
  useMotionValueEvent(clock, "change", (time) => {
    updateIndex(time);
    if (latest.current.paused) engine.current?.renderOnce();
  });
  useEffect(() => { updateIndex(clock.get()); }, [lines, clock]);

  // One renderer per visible stage, independent of the app's unique audio engine.
  // Hidden/minimized stages abort even an in-flight import/font load before creating a context.
  useEffect(() => {
    if (!enabled || !canvasHost.current) return;
    const controller = new AbortController();
    let owned: SonnetPixiRuntime | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const onContextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    setReady(false);
    void (async () => {
      // Canvas text must use the same packaged glyphs as the rest of Tingchao.
      const sample = lines.map((line) => line.fullText).join("");
      await document.fonts.load('500 32px "Tingchao UI"', sample);
      if (controller.signal.aborted) return;
      const { SonnetPixiRuntime: Renderer } = await import("../vendor/folia/components/visualizer/sonnet/createSonnetPixiRuntime");
      if (controller.signal.aborted || !canvasHost.current) return;
      const current = latest.current;
      owned = await Renderer.create({
        host: canvasHost.current, songSeed: current.seed, program: current.program,
        theme: current.theme!, tuning: { ...TINGCHAO_SONNET_TUNING },
        currentTime: clock, renderScale: 1, antialias: true, antialiasMode: "auto",
        smartBeatEnabled: false, lyricsFontScale: 0.7, staticMode: false,
        transparentBackground: true, paused: true, signal: controller.signal,
        // Respect the surrounding sea scene: typography is the only strong moving subject.
        modulation: { stageScale: 0.72, cameraScale: 0.55, motionScale: 0.85, parallaxScale: 0.6, caScale: 0, ghostScale: 0, transitionGlitchScale: 0 },
      });
      if (controller.signal.aborted) { owned.destroy(); return; }
      canvas = canvasHost.current?.querySelector("canvas") ?? null;
      canvas?.addEventListener("webglcontextlost", onContextLost);
      engine.current = owned;
      setRevision((v) => v + 1);
    })().catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => {
      controller.abort();
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      if (engine.current === owned) engine.current = null;
      owned?.destroy();
    };
    // Mutable song/theme/pause inputs are applied below, including changes made during initialization.
  }, [enabled, clock]);

  useEffect(() => {
    const renderer = engine.current;
    if (!renderer || !theme || !enabled) return;
    const controller = new AbortController();
    setReady(false);
    void renderer.swapSong({ seed, program, theme }, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      renderer.setPaused(latest.current.paused);
      renderer.renderOnce();
      setReady(true);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [revision, program, theme, seed, enabled]);
  useEffect(() => { engine.current?.setPaused(paused); }, [paused, revision]);

  const line = lines[index], next = lines[index + 1];
  const unavailable = failed || !fits;
  return (
    <div className={s.stage} ref={root} data-folia-stage data-renderer={failed ? "fallback" : !fits ? "compact" : !active ? "suspended" : ready ? "sonnet" : "loading"}>
      <div className={`${s.canvas} ${ready && enabled ? s.visible : ""}`} ref={canvasHost} aria-hidden="true" />
      {(!ready || unavailable) && <div className={s.fallback}>{fallback}</div>}
      {ready && enabled && (
        <div className={s.subtitles}>
          {line && <button type="button" className={s.currentLine} onClick={() => runtime.seek(Math.max(0, line.startTime * 1000 + offset))} title="点击定位到这一句">
            <span>{line.fullText}</span>
            {translation && line.translation && <span className={s.translation}>{line.translation}</span>}
            {translation && line.romanization && <span className={s.romanization}>{line.romanization}</span>}
          </button>}
          {!line && next && <span className={s.upcoming}>{next.fullText}</span>}
          {line && next && <span className={s.upcoming}>{next.fullText}</span>}
        </div>
      )}
      {unavailable && <span className={s.status} role="status">{failed ? "演出暂不可用，已使用随行歌词" : "小窗口使用随行歌词"}</span>}
      {!unavailable && !ready && <span className={s.status} role="status">潮汐演出准备中 · 歌词与播放不受影响</span>}
    </div>
  );
}
