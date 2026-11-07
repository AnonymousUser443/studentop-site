import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Slide } from "../components/ui";
import { DataRain } from "../components/DataRain";
import { Reveal } from "../components/Reveal";
import { Seal } from "../components/Seal";
import { PointText } from "../components/PointText";
import { EASE } from "../lib/useTimeline";
import { sealStamp, rise, boom } from "../lib/audio";

const SERIF = "var(--font-display)";

/* ============================================================
   P5-16 · 如果有一天……
   ============================================================ */
export function P5_16() {
  return (
    <Slide>
      <div style={{ position: "absolute", left: 120, top: 320 }}>
        {[
          "如果未来有一天，",
          "越来越多过去需要大量时间的事，",
          "都可以在 AI 的辅助下迅速完成……",
        ].map((l, i) => (
          <Reveal key={i} delay={0.2 + i * 0.26} duration={0.8}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 64,
                lineHeight: 1.8,
                color: i === 2 ? "var(--paper-200)" : "var(--paper-300)",
              }}
            >
              {l}
            </div>
          </Reveal>
        ))}
      </div>
      <DataRain count={30} speed={[3, 9]} opacity={0.35} />
    </Slide>
  );
}

/* ============================================================
   P5-17 · 省下来的时间，去做什么
   ============================================================ */
export function P5_17() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.set(".p517-line3", { opacity: 0, filter: "blur(12px)" });
      const tl = gsap.timeline({ delay: 0.4 });
      tl.to(".p517-line3", {
        opacity: 1,
        filter: "blur(0px)",
        duration: 1.0,
        ease: EASE.soft,
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", left: 120, top: 400 }}>
          <Reveal delay={0.2} duration={0.7}>
            <div style={{ fontFamily: SERIF, fontSize: 88, color: "var(--paper-300)", lineHeight: 1.4 }}>
              那么，
            </div>
          </Reveal>
          <Reveal delay={0.55} duration={0.7}>
            <div style={{ fontFamily: SERIF, fontSize: 88, color: "var(--paper-300)", lineHeight: 1.45 }}>
              我们还可以用节省下来的时间，
            </div>
          </Reveal>
          <div
            className="p517-line3"
            style={{
              fontFamily: SERIF,
              fontSize: 96,
              color: "var(--gold-100)",
              lineHeight: 1.5,
              opacity: 0,
            }}
          >
            去做什么？
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 1240,
            top: 500,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            letterSpacing: "0.3em",
            color: "var(--ash-500)",
          }}
        >
          — 一个不需要马上回答的问题 —
        </div>
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-18 · 彩蛋：盖歪了的章
   ------------------------------------------------------------
   这一页的效果完全来自"不完美"：
   角度歪 8°、越界、不回弹。
   ============================================================ */
export function P5_18() {
  const [showSub, setShowSub] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowSub(true), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Slide>
      {/* 印章：从右上斜着砸进来，一半越出安全区 */}
      <Seal
        text="社会必要劳动时间"
        angle={8}
        size={200}
        x={1442}
        y={712}
        crooked
        delay={0.9}
      />

      {showSub && (
        <div
          style={{
            position: "absolute",
            left: 1500,
            top: 962,
            fontFamily: "var(--font-kai)",
            fontSize: 34,
            color: "var(--cinnabar-300)",
            transform: "rotate(-4deg)",
            opacity: 0.95,
            animation: "fadeInSub 0.5s ease forwards",
          }}
        >
          减少了！
        </div>
      )}

      <div style={{ position: "absolute", left: 120, top: 420 }}>
        <Reveal delay={0.2} duration={0.8}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 64,
              lineHeight: 1.7,
              color: "var(--paper-300)",
              whiteSpace: "pre-line",
            }}
          >
            {"社会必要劳动时间，"}
          </div>
        </Reveal>
      </div>

      <style>{`
        @keyframes fadeInSub {
          from { opacity: 0; transform: rotate(-4deg) translateY(-8px); }
          to   { opacity: 0.95; transform: rotate(-4deg) translateY(0); }
        }
      `}</style>
    </Slide>
  );
}

/* ============================================================
   P5-19 · 数据流汇聚成问号
   ============================================================ */
export function P5_19({ onDone }: { onDone?: () => void }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const t = setTimeout(() => rise(1.8, 0.09), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <Slide>
      <PointText
        text="?"
        fontSize={520}
        maxPoints={2600}
        color="#e3c88e"
        duration={1.8}
        spread={0.45}
        scatter={760}
        x={960}
        y={510}
        delay={0.3}
        pointSize={2.4}
        breathe
        onDone={onDone}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 150,
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.42em",
          color: "var(--ash-500)",
        }}
      >
        CONVERGING
      </div>
    </Slide>
  );
}

/* ============================================================
   P5-20 · 炸开 → 钤印 → 熄灯
   ============================================================ */
export function P5_20() {
  const root = useRef<HTMLDivElement>(null);
  const [sealGo, setSealGo] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const t = setTimeout(() => {
      boom(0.25);
      setSealGo(true);
    }, 700);

    const ctx = gsap.context(() => {
      // 「?」炸开
      gsap.fromTo(
        ".p520-core",
        { scale: 1, opacity: 1 },
        { scale: 1.9, opacity: 0, duration: 0.45, ease: "power4.in" }
      );
      // 粒子四散
      gsap.to(".p520-spark", {
        opacity: 0,
        x: () => gsap.utils.random(-700, 700),
        y: () => gsap.utils.random(-460, 460),
        scale: 0.2,
        duration: 1.3,
        stagger: 0.012,
        ease: "power2.out",
      });
      gsap.to(".p520-dim", { opacity: 0.78, duration: 0.8, delay: 0.35, ease: "power2.in" });
    }, el);

    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, []);

  return (
    <Slide>
      <div ref={root} style={{ position: "absolute", inset: 0 }}>
        {/* 画面退入黑曜暗部，留一丝线路供印章落下。 */}
        <div
          className="p520-dim"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--ink-950)",
            opacity: 0,
            zIndex: 5,
          }}
        />

        {/* 爆炸中心 */}
        <div
          className="p520-core"
          style={{
            position: "absolute",
            left: 960,
            top: 500,
            transform: "translate(-50%, -50%)",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(246,228,188,0.9) 0%, rgba(227,200,142,0.25) 45%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />

        {/* 火花 */}
        {Array.from({ length: 64 }).map((_, i) => {
          const ang = (Math.PI * 2 * i) / 64 + Math.random() * 0.4;
          const r = 90 + Math.random() * 160;
          return (
            <span
              key={i}
              className="p520-spark"
              style={{
                position: "absolute",
                left: 960 + Math.cos(ang) * r,
                top: 500 + Math.sin(ang) * r,
                width: 2 + Math.random() * 2,
                height: 2 + Math.random() * 2,
                borderRadius: "50%",
                background: "#f6e4bc",
                boxShadow: "0 0 8px rgba(246,228,188,0.9)",
                zIndex: 3,
              }}
            />
          );
        })}

        {sealGo && (
          <div style={{ position: "absolute", inset: 0, zIndex: 8 }}>
            <Seal
              text="界义"
              angle={-3.4}
              size={230}
              x={1560}
              y={700}
              animate
              onDone={() => sealStamp(0.3)}
            />
          </div>
        )}
      </div>
    </Slide>
  );
}
