import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import type { AccountUser, GameSettings } from '../types';
import { DEFAULT_SETTINGS, useSettings } from '../app/stores/useSettings';
import { Icon } from '../hud/Icon';
import { useModalFocus } from '../menu/modalFocus';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { tween } from '../motion/transitions';
import SettingRow from './ui/SettingRow';
import SettingSelect from './ui/SettingSelect';
import SettingSlider from './ui/SettingSlider';
import SettingSwitch from './ui/SettingSwitch';
import SettingsRail, { SETTINGS_CATEGORIES, type SettingsCategoryId } from './ui/SettingsRail';
import ConfirmActionDialog from './ConfirmActionDialog';
import AboutPanel from './AboutPanel';
import QualitySettings from './QualitySettings';
import './settings.css';

type Action = () => void | Promise<void>;
type Confirmation = 'defaults' | 'progress' | 'local';
export interface SettingsScreenProps {
  open?: boolean;
  initialCategory?: SettingsCategoryId;
  onClose: () => void;
  account: AccountUser | null;
  onLoginPrompt: () => void;
  onLogout: Action;
  onResetProgress: Action;
  onClearLocalSave: Action;
  onExportSave: Action;
  isFullscreen: boolean;
  onFullscreen: () => void;
  onOpenCalibration?: () => void;
}

const KEYMAP = [
  { action: '活动一览', key: 'A', description: '看看校园活动' },
  { action: '收集图鉴', key: 'C', description: '重访已点亮的地标' },
  { action: '回到地图中心', key: 'M', description: '恢复校园总览' },
  { action: '切换全屏', key: 'F', description: '进入或退出全屏' },
  { action: '定位到我', key: 'L', description: '使用当前设备位置' },
  { action: '逐级返回', key: 'Esc', description: '先收起选项或确认，再返回上一级' },
  { action: '移动焦点', key: 'Tab', description: 'Shift + Tab 反向移动' },
] as const;

