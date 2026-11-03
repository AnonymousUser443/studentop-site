import { useId, type ReactNode } from 'react';

export interface SettingRowProps {
  label: string;
  hint?: string;
  control: ReactNode;
  disabled?: boolean;
  customized?: boolean;
}

/** 设置页的浅色宣纸条：左文右控件，切角由 CSS 的 clip-path 完成 */
export default function SettingRow({ label, hint, control, disabled = false, customized = false }: SettingRowProps) {
  const hintId = useId();
  return (
    <div className={`settings-row${disabled ? ' is-disabled' : ''}${customized ? ' is-customized' : ''}`} role="group" aria-label={label} aria-describedby={hint ? hintId : undefined}>
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}{customized && <span className="settings-custom-mark">自定义</span>}</span>
        {hint && <span id={hintId} className="settings-row-hint">{hint}</span>}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}
