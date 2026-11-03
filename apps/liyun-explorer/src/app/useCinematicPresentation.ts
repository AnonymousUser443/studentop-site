import { useEffect, useState } from 'react';
import { useCinematic } from './stores/useCinematic';

/** Queue entries are committed before their visual pre-roll. This hook never writes a save. */
export function useCinematicPresentation(enabled: boolean) {
  const first = useCinematic(state => state.queue[0] ?? null);
  const [readyId, setReadyId] = useState<number | null>(null);
  useEffect(() => {
    if (!first || !enabled) { setReadyId(null); return; }
    const remaining = first.availableAt - performance.now();
    if (remaining <= 0) { setReadyId(first.id); return; }
    setReadyId(null);
    const timer = setTimeout(() => setReadyId(first.id), remaining);
    return () => clearTimeout(timer);
  }, [first, enabled]);
  return enabled && first?.id === readyId ? first : null;
}
