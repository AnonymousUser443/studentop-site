import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSettings } from '../app/stores/useSettings';
import { Icon } from '../hud/Icon';
import { tween } from '../motion/transitions';
import { QUALITY_LABELS, type QualityPreset } from './spec';
import SettingRow from './ui/SettingRow';
import SettingSelect, { type SettingSelectOption } from './ui/SettingSelect';
import SettingSlider from './ui/SettingSlider';
import SettingSwitch from './ui/SettingSwitch';
import SettingsRail, { SETTINGS_CATEGORIES, type SettingsCategoryId } from './ui/SettingsRail';
import './settings.css';

const SAVE_KEY = 'liyun.exploration.v2';

const KEYMAP = [
  { action: '打开活动一览', key: 'A', description: '' },
  { action: '打开收集图鉴', key: 'C', description: '' },
  { action: '回到中心', key: 'M', description: '' },
  { action: '切换全屏', key: 'F', description: '' },
  { action: '定位到我', key: 'L', description: '' },
  { action: '关闭面板', key: 'Esc', description: '' },
] as const;

export default function SettingsScreen({ onClose }: { onClose: () => void }): JSX.Element {
  const settings = useSettings(s => s.settings);
  const spec = useSettings(s => s.spec);
  const update = useSettings(s => s.update);
  const setPreset = useSettings(s => s.setPreset);
  const setOverride = useSettings(s => s.setOverride);
  const restoreDegraded = useSettings(s => s.restoreDegraded);

  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced) || settings.reducedMotion;

  const [active, setActive] = useState<SettingsCategoryId>('control');
  const activeLabel = SETTINGS_CATEGORIES.find(category => category.id === active)?.label ?? '设置';

  // 尚未接入 store 的条目先放在页面本地
  const [dragSensitivity, setDragSensitivity] = useState(1.0);
  const [zoomLimit, setZoomLimit] = useState(2.7);
  const [doubleZoom, setDoubleZoom] = useState('1.45');
  const [messageDuration, setMessageDuration] = useState('3.6');
  const [congratsShow, setCongratsShow] = useState('on');
  const [redDot, setRedDot] = useState(true);
  const [resetArmed, setResetArmed] = useState(false);

  const degradedFrom = settings.degradedFrom;

  // Esc 关闭：捕获阶段拦截，避免被下层面板先消费
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // 重置进度两段式确认：3 秒未再点自动收起
  useEffect(() => {
    if (!resetArmed) return;
    const timer = setTimeout(() => setResetArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [resetArmed]);

  const restoreDefaults = () => {
    setPreset('high');
    update({
      music: true,
      volume: 0.35,
      track: 0,
      reducedMotion: false,
      uiSound: true,
      reduceFlash: false,
      autoDegrade: true,
      hudScale: 1,
    });
  };

  const exportSave = () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const blob = new Blob([raw], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'liyun-save.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const resetProgress = () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  };

  const qualityOptions: SettingSelectOption[] = (['low', 'high', 'ultra'] as const).map(value => ({
    value,
    label: QUALITY_LABELS[value],
  }));
  if (settings.qualityPreset === 'custom') {
    qualityOptions.push({ value: 'custom', label: QUALITY_LABELS.custom, disabled: true });
  }

  const renderCategory = (): ReactNode => {
    switch (active) {
      case 'control':
        return (
          <div className="settings-rows">
            <SettingRow
              label="拖动灵敏度"
              hint="地图拖动的跟手程度"
              control={
                <SettingSlider
                  value={dragSensitivity}
                  min={0.6}
                  max={2.0}
                  step={0.1}
                  onChange={setDragSensitivity}
                  ariaLabel="拖动灵敏度"
                  formatValue={value => value.toFixed(1)}
                  note="（开发中）"
                />
              }
            />
            <SettingRow
              label="缩放上限"
              control={
                <SettingSlider
                  value={zoomLimit}
                  min={1.5}
                  max={4.0}
                  step={0.1}
                  onChange={setZoomLimit}
                  ariaLabel="缩放上限"
                  formatValue={value => value.toFixed(1)}
                  note="（开发中）"
                />
              }
            />
            <SettingRow
              label="双击缩放"
              control={
                <SettingSelect
                  value={doubleZoom}
                  options={[
                    { value: '1.2', label: '1.2' },
                    { value: '1.45', label: '1.45' },
                    { value: '1.8', label: '1.8' },
                  ]}
                  onChange={setDoubleZoom}
                  ariaLabel="双击缩放"
                  note="（开发中）"
                />
              }
            />
          </div>
        );

      case 'keys':
        return (
          <>
            <dl className="settings-keymap">
              <div className="settings-keymap-row settings-keymap-head">
                <dt>功能</dt>
                <dd>按键</dd>
                <dd>说明</dd>
              </div>
              {KEYMAP.map(item => (
                <div className="settings-keymap-row" key={item.action}>
                  <dt>{item.action}</dt>
                  <dd className="settings-keymap-key">{item.key}</dd>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
            <p className="settings-note">快捷键在桌面端生效；触屏设备可使用界面按钮。</p>
          </>
        );

      case 'image':
        return (
          <div className="settings-rows">
            <SettingRow
              label="画面预设"
              control={
                <SettingSelect
                  value={settings.qualityPreset}
                  options={qualityOptions}
                  onChange={value => setPreset(value as QualityPreset)}
                  ariaLabel="画面预设"
                />
              }
            />
            <SettingRow
              label="渲染精度"
              control={
                <SettingSlider
                  value={spec.pixelDensity}
                  min={0.75}
                  max={2.0}
                  step={0.05}
                  onChange={value => setOverride('pixelDensity', value)}
                  ariaLabel="渲染精度"
                  formatValue={value => value.toFixed(2)}
                />
              }
            />
            <SettingRow
              label="特效质量"
              control={
                <SettingSelect
                  value={String(spec.glowLayers)}
                  options={[
                    { value: '1', label: '低' },
                    { value: '2', label: '高' },
                    { value: '3', label: '极致' },
                  ]}
                  onChange={value => setOverride('glowLayers', Number(value) as 1 | 2 | 3)}
                  ariaLabel="特效质量"
                />
              }
            />
            <SettingRow
              label="云雾层数"
              control={
                <SettingSelect
                  value={String(spec.inkLayers)}
                  options={[
                    { value: '0', label: '关闭' },
                    { value: '1', label: '单层' },
                    { value: '2', label: '叠加' },
                  ]}
                  onChange={value => setOverride('inkLayers', Number(value) as 0 | 1 | 2)}
                  ariaLabel="云雾层数"
                />
              }
            />
            <SettingRow
              label="减少动态效果"
              control={
                <SettingSwitch
                  checked={settings.reducedMotion}
                  onChange={value => update({ reducedMotion: value })}
                  ariaLabel="减少动态效果"
                />
              }
            />
            <SettingRow
              label="减少强闪光"
              hint="降低高亮闪烁，适合光敏感人群"
              control={
                <SettingSwitch
                  checked={settings.reduceFlash}
                  onChange={value => update({ reduceFlash: value })}
                  ariaLabel="减少强闪光"
                />
              }
            />
            <SettingRow
              label="自动降级"
              hint="临时卡顿时自动降低画质；关闭后档位不再被自动修改"
              control={
                <SettingSwitch
                  checked={settings.autoDegrade}
                  onChange={value => update({ autoDegrade: value })}
                  ariaLabel="自动降级"
                />
              }
            />
            {degradedFrom !== null && (
              <div className="settings-degrade-note">
                <span>曾因性能自动降级（原档位：{QUALITY_LABELS[degradedFrom]}）</span>
                <button type="button" className="settings-text-button" onClick={restoreDegraded}>
                  恢复原档
                </button>
              </div>
            )}
          </div>
        );

      case 'sound':
        return (
          <div className="settings-rows">
            <SettingRow
              label="校园配乐"
              control={
                <SettingSwitch
                  checked={settings.music}
                  onChange={value => update({ music: value })}
                  ariaLabel="校园配乐"
                />
              }
            />
            <SettingRow
              label="当前曲目"
              control={
                <SettingSelect
                  value={String(settings.track)}
                  options={[
                    { value: '0', label: '校园配乐 · 壹' },
                    { value: '1', label: '校园配乐 · 贰' },
                    { value: '2', label: '校园配乐 · 叁' },
                  ]}
                  onChange={value => update({ track: Number(value) })}
                  ariaLabel="当前曲目"
                />
              }
            />
            <SettingRow
              label="音乐音量"
              control={
                <SettingSlider
                  value={settings.volume}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={value => update({ volume: value })}
                  ariaLabel="音乐音量"
                  formatValue={value => `${Math.round(value * 100)}%`}
                />
              }
            />
            <SettingRow
              label="界面音效"
              control={
                <SettingSwitch
                  checked={settings.uiSound}
                  onChange={value => update({ uiSound: value })}
                  ariaLabel="界面音效"
                />
              }
            />
          </div>
        );

      case 'message':
        return (
          <div className="settings-rows">
            <SettingRow
              label="播报停留时长"
              control={
                <SettingSelect
                  value={messageDuration}
                  options={[
                    { value: '2.4', label: '短(2.4s)' },
                    { value: '3.6', label: '标准(3.6s)' },
                    { value: '5', label: '长(5s)' },
                  ]}
                  onChange={setMessageDuration}
                  ariaLabel="播报停留时长"
                  note="（开发中）"
                />
              }
            />
            <SettingRow
              label="播放恭喜演出"
              control={
                <SettingSelect
                  value={congratsShow}
                  options={[
                    { value: 'on', label: '开启' },
                    { value: 'off', label: '关闭' },
                  ]}
                  onChange={setCongratsShow}
                  ariaLabel="播放恭喜演出"
                  note="（开发中）"
                />
              }
            />
            <SettingRow
              label="红点提示"
              control={
                <div className="settings-inline-control">
                  <SettingSwitch checked={redDot} onChange={setRedDot} ariaLabel="红点提示" />
                  <span className="settings-dev-note">（开发中）</span>
                </div>
              }
            />
          </div>
        );

      case 'account':
        return (
          <>
            <div className="settings-rows">
              <SettingRow
                label="昵称"
                hint="登录后显示"
                control={<span className="settings-value">—</span>}
              />
              <SettingRow
                label="学号 / ID"
                control={<span className="settings-value">—</span>}
              />
              <SettingRow
                label="UID"
                control={<span className="settings-value">—</span>}
              />
            </div>
            <div className="settings-actions-inline">
              <button
                type="button"
                className="settings-btn settings-btn--secondary"
                onClick={() => console.info('账户功能待接入')}
              >
                登录账号
              </button>
              <button
                type="button"
                className="settings-btn settings-btn--secondary"
                onClick={() => console.info('账户功能待接入')}
              >
                退出登录
              </button>
              <span className="settings-dev-note">（开发中）</span>
            </div>
          </>
        );

      case 'data':
        return (
          <>
            <p className="settings-note">存档保存在当前浏览器；登录账号后会同步到云端。</p>
            <div className="settings-actions-inline">
              <button type="button" className="settings-btn settings-btn--secondary" onClick={exportSave}>
                导出存档 JSON
              </button>
              <button
                type="button"
                className={`settings-btn settings-btn--secondary${resetArmed ? ' is-danger' : ''}`}
                onClick={resetProgress}
              >
                {resetArmed ? '确认重置？' : '重置探索进度'}
              </button>
            </div>
          </>
        );

      case 'other':
        return (
          <div className="settings-rows">
            <SettingRow
              label="语言"
              hint="其他语言尚未支持"
              control={<span className="settings-value">简体中文</span>}
            />
            <SettingRow
              label="关于"
              control={<span className="settings-value">理韵寻踪 v1.0.0</span>}
            />
            <SettingRow
              label="开源许可"
              control={<span className="settings-value">Noto Serif SC · Ma Shan Zheng（SIL OFL 1.1）</span>}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.section
      className="settings-screen"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tween.slow}
    >
      <header className="settings-header">
        <div className="settings-heading">
          <Icon name="settings" className="settings-heading-icon" />
          <span>设置 / {activeLabel}</span>
        </div>
        <button type="button" className="settings-close" aria-label="关闭设置" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>

      <motion.div
        className="settings-body"
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween.base}
      >
        <SettingsRail active={active} onChange={setActive} />
        <main
          id={`settings-panel-${active}`}
          className="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${active}`}
        >
          <div className="settings-panel-inner">
            <h2 className="settings-category-title">{activeLabel}</h2>
            {renderCategory()}
          </div>
        </main>
      </motion.div>

      <footer className="settings-footer">
        <button type="button" className="settings-btn settings-btn--secondary" onClick={restoreDefaults}>
          恢复默认
        </button>
        <button type="button" className="settings-btn settings-btn--primary" onClick={onClose}>
          应用并返回
        </button>
      </footer>
    </motion.section>
  );
}
