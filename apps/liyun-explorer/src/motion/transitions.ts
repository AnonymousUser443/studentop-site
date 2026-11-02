/**
 * framer-motion 与 CSS 的动效数值必须来自同一处。
 * CSS 侧见 src/styles/tokens.css 的 --d-* 与 --e-*。
 * 规则：所有 transition 必须引用本文件，禁止内联裸数字（见 V2 计划 5.2）。
 */
import type { Transition, Variants } from 'framer-motion';

/** 毫秒 → 秒，framer 用秒 */
export const D = {
  tap: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.42,
  scene: 0.9,
  cinema: 1.6,
} as const;

/** 与 CSS --e-* 对应的贝塞尔控制点 */
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.45, 0, 0.25, 1],
  soft: [0.22, 0.8, 0.2, 1],
  spring: [0.22, 1.32, 0.36, 1],
} as const;

export const tween = {
  tap: { duration: D.tap, ease: EASE.soft } as Transition,
  fast: { duration: D.fast, ease: EASE.soft } as Transition,
  base: { duration: D.base, ease: EASE.out } as Transition,
  slow: { duration: D.slow, ease: EASE.out } as Transition,
  page: { duration: D.slow, ease: EASE.inOut } as Transition,
  scene: { duration: D.scene, ease: EASE.out } as Transition,
} as const;

export const spring = {
  soft: { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 } as Transition,
  pop: { type: 'spring', stiffness: 460, damping: 26, mass: 0.7 } as Transition,
  layout: { type: 'spring', stiffness: 380, damping: 34 } as Transition,
} as const;

/** 宫格/列表错峰 */
export const stagger = (each = 0.04, delay = 0) => ({
  delayChildren: delay,
  staggerChildren: each,
});

/** 面板进出：纸片展开 + 淡入 */
export const panelMotion = {
  initial: { opacity: 0, y: -8, scaleY: 0.97 },
  animate: { opacity: 1, y: 0, scaleY: 1, transition: tween.base },
  exit: { opacity: 0, y: -6, scale: 0.98, transition: tween.fast },
};

/** 页面切换：横向 12px */
export const pageMotion = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: tween.page },
  exit: { opacity: 0, x: -12, transition: tween.fast },
};

/** 四锚坐标保持静止，位移只写内部 slot。退出时不保留错峰延迟。 */
export const hudReveal: Variants = {
  hidden: ({ x, y, reduced }: { x: number; y: number; reduced: boolean }) => ({
    opacity: 0, x: reduced ? 0 : x, y: reduced ? 0 : y,
    transition: tween.fast,
  }),
  visible: ({ order, reduced }: { order: number; reduced: boolean }) => ({
    opacity: 1, x: 0, y: 0,
    transition: reduced ? tween.tap : { ...tween.slow, delay: order * D.tap },
  }),
};
