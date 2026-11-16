import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { m, useReducedMotionConfig } from "motion/react";
import type { PlaybackSource, Quality } from "../domain";
import { PlaybackVisibilityContext, useDocumentVisible, formatTime } from "./hooks";
import { Icon } from "./icons";
import s from "./QualityMenu.module.css";

const OPTIONS: { value: Quality; label: string; note: string; initials: string }[] = [
  { value: "standard", label: "标准", note: "轻松听，少一些流量", initials: "SQ" },
  { value: "higher", label: "较高", note: "请求更高码率音源", initials: "HQ" },
  { value: "exhigh", label: "极高", note: "优先请求高码率音源", initials: "HQ+" },
  { value: "lossless", label: "无损", note: "尝试获取可用的无损音源", initials: "LS" },
];

export function qualityName(value: Quality) {
  return OPTIONS.find((option) => option.value === value)!.label;
}

export function qualitySummary(requested: Quality, source: PlaybackSource | null) {
  const request = `请求音质：${qualityName(requested)}`;
  if (!source) return request;
  const actual = `实际音质：${qualityName(source.quality)}`;
  return `${source.quality === requested ? actual : `${request}；${actual}`}${source.availability === "preview" ? "；当前为试听片段" : ""}`;
}

export function QualityMenu({
  requested,
  source,
  onChange,
  onOpenChange,
}: {
  requested: Quality;
  source: PlaybackSource | null;
  onChange: (quality: Quality) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const inheritedActive = useContext(PlaybackVisibilityContext);
  const documentVisible = useDocumentVisible();
  const reduced = useReducedMotionConfig();
  const active = inheritedActive && documentVisible;
  const [open, setOpen] = useState(false);
  const notifyOpen = useRef(onOpenChange); notifyOpen.current = onOpenChange;
  useEffect(() => { notifyOpen.current?.(open); return () => notifyOpen.current?.(false); }, [open]);
  const [focused, setFocused] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const mismatch = !!source && source.quality !== requested;
  const summary = qualitySummary(requested, source);
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };
  const show = (last = false) => {
    if (!active) return;
    setFocused(last ? OPTIONS.length - 1 : OPTIONS.findIndex((option) => option.value === requested));
    setOpen(true);
  };
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  useLayoutEffect(() => {
    if (!open || !active) return;
    const measure = () => {
      const node = root.current;
      if (!node) return;
      const anchor = node.getBoundingClientRect();
      const bounds = node.closest("[data-tingchao-root]")?.getBoundingClientRect() || {
        left: 0, right: window.innerWidth, top: 0, width: window.innerWidth,
      };
      const width = Math.min(286, Math.max(220, bounds.width - 24));
      const left = Math.max(bounds.left + 12, Math.min(anchor.right - width, bounds.right - width - 12));
      setMenuStyle({ width, right: anchor.right - left - width, maxHeight: Math.max(140, anchor.top - bounds.top - 12) });
    };
    measure();
    const node = root.current?.closest("[data-tingchao-root]");
    const observer = new ResizeObserver(measure);
    if (node) observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, active]);
  useEffect(() => {
    if (open && active) buttons.current[focused]?.focus({ preventScroll: true });
  }, [open, focused, active]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  const navigate = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      // Forward Tab naturally reaches volume/queue and closes on blur. Backward
      // Tab returns to the trigger without leaving focus on an unmounted option.
      if (event.shiftKey) {
        event.preventDefault();
        close(true);
      }
    }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setFocused((current) => event.key === "Home" ? 0 : event.key === "End" ? OPTIONS.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + OPTIONS.length) % OPTIONS.length);
    }
  };
  return <div className={s.root} ref={root} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close();
  }}>
    <button ref={trigger} className={`${s.trigger} ${open ? s.triggerOpen : ""}`} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`播放音质，${summary}`} title={summary} onClick={() => open ? close() : show()} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        show(event.key === "ArrowUp");
      }
    }}><span>{qualityName(requested)}</span>{mismatch && <i className={s.actualDot} aria-hidden="true" />}<Icon name="chevron" size={11} /></button>
    {mismatch && <small className={s.actualHint}>实际 {qualityName(source!.quality)}</small>}
    {open && active && <m.div className={s.popover} style={menuStyle} initial={reduced ? false : { opacity: 0, y: 9, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}>
      <header className={s.heading}><span className={s.eyebrow}>THE WAY YOU LISTEN</span><strong>听得更合心意</strong><div className={s.current}><span className={source ? s.currentAvailable : ""}>{source ? `本次实际 · ${qualityName(source.quality)}` : "播放后显示实际音质"}</span>{source?.availability === "preview" && <span className={s.preview}>试听片段</span>}</div>{source?.preview && <small className={s.previewRange}>可播放 {formatTime(source.preview.startMs)} — {formatTime(source.preview.endMs)}</small>}</header>
      <div id={id} role="menu" aria-label="选择请求播放音质" onKeyDown={navigate} className={s.options}>
        {OPTIONS.map((option, index) => <button key={option.value} type="button" role="menuitemradio" aria-checked={requested === option.value} tabIndex={index === focused ? 0 : -1} ref={(element) => { buttons.current[index] = element; }} className={`${s.option} ${requested === option.value ? s.optionSelected : ""}`} onFocus={() => setFocused(index)} onClick={() => {
          onChange(option.value);
          close(true);
        }}><span className={s.optionMark}>{option.initials}</span><span className={s.optionCopy}><strong>{option.label}{source?.quality === option.value && <small>实际</small>}</strong><span>{option.note}</span></span><span className={s.check}>{requested === option.value && <Icon name="check" size={16} />}</span></button>)}
      </div>
      <footer className={s.footnote}>以上选择为请求音质。实际音质与试听范围<br />以上游返回和当前账号可用内容为准。</footer>
    </m.div>}
  </div>;
}
