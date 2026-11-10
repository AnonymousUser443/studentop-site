import { useEffect, useRef } from "react";

/**
 * <DataRain> — 数据雨
 * ------------------------------------------------------------
 * P5 全章的背景层。120 个 1px 的点自上而下以不同速度坠落，
 * 极淡（0.15–0.4）。它不制造"科技感"，它制造"没有地面的失重感"。
 *
 * 用 Canvas 2D 而不是 DOM：120 个常驻 DOM 元素每帧改 style 会掉帧。
 */
export function DataRain({
  count = 120,
  zIndex = 1,
  opacity = 1,
  speed = [8, 26],
  gold = 0.0,
}: {
  count?: number;
  zIndex?: number;
  opacity?: number;
  speed?: [number, number];
  /** 金色点的比例 0–1 */
  gold?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1920;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    type P = { x: number; y: number; v: number; a: number; len: number; gold: boolean };
    const pts: P[] = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      v: speed[0] + Math.random() * (speed[1] - speed[0]),
      a: 0.15 + Math.random() * 0.25,
      len: Math.random() < 0.18 ? 14 + Math.random() * 26 : 1,
      gold: Math.random() < gold,
    }));

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, W, H);

      for (const p of pts) {
        p.y += p.v * dt;
        if (p.y > H + 40) {
          p.y = -40;
          p.x = Math.random() * W;
        }

        if (p.len > 1) {
          // 拉丝：竖向的短光条
          const g = ctx.createLinearGradient(p.x, p.y - p.len, p.x, p.y);
          g.addColorStop(0, "rgba(184,147,76,0)");
          g.addColorStop(1, `rgba(226,195,128,${p.a * 0.55})`);
          ctx.fillStyle = g;
          ctx.fillRect(p.x, p.y - p.len, 1, p.len);
        } else {
          ctx.fillStyle = p.gold
            ? `rgba(227,200,142,${p.a})`
            : `rgba(249,231,185,${p.a})`;
          ctx.fillRect(p.x, p.y, 1, 1);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [count, speed, gold]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: 1920,
        height: 1080,
        opacity,
        zIndex,
        pointerEvents: "none",
      }}
    />
  );
}
