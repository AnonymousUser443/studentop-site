import { useEffect, type RefObject } from 'react';

type UiSound = (kind?: 'hover' | 'confirm' | 'cancel') => void;

/** Native clicks include keyboard activation. Portal controls belong to this app too. */
export function useUiSound(stage: RefObject<HTMLElement | null>, play: UiSound, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let lastHover = 0;
    const button = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const element = target.closest<HTMLElement>('button,[role="button"],[role="switch"],[role="tab"],[role="option"]');
      if (!element || element.closest('[inert]') || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled')) return null;
      const owned = stage.current?.contains(element) || element.closest('[data-radix-popper-content-wrapper],[role="dialog"],.menu-screen,.settings-screen');
      return owned ? element : null;
    };
    const click = (event: MouseEvent) => { if (button(event.target)) play('confirm'); };
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !button(event.target)) return;
      const now = performance.now();
      if (now - lastHover < 100) return;
      lastHover = now; play('hover');
    };
    const cue = (event: Event) => {
      const kind = (event as CustomEvent).detail;
      if (kind === 'confirm' || kind === 'cancel' || kind === 'hover') play(kind);
    };
    document.addEventListener('click', click, true);
    document.addEventListener('pointerover', hover, true);
    window.addEventListener('liyun:ui-sfx', cue);
    return () => {
      document.removeEventListener('click', click, true);
      document.removeEventListener('pointerover', hover, true);
      window.removeEventListener('liyun:ui-sfx', cue);
    };
  }, [enabled, play, stage]);
}
