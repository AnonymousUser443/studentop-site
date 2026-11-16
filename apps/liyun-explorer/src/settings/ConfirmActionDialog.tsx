import { useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useModalFocus } from '../menu/modalFocus';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { Icon } from '../hud/Icon';
import { ScrollFurniture, ScrollText, useScrollState } from '../ui/scrollDialog/ScrollFurniture';
import { scrollIcon, scrollPaper, scrollPart, scrollScrim } from '../ui/scrollDialog/motion';

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

const detailPart = scrollPart(.18, 0, 9);
const actionsPart = scrollPart(.22, 0, 11);

function ConfirmContents({ title, description, confirmLabel, destructive = false, busy, error, onCancel, onConfirm, reduced }: Omit<ConfirmActionProps, 'open'> & { reduced: boolean }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const focus = useModalFocus(cancelRef, true);
  const state = useScrollState();
  const closing = state === 'closing';
  useLayoutEffect(() => {
    if (closing) surfaceRef.current?.focus({ preventScroll: true });
    else if (document.activeElement === surfaceRef.current) cancelRef.current?.focus({ preventScroll: true });
  }, [closing]);
  return <Dialog.Portal forceMount>
    <Dialog.Overlay asChild forceMount><motion.div className="settings-confirm-overlay" data-scroll-state={state} initial="rolled" animate="open" exit="closing" custom={reduced} variants={scrollScrim} /></Dialog.Overlay>
    <Dialog.Content asChild forceMount {...focus}
      onEscapeKeyDown={event => { event.stopPropagation(); if (busy || closing) event.preventDefault(); }}
      onInteractOutside={event => { if (busy || closing) event.preventDefault(); }}>
      <motion.section className="settings-confirm scroll-surface" ref={surfaceRef} data-scroll-state={state}
        onKeyDown={event => { if (closing && event.key === 'Tab') event.preventDefault(); }}
        initial="rolled" animate="open" exit="closing" custom={reduced} variants={scrollPaper} aria-busy={busy}>
        <ScrollFurniture reduced={reduced} />
        <motion.div className="settings-confirm-emblem" aria-hidden="true" variants={scrollIcon} custom={reduced}><Icon name={destructive ? 'scroll' : 'settings'} /></motion.div>
        <Dialog.Title><ScrollText text={title} reduced={reduced} /></Dialog.Title>
        <Dialog.Description asChild><motion.p variants={detailPart} custom={reduced}>{description}</motion.p></Dialog.Description>
        {error && <p className="settings-action-error" role="alert">{error}</p>}
        <motion.div className="settings-confirm-actions" variants={actionsPart} custom={reduced} inert={closing || undefined}>
          <button ref={cancelRef} type="button" className="settings-btn settings-btn--secondary" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className={`settings-btn ${destructive ? 'settings-btn--danger' : 'settings-btn--primary'}`} onClick={onConfirm} disabled={busy}>{busy ? '正在处理…' : confirmLabel}</button>
        </motion.div>
      </motion.section>
    </Dialog.Content>
  </Dialog.Portal>;
}

export default function ConfirmActionDialog({ open, ...props }: ConfirmActionProps) {
  const { reducedMotion } = useMotionPreferences();
  const [retained, setRetained] = useState(open);
  useLayoutEffect(() => { if (open) setRetained(true); }, [open]);
  return (
    <Dialog.Root open={open || retained} onOpenChange={next => { if (!next && open && !props.busy) props.onCancel(); }}>
      <AnimatePresence custom={reducedMotion} onExitComplete={() => { if (!open) setRetained(false); }}>
        {open && <ConfirmContents {...props} reduced={reducedMotion} />}
      </AnimatePresence>
    </Dialog.Root>
  );
}
