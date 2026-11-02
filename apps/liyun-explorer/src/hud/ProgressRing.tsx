/**
 * 探索进度环：替代原来的 9px 细条。
 * 三件事：① 环形描边按 progress 生长；② 数字滚动；③ 数值变化时 aria-live 播报。
 */
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { tween } from '../motion/transitions';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import HudButton from './HudButton';

export interface ProgressRingProps {
  /** 0–100 */
  progress: number;
  /** 已收录 / 总数 */
  collected: number;
  total: number;
  /** 校区名（书法体，窄屏隐藏） */
  campusName?: string;
  /** 存档标识，如 "游客 · 本机存档" 或 "UID: LY06112403" */
  saveLabel: string;
  onClick?: () => void;
}

const SIZE = 96;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

export default function ProgressRing({
  progress, collected, total, campusName = '良乡校区', saveLabel, onClick,
}: ProgressRingProps) {
  const { reducedMotion, reduceFlash, ambient } = useMotionPreferences();
  const target = clamp(progress);
  // 弧线和数字共用一个值；补间直接更新 DOM，不逐帧触发 React render。
  const shown = useMotionValue(target);
  const rounded = useTransform(shown, value => String(Math.round(value)));
  const offset = useTransform(shown, value => C * (1 - value / 100));
  const previous = useRef(target);
  const sweepId = useRef(0);
  const [sweep, setSweep] = useState<number | null>(null);

  useEffect(() => {
    const increased = target > previous.current;
    previous.current = target;
    if (reducedMotion) { shown.set(target); setSweep(null); return; }
    // 从当前可见值续接，快速更新或中途切换偏好时不会回跳。
    const controls = animate(shown, target, tween.scene);
    if (increased && !reduceFlash && ambient) setSweep(++sweepId.current);
    else setSweep(null);
    return () => controls.stop();
  }, [target, shown, reducedMotion, reduceFlash, ambient]);

  return (
    <div className="hud-progress">
      <HudButton
        type="button"
        className="hud-progress-ring"
        onClick={onClick}
        aria-label={`探索度 ${Math.round(target)}%，已收录 ${collected} / ${total} 处地标，回到校园中心`}
        title="回到校园中心"
        data-testid="hud-progress"
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="hud-progress-svg" aria-hidden="true">
          <circle className="hud-progress-track" cx={SIZE / 2} cy={SIZE / 2} r={R} />
          <motion.circle
            className="hud-progress-arc"
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            style={{ strokeDasharray: C, strokeDashoffset: offset }}
          />
        </svg>
        {sweep !== null && !reducedMotion && !reduceFlash && ambient && (
          <span key={sweep} className="hud-progress-sweep ambient-only" aria-hidden="true" onAnimationEnd={() => setSweep(null)} />
        )}
        <span className="hud-progress-value tabular" aria-hidden="true">
          <span className="hud-progress-caption">探索度</span>
          <motion.span className="hud-progress-number">{rounded}</motion.span>
          <span className="hud-progress-unit">%</span>
        </span>
      </HudButton>
      <div className="hud-progress-meta">
        {campusName && <span className="hud-progress-campus">{campusName}</span>}
        <span className="hud-progress-count tabular">{collected} / {total}</span>
        <span className="hud-progress-save">{saveLabel}</span>
      </div>
      {/* 数值变化播报：读屏用户唯一能感知进度变更的通道 */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        探索度 {Math.round(target)}%，已收录 {collected} / {total} 处地标
      </span>
    </div>
  );
}
