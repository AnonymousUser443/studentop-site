/**
 * HudFrame：HUD 的"四锚"外壳。
 *
 * 只负责定位，不负责内容。所有内容通过 slots 传入，避免品牌/状态/坞各自 absolute。
 * 移动端只改 --hud-gutter 一处，四个锚点全部跟随（见 V2 计划 4.1）。
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { hudReveal } from '../motion/transitions';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import './hud-frame.css';

export interface HudFrameProps {
  brand: ReactNode;
  status: ReactNode;
  dock: ReactNode;
  progress: ReactNode;
  /** 右侧上下文卡（定位/详情），可空 */
  context?: ReactNode;
  /** 中轴播报层，可空 */
  announce?: ReactNode;
  /** HUD 整体是否禁用交互（进入前 / 面板打开时） */
  inert?: boolean;
  /** 是否为紧凑模式（面板打开时压低存在感） */
  compact?: boolean;
  visible?: boolean;
}

export default function HudFrame({
  brand, status, dock, progress, context, announce, inert = false, compact = false, visible = true,
}: HudFrameProps) {
  const { reducedMotion } = useMotionPreferences();
  const slots = [
    { name: 'brand', content: brand, x: -12, y: 0, order: 0 },
    { name: 'status', content: status, x: 12, y: 0, order: 0 },
    { name: 'dock', content: dock, x: 0, y: 12, order: 1 },
    { name: 'progress', content: progress, x: 0, y: 10, order: 3 },
    { name: 'context', content: context, x: 12, y: 0, order: 2 },
  ];
  return (
    <>
    <div
      className="hud-frame"
      data-compact={compact ? 'true' : 'false'}
      aria-hidden={!visible || undefined}
      inert={inert || !visible || undefined}
    >
      {slots.map(({ name, content, ...reveal }) => content != null && (
        <div key={name} className={`hud-anchor hud-anchor--${name}`}>
          <motion.div className="hud-slot" custom={{ ...reveal, reduced: reducedMotion }}
            variants={hudReveal} initial="hidden" animate={visible ? 'visible' : 'hidden'}>
            {content}
          </motion.div>
        </div>
      ))}
    </div>
    {visible && announce != null && <div className="hud-announce-layer">{announce}</div>}
    </>
  );
}
