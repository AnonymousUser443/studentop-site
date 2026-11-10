import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * <ChapterGlow> — 章节光晕
 * ------------------------------------------------------------
 * 全片只有这一种"背景色"。颜色不出现在文字上，只出现在光里。
 * 光的位置与方向，定义了每一章的性格（见 02 §2.5）。
 */
export function ChapterGlow({
  color = "#c7a361",
  x = 960,
  y = 520,
  radius = 700,
  opacity = 0.14,
  delay = 0,
  direction = "center",
}: {
  color?: string;
  x?: number;
  y?: number;
  radius?: number;
  opacity?: number;
  delay?: number;
  direction?: "center" | "top" | "bottom" | "left-bottom" | "horizon";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.6 },
        { opacity, scale: 1, duration: 2.4, delay, ease: "power2.out" }
      );
      // 呼吸
      gsap.to(el, {
        opacity: opacity * 1.18,
        duration: 8,
        delay: delay + 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, el);
    return () => ctx.revert();
  }, [opacity, delay]);

  if (direction === "horizon") {
    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y,
          height: radius * 0.5,
          background: `linear-gradient(180deg, ${color}00 0%, ${color} 45%, ${color}00 100%)`,
          opacity: 0,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <div
      ref={ref}
      className="glow"
      style={{
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        background: `radial-gradient(circle at center, ${color} 0%, ${color}66 32%, transparent 68%)`,
        opacity: 0,
      }}
    />
  );
}

/**
 * <Vignette> / <Grain> / <Scanlines> — 全局材质层
 * 注意：这三层必须在内容之上（z-index 55-60），
 * 否则"这是一张纸上的画面"的感觉会丢掉。
 */
export function Grain() {
  return (
    <div
      className="layer grain"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E\")",
        backgroundSize: "300px 300px",
      }}
    />
  );
}

export function Vignette() {
  return <div className="layer vignette" />;
}

export function Scanlines({ opacity = 0.35 }: { opacity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.to(el, { opacity, duration: 0.8, delay: 0.4, ease: "power2.out" });
    }, el);
    return () => ctx.revert();
  }, [opacity]);
  return <div ref={ref} className="layer scanlines" />;
}
