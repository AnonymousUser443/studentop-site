import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { LANDMARKS } from '../../content/catalog';
import type { PanelId } from '../../types';
import { useUi, type AppRoute } from '../stores/useUi';

type ActivityReturn = { kind: 'map'; landmarkId: string } | { kind: 'collection' } | null;
type Options = { stage: RefObject<HTMLDivElement | null>; entered: boolean; portrait: boolean; cinematicOpen: boolean; stopFollowing: () => void; focusPlace: (id: string) => void };

export function usePageNavigation({ stage, entered, portrait, cinematicOpen, stopFollowing, focusPlace }: Options) {
  const route = useUi(store => store.route), activePanel = useUi(store => store.activePanel), selectedId = useUi(store => store.selectedId);
  const [activityReturn, setActivityReturn] = useState<ActivityReturn>(null);
  const [initialCategory, setInitialCategory] = useState<'control' | 'other'>('control');
  const menuReturnFocus = useRef<HTMLElement | null>(null);
  const activityOpen = entered && activePanel === 'activities';
  const setRoute = useCallback((next: AppRoute) => {
    // Capture before the map/HUD becomes inert or a lazy page starts loading.
    // Settings -> menu preserves the original world trigger.
    if (next === 'menu' && useUi.getState().route === 'map') {
      const trigger = document.activeElement;
      menuReturnFocus.current = trigger instanceof HTMLElement && trigger !== document.body ? trigger : null;
    }
    useUi.getState().select(null); useUi.getState().setPanel(null); useUi.getState().setRoute(next);
  }, []);
  const select = useCallback((id: string) => {
    if (!LANDMARKS.some(place => place.id === id)) return;
    useUi.getState().select(id); useUi.getState().setPanel(null);
  }, []);
  const openActivities = useCallback(() => {
    stopFollowing(); setActivityReturn(null);
    useUi.getState().setRoute('map'); useUi.getState().select(null); useUi.getState().setPanel('activities');
  }, [stopFollowing]);
  const showPanel = useCallback((id: PanelId) => {
    if (id === 'profile') { setRoute('menu'); return; }
    if (id === 'activities') { openActivities(); return; }
    useUi.getState().setRoute('map'); useUi.getState().select(null); useUi.getState().setPanel(id);
  }, [openActivities, setRoute]);
  const close = useCallback(() => {
    useUi.getState().select(null);
    const current = useUi.getState().activePanel;
    if (activityReturn?.kind === 'collection') {
      if (current === 'collection') { setActivityReturn(null); useUi.getState().setPanel('activities'); }
      else useUi.getState().setPanel('collection');
    } else useUi.getState().setPanel(null);
  }, [activityReturn]);
  const closeAll = useCallback((keepRoute = false) => {
    setActivityReturn(null);
    if (keepRoute) { useUi.getState().select(null); useUi.getState().setPanel(null); }
    else setRoute('map');
  }, [setRoute]);
  const closeActivities = useCallback(() => useUi.getState().setPanel(current => current === 'activities' ? null : current), []);
  const visitActivityMap = useCallback((id: string) => {
    if (useUi.getState().activePanel !== 'activities') return;
    if (!LANDMARKS.some(place => place.id === id)) throw new Error('这处校园地图暂时无法打开，请返回活动一览重试');
    stopFollowing(); setActivityReturn({ kind: 'map', landmarkId: id });
    useUi.getState().select(null); useUi.getState().setPanel(null); focusPlace(id);
  }, [stopFollowing, focusPlace]);
  const viewActivityCollection = useCallback(() => {
    if (useUi.getState().activePanel !== 'activities') return;
    setActivityReturn({ kind: 'collection' }); useUi.getState().select(null); useUi.getState().setPanel('collection');
  }, []);
  const navigateMenu = useCallback((target: 'collection' | 'activities' | 'settings' | 'about') => {
    if (target === 'collection' || target === 'activities') { showPanel(target); return; }
    setInitialCategory(target === 'about' ? 'other' : 'control'); setRoute('settings');
  }, [setRoute, showPanel]);

  // Radix pages and existing HUD/activity modals own Escape. No document-level route listener.
  useEffect(() => {
    if (!entered || portrait || route !== 'map' || cinematicOpen || !activityReturn || activePanel || selectedId) return;
    const closePreview = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setActivityReturn(null); }
    };
    document.addEventListener('keydown', closePreview);
    return () => document.removeEventListener('keydown', closePreview);
  }, [entered, portrait, route, cinematicOpen, activityReturn, activePanel, selectedId]);
  useEffect(() => {
    if (activityOpen || !entered || portrait || activePanel || selectedId || route !== 'map' || cinematicOpen) return;
    if (!activityReturn) return;
    const frame = requestAnimationFrame(() => stage.current?.querySelector<HTMLButtonElement>('[data-testid="activity-return"]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [activityOpen, activityReturn, entered, portrait, activePanel, selectedId, route, cinematicOpen, stage]);
  useEffect(() => {
    if (portrait || !activityOpen) return;
    const frame = requestAnimationFrame(() => stage.current?.querySelector<HTMLButtonElement>('[data-testid="activity-screen"] [role="tab"][aria-selected="true"]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [portrait, activityOpen, stage]);
  return { route, activePanel, selectedId, activityReturn, activityOpen, initialCategory, menuReturnFocus: menuReturnFocus.current, setRoute, select, showPanel, openActivities, close, closeAll, closeActivities, visitActivityMap, viewActivityCollection, navigateMenu };
}
