import { useSettings } from '../app/stores/useSettings';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { QUALITY_LABELS, QUALITY_PRESETS, type QualityPreset, type QualitySpec } from './spec';
import SettingRow from './ui/SettingRow';
import SettingSelect, { type SettingSelectOption } from './ui/SettingSelect';
import SettingSlider from './ui/SettingSlider';
import SettingSwitch from './ui/SettingSwitch';

export default function QualitySettings({ isFullscreen, onFullscreen }: { isFullscreen: boolean; onFullscreen: () => void }) {
  const settings = useSettings(s => s.settings);
  const effective = useSettings(s => s.spec);
  const update = useSettings(s => s.update);
  const setPreset = useSettings(s => s.setPreset);
  const setOverride = useSettings(s => s.setOverride);
  const restoreDegraded = useSettings(s => s.restoreDegraded);
  const { systemReduced, reducedMotion } = useMotionPreferences();
  const base = settings.qualityPreset === 'custom' ? settings.baseQualityPreset : settings.qualityPreset;
  const configured = { ...QUALITY_PRESETS[base], ...settings.qualityOverrides };
  const changed = (key: keyof QualitySpec) => configured[key] !== QUALITY_PRESETS[base][key];
  const changedCount = (Object.keys(configured) as (keyof QualitySpec)[]).filter(changed).length;
  const qualityOptions: SettingSelectOption[] = (['low', 'high', 'ultra'] as const).map(value => ({ value, label: QUALITY_LABELS[value] }));
  if (settings.qualityPreset === 'custom') qualityOptions.push({ value: 'custom', label: `自定义 · 基于${QUALITY_LABELS[base]}`, disabled: true });
  const options = (items: readonly (readonly [string, string])[]): SettingSelectOption[] => items.map(([value, label]) => ({ value, label }));
  const numberSlider = (key: 'pixelDensity' | 'fogFps' | 'lightFps' | 'leafCount' | 'moteCount' | 'backdropBlur', label: string, min: number, max: number, step: number, suffix = '') => <SettingRow key={key} label={label} customized={changed(key)} control={<SettingSlider value={configured[key]} min={min} max={max} step={step} onChange={value => setOverride(key, value)} ariaLabel={label} formatValue={value => `${step < 1 ? value.toFixed(2) : value}${suffix}`} />} />;

  return <>
    <div className="settings-quality-summary"><span className="settings-quality-seal" aria-hidden="true">画</span><div><strong>{QUALITY_LABELS[settings.qualityPreset]}</strong><p>{changedCount ? `基于${QUALITY_LABELS[base]}，已调整 ${changedCount} 项参数` : '预设会统一调整精度、光影与环境效果'}</p></div><span className="settings-quality-count">{changedCount ? `${changedCount} 项` : '预设'}</span></div>
    {(reducedMotion || settings.qualityPreset === 'low') && <p className="settings-policy-note">{systemReduced ? '系统已启用减少动态效果。' : settings.reducedMotion ? '已启用减少动态效果。' : '流畅预设已启用轻量显示。'}环境动画、叠层云纹与背景模糊会自动收敛；下方仍显示你的配置，关闭保护后恢复。</p>}
    <div className="settings-rows">
      <SettingRow label="画面预设" hint="切换预设会替换下方自定义参数" control={<SettingSelect value={settings.qualityPreset} options={qualityOptions} onChange={value => setPreset(value as QualityPreset)} ariaLabel="画面预设" />} />
      <SettingRow label="界面缩放" hint="调整地图 HUD 的尺寸" control={<SettingSelect value={String(settings.hudScale)} options={options([['0.9', '紧凑 · 90%'], ['1', '标准 · 100%'], ['1.12', '舒适 · 112%']])} onChange={value => update({ hudScale: Number(value) as .9 | 1 | 1.12 })} ariaLabel="界面缩放" />} />
      <SettingRow label="全屏显示" control={<button type="button" className="settings-inline-button" onClick={onFullscreen}>{isFullscreen ? '退出全屏' : '进入全屏'} <span aria-hidden="true">↗</span></button>} />
    </div>
    <h3 className="settings-subtitle">画面细节<span>单项修改将标记为自定义</span></h3>
    <div className="settings-rows">
      {numberSlider('pixelDensity', '渲染精度', .75, 2, .05, '×')}
      <SettingRow label="光晕层数" customized={changed('glowLayers')} control={<SettingSelect value={String(configured.glowLayers)} options={options([['1', '单层 · 流畅'], ['2', '双层 · 柔和'], ['3', '三层 · 细腻']])} onChange={value => setOverride('glowLayers', Number(value) as 1 | 2 | 3)} ariaLabel="光晕层数" />} />
      <SettingRow label="云纹层数" hint={effective.inkLayers !== configured.inkLayers ? `当前保护策略下生效：${effective.inkLayers} 层` : undefined} customized={changed('inkLayers')} control={<SettingSelect value={String(configured.inkLayers)} options={options([['0', '纯色'], ['1', '单层'], ['2', '叠加']])} onChange={value => setOverride('inkLayers', Number(value) as 0 | 1 | 2)} ariaLabel="云纹层数" />} />
      {numberSlider('fogFps', '云雾帧率', 12, 60, 1, ' fps')}
      {numberSlider('lightFps', '光效帧率', 15, 60, 1, ' fps')}
      {numberSlider('leafCount', '落叶数量', 0, 30, 1)}
      {numberSlider('moteCount', '微光粒子', 0, 60, 1)}
      {numberSlider('backdropBlur', '背景模糊', 0, 16, 1, ' px')}
      <SettingRow label="面板阴影" customized={changed('dropShadows')} control={<SettingSelect value={configured.dropShadows} options={options([['flat', '平面'], ['soft', '柔和'], ['rich', '丰富']])} onChange={value => setOverride('dropShadows', value as QualitySpec['dropShadows'])} ariaLabel="面板阴影" />} />
      <SettingRow label="墨散细节" customized={changed('inkRevealFidelity')} control={<SettingSelect value={configured.inkRevealFidelity} options={options([['simple', '简洁'], ['full', '完整']])} onChange={value => setOverride('inkRevealFidelity', value as QualitySpec['inkRevealFidelity'])} ariaLabel="墨散细节" />} />
      <SettingRow label="环境呼吸" hint="HUD 呼吸与纸面微尘" customized={changed('cssAmbient')} control={<SettingSwitch checked={configured.cssAmbient} onChange={value => setOverride('cssAmbient', value)} ariaLabel="环境呼吸" />} />
    </div>
    <h3 className="settings-subtitle">舒适与性能</h3>
    <div className="settings-rows">
      <SettingRow label="减少动态效果" hint={systemReduced ? '系统偏好正在生效，游戏内关闭也会保留系统保护' : '减少位移、呼吸与环境动画'} control={<SettingSwitch checked={settings.reducedMotion} onChange={value => update({ reducedMotion: value })} ariaLabel="减少动态效果" />} />
      <SettingRow label="减少强闪光" hint="收敛高亮闪烁与扫光" control={<SettingSwitch checked={settings.reduceFlash} onChange={value => update({ reduceFlash: value })} ariaLabel="减少强闪光" />} />
      <SettingRow label="自动降低画质" hint="持续卡顿时自动降低一档；关闭后保留当前画质" control={<SettingSwitch checked={settings.autoDegrade} onChange={value => update({ autoDegrade: value })} ariaLabel="自动降级" />} />
    </div>
    {settings.degradedFrom && <div className="settings-degrade-note"><span>曾因性能自动降级，原档位为{QUALITY_LABELS[settings.degradedFrom]}。</span><button type="button" className="settings-inline-button" onClick={restoreDegraded}>恢复原档</button></div>}
  </>;
}
