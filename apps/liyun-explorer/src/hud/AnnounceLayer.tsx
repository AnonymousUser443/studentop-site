import { AnimatePresence, motion } from 'framer-motion';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { Icon } from './Icon';
import { tween } from '../motion/transitions';

export interface AnnounceItem {
  id: string | number;
  text: string;
}

export interface AnnounceLayerProps {
  /** FIFO 队列，一次只显示一条 */
  items: AnnounceItem[];
}

/**
 * 中轴播报层：带进出场与队列。
 * 旧实现只有 toast-in、靠 setTimeout 卸载，消失是瞬断；这里补上退场。
 */
export default function AnnounceLayer({ items }: AnnounceLayerProps) {
  const { reducedMotion: reduced } = useMotionPreferences();
  const current = items[0] ?? null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {current && (
        <motion.div
          key={current.id}
          className="hud-announce"
          role="status"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={reduced ? tween.tap : tween.base}
        >
          <Icon name="star" />
          <span>{current.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
