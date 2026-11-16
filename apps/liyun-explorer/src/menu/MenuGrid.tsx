import { memo, type CSSProperties } from 'react';
import { Icon } from '../hud/Icon';
import { D } from '../motion/transitions';
import { MENU_ENTRIES } from './entries';
import type { MenuTarget } from './MenuScreen';

const entries = MENU_ENTRIES.map((entry, index) => ({
  entry, style: { '--menu-tile-delay': `${D.tap + index * D.tap / 3}s` } as CSSProperties,
}));

export default memo(function MenuGrid({ onNavigate }: { onNavigate: (target: MenuTarget) => void }) {
  return (
    <nav className="menu-grid" aria-label="旅途功能">
      {entries.map(({ entry, style }) => (
        <div key={entry.id} className="menu-tile-motion" style={style}>
          <button type="button" className={`menu-tile${entry.to ? '' : ' is-locked'}`} disabled={!entry.to} aria-label={entry.to ? entry.label : `${entry.label}，${entry.detail}`} onClick={() => { if (entry.to) onNavigate(entry.to); }}>
            <span className="menu-tile-icon"><Icon name={entry.icon} /></span>
            <span className="menu-tile-label">{entry.label}</span>
            <span className="menu-tile-detail">{entry.detail}</span>
          </button>
        </div>
      ))}
    </nav>
  );
});
