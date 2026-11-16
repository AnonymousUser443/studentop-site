import { memo, useRef, type KeyboardEvent } from 'react';
import { useMotionPreferences } from '../../motion/useMotionPreferences';

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

/** 选中时留一缕流光，方印内沿对角切开的三角轻移。 */
export default memo(function SettingsRail({ active, onChange }: SettingsRailProps) {
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
            {selected && !reducedMotion && !reduceFlash && <span key={active} className="settings-rail-sweep" aria-hidden="true"><i /><i /><i /></span>}
            <span className="settings-rail-emblem" aria-hidden="true"><span /></span>
            <span className="settings-rail-label">{category.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
