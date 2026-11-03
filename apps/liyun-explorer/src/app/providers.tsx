import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { useSettings } from './stores/useSettings';
import { useMotionPreferences } from '../motion/useMotionPreferences';

/**
 * 全局 Provider：
 *  - 把 qualityPreset 写入 <html data-quality>，驱动 quality.css 的 CSS 变量
 *  - 把 reducedMotion 写入 <html data-motion>，供纯 CSS 环境层读取
 *  - MotionConfig：系统与游戏内减少动态取或，包含实时系统变更
 *
 * 注意：这里只做"投影"，不持有状态；所有写入走 useSettings。
 */
export default function Providers({ children }: { children: ReactNode }) {
  const preset = useSettings((s) => s.settings.qualityPreset);
  const { systemReduced, reducedMotion, reduceFlash, ambient } = useMotionPreferences();
  const hudScale = useSettings((s) => s.settings.hudScale);
  const blur = useSettings((s) => s.spec.backdropBlur);
  const shadowStyle = useSettings((s) => s.spec.dropShadows);
  const refreshQuality = useSettings((s) => s.refreshQuality);

  useEffect(() => {
    refreshQuality();
  }, [systemReduced, refreshQuality]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    // custom 档位按 high 渲染 CSS（真实参数由 spec 计算，CSS 只需一个近似值）
    root.dataset.quality = preset === 'custom' ? 'high' : preset;
  }, [preset]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.ambient = ambient ? 'on' : 'off';
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
    root.dataset.reduceFlash = reduceFlash ? 'true' : 'false';
    root.style.setProperty('--hud-scale', String(hudScale));
    root.style.setProperty('--q-blur', `${blur}px`);
    root.style.setProperty('--q-shadow', shadowStyle === 'flat'
      ? '0 1px 2px color-mix(in srgb, var(--jade-950) 20%, transparent)'
      : shadowStyle === 'rich' ? 'var(--sh-soft), var(--sh-deep)' : 'var(--sh-soft)');
    const visibility = () => { root.dataset.pageVisible = document.hidden ? 'false' : 'true'; };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [ambient, reducedMotion, reduceFlash, hudScale, blur, shadowStyle]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
      {children}
    </MotionConfig>
  );
}
