import { createContext, useContext } from "react";

/** 舞台缩放比：1920 设计像素 → 实际屏幕像素 */
export const ScaleContext = createContext(1);
export const useScale = () => useContext(ScaleContext);

/** 把 DOM 元素的实际屏幕坐标换算回 1920×1080 设计坐标 */
export function toDesign(el: HTMLElement, scale: number) {
  const stage = el.closest(".stage") as HTMLElement | null;
  const s = stage?.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!s) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: (r.left - s.left) / scale,
    y: (r.top - s.top) / scale,
    w: r.width / scale,
    h: r.height / scale,
  };
}
