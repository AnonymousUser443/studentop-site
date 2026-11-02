import type { ReactNode } from 'react';

export interface SettingRowProps {
  label: string;
  hint?: string;
  control: ReactNode;
  disabled?: boolean;
}

/** 设置页的浅色宣纸条：左文右控件，切角由 CSS 的 clip-path 完成 */
export default function SettingRow({ label, hint, control, disabled = false }: SettingRowProps) {
  return (
    <div className={`settings-row${disabled ? ' is-disabled' : ''}`}>
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {hint && <span className="settings-row-hint">{hint}</span>}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}
