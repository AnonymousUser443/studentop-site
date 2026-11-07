import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Slide, Kicker, ChapterRing } from "../components/ui";

import { DataRain } from "../components/DataRain";
import { PointText } from "../components/PointText";
import { Reveal } from "../components/Reveal";
import { EASE } from "../lib/useTimeline";
import { boom, dataBoot } from "../lib/audio";

/* ============================================================
   P5-01 · 章节开场：界义
   ------------------------------------------------------------
   八次点亮里唯一一次"没有光"的开场。
   没有光晕、没有地面，只有数据雨与点云成字。
   ============================================================ */
export function P5_01() {
  const root = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      // 数据雨先于一切
      gsap.set(".p501-rain", { opacity: 0 });
      tl.to(".p501-rain", { opacity: 1, duration: 1.2, ease: EASE.soft }, 0);
      tl.call(() => dataBoot(), undefined, 0.2);

      // 章名文字
      gsap.set(".p501-label", { opacity: 0, y: 12 });
      gsap.set(".p501-code", { opacity: 0, letterSpacing: "0.6em" });
      tl.to(".p501-code", { opacity: 0.9, letterSpacing: "0.28em", duration: 1.1, ease: EASE.soft }, 1.6);
      tl.to(".p501-label", { opacity: 1, y: 0, duration: 0.9, ease: EASE.soft }, 1.9);
      tl.call(() => boom(0.3), undefined, 1.8);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <div className="p501-rain" style={{ position: "absolute", inset: 0 }}>
          <DataRain count={140} speed={[6, 22]} />
        </div>

        {/* 点云成字：界义 */}
        <PointText
          text="界义"
          fontSize={420}
          maxPoints={3600}
          color="#eccf8d"
          duration={1.9}
          spread={0.55}
          scatter={880}
          x={760}
          y={470}
          delay={1.0}
          pointSize={3.3}
          breathe
        />

        <div
          className="p501-code"
          style={{
            position: "absolute",
            left: 1236,
            top: 742,
            fontFamily: "var(--font-mono)",
            fontSize: 15,
            color: "var(--ash-400)",
            letterSpacing: "0.28em",
            opacity: 0,
          }}
        >
          Ti · INTROVERTED THINKING
        </div>

        <div
          className="p501-label"
          style={{
            position: "absolute",
            left: 1236,
            top: 786,
            fontSize: 22,
            color: "var(--paper-300)",
            letterSpacing: "0.24em",
            opacity: 0,
          }}
        >
          界 义
        </div>

        <ChapterRing active={4} x={1700} y={880} size={110} dim={0.12} />
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-02 · 换一个画风
   ============================================================ */
export function P5_02() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 460 }}>
        <Reveal delay={0.2}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 64,
              lineHeight: 1.6,
              color: "var(--ash-300)",
              letterSpacing: "0.04em",
              whiteSpace: "pre-line",
            }}
          >
            {"接下来，\n我们换一个画风。"}
          </div>
        </Reveal>
      </div>
      <DataRain count={40} speed={[4, 12]} opacity={0.5} />
    </Slide>
  );
}

/* ============================================================
   P5-03 · 人工智能（全片最重的一页之一）
   ============================================================ */
export function P5_03() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      // 数据雨塌陷
      tl.to(".p503-rain", { opacity: 0, duration: 0.5, ease: "power2.in" }, 0);
      // 竖向劈开
      gsap.set(".p503-title", { clipPath: "inset(50% 0 50% 0)" });
      gsap.set(".p503-title span", { scaleY: 1.12, opacity: 0 });
      tl.to(".p503-title", { clipPath: "inset(0% 0 0% 0)", duration: 1.4, ease: EASE.ritual }, 0);
      tl.to(
        ".p503-title span",
        { scaleY: 1, opacity: 1, duration: 1.2, ease: EASE.soft },
        0.2
      );
      tl.call(() => boom(0.55), undefined, 0.02);
      // 背后光晕
      gsap.set(".p503-halo", { opacity: 0, scale: 0.2 });
      tl.to(".p503-halo", { opacity: 1, scale: 1, duration: 1.5, ease: EASE.soft }, 0.6);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <div className="p503-rain" style={{ position: "absolute", inset: 0 }}>
          <DataRain count={120} speed={[10, 30]} />
        </div>

        {/* 光晕 */}
        <div
          className="p503-halo"
          style={{
            position: "absolute",
            left: 960 - 400,
            top: 470 - 400,
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(184,147,76,0.22) 0%, rgba(184,147,76,0.08) 40%, transparent 70%)",
            filter: "blur(60px)",
            opacity: 0,
          }}
        />

        <div
          className="p503-title"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 400,
            textAlign: "center",
            clipPath: "inset(50% 0 50% 0)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: 200,
              lineHeight: 1.1,
              letterSpacing: "0.02em",
              color: "var(--paper-100)",
              textShadow: "0 0 80px rgba(184,147,76,0.55)",
            }}
          >
            人工智能。
          </span>
        </div>
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-04 · 我们怎么用 AI（FLEX）
   ============================================================ */
export function P5_04() {
  return (
    <Slide>
      <Kicker>TI · 02</Kicker>
      <div style={{ position: "absolute", left: 120, top: 340 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 44,
            lineHeight: 2.2,
            color: "var(--ash-300)",
          }}
        >
          {["有人用它写代码，", "有人用它整理资料，", "有人只是偶尔问问问题。"].map((l, i) => (
            <Reveal key={i} delay={0.2 + i * 0.22} duration={0.72}>
              <div>{l}</div>
            </Reveal>
          ))}
        </div>
      </div>
      <DataRain count={50} speed={[4, 14]} opacity={0.55} />
    </Slide>
  );
}

/* ============================================================
   P5-05 · 快得有些不真实
   ============================================================ */
export function P5_05() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 380 }}>
        <Reveal delay={0.2}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 88,
              lineHeight: 1.5,
              color: "var(--paper-100)",
              whiteSpace: "pre-line",
            }}
          >
            {"AI 的发展，\n好像快得有些不真实。"}
          </div>
        </Reveal>
      </div>
      <DataRain count={70} speed={[8, 26]} opacity={0.7} />
    </Slide>
  );
}
