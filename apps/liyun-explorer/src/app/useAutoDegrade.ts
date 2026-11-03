import { useEffect, useRef } from 'react';
import { useSettings } from './stores/useSettings';

export type AutoDegradeEvent = {
  from: 'high' | 'ultra';
  to: 'low' | 'high';
  originalPreset: 'high' | 'ultra';
};

const FPS_THRESHOLD = 26;
const FIRST_WINDOW_MS = 5000;
const NEXT_WINDOW_MS = 30000;
const CONSECUTIVE_BAD_WINDOWS = 2;

/**
 * 首窗 5s，后续 30s；连续两个有效低帧率窗口才降档。
 * App 传入所有会暂停地图的状态。暂停或隐藏时取消整个窗口和连续计数，
 * 恢复后从新窗口开始，暂停的墙钟时间永远不会成为性能证据。
 * 一段自动降级经历只通知一次；再次降级仍保留最初档位供用户恢复。
 */
export function useAutoDegrade(paused: boolean, onDegrade?: (event: AutoDegradeEvent) => void): void {
  const autoDegrade = useSettings(s => s.settings.autoDegrade);
  const preset = useSettings(s => s.settings.qualityPreset);
  const degradedFrom = useSettings(s => s.settings.degradedFrom);
  const degrade = useSettings(s => s.degrade);
  const callback = useRef(onDegrade);
  callback.current = onDegrade;

  useEffect(() => {
    // 关闭、显式暂停、最低档和自定义档均不注册采样器或监听器。
    if (!autoDegrade || paused || (preset !== 'high' && preset !== 'ultra')) return;

    let raf: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let frames = 0;
    let windowStart = 0;
    let badStreak = 0;

    const stopWindow = () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (timer !== undefined) clearTimeout(timer);
      raf = undefined;
      timer = undefined;
      frames = 0;
    };

    const tick = () => {
      if (disposed) return;
      // visibilitychange 是主路径；这里防止隐藏事件延迟时仍累计当前窗口。
      if (document.hidden) {
        stopWindow();
        badStreak = 0;
        return;
      }
      frames += 1;
      raf = requestAnimationFrame(tick);
    };

    const startWindow = (duration: number) => {
      if (disposed || document.hidden) return;
      stopWindow();
      windowStart = performance.now();
      raf = requestAnimationFrame(tick);
      timer = setTimeout(() => {
        if (disposed || document.hidden) {
          stopWindow();
          badStreak = 0;
          return;
        }
        const elapsed = performance.now() - windowStart;
        const fps = elapsed > 0 ? frames * 1000 / elapsed : Infinity;
        stopWindow();
        badStreak = elapsed >= 1200 && fps < FPS_THRESHOLD ? badStreak + 1 : 0;
        if (badStreak >= CONSECUTIVE_BAD_WINDOWS) {
          if (degrade(preset) && degradedFrom === null) {
            callback.current?.({ from: preset, to: preset === 'ultra' ? 'high' : 'low', originalPreset: preset });
          }
          // 成功时 store 的新档位会重启 effect；失败时也不遗留后台采样。
          return;
        }
        startWindow(NEXT_WINDOW_MS);
      }, duration);
    };

    const onVisibilityChange = () => {
      stopWindow();
      badStreak = 0;
      if (!document.hidden) startWindow(FIRST_WINDOW_MS);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    startWindow(FIRST_WINDOW_MS);
    return () => {
      disposed = true;
      stopWindow();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [autoDegrade, preset, degradedFrom, degrade, paused]);
}
