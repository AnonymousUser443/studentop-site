import { useRef, type RefObject } from 'react';

/** Keep the world opener while a drawer briefly hands focus to another modal. */
export function useModalFocus(initialFocus: RefObject<HTMLElement | null>, allowDialogOpener = false, returnFocus?: HTMLElement | null, fallbackSelector?: string) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      event.preventDefault();
      const current = document.activeElement;
      if (current instanceof HTMLElement && current !== document.body && (allowDialogOpener || !current.closest('[role="dialog"]'))) opener.current = current;
      initialFocus.current?.focus({ preventScroll: true });
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      if (!allowDialogOpener && document.querySelector('[role="dialog"][data-state="open"]')) return;
      // A cold lazy import can mount after the parent has already made its HUD inert.
      // The caller may preserve that opener before navigation; the drawer also has a visible fallback.
      const target = returnFocus ?? opener.current ?? (fallbackSelector ? document.querySelector<HTMLElement>(fallbackSelector) : null);
      if (target?.isConnected && !target.closest('[inert], [aria-hidden="true"]')) target.focus({ preventScroll: true });
    },
  };
}
