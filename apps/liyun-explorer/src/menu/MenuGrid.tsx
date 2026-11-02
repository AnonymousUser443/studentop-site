import type { JSX } from 'react';
import { motion } from 'framer-motion';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { Icon } from '../hud/Icon';
import { tween } from '../motion/transitions';
import type { MenuTarget } from './MenuScreen';

const ENTRIES = [
  { id: 'collection', label: '收集图鉴', icon: 'chest', to: 'collection' },
  { id: 'activities', label: '活动一览', icon: 'scroll', to: 'activities' },
  { id: 'settings', label: '设置', icon: 'settings', to: 'settings' },
  { id: 'about', label: '关于', icon: 'compass', to: 'about' },
  { id: 'archive', label: '旅途档案', icon: 'book', to: null },
  { id: 'achievements', label: '寻踪成就', icon: 'star', to: null },
  { id: 'stories', label: '地标小故事', icon: 'leaf', to: null },
  { id: 'placeholder', label: '敬请期待', icon: 'lock', to: null },
] as const;

export default function MenuGrid({ onNavigate }: {
  onNavigate: (target: MenuTarget) => void;
}): JSX.Element {
  const { reducedMotion: reduced } = useMotionPreferences();

  return (
    <div className="menu-grid">
      {ENTRIES.map((entry, index) => {
        const locked = entry.to === null;
        return (
          <motion.div
            key={entry.id}
            className="menu-tile-motion"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? tween.tap : { ...tween.base, delay: index * 0.04 }}
          >
            <button
              type="button"
              className={`menu-tile${locked ? ' is-locked' : ''}`}
              aria-label={entry.label}
              aria-disabled={locked || undefined}
              title={locked ? '即将开放' : entry.label}
              onClick={() => {
                // 未开放项不触发任何行为
                if (entry.to) onNavigate(entry.to);
              }}
            >
              <Icon name={entry.icon} />
              <span className="menu-tile-label">{entry.label}</span>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
