import { Icon } from '../hud/Icon';
import type { MenuTarget } from './MenuScreen';

type RailEntry = {
  id: string;
  label: string;
  icon: 'scroll' | 'chest' | 'settings' | 'star' | 'book';
  to: MenuTarget | null;
};

// 顺序固定；to 为 null 表示尚未开放
const RAIL_ITEMS: readonly RailEntry[] = [
  { id: 'activities', label: '活动一览', icon: 'scroll', to: 'activities' },
  { id: 'collection', label: '收集图鉴', icon: 'chest', to: 'collection' },
  { id: 'settings', label: '设置', icon: 'settings', to: 'settings' },
  { id: 'achievements', label: '寻踪成就', icon: 'star', to: null },
  { id: 'archive', label: '旅途档案', icon: 'book', to: null },
];

export default function MenuRail({ onNavigate }: {
  onNavigate: (target: MenuTarget) => void;
}) {
  return (
    <nav className="menu-rail" aria-label="功能入口">
      {RAIL_ITEMS.map((item) => {
        const locked = item.to === null;
        return (
          <button
            key={item.id}
            type="button"
            className={`menu-rail-button${locked ? ' is-locked' : ''}`}
            aria-label={item.label}
            aria-disabled={locked || undefined}
            title={locked ? '即将开放' : item.label}
            onClick={() => {
              // 未开放项不触发任何行为
              if (item.to) onNavigate(item.to);
            }}
          >
            <Icon name={item.icon} />
          </button>
        );
      })}
    </nav>
  );
}
