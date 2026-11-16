import {
  lazy,
  Suspense,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import { m } from "motion/react";
import type { LyricLine, MusicHost, MusicRuntime, Track } from "../domain";
import {
  usePlayback,
  useHost,
  useDocumentVisible,
  shallowEqual,
  formatTime,
  readStored,
  writeStored,
} from "./hooks";
import { Cover, IconButton } from "./shared";
import { Icon } from "./icons";
import s from "./music.module.css";

const FoliaStage = lazy(() => import("../lyrics/FoliaStage"));
const TiltStage = lazy(() => import("../lyrics/TiltStage"));

function currentLine(lines: LyricLine[], position: number) {
  let low = 0,
    high = lines.length - 1,
    index = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].startMs <= position) {
      index = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return index;
}
export function Immersive({
  runtime,
  host,
  visible,
  onClose,
  onLike,
  liked,
}: {
  runtime: MusicRuntime;
  host: MusicHost;
  visible: boolean;
  onClose: () => void;
  onLike: (track: Track) => void;
  liked: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    art = useRef<HTMLDivElement>(null);
  const { reduced } = useHost(host),
    documentVisible = useDocumentVisible(),
    active = visible && documentVisible;
  const state = usePlayback(
    runtime,
    (v) => ({ track: v.currentTrack, lyrics: v.lyrics, status: v.status }),
    shallowEqual,
    active,
  );
  const [translation, setTranslation] = useState(true),
    [offset, setOffset] = useState(0),
    [mode, setMode] = useState<"scroll" | "performance" | "tilt">(() => {
      const saved = readStored<string>("tingchao.lyric-mode", "scroll");
      return saved === "performance" || saved === "tilt" ? saved : "scroll";
    });
  const performanceMode = mode === "performance" && !reduced && Boolean(state.lyrics?.lines.length);
  const fallback = <LyricScroll runtime={runtime} translation={translation} offset={offset} reduced={reduced} active={active} />;
  useLayoutEffect(() => {
    if (!active || reduced || !root.current) return;
    const context = gsap.context(() => {
      gsap.from("[data-lyric-stage]", {
        y: 28,
        opacity: 0,
        duration: 0.65,
        ease: "power3.out",
        delay: 0.12,
      });
      gsap.from("[data-scene-far]", {
        scale: 1.06,
        duration: 1.4,
        ease: "power2.out",
      });
      if (art.current) {
        const from = root.current
            ?.closest("[data-tingchao-root]")
            ?.querySelector("[data-player-cover]")
            ?.getBoundingClientRect(),
          to = art.current.getBoundingClientRect();
        if (from && to.width)
          gsap.from(art.current, {
            x: from.x + from.width / 2 - to.x - to.width / 2,
            y: from.y + from.height / 2 - to.y - to.height / 2,
            scale: from.width / to.width,
            rotation: -4,
            duration: 0.75,
            ease: "power3.inOut",
          });
        else
          gsap.from(art.current, {
            scale: 0.9,
            y: 30,
            opacity: 0,
            duration: 0.7,
            ease: "power3.out",
          });
      }
      gsap.to("[data-scene-glow]", {
        opacity: 0.8,
        duration: 5,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    }, root);
    return () => context.revert();
  }, [active, reduced]);
  useEffect(() => {
    const node = root.current;
    if (!node || !active || reduced) return;
    const layer = node.querySelector("[data-scene-front]");
    if (!layer) return;
    const x = gsap.quickTo(layer, "x", { duration: 1, ease: "power2.out" }),
      y = gsap.quickTo(layer, "y", { duration: 1, ease: "power2.out" });
    const move = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      x(((e.clientX - r.left - r.width / 2) / r.width) * 18);
      y(((e.clientY - r.top - r.height / 2) / r.height) * 10);
    };
    const reset = () => {
      x(0);
      y(0);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", reset);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", reset);
      x.tween.kill();
      y.tween.kill();
      gsap.set(layer, { clearProps: "transform" });
    };
  }, [active, reduced]);
  useEffect(() => setOffset(0), [state.track?.id]);
  if (!state.track) return null;
  return (
    <m.div
      ref={root}
      className={`${s.immersive} ${performanceMode ? s.performance : ""}`}
      data-lyric-mode={!reduced && state.lyrics?.lines.length ? mode : "scroll"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.3 }}
      aria-label="沉浸歌词"
    >
      <img
        className={s.sceneFar}
        data-scene-far
        src={
          host.theme() === "light"
            ? "/assets/img/music/day-depth.webp"
            : "/assets/img/music/tide-depth.webp"
        }
        alt=""
        draggable={false}
      />
      <div className={s.sceneVeil} />
      <div className={s.sceneGlow} data-scene-glow />
      <img
        className={s.sceneFront}
        data-scene-front
        src={
          host.theme() === "light"
            ? "/assets/img/music/day-foreground.webp"
            : "/assets/img/music/tide-foreground.webp"
        }
        alt=""
        draggable={false}
      />
      <div className={s.immersiveTop}>
        <button type="button" className={s.textButton} onClick={onClose}>
          <Icon name="back" size={17} />
          回到听潮
        </button>
        <span className={s.eyebrow}>LET THE MUSIC FIND YOU</span>
        <div className={s.lyricTools}>
          <div className={s.lyricModes} role="group" aria-label="歌词呈现方式">
            {([['scroll', '随行'], ['performance', '演出'], ['tilt', '错落']] as const).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={mode === value}
                title={value === "performance" ? "潮汐演出 · Folia Sonnet" : value === "tilt" ? "错落排字 · Folia Tilt" : "随行逐字歌词"}
                onClick={() => { setMode(value); writeStored("tingchao.lyric-mode", value); }}>
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${s.translationToggle} ${translation ? s.toggleActive : ""}`}
            onClick={() => setTranslation((v) => !v)}
            aria-pressed={translation}
            title="显示或隐藏歌词翻译"
          >
            译
          </button>
          <label className={s.offsetSelect} title="调整歌词时间">
            <span>歌词</span>
            <select
              value={offset}
              aria-label="歌词时间偏移"
              onChange={(event) => setOffset(Number(event.currentTarget.value))}
            >
              <option value={-3000}>提前 3 秒</option>
              <option value={-2000}>提前 2 秒</option>
              <option value={-1000}>提前 1 秒</option>
              <option value={0}>同步</option>
              <option value={1000}>延后 1 秒</option>
              <option value={2000}>延后 2 秒</option>
              <option value={3000}>延后 3 秒</option>
            </select>
          </label>
        </div>
      </div>
      <div className={s.immersiveContent}>
        <section className={s.albumStage}>
          <div className={s.albumHalo} />
          <div className={s.albumArtwork} ref={art}>
            <Cover
              src={state.track.coverUrl}
              className={s.immersiveCover}
              eager
            />
            <span className={s.albumCorner} />
          </div>
          <div className={s.immersiveIdentity}>
            <span className={s.eyebrow}>NOW PLAYING / 此刻正在听</span>
            <h1>{state.track.title}</h1>
            <p>{state.track.artists.map((x) => x.name).join(" / ")}</p>
            <span className={s.albumSubtitle}>{state.track.album.title}</span>
            <button
              type="button"
              className={`${s.immersiveLike} ${liked ? s.immersiveLiked : ""}`}
              onClick={() => onLike(state.track!)}
              aria-label={liked ? "取消喜欢" : "喜欢这首歌"}
              aria-pressed={liked}
            >
              <Icon name="heart" size={17} />
              {liked ? "已留在喜欢里" : "把这一刻，留在喜欢里"}
            </button>
          </div>
        </section>
        <div className={s.lyricStage} data-lyric-stage>
          {mode === "tilt" && !reduced && state.lyrics?.lines.length ? (
            <Suspense fallback={fallback}><TiltStage runtime={runtime} translation={translation} offset={offset} active={active} appearance={host.theme()} fallback={fallback} /></Suspense>
          ) : performanceMode ? (
            <Suspense fallback={fallback}>
              <FoliaStage runtime={runtime} translation={translation} offset={offset}
                active={active} appearance={host.theme()} fallback={fallback} />
            </Suspense>
          ) : fallback}
        </div>
      </div>
      <div className={s.immersiveFoot}>
        <span className={s.tideLine} />
        <span>{mode !== "scroll" && reduced ? "已按减少动态效果使用随行歌词" : "声音抵达的地方，自有回响。"}</span>
        <span className={s.tideLine} />
        <details className={s.lyricCredits}>
          <summary>歌词引擎</summary>
          <div>
            <strong>潮汐演出 / 错落排字 × Folia Sonnet / Tilt</strong>
            <p>Folia contributors · AGPL-3.0。听潮适配昼夜主题、播放时钟与窗口生命周期。</p>
            <a href="https://github.com/chthollyphile/folia-major/tree/1f73b512e27ea640a045451c8af7ef2082264788" target="_blank" rel="noreferrer">上游源码与许可</a>
            <span>听潮对应源码：studentop-site / apps/aidenos-music；许可见仓库 LICENSE。</span>
          </div>
        </details>
      </div>
    </m.div>
  );
}
function LyricScroll({
  runtime,
  translation,
  offset,
  reduced,
  active,
}: {
  runtime: MusicRuntime;
  translation: boolean;
  offset: number;
  reduced: boolean;
  active: boolean;
}) {
  const state = usePlayback(
      runtime,
      (v) => ({
        lyrics: v.lyrics,
        position: v.positionMs,
        status: v.status,
        duration: v.durationMs,
      }),
      shallowEqual,
      active,
    ),
    [displayPosition, setDisplayPosition] = useState(state.position),
    position = displayPosition - offset;
  useEffect(() => {
    if (!active) return;
    setDisplayPosition(state.position);
    if (reduced || state.status !== "playing") return;
    const anchor = performance.now();
    let frame = 0,
      last = 0;
    const tick = (time: number) => {
      const elapsed = time - anchor;
      if (time - last >= 30) {
        setDisplayPosition(
          Math.min(
            state.duration || Infinity,
            state.position + Math.min(450, elapsed),
          ),
        );
        last = time;
      }
      if (elapsed < 450) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.position, state.status, state.duration, active, reduced]);
  const lines = state.lyrics?.lines || [],
    index = currentLine(lines, position),
    scroll = useRef<HTMLDivElement>(null),
    manualTimer = useRef<number | undefined>(undefined),
    [manual, setManual] = useState(false);
  const follow = () => {
    if (!active) return;
    setManual(false);
    clearTimeout(manualTimer.current);
    manualTimer.current = undefined;
    const node = scroll.current?.querySelector<HTMLElement>(
      "[data-current-lyric]",
    );
    if (node && scroll.current) {
      const top =
        node.offsetTop -
        scroll.current.clientHeight * 0.43 +
        node.clientHeight / 2;
      scroll.current.scrollTo({
        top: Math.max(0, top),
        behavior: reduced ? "instant" : "smooth",
      });
    }
  };
  useEffect(() => {
    if (!active || manual) return;
    const timer = requestAnimationFrame(() => {
      const node = scroll.current?.querySelector<HTMLElement>(
        "[data-current-lyric]",
      );
      if (node && scroll.current)
        scroll.current.scrollTo({
          top: Math.max(
            0,
            node.offsetTop -
              scroll.current.clientHeight * 0.43 +
              node.clientHeight / 2,
          ),
          behavior: reduced ? "instant" : "smooth",
        });
    });
    return () => cancelAnimationFrame(timer);
  }, [index, manual, reduced, active]);
  useEffect(() => {
    if (!active) {
      setManual(false);
      const node = scroll.current;
      if (node) node.scrollTo({ top: node.scrollTop, behavior: "instant" });
    }
    return () => {
      clearTimeout(manualTimer.current);
      manualTimer.current = undefined;
    };
  }, [active]);
  const takeOver = () => {
    if (!active) return;
    setManual(true);
    clearTimeout(manualTimer.current);
    manualTimer.current = window.setTimeout(() => {
      manualTimer.current = undefined;
      setManual(false);
    }, 6500);
  };
  if (!state.lyrics)
    return (
      <div className={s.noLyrics}>
        <span className={s.lyricWaiting}>···</span>
        <h2>
          {state.status === "loading" ? "正在接近这段旋律" : "歌词正在路上"}
        </h2>
        <p>先让声音慢慢展开。</p>
      </div>
    );
  if (state.lyrics.instrumental || !lines.length)
    return (
      <div className={s.noLyrics}>
        <Icon name="headphones" size={38} />
        <span className={s.eyebrow}>A MOMENT WITHOUT WORDS</span>
        <h2>
          {state.lyrics.instrumental
            ? "此刻，让旋律说话"
            : "有些心绪，不必写成文字"}
        </h2>
        <p>
          {state.lyrics.instrumental
            ? "纯音乐，请欣赏。"
            : "这首歌暂时没有可用歌词。"}
        </p>
        <div className={s.noLyricsWaves}>
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  return (
    <>
      <div
        className={s.lyricScroll}
        ref={scroll}
        onWheel={takeOver}
        onTouchStart={takeOver}
        aria-label="歌词，点击行可跳转播放"
      >
        <div className={s.lyricSpacer} />
        {lines.map((line, lineIndex) => (
          <TimedLine
            key={line.id}
            line={line}
            active={lineIndex === index}
            past={lineIndex < index}
            position={
              lineIndex === index
                ? position
                : lineIndex < index
                  ? Infinity
                  : -Infinity
            }
            translation={translation}
            seekOffset={offset}
            onSeek={() => {
              runtime.seek(Math.max(0, line.startMs + offset));
              setManual(false);
            }}
          />
        ))}
        <div className={s.lyricSpacer} />
      </div>
      {manual && (
        <button type="button" className={s.backToLyric} onClick={follow}>
          <Icon name="clock" size={14} />
          回到当前播放
        </button>
      )}
    </>
  );
}
const TimedLine = memo(
  function TimedLine({
    line,
    active,
    past,
    position,
    translation,
    onSeek,
  }: {
    line: LyricLine;
    active: boolean;
    past: boolean;
    position: number;
    translation: boolean;
    seekOffset: number;
    onSeek: () => void;
  }) {
    return (
      <button
        type="button"
        className={`${s.lyricLine} ${active ? s.lyricActive : ""} ${past ? s.lyricPast : ""}`}
        onClick={onSeek}
        data-current-lyric={active ? "true" : undefined}
        title={`跳到 ${formatTime(line.startMs)}`}
        aria-current={active ? "true" : undefined}
      >
        <span className={s.lyricOriginal}>
          {line.words.length
            ? line.words.map((word, index) => {
                const progress =
                  word.durationMs > 0
                    ? Math.max(
                        0,
                        Math.min(
                          1,
                          (position - word.startMs) / word.durationMs,
                        ),
                      )
                    : position >= word.startMs
                      ? 1
                      : 0;
                return (
                  <span
                    key={`${word.startMs}-${index}`}
                    className={active ? s.lyricWord : undefined}
                    style={
                      active
                        ? ({
                            "--word-fill": `${progress * 100}%`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {word.text}
                  </span>
                );
              })
            : line.text || "♪"}
        </span>
        {translation && line.translation && (
          <span className={s.lyricTranslation}>{line.translation}</span>
        )}
        {translation && line.romanization && (
          <span className={s.lyricRomanization}>{line.romanization}</span>
        )}
      </button>
    );
  },
  (before, after) =>
    before.line === after.line &&
    before.active === after.active &&
    before.past === after.past &&
    before.position === after.position &&
    before.translation === after.translation &&
    before.seekOffset === after.seekOffset,
);
