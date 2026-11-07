import { useEffect, useRef, useState } from "react";

import * as THREE from "three";
import { ensureFonts, sampleText, toWorld, textCanvasSize, FONT_DISPLAY } from "../lib/fonts";


/**
 * <PointText> — 点云成字
 * ------------------------------------------------------------
 * 把一段文字采样成 N 个点，这些点从画面各处飞向字形位置。
 * 用于 P5-01「界义」与 P5-19「?」。
 *
 * 关键：每个点有独立的 delay 与初始位置，
 * 汇聚完成后不停下，而是保留 0.5px 的呼吸，
 * 否则看起来像一张贴图。
 */

interface PointTextProps {
  text: string;
  fontSize?: number;
  /** 点的总数上限 */
  maxPoints?: number;
  color?: string;
  /** 汇聚时长 */
  duration?: number;
  /** 每个点的最大随机延迟 */
  spread?: number;
  /** 初始散布半径 */
  scatter?: number;
  x?: number;
  y?: number;
  delay?: number;
  onDone?: () => void;
  /** 汇聚后是否继续抖动 */
  breathe?: boolean;
  pointSize?: number;
}

export function PointText({
  text,
  fontSize = 420,
  maxPoints = 3200,
  color = "#f0d599",
  duration = 1.6,
  spread = 0.6,
  scatter = 900,
  x = 960,
  y = 480,
  delay = 0,
  onDone,
  breathe = true,
  pointSize = 2.6,
}: PointTextProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFonts([text]);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [text]);

  useEffect(() => {
    if (!ready) return;
    const mount = mountRef.current;
    if (!mount) return;

    // ---------- 1. 采样 ----------
    const { w: cw, h: ch } = textCanvasSize(text, fontSize);
    // 根据目标点数反推采样步长
    const approxArea = cw * ch * 0.22;
    const step = Math.max(2, Math.round(Math.sqrt(approxArea / maxPoints)));
    const sampled = sampleText(text, fontSize, { step, threshold: 110, font: FONT_DISPLAY });
    const count = sampled.count;

    // 用采样点的真实重心做居中基准（画布中心会偏，因为测宽含留白）
    const targets = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      targets[i * 2] = sampled.points[i * 2] - sampled.centroid.x;
      targets[i * 2 + 1] = sampled.centroid.y - sampled.points[i * 2 + 1];
    }
    void cw;
    void ch;
    void toWorld;

    // ---------- 2. 场景 ----------
    const scene = new THREE.Scene();
    // 正交相机：1 世界单位 = 1 设计像素，Y 轴向上
    const camera = new THREE.OrthographicCamera(-960, 960, 540, -540, -1000, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(1920, 1080, true);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "1920px";
    renderer.domElement.style.height = "1080px";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    // 位置数据
    const positions = new Float32Array(count * 3);
    const starts = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const delays = new Float32Array(count);

    // 设计坐标 → 世界坐标：(x - 960, 540 - y)
    const tx = x - 960;
    const ty = 540 - y;

    for (let i = 0; i < count; i++) {
      const px = targets[i * 2] + tx;
      const py = targets[i * 2 + 1] + ty;

      // 初始位置：以中心为原点，向四周大幅散布，并带一点纵向拉伸（像雨）
      const ang = Math.random() * Math.PI * 2;
      const rad = scatter * (0.35 + Math.random() * 0.9);
      const sx = Math.cos(ang) * rad * 1.35;
      const sy = Math.sin(ang) * rad + 180;

      starts[i * 3] = sx;
      starts[i * 3 + 1] = sy;
      starts[i * 3 + 2] = 0;

      positions[i * 3] = sx;
      positions[i * 3 + 1] = sy;
      positions[i * 3 + 2] = 0;

      phases[i] = Math.random() * Math.PI * 2;
      delays[i] = Math.random() * spread;
      void px;
      void py;
    }

    // 目标位置单独存
    const targetPos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      targetPos[i * 3] = targets[i * 2] + tx;
      targetPos[i * 3 + 1] = targets[i * 2 + 1] + ty;
      targetPos[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // 点精灵：圆形软边
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const sctx = spriteCanvas.getContext("2d")!;
    const grd = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.85)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grd;
    sctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(spriteCanvas);

    const mat = new THREE.PointsMaterial({
      size: pointSize,
      map: sprite,
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ---------- 3. 动画状态 ----------
    const state = {
      t: 0,          // 全局进度 0 → 1（加延迟）
      elapsed: 0,
      settled: false,
    };

    const attr = geo.getAttribute("position") as THREE.BufferAttribute;

    // 缓动：easeOutCubic
    const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

    let raf = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      state.elapsed += dt;
      const globalP = Math.min(1, Math.max(0, (state.elapsed - delay) / duration));

      if (globalP > 0.995 && !state.settled) {
        state.settled = true;
        onDone?.();
      }

      const arr = attr.array as Float32Array;
      const time = state.elapsed;

      for (let i = 0; i < count; i++) {
        const p = Math.min(1, Math.max(0, (globalP - delays[i]) / (1 - spread)));
        const e = easeOut(p);

        const x0 = starts[i * 3];
        const y0 = starts[i * 3 + 1];
        const x1 = targetPos[i * 3];
        const y1 = targetPos[i * 3 + 1];

        let px = x0 + (x1 - x0) * e;
        let py = y0 + (y1 - y0) * e;

        if (breathe && e > 0.9) {
          const k = (e - 0.9) / 0.1;
          px += Math.sin(time * 1.7 + phases[i]) * 0.55 * k;
          py += Math.cos(time * 1.4 + phases[i]) * 0.55 * k;
        }

        arr[i * 3] = px;
        arr[i * 3 + 1] = py;
      }
      attr.needsUpdate = true;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      geo.dispose();
      mat.dispose();
      sprite.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [ready, text, fontSize, maxPoints, color, duration, spread, scatter, x, y, delay, breathe, pointSize, onDone]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        inset: 0,
        width: 1920,
        height: 1080,
        pointerEvents: "none",
      }}
    />
  );
}
