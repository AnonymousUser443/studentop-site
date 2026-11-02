import * as Select from '@radix-ui/react-select';

export interface SettingSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SettingSelectProps {
  value: string;
  options: SettingSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** 行尾的开发中标记 */
  note?: string;
}

/** 自绘皮肤下拉：透明触发器 + 玉底金边弹层 */
export default function SettingSelect({ value, options, onChange, ariaLabel, disabled = false, note }: SettingSelectProps) {
  const selected = options.find(option => option.value === value);
  return (
    <div className="settings-select-control">
      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger className="settings-select-trigger" aria-label={ariaLabel}>
          <span className="settings-select-value">{selected?.label ?? value}</span>
          <Select.Icon asChild>
            <span className="settings-select-caret" aria-hidden="true">▾</span>
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="settings-select-content" position="popper" sideOffset={6} align="end">
            <Select.Viewport className="settings-select-viewport">
              {options.map(option => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="settings-select-item"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="settings-select-check">
                    <span aria-hidden="true">✓</span>
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {note && <span className="settings-dev-note">{note}</span>}
    </div>
  );
}
