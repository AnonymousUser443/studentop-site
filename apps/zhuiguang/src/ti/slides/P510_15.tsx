import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Slide } from "../components/ui";
import { DataRain } from "../components/DataRain";
import { Reveal } from "../components/Reveal";
import { EASE } from "../lib/useTimeline";
import { chime, tick } from "../lib/audio";

const SERIF = "var(--font-display)";



/* ============================================================
   P5-10 · 不只是词语接龙
   ============================================================ */
export function P5_10() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.set(".p510-word", { opacity: 0, y: 16 });
      gsap.set(".p510-dot", { opacity: 0, scale: 0 });

      const tl = gsap.timeline({ delay: 0.9 });
      tl.to(".p510-word", {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.16,
        ease: EASE.soft,
      });

      // 每词下方浮起一簇数据点，散开再消失
      const words = gsap.utils.toArray<HTMLElement>(".p510-word-wrap");
      words.forEach((w, i) => {
        const dots = w.querySelectorAll<HTMLElement>(".p510-dot");
        tl.fromTo(
          dots,
          { opacity: 0.85, scale: 1, x: 0, y: 0 },
          {
            opacity: 0,
            scale: 0.2,
            x: () => gsap.utils.random(-46, 46),
            y: () => gsap.utils.random(-34, -6),
            duration: 1.0,
            stagger: 0.02,
            ease: "power1.out",
          },
          i * 0.15
        );
        tl.call(() => tick(i, 0.03), undefined, i * 0.15);
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <DataRain count={40} speed={[4, 12]} opacity={0.4} />

        <div style={{ position: "absolute", left: 120, top: 300 }}>
          <Reveal delay={0.15} duration={0.85}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 56,
                lineHeight: 1.7,
                color: "var(--paper-100)",
                whiteSpace: "pre-line",
              }}
            >
              {"但大语言模型，\n并不只是背了一张词语接龙表。"}
            </div>
          </Reveal>
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 620,
            display: "flex",
            gap: 72,
          }}
        >
          {["语法", "语义", "知识关联", "复杂规律"].map((w, i) => (
            <div key={i} className="p510-word-wrap" style={{ position: "relative" }}>
              <div
                className="p510-word"
                style={{
                  fontFamily: SERIF,
                  fontSize: 32,
                  color: "var(--ash-300)",
                  letterSpacing: "0.04em",
                  opacity: 0,
                }}
              >
                {w}
              </div>
              {/* 数据点簇 */}
              <div style={{ position: "absolute", left: 0, top: 54, width: "100%", height: 40 }}>
                {Array.from({ length: 11 }).map((_, k) => (
                  <span
                    key={k}
                    className="p510-dot"
                    style={{
                      position: "absolute",
                      left: `${6 + Math.random() * 82}%`,
                      top: `${Math.random() * 26}px`,
                      width: 2,
                      height: 2,
                      borderRadius: "50%",
                      background: "#eccf8d",
                      boxShadow: "0 0 4px rgba(220,187,117,0.8)",
                      opacity: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-11 · 训练目标
   ============================================================ */
export function P5_11() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 380 }}>
        <Reveal delay={0.2}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 64,
              lineHeight: 1.75,
              color: "var(--paper-100)",
              whiteSpace: "pre-line",
            }}
          >
            {"模型的训练目标之一是，\n生成符合上下文的内容。"}
          </div>
        </Reveal>
      </div>
      <DataRain count={52} speed={[5, 16]} opacity={0.5} />
    </Slide>
  );
}

/* ============================================================
   P5-12 · 裂缝：它一定是真的吗
   ============================================================ */
export function P5_12() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const path = el.querySelector<SVGPathElement>(".p512-crack");
      if (path) {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        gsap.to(path, { strokeDashoffset: 0, duration: 0.55, delay: 1.4, ease: "power2.inOut" });
      }
      gsap.to(".p512-question", {
        opacity: 1,
        duration: 1.1,
        delay: 1.9,
        ease: EASE.soft,
      });
      gsap.fromTo(
        ".p512-question",
        { filter: "blur(10px)" },
        { filter: "blur(0px)", duration: 1.1, delay: 1.9 }
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <DataRain count={30} speed={[3, 10]} opacity={0.35} />

        <div style={{ position: "absolute", left: 120, top: 330 }}>
          <Reveal delay={0.2} duration={0.7}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 48,
                color: "var(--ash-400)",
                letterSpacing: "0.02em",
              }}
            >
              那么问题来了——
            </div>
          </Reveal>
        </div>

        {/* 裂缝 */}
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <path
            className="p512-crack"
            d="M 120 476 L 236 452 L 332 500 L 448 462 L 566 516 L 690 470 L 812 522 L 946 474 L 1082 528 L 1206 480 L 1332 532 L 1452 484 L 1560 528"
            fill="none"
            stroke="var(--cinnabar-400)"
            strokeWidth="1.2"
            strokeLinejoin="round"
            opacity="0"
            style={{ filter: "drop-shadow(0 0 6px rgba(194,65,46,0.6))" }}
          />
        </svg>

        <div
          className="p512-question"
          style={{
            position: "absolute",
            left: 120,
            top: 560,
            opacity: 0,
          }}
        >
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 88,
              lineHeight: 1.5,
              color: "var(--paper-100)",
              whiteSpace: "pre-line",
            }}
          >
            {"它生成的东西，\n就一定是真的吗？"}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-13 · 流畅 ≠ 正确（金句，极端克制）
   ============================================================ */
