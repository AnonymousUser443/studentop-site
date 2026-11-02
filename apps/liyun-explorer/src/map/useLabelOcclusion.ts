import { useLayoutEffect, type RefObject } from 'react';

const intersects = (a: DOMRect, b: DOMRect) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
  && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;

/** 只收起被 HUD 或前一标签遮住的文字，始终保留原经纬锚点和可点的菱形。 */
export function useLabelOcclusion(surface: RefObject<HTMLDivElement | null>, revision: unknown[]) {
  useLayoutEffect(() => {
    const root = surface.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      const markers = Array.from(root.querySelectorAll<HTMLElement>('.map-marker'));
      // 批量恢复 → 统一读取 → 批量写入，避免每枚标签反复触发布局。
      markers.forEach(marker => { delete marker.dataset.labelHidden; });
      const hud = document.querySelector('.hud-frame:not([aria-hidden="true"])');
      const reserved = Array.from(hud?.querySelectorAll('.hud-anchor') ?? []).map(el => el.getBoundingClientRect());
      const labels = markers.map(marker => ({ marker, rect: marker.querySelector('.map-marker-name')!.getBoundingClientRect() }));
      const accepted: DOMRect[] = [];
      labels.forEach(({ marker, rect }) => {
        const blocked = reserved.some(box => intersects(rect, box)) || accepted.some(box => intersects(rect, box));
        if (blocked) marker.dataset.labelHidden = 'true';
        else accepted.push(rect);
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    document.querySelectorAll('.hud-anchor > .hud-slot').forEach(el => observer.observe(el));
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
    // revision 是调用方的固定依赖列表，不把高频几何写回 React state。
  }, [surface, ...revision]);
}
