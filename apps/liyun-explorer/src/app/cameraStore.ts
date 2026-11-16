import type { MapCamera } from '../types';

/** Runtime-only camera. Only the map and its paint effects subscribe. */
export function createCameraStore(initial: MapCamera) {
  let camera = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => camera,
    set(next: MapCamera | ((current: MapCamera) => MapCamera)) {
      const value = typeof next === 'function' ? next(camera) : next;
      if (value.x === camera.x && value.y === camera.y && value.scale === camera.scale) return;
      camera = value;
      for (const listener of listeners) listener();
    },
  };
}

export type CameraStore = ReturnType<typeof createCameraStore>;
