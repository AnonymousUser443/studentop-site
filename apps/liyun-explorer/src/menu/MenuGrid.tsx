import { motion } from 'framer-motion';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { Icon } from '../hud/Icon';
import { D, tween } from '../motion/transitions';
import { MENU_ENTRIES } from './entries';
import type { MenuTarget } from './MenuScreen';

export default function MenuGrid({ onNavigate }: { onNavigate: (target: MenuTarget) => void }) {
  const { reducedMotion } = useMotionPreferences();
  return (
    <nav className="menu-grid" aria-label="旅途功能">
      {MENU_ENTRIES.map((entry, index) => (
        <motion.div key={entry.id} className="menu-tile-motion" initial={reducedMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={reducedMotion ? tween.tap : { ...tween.base, delay: D.tap + index * D.tap / 3 }}>
          <button type="button" className={`menu-tile${entry.to ? '' : ' is-locked'}`} disabled={!entry.to} aria-label={entry.to ? entry.label : `${entry.label}，${entry.detail}`} onClick={() => { if (entry.to) onNavigate(entry.to); }}>
            <span className="menu-tile-icon"><Icon name={entry.icon} /></span>
            <span className="menu-tile-label">{entry.label}</span>
            <span className="menu-tile-detail">{entry.detail}</span>
          </button>
        </motion.div>
      ))}
    </nav>
  );
}