export default function SettingsScreen({ open = true, initialCategory = 'control', onClose, account, onLoginPrompt, onLogout, onResetProgress, onClearLocalSave, onExportSave, isFullscreen, onFullscreen, onOpenCalibration }: SettingsScreenProps): JSX.Element {
  const settings = useSettings(s => s.settings);
  const update = useSettings(s => s.update);
  const { reducedMotion } = useMotionPreferences();
  const [active, setActive] = useState<SettingsCategoryId>(initialCategory);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState<'confirm' | 'export' | 'logout' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const focus = useModalFocus(closeRef);
  const label = SETTINGS_CATEGORIES.find(category => category.id === active)?.label ?? '设置';

  useEffect(() => {
    if (open) { setActive(initialCategory); setStatus(null); }
    else { setConfirmation(null); setActionError(null); }
  }, [open, initialCategory]);

  useEffect(() => { panelRef.current?.scrollTo({ top: 0, behavior: 'instant' }); }, [active]);

  const ask = (kind: Confirmation) => { setActionError(null); setConfirmation(kind); };
  const confirmationCopy = confirmation === 'progress'
    ? { title: '重新开始这段旅途？', description: `将清空已点亮的地标、区域与探索进度，保留声音、画面等偏好设置。${account ? '空进度会同步到当前账号。' : '此操作无法撤销。'}`, label: '重置探索进度' }
    : confirmation === 'local'
      ? { title: '清空本机存档？', description: '将清除本浏览器保存的旅途与偏好设置，不删除账号中的云端存档。登录账号后，云端旅途仍可再次恢复。', label: '清空本机存档' }
      : { title: '恢复默认设置？', description: '控制、画面、声音、消息与界面缩放将恢复初始设置。已收集的地标与探索进度会保留。', label: '恢复默认设置' };

  const confirm = async () => {
    if (!confirmation || busy) return;
    const kind = confirmation;
    setBusy('confirm'); setActionError(null);
    try {
      if (kind === 'defaults') update({ ...DEFAULT_SETTINGS } as GameSettings);
      else if (kind === 'progress') await onResetProgress();
      else await onClearLocalSave();
      setStatus(kind === 'defaults' ? '已恢复默认设置。' : kind === 'progress' ? '探索进度已重置，偏好设置已保留。' : '已清空本机存档。');
      setConfirmation(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '暂时未能完成，请重试。');
    } finally { setBusy(null); }
  };

  const exportSave = async () => {
    if (busy) return;
    setBusy('export'); setStatus(null);
    try { await onExportSave(); setStatus('当前旅途存档已导出。'); }
    catch (error) { setStatus(error instanceof Error ? `导出失败：${error.message}` : '导出失败，请重试。'); }
    finally { setBusy(null); }
  };

  const logout = async () => {
    if (busy) return;
    setBusy('logout'); setStatus(null);
    try { await onLogout(); }
    catch (error) { setStatus(error instanceof Error ? `退出失败：${error.message}` : '暂时无法退出账号，请重试。'); }
    finally { setBusy(null); }
  };

  const renderCategory = (): ReactNode => {
    switch (active) {
      case 'control': return <>
        <p className="settings-intro">让地图跟随你的习惯。</p>
        <div className="settings-rows">
          <SettingRow label="拖动灵敏度" hint="数值越大，同样手势移动得越远" control={<SettingSlider value={settings.dragSensitivity} min={.6} max={2} step={.1} onChange={value => update({ dragSensitivity: value })} ariaLabel="拖动灵敏度" formatValue={value => `${value.toFixed(1)}×`} />} />
          <SettingRow label="缩放上限" hint="地图可放大的最大倍率" control={<SettingSlider value={settings.zoomLimit} min={1.5} max={4} step={.1} onChange={value => update({ zoomLimit: value })} ariaLabel="缩放上限" formatValue={value => `${value.toFixed(1)}×`} />} />
          <SettingRow label="双击缩放" hint="每次双击地图的放大倍率" control={<SettingSelect value={String(settings.doubleZoom)} options={[{ value: '1.2', label: '轻缓 · 1.2×' }, { value: '1.45', label: '标准 · 1.45×' }, { value: '1.8', label: '快速 · 1.8×' }]} onChange={value => update({ doubleZoom: Number(value) as GameSettings['doubleZoom'] })} ariaLabel="双击缩放" />} />
        </div>
        <aside className="settings-tip"><Icon name="compass" /><p>拖动地图寻找风景；双击地图、滚动鼠标滚轮，或用双指调整远近。</p></aside>
      </>;
      case 'keys': return <>
        <p className="settings-intro">快捷键在地图探索时生效，输入文字时会暂时让路。</p>
        <dl className="settings-keymap"><div className="settings-keymap-row settings-keymap-head"><dt>功能</dt><dd>按键</dd><dd>说明</dd></div>{KEYMAP.map(item => <div className="settings-keymap-row" key={item.action}><dt>{item.action}</dt><dd><kbd>{item.key}</kbd></dd><dd>{item.description}</dd></div>)}</dl>
        <p className="settings-note">在左侧分类中，可用 ↑ / ↓ 切换，Home / End 跳到首尾；下拉选项支持方向键、Enter 与 Escape。</p>
      </>;
      case 'image': return <QualitySettings isFullscreen={isFullscreen} onFullscreen={onFullscreen} />;
      case 'sound': return <>
        <p className="settings-intro">留一点校园的声音在旅途中。</p>
        <div className="settings-rows">
          <SettingRow label="校园配乐" control={<SettingSwitch checked={settings.music} onChange={value => update({ music: value })} ariaLabel="校园配乐" />} />
          <SettingRow label="当前曲目" control={<SettingSelect value={String(settings.track)} options={[{ value: '0', label: '校园配乐 · 壹' }, { value: '1', label: '校园配乐 · 贰' }, { value: '2', label: '校园配乐 · 叁' }]} onChange={value => update({ track: Number(value) })} ariaLabel="当前曲目" />} />
          <SettingRow label="声音音量" hint="同时影响配乐与界面反馈" control={<SettingSlider value={settings.volume} min={0} max={1} step={.05} onChange={value => update({ volume: value })} ariaLabel="声音音量" formatValue={value => `${Math.round(value * 100)}%`} />} />
          <SettingRow label="界面音效" hint="按钮、提示与点亮地标的反馈音" control={<SettingSwitch checked={settings.uiSound} onChange={value => update({ uiSound: value })} ariaLabel="界面音效" />} />
        </div><p className="settings-note">浏览器可能需要你先点击页面，才允许播放声音。</p>
      </>;
      case 'message': return <>
        <p className="settings-intro">按自己的节奏，接住每一次发现。</p>
        <div className="settings-rows">
          <SettingRow label="播报停留时长" hint="普通提示会依次显示" control={<SettingSelect value={String(settings.messageDuration)} options={[{ value: '2.4', label: '简短 · 2.4 秒' }, { value: '3.6', label: '标准 · 3.6 秒' }, { value: '5', label: '从容 · 5 秒' }]} onChange={value => update({ messageDuration: Number(value) as GameSettings['messageDuration'] })} ariaLabel="播报停留时长" />} />
          <SettingRow label="播放恭喜演出" hint="点亮地标或新区域时播放；关闭后仍正常记录进度" control={<SettingSwitch checked={settings.showCinematic} onChange={value => update({ showCinematic: value })} ariaLabel="播放恭喜演出" />} />
          <SettingRow label="红点提示" hint="显示活动等入口的更新提示" control={<SettingSwitch checked={settings.redDot} onChange={value => update({ redDot: value })} ariaLabel="红点提示" />} />
        </div>
      </>;
      case 'account': return <>
        <div className="settings-account-banner"><div className="settings-account-avatar"><Icon name="gate" /></div><div><h3>{account?.nickname ?? '校园旅人'}</h3><p>{account ? '已登录 · 旅途随账号同步' : '游客模式 · 旅途保存在本机'}</p></div></div>
        {account ? <><div className="settings-rows"><SettingRow label="昵称" control={<span className="settings-value">{account.nickname}</span>} /><SettingRow label="学号 / ID" control={<span className="settings-value">{account.studentId}</span>} /><SettingRow label="UID" control={<span className="settings-value">{account.uid}</span>} /></div><div className="settings-actions-inline"><button type="button" className="settings-btn settings-btn--secondary" onClick={() => { void logout(); }} disabled={busy !== null}>{busy === 'logout' ? '正在退出…' : '退出登录'}</button></div></> : <div className="settings-account-guest"><p>登录后，可以在同一账号下继续你的校园旅途。</p><button type="button" className="settings-btn settings-btn--primary" onClick={onLoginPrompt}>登录账号</button></div>}
      </>;
      case 'data': return <>
        <p className="settings-intro">保存已经走过的路，也可以重新出发。</p>
        <div className="settings-data-card"><div><h3>导出旅途存档</h3><p>下载当前有效的探索进度与设置，留作备份。</p></div><button type="button" className="settings-btn settings-btn--secondary" onClick={() => { void exportSave(); }} disabled={busy !== null}>{busy === 'export' ? '正在导出…' : '导出 JSON'}</button></div>
        <div className="settings-data-card"><div><h3>重置探索进度</h3><p>清空地标与区域进度，保留当前偏好设置。{account ? '将同步到账号。' : ''}</p></div><button type="button" className="settings-btn settings-btn--danger-outline" onClick={() => ask('progress')} disabled={busy !== null}>重置探索进度</button></div>
        <div className="settings-data-card"><div><h3>清空本机存档</h3><p>清除当前浏览器保存的旅途与设置，云端账号存档保留。</p></div><button type="button" className="settings-btn settings-btn--danger-outline" onClick={() => ask('local')} disabled={busy !== null}>清空本机存档</button></div>
        {onOpenCalibration && <><h3 className="settings-subtitle">定位参照</h3><div className="settings-data-card"><div><h3>地图标定工具</h3><p>需要核对地图与定位参照的对齐关系时使用。</p></div><button type="button" className="settings-btn settings-btn--secondary" onClick={onOpenCalibration}>打开标定工具</button></div></>}
      </>;
      case 'other': return <AboutPanel />;
    }
  };

  return <Dialog.Root open={open} onOpenChange={next => { if (!next && !confirmation) onClose(); }}>
    <AnimatePresence>
      {open && <Dialog.Portal forceMount>
        <Dialog.Overlay asChild forceMount><motion.div className="settings-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast} /></Dialog.Overlay>
        <Dialog.Content asChild forceMount {...focus} onEscapeKeyDown={event => { event.stopPropagation(); if (confirmation) event.preventDefault(); }}>
          <motion.section className="settings-screen" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }} transition={reducedMotion ? tween.tap : tween.page}>
            <div className="settings-watermark" aria-hidden="true"><Icon name="compass" /></div>
            <Dialog.Description className="settings-sr-only">设置自动生效。用 Tab 移动焦点，Escape 逐级返回。</Dialog.Description>
            <header className="settings-header"><div className="settings-heading"><Icon name="settings" /><Dialog.Title asChild><h1>设置 <span>/</span> {label}</h1></Dialog.Title></div><button ref={closeRef} type="button" className="settings-close" aria-label="关闭设置" onClick={onClose}><Icon name="close" /></button></header>
            <div className="settings-body"><SettingsRail active={active} onChange={setActive} /><main ref={panelRef} id={`settings-panel-${active}`} className="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${active}`} tabIndex={0}><AnimatePresence mode="wait" initial={false}><motion.div key={active} className="settings-panel-inner" initial={reducedMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tween.fast}><h2 className="settings-category-title">{active === 'other' ? '关于这段旅途' : label}<span aria-hidden="true">◆</span></h2>{renderCategory()}</motion.div></AnimatePresence></main></div>
            <footer className="settings-footer"><button type="button" className="settings-btn settings-btn--secondary" onClick={() => ask('defaults')} disabled={busy !== null}>恢复默认</button><p className="settings-save-status" role="status" aria-live="polite">{status ?? '修改自动保存并生效'}</p><button type="button" className="settings-btn settings-btn--primary" onClick={onClose}>返回旅途 <span aria-hidden="true">↩</span></button></footer>
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>}
    </AnimatePresence>
    <ConfirmActionDialog open={open && confirmation !== null} title={confirmationCopy.title} description={confirmationCopy.description} confirmLabel={confirmationCopy.label} destructive={confirmation !== 'defaults'} busy={busy === 'confirm'} error={actionError} onCancel={() => { if (!busy) { setConfirmation(null); setActionError(null); } }} onConfirm={() => { void confirm(); }} />
  </Dialog.Root>;
}
