import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useMotionPreferences } from '../../motion/useMotionPreferences';
import { tween } from '../../motion/transitions';

export const SETTINGS_CATEGORIES = [
  { id: 'control', label: '控制' },
  { id: 'keys',    label: '按键' },
  { id: 'image',   label: '图像' },
  { id: 'sound',   label: '声音' },
  { id: 'message', label: '消息' },
  { id: 'account', label: '账户' },
  { id: 'data',    label: '数据' },
  { id: 'other',   label: '其他' },
] as const;

export type SettingsCategoryId = typeof SETTINGS_CATEGORIES[number]['id'];

interface SettingsRailProps {
  active: SettingsCategoryId;
  onChange: (id: SettingsCategoryId) => void;
}

/** 左侧分类栏：◆ 标记 + 金色选中线，方向键在 tab 间循环 */
export default function SettingsRail({ active, onChange }: SettingsRailProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const { reducedMotion, reduceFlash } = useMotionPreferences();

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? SETTINGS_CATEGORIES.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length;
    onChange(SETTINGS_CATEGORIES[next].id);
    buttons.current[next]?.focus();
    buttons.current[next]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <nav className="settings-rail" role="tablist" aria-label="设置分类" aria-orientation="vertical">
      {SETTINGS_CATEGORIES.map((category, index) => {
        const selected = category.id === active;
        return (
          <button
            key={category.id}
            ref={node => { buttons.current[index] = node; }}
            id={`settings-tab-${category.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`settings-panel-${category.id}`}
            tabIndex={selected ? 0 : -1}
            className="settings-rail-item"
            onClick={() => onChange(category.id)}
            onKeyDown={event => move(event, index)}
          >
            {selected && <motion.span layoutId="settings-category-highlight" className="settings-rail-selected" transition={reducedMotion ? tween.tap : tween.base} aria-hidden="true" />}
            {selected && !reducedMotion && !reduceFlash && <span key={active} className="settings-rail-sweep" aria-hidden="true"><i /><i /><i /></span>}
            <span className="settings-rail-diamond" aria-hidden="true" />
            <span className="settings-rail-label">{category.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
