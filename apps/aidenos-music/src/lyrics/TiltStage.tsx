import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m, useMotionValue, useMotionValueEvent } from "motion/react";
import type { MusicRuntime } from "../domain";
import type { Theme } from "../vendor/folia/types";
import { TiltTypography } from "../vendor/folia/components/visualizer/tilt/Typography";
import { findLyricIndex, readFoliaTheme, toFoliaLines } from "./foliaAdapter";
import { connectLyricClock } from "./lyricClock";
import { shallowEqual, usePlayback } from "../ui/hooks";
import s from "./TiltStage.module.css";

interface Props { runtime: MusicRuntime; active: boolean; appearance: "light" | "dark"; translation: boolean; offset: number; fallback: ReactNode; }
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function TiltStage(props: Props) {
  return <Boundary fallback={props.fallback}><Stage {...props} /></Boundary>;
}
function Stage({ runtime, active, appearance, translation, offset, fallback }: Props) {
  const root = useRef<HTMLDivElement>(null), clock = useMotionValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 }), [theme, setTheme] = useState<Theme | null>(null);
  const [index, setIndex] = useState(-1), indexRef = useRef(-1), [fontsReady, setFontsReady] = useState(false);
  const state = usePlayback(runtime, (v) => ({ lyrics: v.lyrics, track: v.currentTrack }), shallowEqual, active);
  const lines = useMemo(() => toFoliaLines(state.lyrics), [state.lyrics]);
  const fits = size.width >= 280 && size.height >= 210;
  useLayoutEffect(() => {
    if (!root.current) return;
    setTheme(readFoliaTheme(root.current));
  }, [appearance]);
  useLayoutEffect(() => {
    const node = root.current; if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!active || !fits) return;
    let cancelled = false; setFontsReady(false);
    const ready = () => { if (!cancelled) setFontsReady(true); };
    void document.fonts.load('500 32px "Tingchao UI"', lines.map((line) => line.fullText).join("")).then(ready, ready);
    return () => { cancelled = true; };
  }, [active, fits, lines]);
  useEffect(() => {
    if (!active || !fits) return;
    return connectLyricClock(runtime, clock, offset);
  }, [runtime, active, fits, clock, offset]);
  useMotionValueEvent(clock, "change", (time) => {
    const next = findLyricIndex(lines, time);
    if (indexRef.current !== next) { indexRef.current = next; setIndex(next); }
  });
  useEffect(() => { indexRef.current = findLyricIndex(lines, clock.get()); setIndex(indexRef.current); }, [lines, clock]);
  const line = lines[index], next = lines[index + 1];
  const enabled = active && fits && theme && fontsReady;
  return <div className={s.stage} ref={root} data-folia-tilt data-renderer={!active ? "suspended" : !fits ? "compact" : enabled ? "tilt" : "loading"}>
    {enabled ? <>
      <div className={s.typography} aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          {line ? <m.div key={`${state.track?.id}:${line.id}:${line.startTime}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .22, ease: [.22, 1, .36, 1] }}>
            <TiltTypography line={line} clock={clock} theme={theme} width={Math.min(size.width, Math.max(280, size.height * 1.9))} />
          </m.div> : <span className={s.waiting}>等待第一句潮声</span>}
        </AnimatePresence>
      </div>
      <div className={s.subtitles}>
        {line && <button type="button" title="点击定位到这一句" onClick={() => runtime.seek(Math.max(0, line.startTime * 1000 + offset))}>
          <span className={s.accessible}>{line.fullText}</span>
          {translation && line.translation && <span>{line.translation}</span>}
          {translation && line.romanization && <small>{line.romanization}</small>}
        </button>}
        {next && <button type="button" className={s.next} onClick={() => runtime.seek(Math.max(0, next.startTime * 1000 + offset))} aria-label={`定位下一句：${next.fullText}`}>{next.fullText}</button>}
      </div>
    </> : fallback}
  </div>;
}
