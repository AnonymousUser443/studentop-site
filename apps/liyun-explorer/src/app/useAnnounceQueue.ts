import { useEffect } from 'react';
import { useUi } from './stores/useUi';

/** Pause the head while a full-page overlay is hiding it. Every message keeps its own lifetime. */
export function useAnnounceQueue(paused: boolean) {
  const current = useUi(state => state.announcements[0]);
  const dismiss = useUi(state => state.dismissAnnouncement);
  useEffect(() => {
    if (!current || paused) return;
    const timer = setTimeout(() => dismiss(current.id), current.duration);
    return () => clearTimeout(timer);
  }, [current, paused, dismiss]);
  return current;
}
