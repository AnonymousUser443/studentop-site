import { sanitizeCloudState } from '../account';
import { createExploredState, createInitialState, LEGACY_SAVE_KEY, restoreState, SAVE_KEY } from '../state';
import type { ExplorationState } from '../types';

export type RuntimeMode = { qa: boolean; preset: string | null; calibration: boolean; isolated: boolean; preview?:boolean };
export function runtimeMode(search: string, development: boolean): RuntimeMode {
  const params = new URLSearchParams(search);
  const qa = development && params.get('qa') === '1';
  const calibration = params.get('tool') === 'calibration';
  const preview=/^\d+$/.test(params.get('contentPreview')??'');
  return { qa, preset: qa ? params.get('preset') : null, calibration, isolated: qa || calibration || preview,...(preview?{preview:true}:{}) };
}

export function loadExploration(mode: RuntimeMode, reduced: boolean, storage?: Pick<Storage, 'getItem'>): ExplorationState {
  if (mode.preset === 'explored') return createExploredState();
  if (mode.isolated) return createInitialState(reduced);
  try { return restoreState(storage?.getItem(SAVE_KEY) ?? storage?.getItem(LEGACY_SAVE_KEY) ?? null, reduced); }
  catch { return createInitialState(reduced); }
}

export const resetSnapshot = (state: ExplorationState): ExplorationState => ({ ...createInitialState(), settings: state.settings });
export const exportSnapshot = (state: ExplorationState): string => JSON.stringify(sanitizeCloudState(state), null, 2);

/** Serialize cloud writes so an older debounced PUT cannot arrive after a reset. */
export function createCloudWriter(
  save: (token: string, state: ExplorationState) => Promise<unknown>,
  currentToken: () => string | null,
) {
  let tail = Promise.resolve();
  return (token: string, state: ExplorationState): Promise<void> => {
    const snapshot = sanitizeCloudState(state);
    const task = tail.catch(() => undefined).then(async () => {
      if (currentToken() === token) await save(token, snapshot);
    });
    tail = task;
    return task;
  };
}
