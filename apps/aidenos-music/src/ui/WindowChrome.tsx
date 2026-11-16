import { useLayoutEffect, useRef } from "react";
import type { MusicHost } from "../domain";
import s from "./WindowChrome.module.css";

/** The desktop lends its original controls to this slot; React never recreates them. */
export function WindowChrome({ host }: { host: MusicHost }) {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (slot.current) return host.mountWindowControls?.(slot.current);
  }, [host]);
  if (!host.mountWindowControls) return null;
  return (
    <div className={s.chrome} data-music-window-chrome>
      <div
        className={s.dragRegion}
        data-window-drag-region
        aria-hidden="true"
        title="拖动窗口；双击最大化或还原"
      />
      <div ref={slot} className={s.captionSlot} role="group" aria-label="窗口操作" />
    </div>
  );
}
