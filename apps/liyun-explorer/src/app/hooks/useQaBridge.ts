import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { LANDMARKS } from '../../content/catalog';
import { getRegion, isRegionId, REGIONS } from '../../content/regions';
import { createExploredState, createInitialState } from '../../state';
import type { MapCamera, SceneEvent } from '../../types';
import { useCinematic, type CinematicPayload } from '../stores/useCinematic';
import { useExploration } from '../stores/useExploration';
import { useSettings } from '../stores/useSettings';
import { useUi, type AppRoute } from '../stores/useUi';

type Options = {
  enabled: boolean; getCamera: () => MapCamera; getEvent: () => SceneEvent | null; setCamera: (camera: MapCamera) => void;
  select: (id: string) => void; discover: (id: string) => void; reset: () => unknown;
  freeze: (offset?: number) => void; showPanel: (id: 'profile' | 'collection' | 'activities' | null) => void;
  replace: (state: ReturnType<typeof createInitialState>) => unknown; clear: () => void; closeAll: () => void; resetCamera: () => void;
  setEntered: (entered: boolean) => void; setRoute: (route: AppRoute) => void;
};

export function useQaBridge(options: Options) {
  useEffect(() => {
    if (!options.enabled) return;
    const api = {
      getState: () => useExploration.getState().state, getCamera: options.getCamera, getEvent: options.getEvent,
      flushSync, select: options.select, discover: options.discover, setCamera: options.setCamera, reset: options.reset,
      freeze: options.freeze, showPanel: options.showPanel, setEntered: options.setEntered,
      setSettings: useSettings.getState().update, setQualityPreset: useSettings.getState().setPreset,
      setPreset: (name: string) => {
        options.replace(name === 'explored' ? createExploredState() : createInitialState());
        options.clear(); options.closeAll(); useUi.getState().clearAnnouncements(); options.resetCamera();
      },
      setRoute: (route: AppRoute) => { if (['map', 'menu', 'settings', 'calibration'].includes(route)) options.setRoute(route); },
      getUi: () => ({ route: useUi.getState().route, activePanel: useUi.getState().activePanel, selectedId: useUi.getState().selectedId, announcements: useUi.getState().announcements, cinematicQueue: useCinematic.getState().queue }),
      getRegions: () => REGIONS.map(region => ({ ...region, unlocked: useExploration.getState().state.unlockedRegionIds.includes(region.id) })),
      unlockRegion: (id: string, unlocked = true) => {
        if (!isRegionId(id)) return false;
        useExploration.getState().update(state => ({ ...state, unlockedRegionIds: unlocked ? [...new Set([...state.unlockedRegionIds, id])] : state.unlockedRegionIds.filter(region => region !== id) }));
        return true;
      },
      previewCinematic: (input: string | Partial<CinematicPayload> = 'wencui', contentId?: string) => {
        const payload = typeof input === 'string' ? { type: input === 'region' ? 'region' as const : 'landmark' as const, contentId: contentId ?? (input === 'region' || input === 'landmark' ? 'wencui' : input) } : input;
        const type = payload.type === 'region' ? 'region' : 'landmark', id = payload.contentId ?? 'wencui';
        if (type === 'region' ? !getRegion(id) : !LANDMARKS.some(place => place.id === id)) return false;
        options.closeAll();
        useCinematic.getState().enqueue({ type, contentId: id, progressDelta: payload.progressDelta ?? 0, availableAt: performance.now(), quick: payload.quick, unlockedRegions: payload.unlockedRegions });
        return true;
      },
    };
    const target = window as unknown as { __LIYUN__?: typeof api };
    target.__LIYUN__ = api;
    return () => { if (target.__LIYUN__ === api) delete target.__LIYUN__; };
  }, [options]);
}
