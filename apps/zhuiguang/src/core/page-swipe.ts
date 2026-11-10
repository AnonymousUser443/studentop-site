import { useRef, type PointerEvent } from 'react';

export function usePageSwipe(navigate: (forward: boolean) => void, enabled = true) {
  const origin = useRef<{ id: number; x: number; y: number; time: number }>();
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      origin.current = undefined;
      if (!enabled || !event.isPrimary || event.pointerType !== 'touch') return;
      if (event.target instanceof Element && event.target.closest('button,a,input,select,textarea,video,[contenteditable],[data-no-swipe]')) return;
      origin.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    },
    onPointerCancel() { origin.current = undefined; },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = origin.current;
      origin.current = undefined;
      if (!enabled || !start || start.id !== event.pointerId || performance.now() - start.time > 850) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.6) navigate(dx < 0);
    },
  };
}
