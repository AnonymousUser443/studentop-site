import { useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';

export interface SettingSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  /** 数值展示格式，默认按步进保留一位或两位小数 */
  formatValue?: (value: number) => string;
  note?: string;
  disabled?: boolean;
  /** Preview the thumb while dragging; apply expensive effects on release. */
  applyOnRelease?: boolean;
}

/** 菱形游标滑条：轨道细金，右侧固定宽度数值 */
export default function SettingSlider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
  formatValue,
  note,
  disabled = false,
  applyOnRelease = false,
}: SettingSliderProps) {
  const [preview, setPreview] = useState<number | null>(null);
  useEffect(() => { setPreview(null); }, [value]);
  const shown = applyOnRelease ? preview ?? value : value;
  const display = formatValue ? formatValue(shown) : shown.toFixed(step < 0.1 ? 2 : 1);
  return (
    <div className="settings-slider-control">
      <Slider.Root
        className="settings-slider-root"
        value={[shown]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        onValueChange={next => {
          const first = next[0];
          if (first === undefined) return;
          if (applyOnRelease) setPreview(first);
          else onChange(first);
        }}
        onValueCommit={next => {
          if (!applyOnRelease) return;
          setPreview(null);
          const first = next[0];
          if (first !== undefined && first !== value) onChange(first);
        }}
        onPointerCancel={() => { if (applyOnRelease) setPreview(null); }}
      >
        <Slider.Track className="settings-slider-track">
          <Slider.Range className="settings-slider-range" />
        </Slider.Track>
        <Slider.Thumb className="settings-slider-thumb" aria-label={ariaLabel} aria-valuetext={display} />
      </Slider.Root>
      <output className="settings-slider-value">{display}</output>
      {note && <span className="settings-dev-note">{note}</span>}
    </div>
  );
}
