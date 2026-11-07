import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { EASE } from "../lib/useTimeline";

/**
 * <Reveal> — 遮罩揭示
 * ------------------------------------------------------------
 * 本片的主入场方式（占比 60%）。文字本身不动，
 * 而是从遮罩下方向上滑入，露出字形。
 *
 * 为什么不用 opacity：淡入会让字"变模糊"，遮罩揭示让字"落定"。
 */

type Variant = "up" | "horizontal" | "vertical" | "ink";

interface RevealProps {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  variant?: Variant;
  delay?: number;
  duration?: number;
  /** 逐行间隔（秒） */
  stagger?: number;
  /** 是否拆分内部的 <br> 行 */
  splitLines?: boolean;
}

export function Reveal({
  children,
  as = "div",
  className = "",
  style,
  variant = "up",
  delay = 0,
  duration = 0.72,
  stagger = 0,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const inner = el.querySelectorAll<HTMLElement>("[data-reveal-inner]");
      if (!inner.length) return;

      const tl = gsap.timeline({ delay });

      if (variant === "up") {
        gsap.set(inner, { yPercent: 105 });
        tl.to(inner, {
          yPercent: 0,
          duration,
          ease: EASE.enter,
          stagger: stagger || 0,
        });
      } else if (variant === "horizontal") {
        gsap.set(el, { clipPath: "inset(0 100% 0 0)" });
        gsap.set(inner, { x: -24, opacity: 0 });
        tl.to(el, { clipPath: "inset(0 0% 0 0)", duration, ease: EASE.enter })
          .to(inner, { x: 0, opacity: 1, duration: 0.9, ease: EASE.soft }, 0.1);
      } else if (variant === "vertical") {
        gsap.set(el, { clipPath: "inset(50% 0 50% 0)" });
        gsap.set(inner, { scaleY: 1.06, opacity: 0 });
        tl.to(el, { clipPath: "inset(0% 0 0% 0)", duration, ease: EASE.ritual })
          .to(inner, { scaleY: 1, opacity: 1, duration: duration * 0.9, ease: EASE.soft }, 0.15);
      } else {
        // ink：墨迹浮现（古诗、书法感文字）
        gsap.set(inner, { filter: "blur(10px)", opacity: 0 });
        tl.to(inner, {
          filter: "blur(0px)",
          opacity: 1,
          duration: duration + 0.2,
          ease: EASE.soft,
          stagger: stagger || 0.13,
        });
      }
    }, el);

    return () => ctx.revert();
  }, [variant, delay, duration, stagger]);

  const Tag = as as any;

  return (
    <Tag
      ref={ref as any}
      className={`reveal ${className}`}
      style={{ clipPath: variant === "horizontal" ? "inset(0 100% 0 0)" : undefined, ...style }}
    >
      <span data-reveal-inner style={{ display: "block", clipPath: "none" }}>
        {children}
      </span>
    </Tag>
  );
}

/**
 * 多行遮罩揭示：把文字按行拆开，每行一个 <Reveal>
 */
export function RevealLines({
  lines,
  className = "",
  style,
  lineStyle,
  delay = 0,
  duration = 0.72,
  stagger = 0.09,
  align = "left",
}: {
  lines: (string | React.ReactNode)[];
  className?: string;
  style?: React.CSSProperties;
  lineStyle?: React.CSSProperties;
  delay?: number;
  duration?: number;
  stagger?: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <div className={className} style={{ textAlign: align, ...style }}>
      {lines.map((line, i) => (
        <Reveal
          key={i}
          delay={delay + i * stagger}
          duration={duration}
          style={{ display: "block", ...lineStyle }}
        >
          {line}
        </Reveal>
      ))}
    </div>
  );
}
