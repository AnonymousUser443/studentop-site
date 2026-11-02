import { useSyncExternalStore } from 'react';
import { useSettings } from '../app/stores/useSettings';

const query = '(prefers-reduced-motion: reduce)';
const systemSnapshot = () => typeof matchMedia === 'function' && matchMedia(query).matches;
const serverSnapshot = () => false;
const subscribe = (onChange: () => void) => {
  const media = matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** 系统偏好与游戏开关取或，并响应页面打开后的系统偏好变化。 */
export function useMotionPreferences() {
  const systemReduced = useSyncExternalStore(subscribe, systemSnapshot, serverSnapshot);
  const gameReduced = useSettings(s => s.settings.reducedMotion);
  const reduceFlash = useSettings(s => s.settings.reduceFlash);
  const cssAmbient = useSettings(s => s.spec.cssAmbient);
  const reducedMotion = systemReduced || gameReduced;
  return { systemReduced, reducedMotion, reduceFlash, ambient: cssAmbient && !reducedMotion && !reduceFlash };
}
