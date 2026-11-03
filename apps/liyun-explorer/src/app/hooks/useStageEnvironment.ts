import { useCallback, useEffect, useState, type RefObject } from 'react';

export function useStageEnvironment(stage: RefObject<HTMLDivElement | null>, message: (text: string) => void) {
  const [hidden, setHidden] = useState(document.hidden);
  const [isFullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const visibility = () => setHidden(document.hidden), full = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', full);
    return () => { document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', full); };
  }, []);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => undefined); return; }
    // Include body-mounted Radix portals in the same fullscreen subtree.
    const target = stage.current?.ownerDocument.documentElement;
    if (!target?.requestFullscreen) { message('当前浏览器不支持全屏，仍可横屏探索'); return; }
    void target.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
      void orientation?.lock?.('landscape').catch(() => undefined);
    }).catch(() => message('未能进入全屏，仍可横屏继续探索'));
  }, [stage, message]);
  return { hidden, isFullscreen, fullscreen };
}

const ENTERED_EVENT = 'liyun:entered';
let enteredOnce = false;
export function useEntryState(initiallyEntered: boolean) {
  const [entered, setEntered] = useState(() => initiallyEntered || enteredOnce);
  useEffect(() => {
    const dismiss = () => setEntered(true);
    window.addEventListener(ENTERED_EVENT, dismiss);
    return () => window.removeEventListener(ENTERED_EVENT, dismiss);
  }, []);
  const markEntered = useCallback(() => { enteredOnce = true; setEntered(true); window.dispatchEvent(new Event(ENTERED_EVENT)); }, []);
  const showEntry = useCallback(() => { enteredOnce = false; setEntered(false); }, []);
  return { entered, setEntered, markEntered, showEntry };
}
