import { useEffect, useRef } from "react";
import gsap from "gsap";
import { EASE } from "../lib/useTimeline";
import { sealStamp } from "../lib/audio";

/**
 * <Seal> — 朱砂印
 * ------------------------------------------------------------
 * 这是全片的叙事骨架。做假的地方主要在三点：
 *  1. 边缘不能是直的      → feTurbulence 位移
 *  2. 印泥不能是均匀的    → mask 白斑（缺墨）
 *  3. 角度不能是正的      → 每章不同的旋转
 */

let uid = 0;

interface SealProps {
  text: string;
  sub?: string;
  /** 旋转角度（度） */
  angle?: number;
  size?: number;
  opacity?: number;
  x?: number;
  y?: number;
  /** 自动播放钤印动画 */
  animate?: boolean;
  delay?: number;
  /** 盖歪的版本（P5-18 用） */
  crooked?: boolean;
  onDone?: () => void;
}

export function Seal({
  text,
  sub,
  angle = 1.8,
  size = 230,
  opacity = 1,
  x = 1560,
  y = 760,
  animate = true,
  delay = 0,
  crooked = false,
  onDone,
}: SealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`seal-${uid++}`);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay, onComplete: onDone });

      if (!animate) {
        gsap.set(el, { opacity, rotate: angle });
        return;
      }

      // 从画外飞入 → 触地 → 回弹（crooked 时直砸、无回弹）
      gsap.set(el, { opacity: 0, scale: 1.35, rotate: angle + (crooked ? 14 : 6), x: 60, y: -40 });

      tl.to(el, { opacity, duration: 0.2, ease: "power2.out" }, 0)
        .to(el, { scale: 0.96, rotate: angle, x: 0, y: 0, duration: 0.26, ease: crooked ? "power4.in" : "power3.in" }, 0)
        .call(() => sealStamp(crooked ? 0.45 : 0.32))
        // 冲击波
        .fromTo(
          `.${id.current}-ring`,
          { scale: 0.9, opacity: 0.55 },
          { scale: 2.3, opacity: 0, duration: 0.6, ease: "power2.out" },
          0.26
        )
        // 震动
        .to(el, { x: 2.5, duration: 0.05, repeat: 3, yoyo: true, ease: "none" }, 0.26);

      if (!crooked) {
        tl.to(el, { scale: 1, duration: 0.24, ease: EASE.back }, 0.34);
      }
      // 印面文字：从模糊到清晰
      tl.fromTo(
        `.${id.current}-text`,
        { filter: "blur(6px)", opacity: 0.2 },
        { filter: "blur(0px)", opacity: 1, duration: 0.3, ease: "power2.out" },
        0.3
      );
    }, el);

    return () => ctx.revert();
  }, [animate, angle, opacity, delay, crooked, onDone]);

  const w = size;
  const h = size * (sub ? 1.16 : 1);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: 0,
        transformOrigin: "50% 60%",
        pointerEvents: "none",
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id={`${id.current}-rough`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed={uid} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5.5" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
          {/* 缺墨：用噪声生成白斑遮罩 */}
          <mask id={`${id.current}-ink`}>
            <rect width="100%" height="100%" fill="white" />
            <circle cx="22%" cy="26%" r="9" fill="black" opacity="0.55" />
            <circle cx="74%" cy="18%" r="6" fill="black" opacity="0.4" />
            <circle cx="82%" cy="72%" r="11" fill="black" opacity="0.45" />
            <circle cx="34%" cy="78%" r="7" fill="black" opacity="0.35" />
            <rect x="40%" y="0" width="6%" height="100%" fill="black" opacity="0.18" />
          </mask>
        </defs>
      </svg>

      {/* 冲击波 */}
      <div
        className={`${id.current}-ring`}
        style={{
          position: "absolute",
          inset: -6,
          border: "1px solid var(--cinnabar-300)",
          opacity: 0,
          borderRadius: 2,
        }}
      />

      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <g filter={`url(#${id.current}-rough)`} mask={`url(#${id.current}-ink)`}>
          <rect width={w} height={h} fill="var(--cinnabar-400)" />
          <rect width={w} height={h} fill="url(#paperTex)" opacity="0.18" style={{ mixBlendMode: "multiply" }} />
          {/* 边框：外粗内细，模拟石章 */}
          <rect x="8" y="8" width={w - 16} height={h - 16} fill="none" stroke="rgba(255,240,225,0.55)" strokeWidth="2.5" opacity="0.5" />
        </g>
      </svg>

      {/* 印面文字 */}
      <div
        className={`${id.current}-text`}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: h * 0.02,
          padding: "12%",
        }}
      >
        <SealText text={text} w={w} h={h} />
      </div>

      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <pattern id="paperTex" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#000" opacity="0.06" />
            <circle cx="10" cy="12" r="1" fill="#fff" opacity="0.35" />
            <circle cx="27" cy="31" r="0.8" fill="#fff" opacity="0.28" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}

/**
 * 印面文字版式
 * ------------------------------------------------------------
 * 中文印章是竖排、自右向左。四字以内一列，更多则分两列。
 * 字号必须随字数自适应，否则会溢出印面（七个字的印尤其致命）。
 */
function SealText({ text, w, h }: { text: string; w: number; h: number }) {
  const chars = Array.from(text);
  const n = chars.length;
  const cols = n <= 4 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const fontSize = Math.min((w * 0.76) / rows, (h * 0.76) / cols, w * 0.36);

  // 自右向左分列
  const columns: string[][] = [];
  for (let c = 0; c < cols; c++) {
    columns.push(chars.slice(c * rows, c * rows + rows));
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "center",
        gap: fontSize * 0.12,
        padding: "11%",
      }}
    >
      {columns.map((col, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: fontSize * 0.08,
          }}
        >
          {col.map((ch, j) => (
            <span
              key={j}
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize,
                lineHeight: 1,
                color: "#f4e8dc",
                textShadow: "0 0 1px rgba(0,0,0,0.35)",
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
