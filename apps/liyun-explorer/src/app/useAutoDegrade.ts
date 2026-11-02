import { useEffect, useRef } from 'react';
import { useSettings } from './stores/useSettings';

/**
 * 自动降级采样器（见 docs/UI-REFACTOR-PLAN-V2.md 6.3 / 6.3.1）。
 *
 * 契约：
 *  - autoDegrade === false 时**完全不注册**任何 rAF 采样，零后台开销
 *  - 只在 preset 为 high / ultra 时工作（low 已是最低档，无需再降）
 *  - 首窗 5s，之后每 30s 复采
 *  - 需**连续两个**窗口低于阈值才降档，避免一次掉帧就降
 *  - 降档后写入 degradedFrom，供设置页"恢复原档"
 *  - 页面隐藏时不计入采样（后台标签页天然掉帧，不能当性能证据）
 */
const FPS_THRESHOLD = 26;
const FIRST_WINDOW_MS = 5000;
const NEXT_WINDOW_MS = 30000;
const CONSECUTIVE_BAD_WINDOWS = 2;

export function useAutoDegrade(paused: boolean): void {
  const autoDegrade = useSettings(s => s.settings.autoDegrade);
  const preset = useSettings(s => s.settings.qualityPreset);
  const degrade = useSettings(s => s.degrade);
  const badStreak = useRef(0);

  useEffect(() => {
    // 契约：关闭即彻底停用，不留任何 rAF / 定时器
    if (!autoDegrade) {
      badStreak.current = 0;
      return;
    }
    if (preset !== 'high' && preset !== 'ultra') {
      badStreak.current = 0;
      return;
    }

    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let frames = 0;
    let windowStart = 0;

    const stopSampling = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    const finishWindow = () => {
      if (disposed) return;
      const elapsed = performance.now() - windowStart;
      // 采样窗过短（例如立刻被暂停）不足以判定，直接丢弃
      if (elapsed < 1200) { badStreak.current = 0; return; }
      const fps = (frames * 1000) / elapsed;
      frames = 0;
      windowStart = performance.now();
      if (fps < FPS_THRESHOLD) {
        badStreak.current += 1;
        if (badStreak.current >= CONSECUTIVE_BAD_WINDOWS) {
          badStreak.current = 0;
          degrade(preset);
          return; // 降档后 preset 变化，effect 会重新跑
        }
      } else {
        badStreak.current = 0;
      }
      schedule();
    };

    const schedule = () => {
      if (disposed) return;
      clearTimeout(timer);
      timer = setTimeout(finishWindow, NEXT_WINDOW_MS);
    };

    const tick = () => {
      if (disposed) return;
      if (document.hidden || paused) {
        // 暂停期间不计数，也不累计坏窗口
        raf = requestAnimationFrame(tick);
        return;
      }
      frames += 1;
      raf = requestAnimationFrame(tick);
    };

    // 首窗
    windowStart = performance.now();
    frames = 0;
    raf = requestAnimationFrame(tick);
    timer = setTimeout(finishWindow, FIRST_WINDOW_MS);

    return () => {
      disposed = true;
      stopSampling();
      clearTimeout(timer);
    };
  }, [autoDegrade, preset, degrade, paused]);
}
