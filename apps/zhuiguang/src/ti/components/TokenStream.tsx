import { useEffect, useRef, useState, useContext } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { ensureFonts, sampleText, textCanvasSize, FONT_DISPLAY } from "../lib/fonts";
import { ScaleContext } from "../lib/scale";


/**
 * <TokenStream> — P5-06 Token 流（峰值页）
 * ------------------------------------------------------------
 * 分镜（见《07_详解_P4-P5》P5-06）：
 *   1. 句子逐字写出                      0.0 – 1.4s
 *   2. 分组：出现竖缝，各组上浮           1.4 – 2.6s
 *   3. 每组文字"坍缩"成点云 → 立方体       2.6 – 5.0s
 *   4. 立方体飞向背景神经网络             4.4 – 6.2s
 *
 * 实现要点：
 *  - 文字用 DOM（保证清晰），坍缩时用 Three.js 点云接管
 *  - 每个 token 独立一个 Points 对象，各自随机相位
 *  - 立方体不是 Mesh，是"点组成的 12 条棱"，才有"发光"感
 */


const TOKENS = ["我", "是", "山里", "灵活", "的", "狗"];

interface TokenState {
  el: HTMLElement | null;
  centerX: number; // 设计坐标
  centerY: number;
  text: string;
}

export function TokenStream({ onDone }: { onDone?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sepRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [ready, setReady] = useState(false);
  const scale = useContext(ScaleContext);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFonts(TOKENS);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- DOM 阶段 ----------
  useEffect(() => {
    if (!ready || !rootRef.current) return;
    const root = rootRef.current;

    const ctx = gsap.context(() => {
      const chars = gsap.utils.toArray<HTMLElement>(".ts-char");
      const seps = sepRefs.current.filter(Boolean) as HTMLElement[];

      gsap.set(chars, { opacity: 0, filter: "blur(8px)", y: 10 });
      gsap.set(seps, { scaleY: 0, opacity: 0 });

      const tl = gsap.timeline();

      // 1. 逐字写出
      tl.to(chars, {
        opacity: 1,
        filter: "blur(0px)",
        y: 0,
        duration: 0.5,
        stagger: 0.055,
        ease: "power2.out",
      });

      // 2. 分组：竖缝出现 + 组上浮（由外层的 data-token 组控制）
      tl.to(
        seps,
        { scaleY: 1, opacity: 0.85, duration: 0.42, stagger: 0.08, ease: "power2.out" },
        "+=0.25"
      );
      tl.to(
        ".ts-gap",
        { width: 10, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power2.out" },
        "<"
      );
      tl.to(
        ".ts-token",
        { y: -6, duration: 0.45, stagger: 0.07, ease: "power2.out" },
        "<0.05"
      );
      tl.call(() => onDone?.());
    }, root);

    return () => ctx.revert();
  }, [ready, onDone]);

  // ---------- Three.js 阶段 ----------
  useEffect(() => {
    if (!ready) return;
    const mount = mountRef.current;
    const root = rootRef.current;
    if (!mount || !root) return;

    // 测量每个 token 的中心（设计坐标）
    const tokens: TokenState[] = TOKENS.map((t, i) => {
      const el = tokenRefs.current[i];
      let cx = 960;
      let cy = 480;
      if (el) {
        const stage = root.closest(".stage") as HTMLElement | null;
        const sr = stage?.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (sr) {
          cx = (r.left + r.width / 2 - sr.left) / scale;
          cy = (r.top + r.height / 2 - sr.top) / scale;
        }
      }
      return { el, centerX: cx, centerY: cy, text: t };
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-960, 960, 540, -540, -2000, 2000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(1920, 1080, true);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "1920px";
    renderer.domElement.style.height = "1080px";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    // 圆形点精灵
    const sc = document.createElement("canvas");
    sc.width = 64;
    sc.height = 64;
    const sctx = sc.getContext("2d")!;
    const grd = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.75)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grd;
    sctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(sc);

    // ---------- 每个 token 的点云 ----------
    const FONT_SIZE = 96;

    interface TokenObj {
      group: THREE.Points;
      geometry: THREE.BufferGeometry;
      material: THREE.PointsMaterial;
      starts: Float32Array;
      targets: Float32Array;
      delays: Float32Array;
      count: number;
      progress: { v: number };
      size: number;
      worldX: number;
      worldY: number;
    }

    const tokenObjs: TokenObj[] = [];

    TOKENS.forEach((t, idx) => {
      const { w: cw, h: ch } = textCanvasSize(t, FONT_SIZE);
      const step = TOKENS.length > 1 ? 3 : 2;
      const sampled = sampleText(t, FONT_SIZE, { step, threshold: 110, font: FONT_DISPLAY });
      const count = Math.min(sampled.count, 1400);

      const starts = new Float32Array(count * 3);
      const delays = new Float32Array(count);

      // 起点：字形内部相对坐标（相对该 token 中心）
      for (let i = 0; i < count; i++) {
        const px = sampled.points[i * 2] - cw / 2;
        const py = ch / 2 - sampled.points[i * 2 + 1];
        starts[i * 3] = px;
        starts[i * 3 + 1] = py;
        starts[i * 3 + 2] = 0;
        delays[i] = Math.random() * 0.35;
      }

      // 终点：立方体 12 条棱上的点
      const cubeSize = Math.min(96, 46 + t.length * 14);
      const h = cubeSize / 2;
      const corners = [
        [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
        [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
      ];
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      const targets = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const e = edges[Math.floor(Math.random() * edges.length)];
        const k = Math.random();
        const a = corners[e[0]];
        const b = corners[e[1]];
        targets[i * 3] = a[0] + (b[0] - a[0]) * k + (Math.random() - 0.5) * 1.6;
        targets[i * 3 + 1] = a[1] + (b[1] - a[1]) * k + (Math.random() - 0.5) * 1.6;
        targets[i * 3 + 2] = a[2] + (b[2] - a[2]) * k + (Math.random() - 0.5) * 1.6;
      }

      const positions = new Float32Array(starts);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        size: 2.1,
        map: sprite,
        color: new THREE.Color("#f9e8ba"),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: false,
      });

      const group = new THREE.Points(geo, mat);
      group.position.set(tokens[idx].centerX - 960, 540 - tokens[idx].centerY, 0);
      scene.add(group);

      tokenObjs.push({
        group,
        geometry: geo,
        material: mat,
        starts,
        targets,
        delays,
        count,
        progress: { v: 0 },
        size: cubeSize,
        worldX: tokens[idx].centerX - 960,
        worldY: 540 - tokens[idx].centerY,
      });
    });

    // ---------- 背景神经网络 ----------
    const netGeo = new THREE.BufferGeometry();
    const NET_N = 420;
    const netPos = new Float32Array(NET_N * 3);
    for (let i = 0; i < NET_N; i++) {
      netPos[i * 3] = (Math.random() - 0.5) * 2100;
      netPos[i * 3 + 1] = (Math.random() - 0.5) * 1300;
      netPos[i * 3 + 2] = -300 - Math.random() * 400;
    }
    netGeo.setAttribute("position", new THREE.BufferAttribute(netPos, 3));
    const netMat = new THREE.PointsMaterial({
      size: 1.4,
      color: new THREE.Color("#91703d"),
      transparent: true,
      opacity: 0,
      sizeAttenuation: false,
      depthWrite: false,
    });
    const net = new THREE.Points(netGeo, netMat);
    scene.add(net);

    // 网络连线（随机取近邻）
    const linePos: number[] = [];
    for (let i = 0; i < NET_N; i++) {
      for (let j = i + 1; j < NET_N; j++) {
        const dx = netPos[i * 3] - netPos[j * 3];
        const dy = netPos[i * 3 + 1] - netPos[j * 3 + 1];
        if (dx * dx + dy * dy < 190 * 190) {
          linePos.push(
            netPos[i * 3], netPos[i * 3 + 1], netPos[i * 3 + 2],
            netPos[j * 3], netPos[j * 3 + 1], netPos[j * 3 + 2]
          );
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#715731"),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // ---------- 触发时间轴 ----------
    const master = gsap.timeline({ delay: 2.5 });

    // 文字淡出、点云浮现
    tokenObjs.forEach((t, i) => {
      master.to(
        t.material,
        { opacity: 1, duration: 0.25, ease: "power2.out" },
        i * 0.14
      );
      master.to(
        t.progress,
        {
          v: 1,
          duration: 1.5,
          ease: "power3.inOut",
        },
        i * 0.14
      );
      master.call(
        () => {
          const els = tokens[i].el?.querySelectorAll<HTMLElement>(".ts-char");
          if (els) gsap.to(els, { opacity: 0, duration: 0.3, ease: "power2.out" });
        },
        undefined,
        i * 0.14
      );
    });

    // 网络浮现 + 立方体飞向网络
    master.to(netMat, { opacity: 0.32, duration: 1.6, ease: "power2.out" }, 1.0);
    master.to(lineMat, { opacity: 0.07, duration: 1.6, ease: "power2.out" }, 1.0);

    master.to(
      tokenObjs.map((t) => t.group.position),
      {
        x: (i: number) => -260 + i * 104,
        y: 40,
        z: -220,
        duration: 1.6,
        ease: "power2.inOut",
        stagger: 0.06,
      },
      1.5
    );

    // ---------- 渲染循环 ----------
    const easeOut3 = (p: number) => 1 - Math.pow(1 - p, 3);
    let raf = 0;
    const clock = new THREE.Clock();
    let elapsed = 0;

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;

      tokenObjs.forEach((t) => {
        const attr = t.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const p0 = t.progress.v;

        for (let i = 0; i < t.count; i++) {
          const p = Math.min(1, Math.max(0, (p0 - t.delays[i]) / (1 - 0.35)));
          const e = easeOut3(p);
          arr[i * 3] = t.starts[i * 3] + (t.targets[i * 3] - t.starts[i * 3]) * e;
          arr[i * 3 + 1] = t.starts[i * 3 + 1] + (t.targets[i * 3 + 1] - t.starts[i * 3 + 1]) * e;
          arr[i * 3 + 2] = t.starts[i * 3 + 2] + (t.targets[i * 3 + 2] - t.starts[i * 3 + 2]) * e;
        }
        attr.needsUpdate = true;

        // 立方体自转：只在该 token 完成坍缩后才开始
        if (p0 > 0.75) {
          const k = (p0 - 0.75) / 0.25;
          t.group.rotation.y = elapsed * 0.55 * k + t.delays[0];
          t.group.rotation.x = Math.sin(elapsed * 0.32 + t.delays[0] * 6) * 0.22 * k;
        }
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      master.kill();
      tokenObjs.forEach((t) => {
        t.geometry.dispose();
        t.material.dispose();
      });
      netGeo.dispose();
      netMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      sprite.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [ready, scale]);

  // ---------- JSX ----------
  let charIndex = 0;

  return (
    <div ref={rootRef} style={{ position: "absolute", inset: 0 }}>
      <div
        ref={mountRef}
        style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none" }}
      />

      {/* 句子：DOM 层，保证文字清晰 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          height: 140,
        }}
      >
        {TOKENS.map((tok, ti) => {
          const charsArr = Array.from(tok);
          return (
            <div key={ti} style={{ display: "flex", alignItems: "center" }}>
              {ti > 0 && (
                <span
                  ref={(el) => {
                    sepRefs.current[ti - 1] = el;
                  }}
                  style={{
                    display: "block",
                    width: "1.5px",
                    height: 96,
                    background:
                      "linear-gradient(180deg, rgba(247,220,157,0) 0%, rgba(247,220,157,0.9) 50%, rgba(247,220,157,0) 100%)",
                    margin: "0 2px",
                    transformOrigin: "center",
                    boxShadow: "0 0 10px rgba(234,204,139,0.7)",
                  }}
                />
              )}
              <span
                className="ts-token"
                ref={(el) => {
                  tokenRefs.current[ti] = el;
                }}
                style={{
                  display: "flex",
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: 96,
                  lineHeight: 1.2,
                  color: "var(--paper-100)",
                  padding: "0 10px",
                }}
              >
                {charsArr.map((c, ci) => (
                  <span key={ci} className="ts-char" style={{ display: "inline-block" }}>
                    {c}
                  </span>
                ))}
                {void charIndex}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
