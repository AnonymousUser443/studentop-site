import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * 每页一个根时间轴。
 * ------------------------------------------------------------
 * 规则（来自《03_动效与转场规格》）：
 *  - 页面内所有动画必须挂到同一个 timeline
 *  - 声音由 tl.call() 触发，不用 setTimeout
 *  - 卸载时 kill，不留残余
 */
export function useTimeline(
  build: (tl: gsap.core.Timeline) => void,
  deps: unknown[] = []
) {
  const scope = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tlRef.current = tl;
      build(tl);
    }, el);

    return () => {
      tlRef.current = null;
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { scope, tl: tlRef };
}

/** 全局缓动常量 */
export const EASE = {
  enter: "power3.out",
  soft: "power2.out",
  exit: "power2.in",
  ritual: "power2.inOut",
  back: "back.out(1.4)",
} as const;

export const DUR = {
  s: 0.16,
  m: 0.62,
  l: 1.4,
  ritual: 2.2,
} as const;
