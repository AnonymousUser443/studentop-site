import { create } from 'zustand';

export type CinematicPayload = {
  id: number;
  type: 'landmark' | 'region';
  contentId: string;
  progressDelta: number;
  availableAt: number;
  quick?: boolean;
  unlockedRegions?: string[];
};
let sequence = 0;

export const useCinematic = create<{
  queue: CinematicPayload[];
  enqueue: (payload: Omit<CinematicPayload, 'id'>) => void;
  complete: (id: number) => void;
  clear: () => void;
}>((set) => ({
  queue: [],
  enqueue: payload => set(current => ({ queue: [...current.queue, { ...payload, id: ++sequence }] })),
  complete: id => set(current => ({ queue: current.queue.filter(item => item.id !== id) })),
  clear: () => set({ queue: [] }),
}));
