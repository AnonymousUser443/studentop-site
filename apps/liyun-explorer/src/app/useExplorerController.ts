import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { DISPLAY_LANDMARKS as LANDMARKS } from '../map/displayLandmarks';
import { useAudio } from '../audio/useAudio';
import { useUiSound } from '../audio/useUiSound';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { exportSnapshot, resetSnapshot, runtimeMode } from './saveLifecycle';
import { useExploration } from './stores/useExploration';
import { useSettings } from './stores/useSettings';
import { useUi } from './stores/useUi';
import { useCinematic } from './stores/useCinematic';
import { useExplorationState } from './hooks/useExplorationState';
import { useAccountSession } from './hooks/useAccountSession';
import { useMapController } from './hooks/useMapController';
import { useEntryState, useStageEnvironment } from './hooks/useStageEnvironment';
import { usePageNavigation } from './hooks/usePageNavigation';
import { useJourneyActions } from './hooks/useJourneyActions';
import { useQaBridge } from './hooks/useQaBridge';
import { useAutoDegrade } from './useAutoDegrade';
import { useAnnounceQueue } from './useAnnounceQueue';
import { useCinematicPresentation } from './useCinematicPresentation';
import { useHotkeys } from './useHotkeys';
import { usePagePreload } from './lazyPages';

const mode = runtimeMode(location.search, import.meta.env.DEV);

