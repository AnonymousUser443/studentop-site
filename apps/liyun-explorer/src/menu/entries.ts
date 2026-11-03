import type { IconName } from '../types';
import type { MenuTarget } from './MenuScreen';

export interface MenuEntry { id: string; label: string; icon: IconName; to: MenuTarget | null; detail: string; }

export const MENU_ENTRIES: readonly MenuEntry[] = [
  { id: 'collection', label: '收集图鉴', icon: 'chest', to: 'collection', detail: '重访点亮的风景' },
  { id: 'activities', label: '活动一览', icon: 'scroll', to: 'activities', detail: '看看校园新鲜事' },
  { id: 'settings', label: '设置', icon: 'settings', to: 'settings', detail: '调整你的旅途' },
  { id: 'about', label: '关于', icon: 'compass', to: 'about', detail: '认识理韵寻踪' },
  { id: 'archive', label: '旅途档案', icon: 'book', to: null, detail: '即将开放' },
  { id: 'achievements', label: '寻踪成就', icon: 'star', to: null, detail: '即将开放' },
  { id: 'stories', label: '地标小故事', icon: 'leaf', to: null, detail: '即将开放' },
  { id: 'next', label: '更多旅途', icon: 'lock', to: null, detail: '敬请期待' },
];
