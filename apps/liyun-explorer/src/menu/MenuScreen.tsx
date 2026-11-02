import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { AccountUser } from '../types';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../hud/Icon';
import { useSettings } from '../app/stores/useSettings';
import { tween } from '../motion/transitions';
import MenuRail from './MenuRail';
import MenuGrid from './MenuGrid';
import './menu.css';

/** 本页可跳转的四个入口（其余项为未开放占位） */
export type MenuTarget = 'collection' | 'activities' | 'settings' | 'about';

export default function MenuScreen({ onClose, onNavigate, account, progress, collected, total }: {
  onClose: () => void;
  onNavigate: (target: MenuTarget) => void;
  account: AccountUser | null;
  progress: number;
  collected: number;
  total: number;
}): JSX.Element {
  const settings = useSettings((s) => s.settings);
  const systemReduced = useReducedMotion();
  const reduced = systemReduced || settings.reducedMotion;
  const closeRef = useRef<HTMLButtonElement>(null);
  const explorationPercent = Math.max(0, Math.min(100, progress));
  const rank = Math.min(10, Math.floor(explorationPercent / 10) + 1);

  // Esc 关闭菜单；打开时把焦点移到返回按钮
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section className="menu-screen" role="dialog" aria-modal="true" aria-label="旅途菜单">
      {/* 上下纸浪：12% 高、6% 透明度，仅作压边 */}
      <div className="menu-wave menu-wave-top" aria-hidden="true" />
      <div className="menu-wave menu-wave-bottom" aria-hidden="true" />

      <button
        ref={closeRef}
        type="button"
        className="menu-close"
        aria-label="返回地图"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>

      <div className="menu-scroll">
        <motion.section
          className="menu-card"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? tween.fast : tween.page}
          aria-label="个人信息"
        >
          <div className="menu-identity">
            {/* 外层保持 96×96 占位，内层菱形 68×68 居中旋转 */}
            <div className="menu-avatar" aria-hidden="true">
              <span className="menu-avatar-diamond">
                <Icon name="gate" />
              </span>
            </div>
            <div className="menu-identity-text">
              <h1 className="menu-nickname">{account?.nickname ?? '游客'}</h1>
              <p className="menu-signature">已点亮 {collected} / {total} 处地标</p>
            </div>
          </div>

          <div className="menu-rank">
            <span className="menu-rank-label">寻踪阶</span>
            <span className="menu-rank-value">{rank}</span>
            <div
              className="menu-progress"
              role="progressbar"
              aria-label="探索度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={explorationPercent}
            >
              <span className="menu-progress-fill" style={{ width: `${explorationPercent}%` }} />
            </div>
            <span className="menu-progress-text">探索度 {explorationPercent}%</span>
          </div>

          <div className="menu-meta">
            <span>{account ? `UID · ${account.uid}` : '游客 · 本机存档'}</span>
            <span>良乡校区 · 秋</span>
          </div>
        </motion.section>

        <MenuGrid onNavigate={onNavigate} />
      </div>

      <MenuRail onNavigate={onNavigate} />
    </section>
  );
}