/** Compose bounded controllers. Durable, volatile and presentation state keep separate owners. */
export function useExplorerController(stage: RefObject<HTMLDivElement | null>) {
  useState(() => { useUi.getState().setRoute(mode.calibration ? 'calibration' : 'map'); return true; });
  const data = useExplorationState(mode);
  const entry = useEntryState(Boolean(mode.qa || mode.calibration || mode.preview));
  const route = useUi(store => store.route), selectedId = useUi(store => store.selectedId), activePanel = useUi(store => store.activePanel);
  const selected = LANDMARKS.find(place => place.id === selectedId) ?? null;
  const map = useMapController(stage, selected, data.state.discoveredIds);
  const message = useCallback((text: string) => useUi.getState().announce(text, useSettings.getState().settings.messageDuration * 1000), []);
  const environment = useStageEnvironment(stage, message);
  const motion = useMotionPreferences();
  const audio = useAudio(data.state.settings, entry.entered && !mode.isolated);
  useUiSound(stage, audio.playUi, entry.entered && !mode.isolated && !map.portrait);
  const session = useAccountSession({ isolated: mode.isolated, suspended: route === 'calibration', replace: data.replace, message });
  const presentationEnabled = entry.entered && !map.portrait && !environment.hidden && route === 'map' && !activePanel && !selectedId && data.state.settings.showCinematic;
  const cinematic = useCinematicPresentation(presentationEnabled);
  const ui = usePageNavigation({ stage, entered: entry.entered, portrait: map.portrait, cinematicOpen: Boolean(cinematic), stopFollowing: map.stopFollowing, focusPlace: map.focusPlace });
  const journey = useJourneyActions({ qa: mode.isolated, location: map.location.state, message, playUnlock: audio.playUnlock, visual: map.visual, frameDiscovery: map.frameDiscovery });
  const worldPaused = environment.hidden || map.portrait || !entry.entered || Boolean(activePanel) || Boolean(selectedId) || route !== 'map' || Boolean(cinematic);
  const announceDowngrade = useCallback(() => message('为了让旅途更流畅，画质已自动调整；可在图像设置中恢复原档'), [message]);
  useAutoDegrade(worldPaused, announceDowngrade);
  const announcement = useAnnounceQueue(worldPaused);
  const qualitySpec = useSettings(store => store.spec);
  usePagePreload(entry.entered && route !== 'calibration');

  const enter = useCallback(() => {
    const track = Math.floor(Math.random() * 3);
    useSettings.getState().update({ track }); audio.start(track); entry.markEntered();
    if (matchMedia('(pointer: coarse)').matches) environment.fullscreen();
  }, [audio.start, entry.markEntered, environment.fullscreen]);
  const loginPrompt = useCallback(() => { ui.closeAll(); journey.clear(); entry.showEntry(); session.clearError(); }, [ui.closeAll, journey.clear, entry.showEntry, session.clearError]);
  const handleLogout = useCallback(async () => { ui.closeAll(); journey.clear(); entry.showEntry(); await session.detach(); }, [ui.closeAll, journey.clear, entry.showEntry, session.detach]);
  const guest = useCallback(() => { session.clearError(); enter(); }, [session.clearError, enter]);
  const reset = useCallback(async () => {
    const snapshot = data.replace(resetSnapshot(useExploration.getState().state));
    journey.clear(); ui.closeAll(true); map.resetCamera();
    try { await session.persistNow(snapshot); message('探索进度已重置，个人设置已保留'); }
    catch { message('本机探索已重置，云端同步失败；请保持登录并在网络恢复后重试'); throw new Error('本机已重置，云端同步失败，请重试'); }
  }, [data.replace, journey.clear, ui.closeAll, map.resetCamera, session.persistNow, message]);
  const clearLocalSave = useCallback(async () => {
    await session.detach();
    try { data.clearLocalArchive(); }
    catch { throw new Error('当前浏览器不允许清空本机存档，请检查隐私设置'); }
    journey.clear(); ui.closeAll(); map.resetCamera(); entry.showEntry();
    message(mode.isolated ? '演示状态已清空，普通存档未变更' : '已清空本机存档并退出本机会话；云端旅途仍保留');
  }, [session.detach, data.clearLocalArchive, journey.clear, ui.closeAll, map.resetCamera, entry.showEntry, message]);
  const exportSave = useCallback(async () => {
    try {
      const url = URL.createObjectURL(new Blob([exportSnapshot(useExploration.getState().state)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `liyun-${mode.isolated ? 'demo-' : ''}save.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('当前旅途已导出');
    } catch { throw new Error('导出失败，请检查浏览器下载权限后重试'); }
  }, [message]);

  const cinematicFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (cinematic && !cinematicFocus.current) cinematicFocus.current = document.activeElement as HTMLElement | null;
  }, [cinematic]);
  const completeCinematic = useCallback((id: number) => {
    useCinematic.getState().complete(id); ui.setRoute('map');
    requestAnimationFrame(() => {
      if (useCinematic.getState().queue.some(item => item.availableAt <= performance.now())) return;
      const previous = cinematicFocus.current; cinematicFocus.current = null;
      const fallback = stage.current?.querySelector<HTMLElement>('[data-testid="dock-collection"], [data-testid="activity-entry"], button');
      (previous?.isConnected && !previous.closest('[inert]') ? previous : fallback)?.focus({ preventScroll: true });
    });
  }, [stage, ui.setRoute]);
  useEffect(() => { if (!data.state.settings.showCinematic) useCinematic.getState().clear(); }, [data.state.settings.showCinematic]);
  useHotkeys({ onActivities: ui.openActivities, onCollection: () => ui.showPanel('collection'), onCenter: map.center, onFullscreen: environment.fullscreen, onLocate: map.locate }, !worldPaused);
  useQaBridge({ enabled: mode.qa, getCamera: () => map.visual.current.camera, getEvent: () => journey.eventRef.current, setCamera: map.setCamera, select: ui.select, discover: journey.discover, reset, freeze: journey.freeze, showPanel: ui.showPanel, replace: data.replace, clear: journey.clear, closeAll: ui.closeAll, resetCamera: map.resetCamera, setEntered: entry.setEntered, setRoute: ui.setRoute });

  const retained = useRef({ menu: false, settings: false, activity: false, atmosphere: false, cinematic: false });
  retained.current.menu ||= route === 'menu'; retained.current.settings ||= route === 'settings'; retained.current.activity ||= ui.activityOpen;
  retained.current.atmosphere ||= entry.entered && !map.portrait && route !== 'calibration'; retained.current.cinematic ||= Boolean(cinematic);
  return { state: data.state, entry, map, environment, motion, audio, session, ui, journey, selected, worldPaused, qualitySpec, announcement, cinematic, retained: retained.current,
    actions: { enter, guest, loginPrompt, logout: handleLogout, reset, clearLocalSave, exportSave, completeCinematic, updateSettings: useSettings.getState().update } };
}
