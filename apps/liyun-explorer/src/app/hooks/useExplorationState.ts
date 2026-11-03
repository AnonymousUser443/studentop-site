import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sanitizeCloudState } from '../../account';
import { createInitialState, LEGACY_SAVE_KEY, SAVE_KEY } from '../../state';
import type { ExplorationState } from '../../types';
import { loadExploration, type RuntimeMode } from '../saveLifecycle';
import { useExploration } from '../stores/useExploration';
import { useSettings } from '../stores/useSettings';
import { useUi } from '../stores/useUi';

const systemReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function replaceExploration(next: ExplorationState): ExplorationState {
  useSettings.getState().hydrate(next.settings, systemReduced());
  const state = { ...next, settings: useSettings.getState().settings };
  useExploration.getState().replace(state);
  return state;
}

/** Settings have one owner; the exploration snapshot follows that owner's updates. */
export function useExplorationState(mode: RuntimeMode) {
  const skipLocalSnapshot = useRef<ExplorationState | null>(null);
  useState(() => {
    let storage: Storage | undefined;
    if (!mode.isolated) { try { storage = localStorage; } catch { /* unavailable */ } }
    replaceExploration(loadExploration(mode, systemReduced(), storage));
    return true;
  });
  const state = useExploration(store => store.state);
  const toolOpen = useUi(store => store.route === 'calibration');

  useLayoutEffect(() => useSettings.subscribe((next, previous) => {
    if (next.settings !== previous.settings) useExploration.getState().update(current => ({ ...current, settings: next.settings }));
  }), []);
  useEffect(() => {
    if (mode.isolated || toolOpen || state === skipLocalSnapshot.current) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(sanitizeCloudState(state))); }
    catch { /* Private mode keeps the current in-memory journey usable. */ }
  }, [state, mode.isolated, toolOpen]);

  const clearLocalArchive = useCallback(() => {
    const initial = replaceExploration(createInitialState(systemReduced()));
    skipLocalSnapshot.current = initial;
    // Tools and QA never touch the ordinary archive, even when this action is used.
    if (!mode.isolated) {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    }
  }, [mode.isolated]);
  return { state, replace: replaceExploration, clearLocalArchive };
}
