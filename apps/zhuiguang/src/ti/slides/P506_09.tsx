import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Slide } from "../components/ui";
import { DataRain } from "../components/DataRain";
import { Reveal } from "../components/Reveal";
import { TokenStream } from "../components/TokenStream";
import { AttentionWeb } from "../components/AttentionWeb";
import { EASE } from "../lib/useTimeline";
import { tick, chime, pulse } from "../lib/audio";

const FONT_SERIF = "var(--font-display)";
const FONT_MONO = "var(--font-mono)";

/* ============================================================
   P5-06 · Token 流（峰值页）
   ------------------------------------------------------------
   标题在左上，主体交给 Three.js 接管。
   ============================================================ */
export function P5_06() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.set(".p506-kicker", { opacity: 0, x: -14 });
      gsap.set(".p506-caption", { opacity: 0 });
      const tl = gsap.timeline({ delay: 0.3 });
      tl.to(".p506-kicker", { opacity: 1, x: 0, duration: 0.7, ease: EASE.soft });
      tl.to(".p506-caption", { opacity: 1, duration: 2.4, ease: EASE.soft }, 6.0);
      tl.call(() => pulse(0.05, 1.4), undefined, 0.2);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <DataRain count={45} speed={[4, 14]} opacity={0.45} zIndex={0} />

        <div className="p506-kicker" style={{ position: "absolute", left: 120, top: 96, opacity: 0 }}>
          <div className="label" style={{ color: "var(--ash-400)" }}>
            TI · 03 · TOKENIZATION
          </div>
        </div>

        {/* 主体：Token 流 */}
        <TokenStream />

        <div
          className="p506-caption"
          style={{
            position: "absolute",
            left: 120,
            top: 860,
            opacity: 0,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 28,
              lineHeight: 1.9,
              color: "var(--ash-300)",
              whiteSpace: "pre-line",
            }}
          >
            {"模型看到的不是「一句话」，\n而是六个 Token。"}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 120,
            top: 96,
            textAlign: "right",
          }}
        >
          <div className="mono" style={{ fontSize: 13, letterSpacing: "0.28em", color: "var(--ash-500)" }}>
            TOKENS · 6
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-07 · 注意力机制（峰值页）
   ============================================================ */
export function P5_07() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.set(".p507-head", { opacity: 0, y: -10 });
      const tl = gsap.timeline({ delay: 0.2 });
      tl.to(".p507-head", { opacity: 1, y: 0, duration: 0.8, ease: EASE.soft });
      [0, 1, 2, 3].forEach((i) => {
        tl.call(() => tick(i, 0.045), undefined, 1.7 + i * 0.45);
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <div
          className="p507-head"
          style={{ position: "absolute", left: 120, top: 96, opacity: 0 }}
        >
          <div className="label" style={{ color: "var(--ash-400)" }}>
            TI · 04 · ATTENTION
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: FONT_SERIF,
              fontSize: 34,
              color: "var(--paper-300)",
              letterSpacing: "0.02em",
            }}
          >
            哪些字，和哪些字有关？
          </div>
        </div>

        <AttentionWeb />

        <div
          style={{
            position: "absolute",
            right: 120,
            bottom: 96,
            textAlign: "right",
            maxWidth: 460,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 24,
              lineHeight: 1.9,
              color: "var(--ash-400)",
              whiteSpace: "pre-line",
            }}
          >
            {"线越粗，注意力权重越高。\n这不是一张示意图——\n它是模型真实在做的事。"}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-08 · Transformer
   ============================================================ */
export function P5_08() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 340 }}>
        <Reveal delay={0.15} duration={0.9}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 96,
              letterSpacing: "0.04em",
              color: "var(--paper-100)",
              fontWeight: 400,
            }}
          >
            Transformer
          </div>
        </Reveal>
        <Reveal delay={0.85} duration={0.7}>
          <div
            style={{
              marginTop: 34,
              fontFamily: FONT_MONO,
              fontSize: 20,
              letterSpacing: "0.3em",
              color: "var(--ash-400)",
            }}
          >
            2017 · 注意力机制
          </div>
        </Reveal>
      </div>
      <DataRain count={24} speed={[3, 9]} opacity={0.4} />
    </Slide>
  );
}

/* ============================================================
   P5-09 · 疯狂星期四（唯一一次"轻佻"的动效）
   ============================================================ */
export function P5_09() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      gsap.set(".p509-a", { opacity: 0, yPercent: 105 });
      gsap.set(".p509-b", { opacity: 0, x: 380, rotate: 8, filter: "blur(5px)" });

      tl.to(".p509-a", { opacity: 1, yPercent: 0, duration: 0.8, ease: EASE.enter });
      // 长停顿，然后弹幕飞入
      tl.to(
        ".p509-b",
        {
          opacity: 1,
          x: 0,
          rotate: -2,
          filter: "blur(0px)",
          duration: 0.62,
          ease: "power3.out",
        },
        1.3
      );
      tl.call(() => chime(0.1), undefined, 1.3);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", left: 120, top: 420 }}>
          <div className="reveal" style={{ display: "inline-block" }}>
            <span className="p509-a" style={{ display: "block" }}>
              <span
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 96,
                  color: "var(--paper-100)",
                  letterSpacing: "0.02em",
                }}
              >
                疯狂星期四……
              </span>
            </span>
          </div>
        </div>

        <div
          className="p509-b"
          style={{
            position: "absolute",
            right: 180,
            top: 620,
            display: "inline-flex",
            alignItems: "center",
            padding: "14px 38px",
            background: "rgba(246,228,188,0.08)",
            borderRadius: 4,
            border: "1px solid rgba(246,228,188,0.18)",
          }}
        >
          <span
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 900,
              fontSize: 72,
              color: "var(--gold-100)",
              letterSpacing: "0.02em",
              textShadow: "0 0 40px rgba(227,200,142,0.35)",
            }}
          >
            V我50
          </span>
        </div>
      </div>
    </Slide>
  );
}
