import { useEffect, useRef, useState, useId } from "react";
import gsap from "gsap";
import { EASE } from "../lib/useTimeline";
import { ensureFonts } from "../lib/fonts";

/**
 * <AttentionWeb> — P5-07 注意力机制（峰值页）
 * ------------------------------------------------------------
 * 这一页的胜负手是"线宽 = 注意力权重"。
 * 四条弧线，粗细分别是 8 / 6 / 2 / 1，
 * 观众一眼就能"看见"权重——不需要任何文字解释。
 *
 * 三个细节，缺一个就掉价：
 *  1. 弧线用贝塞尔，不是圆弧
 *  2. 描边用渐变（起点紫 → 终点金）
 *  3. 经过的背景网格点会被"点亮"（衰减有延迟）
 */

const NODES = [
  { label: "我", x: 360 },
  { label: "是", x: 596 },
  { label: "山里", x: 832 },
  { label: "灵活", x: 1068 },
  { label: "的", x: 1304 },
  { label: "狗", x: 1540 },
];

const NODE_Y = 380;
const TARGET = { x: 960, y: 760, label: "神里绫华" };

/** 注意力权重：来源索引 → 线宽 */
const ARCS = [
  { from: 2, w: 8, label: "强关联" },
  { from: 3, w: 6, label: "强关联" },
  { from: 5, w: 2, label: "弱关联" },
  { from: 0, w: 1, label: "极弱" },
];

