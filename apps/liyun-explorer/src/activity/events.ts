import { LANDMARKS } from '../data';
import type { IconName } from '../types';

export type EventStatus = 'upcoming' | 'active' | 'completed' | 'archived' | 'locked' | 'unavailable';
export type ThemeKey = 'frost' | 'seasons' | 'mystery' | 'encounters' | 'archive';
export interface EventEntry {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  status: EventStatus;
  category: string;
  themeKey: ThemeKey;
  iconKey: IconName;
  rewardKeys: string[];
  availability: string;
  preview: string;
  mapId?: string;
  route?: string;
  previewMapId?: string;
  unlockCondition?: string;
}
export interface EventReward {
  id: string;
  title: string;
  icon: IconName;
  description: string;
}

/** These are published design previews, not a calendar or a reward-granting API. */
export const EVENTS: readonly EventEntry[] = [
  {
    id: 'frost-festival', title: '霜降雅集', subtitle: '一叶知秋 · 理韵相逢',
    summary: '霜降时节，北湖清辉，银杏渐染。循着落叶的轨迹，走进熟悉的校园角落，在光影与记忆之间，收藏这一季的故事。',
    status: 'upcoming', category: '时令', themeKey: 'frost', iconKey: 'leaf',
    rewardKeys: ['starlight', 'journal', 'ginkgo', 'seal'], availability: '主题预告 · 开放时间待公布',
    preview: '计划以北湖秋景与银杏为线索，串起校园漫游。正式玩法、活动时间与奖励规则将在上线时公布；现在可以先到现有校园地图寻访北湖。',
    previewMapId: 'beihu'
  },
  {
    id: 'four-seasons', title: '四时寻访', subtitle: '四时有序 · 风物有声',
    summary: '春花、夏雨、秋叶、冬雪，把每一季的校园写成一页手札。沿着湖畔与林荫小径，找寻你与四时相遇的片刻。',
    status: 'upcoming', category: '风物', themeKey: 'seasons', iconKey: 'flower',
    rewardKeys: ['journal', 'ginkgo'], availability: '玩法构想 · 尚未开放',
    preview: '四季风物寻访正在设计中。此页展示主题方向，不代表已开放任务，也不会增加探索进度或发放奖励。'
  },
  {
    id: 'campus-mystery', title: '校园异闻录', subtitle: '一页旧闻 · 一段新知',
    summary: '书页间留下的字迹，楼宇深处回响的故事。循着一缕墨香，翻开熟悉校园里尚未读过的篇章。',
    status: 'upcoming', category: '叙事', themeKey: 'mystery', iconKey: 'book',
    rewardKeys: ['journal', 'seal'], availability: '故事筹备 · 尚未开放',
    preview: '校园叙事与线索玩法尚在筹备，当前不提供解谜或解锁任务。你可以先在地图中认识校园地标，等待新的故事。',
    previewMapId: 'library'
  },
  {
    id: 'campus-encounters', title: '校园奇遇', subtitle: '随风启程 · 偶遇微光',
    summary: '把寻常路途交给一点好奇。也许在下一处转角，会有一封邀请、一段对话，或一场与校园的奇妙相逢。',
    status: 'upcoming', category: '奇遇', themeKey: 'encounters', iconKey: 'compass',
    rewardKeys: ['starlight', 'seal'], availability: '玩法构想 · 尚未开放',
    preview: '短时任务与奇遇系统尚未接入。本页不显示虚构任务、在线人数或实时奖励，正式规则以后续活动配置为准。'
  },
  {
    id: 'personal-archive', title: '往期纪事', subtitle: '把走过的风景 · 收进记忆',
    summary: '每一次真实抵达，都在校园留下一枚注脚。翻开自己的收集图鉴，让已经点亮的地标重新回到眼前。',
    status: 'archived', category: '回顾', themeKey: 'archive', iconKey: 'scroll',
    rewardKeys: [], availability: '个人旅途回顾 · 来自当前探索存档',
    preview: '这里回顾的是你的实际地标记录，不是尚未上线活动的完成证明。登录时沿用账号存档，游客模式使用本机记录。', route: '/collection'
  }
];

export const REWARDS: Readonly<Record<string, EventReward>> = {
  starlight: { id: 'starlight', title: '寻踪星芒', icon: 'star', description: '奖励构想：寻踪纪念。正式获取条件与数量尚未公布。' },
  journal: { id: 'journal', title: '校园手札', icon: 'book', description: '奖励构想：记录校园片刻。当前仅展示图标，不发放道具。' },
  ginkgo: { id: 'ginkgo', title: '银杏书签', icon: 'leaf', description: '奖励构想：一叶知秋的书签。正式活动上线后以规则为准。' },
  seal: { id: 'seal', title: '理韵纪念章', icon: 'gate', description: '奖励构想：旅途纪念徽记。当前不代表已经获得或可以领取。' }
};

export const STATUS_LABELS: Readonly<Record<EventStatus, string>> = {
  upcoming: '主题预告', active: '正在进行', completed: '已完成', archived: '旅途回顾', locked: '待解锁', unavailable: '暂不可用'
};

const landmarkIds = new Set(LANDMARKS.map(item => item.id));
export type EventAction =
  | { kind: 'preview' | 'condition' | 'unavailable'; label: string; message: string }
  | { kind: 'map'; label: string; landmarkId: string; message: string }
  | { kind: 'collection'; label: string; message: string };

/** Only existing app destinations are accepted; configuration cannot open arbitrary URLs. */
export function eventMapTarget(entry: Pick<EventEntry, 'mapId' | 'route'>): string | null {
  if (entry.route !== undefined) {
    const routeMatch = /^\/map\/([a-z][a-z0-9-]*)$/.exec(entry.route);
    if (!routeMatch || routeMatch[0] !== entry.route || !landmarkIds.has(routeMatch[1])) return null;
    if (entry.mapId !== undefined && entry.mapId !== routeMatch[1]) return null;
    return routeMatch[1];
  }
  return entry.mapId && landmarkIds.has(entry.mapId) ? entry.mapId : null;
}

export function resolveEventAction(entry: EventEntry): EventAction {
  switch (entry.status) {
    case 'upcoming': return { kind: 'preview', label: '查看预告', message: entry.preview };
    case 'locked': return { kind: 'condition', label: '解锁条件', message: entry.unlockCondition || '活动条件尚未公布，请等待正式规则。' };
    case 'archived':
      return entry.route === '/collection'
        ? { kind: 'collection', label: '回顾我的足迹', message: entry.preview }
        : { kind: 'unavailable', label: '暂无回顾', message: '尚未接入活动回顾记录，请稍后再来。' };
    case 'unavailable': return { kind: 'unavailable', label: '稍后重试', message: '当前活动暂不可用，请稍后重新打开活动一览。' };
    case 'active':
    case 'completed': {
      const landmarkId = eventMapTarget(entry);
      return landmarkId
        ? { kind: 'map', label: entry.status === 'completed' ? '再次进入' : '前往参与', landmarkId, message: '' }
        : { kind: 'unavailable', label: '暂不可用', message: '活动目的地尚未就绪，请等待配置更新。' };
    }
    default: return { kind: 'unavailable', label: '暂不可用', message: '活动信息无法识别，请稍后再试。' };
  }
}

export function previewMapTarget(entry: EventEntry): string | null {
  return entry.previewMapId && landmarkIds.has(entry.previewMapId) ? entry.previewMapId : null;
}

export function recordedLandmarkCount(discoveredIds: readonly string[]): number {
  return new Set(discoveredIds.filter(id => landmarkIds.has(id))).size;
}
