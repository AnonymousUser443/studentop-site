import { create } from 'zustand';
import { createInitialState } from '../../state';
import type { ExplorationState } from '../../types';

export type ExplorationUpdate = ExplorationState | ((current: ExplorationState) => ExplorationState);

/** Public exploration anchors only. Live position belongs to useCampusLocation. */
export const useExploration = create<{
  state: ExplorationState;
  replace: (state: ExplorationState) => void;
  update: (update: ExplorationUpdate) => void;
}>((set) => ({
  state: createInitialState(),
  replace: state => set({ state }),
  update: update => set(current => ({ state: typeof update === 'function' ? update(current.state) : update })),
}));
