import { lazy, useEffect } from 'react';

// App is still loaded after publication has been applied. Keep the primary navigation in
// that chunk so its first click can start the motion rather than a JS download.
export { default as MenuScreen } from '../menu/MenuScreen';
export { default as SettingsScreen } from '../settings/SettingsScreen';
export { default as ActivityScreen } from '../activity/ActivityScreen';

function once<T>(load: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => pending ??= load().catch(error => { pending = undefined; throw error; });
}
export const loadAtmosphere = once(() => import('../effects/Atmosphere'));
export const loadCinematic = once(() => import('../cinematic/CinematicScreen'));
export const Atmosphere = lazy(loadAtmosphere);
// The authoring workbench is local development tooling, never a production chunk.
export const CalibrationScreen = import.meta.env.DEV ? lazy(() => import('../calibration/CalibrationScreen')) : null;
export const CinematicScreen = lazy(loadCinematic);

/** Warm optional panels after entry; map navigation already has its modules. */
export function usePagePreload(entered: boolean) {
  useEffect(() => {
    if (!entered) return;
    const timer = setTimeout(() => { void loadCinematic().catch(() => undefined); }, 1200);
    return () => clearTimeout(timer);
  }, [entered]);
}
