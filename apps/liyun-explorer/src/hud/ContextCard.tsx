import { useEffect, useId, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { tween } from '../motion/transitions';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import HudButton from './HudButton';

interface ContextCardProps {
  actions: ReactNode;
  children: ReactNode;
  className?: string;
  attention?: string;
}

/** 定位操作始终可见；手机默认收拢说明文字，手动展开后保持用户选择。 */
export default function ContextCard({ actions, children, className = '', attention }: ContextCardProps) {
  const [expanded, setExpanded] = useState(() => !matchMedia('(max-height: 560px), (max-width: 1000px)').matches);
  const detailsId = useId();
  const { reducedMotion } = useMotionPreferences();
  useEffect(() => { if (attention) setExpanded(true); }, [attention]);
  return <div className={`hud-context-card ${className}`} data-expanded={expanded}>
    <div className="hud-context-actions">
      {actions}
      <HudButton className="hud-context-toggle" aria-expanded={expanded} aria-controls={detailsId}
        aria-label={expanded ? '收起定位详情' : '展开定位详情'} onClick={() => setExpanded(value => !value)}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.5"/></svg>
      </HudButton>
    </div>
      <motion.div id={detailsId} className="hud-context-details" aria-hidden={!expanded} inert={!expanded || undefined}
        initial={false} animate={expanded ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={reducedMotion ? tween.tap : tween.base}>
        <div className="hud-context-details-inner">{children}</div>
      </motion.div>
  </div>;
}
