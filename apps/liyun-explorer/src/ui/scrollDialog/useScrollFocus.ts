import { useEffectEvent, useLayoutEffect, type RefObject } from 'react';

const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// HUD panels and the entry gate are inside the staged world, unlike the Radix portal.
export function useScrollFocus(root: RefObject<HTMLElement | null>, open: boolean, onClose?: () => void, first?: string) {
  const handleClose = useEffectEvent(() => onClose?.());
  const canClose = Boolean(onClose);
  useLayoutEffect(() => {
    const dialog = root.current;
    if (!open || !dialog) return;
    const unavailable = () => dialog.closest('[inert]') || document.querySelector('.orientation-gate');
    const targets = () => Array.from(dialog.querySelectorAll<HTMLElement>(selector))
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert], [hidden], [aria-hidden="true"]'));
    if (!unavailable()) (first ? dialog.querySelector<HTMLElement>(first) ?? dialog : dialog).focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (unavailable()) return;
      if (event.key === 'Escape' && canClose) {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
      } else if (event.key === 'Tab') {
        const all = targets();
        const active = document.activeElement;
        const fromOutside = !all.includes(active as HTMLElement);
        if (!all.length || fromOutside || (event.shiftKey ? active === all[0] : active === all.at(-1))) {
          event.preventDefault();
          (event.shiftKey ? all.at(-1) : all[0])?.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [root, open, canClose, first]);
}
