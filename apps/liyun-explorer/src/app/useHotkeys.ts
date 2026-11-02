import { useEffect } from 'react';

export interface HotkeyActions {
  onActivities: () => void;
  onCollection: () => void;
  onCenter: () => void;
  onFullscreen: () => void;
  onLocate: () => void;
}

/**
 * 桌面热键（与设置页「按键」分类的键位表一一对应）。
 *
 * 规则：
 *  - 输入框/文本域/可编辑区内不触发（避免打字被吞）
 *  - 有修饰键（Ctrl/Alt/Meta）时不触发，不抢占浏览器快捷键
 *  - 触屏设备也注册（外接键盘可用），但界面上不显示提示
 */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
};

export function useHotkeys(actions: HotkeyActions, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key.toLowerCase()) {
        case 'a': event.preventDefault(); actions.onActivities(); break;
        case 'c': event.preventDefault(); actions.onCollection(); break;
        case 'm': event.preventDefault(); actions.onCenter(); break;
        case 'f': event.preventDefault(); actions.onFullscreen(); break;
        case 'l': event.preventDefault(); actions.onLocate(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, enabled]);
}
