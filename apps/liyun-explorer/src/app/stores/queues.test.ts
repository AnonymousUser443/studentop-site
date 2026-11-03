import { afterEach, describe, expect, it } from 'vitest';
import { useUi } from './useUi';
import { useCinematic } from './useCinematic';

afterEach(() => {
  useUi.getState().clearAnnouncements();
  useCinematic.getState().clear();
});

describe('independent presentation queues', () => {
  it('retains concurrent announcements in FIFO order and does not merge identical text', () => {
    useUi.getState().announce('已启', 2400);
    useUi.getState().announce('已启', 5000);
    const first = useUi.getState().announcements[0];
    expect(useUi.getState().announcements.map(item => item.duration)).toEqual([2400, 5000]);
    useUi.getState().dismissAnnouncement(first.id);
    expect(useUi.getState().announcements).toHaveLength(1);
    expect(useUi.getState().announcements[0].id).not.toBe(first.id);
  });

  it('skipping one cinematic preserves the next committed event', () => {
    useCinematic.getState().enqueue({ type: 'landmark', contentId: 'beihu', availableAt: 3200, progressDelta: 7 });
    useCinematic.getState().enqueue({ type: 'region', contentId: 'library', availableAt: 3200, progressDelta: 0 });
    useCinematic.getState().complete(useCinematic.getState().queue[0].id);
    expect(useCinematic.getState().queue.map(item => item.contentId)).toEqual(['library']);
  });
});