export function AttentionWeb({ onDone }: { onDone?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [ready, setReady] = useState(false);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;
    ensureFonts(["我", "是", "山里", "灵活", "的", "狗", "神里绫华"]).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- 网格点阵 ----------
  useEffect(() => {
    if (!ready) return;
    const canvas = gridRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1920;
    const H = 1080;
    const GAP = 30;
    canvas.width = W;
    canvas.height = H;

    const cols = Math.ceil(W / GAP) + 1;
    const rows = Math.ceil(H / GAP) + 1;
    const heat = new Float32Array(cols * rows);

    // 弧线采样点（用于点亮网格）
    const arcPoints: { x: number; y: number }[] = [];
    pathRefs.current.forEach((p) => {
      if (!p) return;
      try {
        const len = p.getTotalLength();
        const n = 90;
        for (let i = 0; i <= n; i++) {
          const pt = p.getPointAtLength((len * i) / n);
          arcPoints.push({ x: pt.x, y: pt.y });
        }
      } catch {
        /* 路径尚未挂载 */
      }
    });

    let raf = 0;

    const draw = () => {
      // 热度衰减
      for (let i = 0; i < heat.length; i++) heat[i] *= 0.93;

      // 弧线附近点亮
      for (const p of arcPoints) {
        const gx = Math.round(p.x / GAP);
        const gy = Math.round(p.y / GAP);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ix = gx + dx;
            const iy = gy + dy;
            if (ix < 0 || iy < 0 || ix >= cols || iy >= rows) continue;
            const d = Math.hypot(dx, dy);
            const v = Math.max(0, 1 - d * 0.55) * 0.5;
            const k = iy * cols + ix;
            if (heat[k] < v) heat[k] = v;
          }
        }
      }

      ctx.clearRect(0, 0, W, H);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const h = heat[y * cols + x];
          if (h < 0.02) {
            ctx.fillStyle = "rgba(31, 42, 38, 0.85)";
          } else {
            const a = Math.min(1, h);
            ctx.fillStyle = `rgba(${138 + 90 * a}, ${120 + 80 * a}, ${184 + 40 * a}, ${Math.min(1, 0.35 + a)})`;
          }
          ctx.fillRect(x * GAP, y * GAP, 1.4, 1.4);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, uid]);

  // ---------- 主时间轴 ----------
  useEffect(() => {
    if (!ready) return;
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: onDone });

      // 1. 六个节点依次出现
      gsap.set(".aw-node", { scale: 0, opacity: 0 });
      gsap.set(".aw-node-label", { opacity: 0, y: 8 });
      tl.to(".aw-node", {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        stagger: 0.08,
        ease: EASE.back,
      });
      tl.to(
        ".aw-node-label",
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: EASE.soft },
        0.3
      );

      // 2. 目标节点从下方升起
      gsap.set(".aw-target", { y: 70, opacity: 0 });
      gsap.set(".aw-target-label", { opacity: 0 });
      tl.to(".aw-target", { y: 0, opacity: 1, duration: 0.85, ease: EASE.enter }, 0.9);
      tl.to(".aw-target-label", { opacity: 1, duration: 0.6, ease: EASE.soft }, 1.2);

      // 3. 四条弧线依次生长（由粗到细，体现权重递减）
      pathRefs.current.forEach((path, i) => {
        if (!path) return;
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
        tl.to(
          path,
          { opacity: 1, duration: 0.2 },
          1.6 + i * 0.45
        );
        tl.to(
          path,
          { strokeDashoffset: 0, duration: 0.75, ease: "power2.inOut" },
          1.62 + i * 0.45
        );
      });

      // 4. 权重标注
      tl.fromTo(
        ".aw-weight",
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.18, ease: EASE.soft },
        2.6
      );

      // 5. 弧线呼吸（线宽只是轻微变化，不能跳）
      tl.to(
        ".aw-arc",
        {
          attr: { "stroke-width": (i: number) => ARCS[i].w + 0.6 },
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.3,
        },
        3.4
      );
    }, root);

    return () => ctx.revert();
  }, [ready, onDone]);

  // 弧线路径生成：二次贝塞尔，控制点在两者中间偏下
  const arcPath = (fromIdx: number) => {
    const a = NODES[fromIdx];
    const bx = a.x;
    const by = NODE_Y + 22;
    const ex = TARGET.x;
    const ey = TARGET.y - 30;
    const mx = (bx + ex) / 2;
    const my = (by + ey) / 2 + 120; // 向下弯的深度
    return `M ${bx} ${by} Q ${mx} ${my} ${ex} ${ey}`;
  };

  return (
    <div ref={rootRef} style={{ position: "absolute", inset: 0 }}>
      {/* 网格 */}
      <canvas
        ref={gridRef}
        style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none", zIndex: 0 }}
      />

      {/* 弧线 */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "visible" }}
      >
        <defs>
          {ARCS.map((_, i) => (
            <linearGradient
              key={i}
              id={`${uid}-g${i}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor="#dcba70" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#f2d79a" stopOpacity="1" />
              <stop offset="100%" stopColor="#e3c88e" stopOpacity="0.85" />
            </linearGradient>
          ))}
        </defs>
        {ARCS.map((a, i) => (
          <path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            className="aw-arc"
            d={arcPath(a.from)}
            fill="none"
            stroke={`url(#${uid}-g${i})`}
            strokeWidth={a.w}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(218,182,107,0.55))" }}
          />
        ))}
      </svg>

      {/* 六个节点 */}
      {NODES.map((n, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: n.x,
            top: NODE_Y,
            transform: "translate(-50%, -50%)",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            className="aw-node"
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "#eccf8d",
              boxShadow: "0 0 18px 4px rgba(201,162,84,0.55)",
            }}
          />
          <div
            className="aw-node-label"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 26,
              color: "var(--paper-200)",
              whiteSpace: "nowrap",
            }}
          >
            {n.label}
          </div>
        </div>
      ))}

      {/* 目标节点 */}
      <div
        className="aw-target"
        style={{
          position: "absolute",
          left: TARGET.x,
          top: TARGET.y,
          transform: "translate(-50%, -50%)",
          zIndex: 4,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "radial-gradient(circle, #f6e4bc 0%, #c9a961 60%, transparent 72%)",
          boxShadow: "0 0 40px 10px rgba(227,200,142,0.4)",
        }}
      />
      <div
        className="aw-target-label"
        style={{
          position: "absolute",
          left: TARGET.x,
          top: TARGET.y + 34,
          transform: "translateX(-50%)",
          zIndex: 4,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: "0.06em",
          color: "var(--gold-100)",
          whiteSpace: "nowrap",
          textShadow: "0 0 24px rgba(227,200,142,0.5)",
        }}
      >
        神里绫华
      </div>

      {/* 权重标注：放在弧线起点下方，小字 */}
      <div style={{ position: "absolute", left: 120, top: 880, zIndex: 5, display: "flex", gap: 44 }}>
        {ARCS.map((a, i) => (
          <div key={i} className="aw-weight" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "block",
                width: 26,
                height: Math.max(1.5, a.w),
                background: "linear-gradient(90deg, #dcba70, #e3c88e)",
                borderRadius: 4,
              }}
            />
            <span
              className="mono"
              style={{ fontSize: 13, letterSpacing: "0.2em", color: "var(--ash-400)" }}
            >
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
