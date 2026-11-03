import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useModalFocus } from '../menu/modalFocus';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { tween } from '../motion/transitions';
import { Icon } from '../hud/Icon';

export interface ConfirmActionProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmActionDialog({ open, title, description, confirmLabel, destructive = false, busy, error, onCancel, onConfirm }: ConfirmActionProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const focus = useModalFocus(cancelRef, true);
  const { reducedMotion } = useMotionPreferences();
  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next && !busy) onCancel(); }}>
      <AnimatePresence>
        {open && <Dialog.Portal forceMount>
          <Dialog.Overlay asChild forceMount><motion.div className="settings-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast} /></Dialog.Overlay>
          <Dialog.Content asChild forceMount {...focus} onEscapeKeyDown={event => { event.stopPropagation(); if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
            <motion.section className="settings-confirm" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: .96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} transition={reducedMotion ? tween.tap : tween.base} aria-busy={busy}>
              <div className="settings-confirm-emblem" aria-hidden="true"><Icon name={destructive ? 'scroll' : 'settings'} /></div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
              {error && <p className="settings-action-error" role="alert">{error}</p>}
              <div className="settings-confirm-actions">
                <button ref={cancelRef} type="button" className="settings-btn settings-btn--secondary" onClick={onCancel} disabled={busy}>取消</button>
                <button type="button" className={`settings-btn ${destructive ? 'settings-btn--danger' : 'settings-btn--primary'}`} onClick={onConfirm} disabled={busy}>{busy ? '正在处理…' : confirmLabel}</button>
              </div>
            </motion.section>
          </Dialog.Content>
        </Dialog.Portal>}
      </AnimatePresence>
    </Dialog.Root>
  );
}