export function P5_13() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.set(".p513-eq", { clipPath: "inset(100% 0 0 0)", opacity: 0 });
      gsap.set(".p513-a", { clipPath: "inset(0 100% 0 0)" });
      gsap.set(".p513-b", { clipPath: "inset(0 0 0 100%)" });
      gsap.set(".p513-rule", { scaleX: 0, opacity: 0 });

      const tl = gsap.timeline({ delay: 0.4 });
      tl.to(".p513-eq", { clipPath: "inset(0% 0 0 0)", opacity: 1, duration: 0.7, ease: EASE.enter });
      tl.to(".p513-a", { clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: EASE.enter }, 0.55);
      tl.to(".p513-b", { clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: EASE.enter }, 0.75);
      tl.call(() => chime(0.18), undefined, 0.6);
      tl.to(".p513-rule", { scaleX: 1, opacity: 0.5, duration: 0.8, ease: EASE.ritual }, 1.1);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <span className="p513-a" style={{ display: "inline-block" }}>
            <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 120, color: "var(--paper-200)" }}>
              流畅
            </span>
          </span>
          <span
            className="p513-eq"
            style={{
              display: "inline-block",
              fontFamily: SERIF,
              fontSize: 120,
              color: "var(--gold-300)",
              position: "relative",
              top: 8,
            }}
          >
            ≠
          </span>
          <span className="p513-b" style={{ display: "inline-block" }}>
            <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 120, color: "var(--paper-200)" }}>
              正确
            </span>
          </span>
        </div>

        <div
          className="hairline p513-rule"
          style={{ position: "absolute", left: 560, width: 800, top: 620 }}
        />
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-14 · 不是无所不能（FLEX）
   ============================================================ */
export function P5_14() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 380 }}>
        {[
          "它可以是非常强大的学习助手，",
          "但它的流畅表达，",
          "并不天然等于事实正确。",
        ].map((l, i) => (
          <Reveal key={i} delay={0.2 + i * 0.24} duration={0.72}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 48,
                lineHeight: 2.0,
                color: i === 2 ? "var(--paper-200)" : "var(--ash-300)",
              }}
            >
              {l}
            </div>
          </Reveal>
        ))}
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-15 · 怎样学习
   ============================================================ */
export function P5_15() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 440 }}>
        <Reveal delay={0.2}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 88,
              lineHeight: 1.55,
              color: "var(--paper-100)",
              whiteSpace: "pre-line",
            }}
          >
            {"在这样的时代，\n我们究竟应该怎样学习？"}
          </div>
        </Reveal>
      </div>
      <DataRain count={36} speed={[3, 10]} opacity={0.4} />
    </Slide>
  );
}
