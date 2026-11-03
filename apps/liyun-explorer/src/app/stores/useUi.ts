import { create } from 'zustand';
import type { PanelId } from '../../types';

export type AppRoute = 'map' | 'menu' | 'settings' | 'calibration';
export type Announcement = { id: number; text: string; duration: number };
let announcementId = 0;

export const useUi = create<{
  route: AppRoute;
  activePanel: PanelId;
  selectedId: string | null;
  announcements: Announcement[];
  setRoute: (route: AppRoute | ((previous: AppRoute) => AppRoute)) => void;
  setPanel: (panel: PanelId | ((previous: PanelId) => PanelId)) => void;
  select: (id: string | null) => void;
  announce: (text: string, duration?: number) => void;
  dismissAnnouncement: (id: number) => void;
  clearAnnouncements: () => void;
}>((set) => ({
  route: 'map', activePanel: null, selectedId: null, announcements: [],
  setRoute: route => set(current => ({ route: typeof route === 'function' ? route(current.route) : route })),
  setPanel: panel => set(current => ({ activePanel: typeof panel === 'function' ? panel(current.activePanel) : panel })),
  select: selectedId => set({ selectedId }),
  announce: (text, duration = 3600) => set(current => ({
    announcements: [...current.announcements, { id: ++announcementId, text, duration }],
  })),
  dismissAnnouncement: id => set(current => ({ announcements: current.announcements.filter(item => item.id !== id) })),
  clearAnnouncements: () => set({ announcements: [] }),
}));
