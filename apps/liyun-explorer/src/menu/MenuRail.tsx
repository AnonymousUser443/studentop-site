import { Icon } from '../hud/Icon';
import type { MenuTarget } from './MenuScreen';

const ITEMS = [
  { id: 'collection', label: '收集图鉴', icon: 'chest' },
  { id: 'activities', label: '活动一览', icon: 'scroll' },
  { id: 'settings', label: '设置', icon: 'settings' },
  { id: 'about', label: '关于', icon: 'compass' },
] as const;

export default function MenuRail({ onNavigate, onClose }: { onNavigate: (target: MenuTarget) => void; onClose: () => void; }) {
  return (
    <nav className="menu-rail" aria-label="快捷功能">
      <div className="menu-rail-mark" aria-hidden="true"><span>寻</span></div>
      <div className="menu-rail-items">
        {ITEMS.map(item => (
          <button key={item.id} type="button" className="menu-rail-button" aria-label={item.label} onClick={() => onNavigate(item.id)}>
            <Icon name={item.icon} /><span className="menu-rail-tooltip" aria-hidden="true">{item.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="menu-rail-button menu-rail-return" aria-label="返回校园" onClick={onClose}>
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M13 6h14v20H13M18 16H3m0 0 6-6m-6 6 6 6" /></svg>
        <span className="menu-rail-tooltip" aria-hidden="true">返回校园</span>
      </button>
    </nav>
  );
}
