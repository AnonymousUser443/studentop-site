import * as Switch from '@radix-ui/react-switch';

export interface SettingSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/** 玉色药丸开关，滑块为宣纸白圆点 */
export default function SettingSwitch({ checked, onChange, ariaLabel, disabled = false }: SettingSwitchProps) {
  return (
    <Switch.Root
      className="settings-switch"
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <Switch.Thumb className="settings-switch-thumb" />
    </Switch.Root>
  );
}
