import { lazy, useEffect } from 'react';
import { preloadHudPanels } from '../hud/Hud';

function once<T>(load: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => pending ??= load();
}
export const loadMenu = once(() => import('../menu/MenuScreen'));
export const loadSettings = once(() => import('../settings/SettingsScreen'));
export const loadActivity = once(() => import('../activity/ActivityScreen'));
export const loadAtmosphere = once(() => import('../effects/Atmosphere'));
export const loadCinematic = once(() => import('../cinematic/CinematicScreen'));
export const MenuScreen = lazy(loadMenu);
export const SettingsScreen = lazy(loadSettings);
export const ActivityScreen = lazy(loadActivity);
export const Atmosphere = lazy(loadAtmosphere);
// The authoring workbench is local development tooling, never a production chunk.
export const CalibrationScreen = import.meta.env.DEV ? lazy(() => import('../calibration/CalibrationScreen')) : null;
export const CinematicScreen = lazy(loadCinematic);

/** Warm later pages only after entry, keeping p5 and Radix out of the entrance bundle. */
export function usePagePreload(entered: boolean) {
  useEffect(() => {
    if (!entered) return;
    const timer = setTimeout(() => { void Promise.allSettled([loadMenu(), loadSettings(), loadActivity(), loadCinematic(), preloadHudPanels()]); }, 1200);
    return () => clearTimeout(timer);
  }, [entered]);
}
