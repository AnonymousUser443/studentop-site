/**
 * 设置 store：唯一持久化来源。
 * 规则：
 *  - 任何组件读取设置一律用 useSettings(s => s.settings.xxx) 选择器，禁止整对象解构
 *  - 写入用 update()，它会合并并做范围校验（见 sanitize 部分）
 *  - 降级逻辑（degrade）只在这里发生，组件不自行改档位
 */
import { create } from 'zustand';
import type { GameSettings } from '../../types';
import { detectPreset, resolveQuality, type QualityPreset, type QualitySpec } from '../../settings/spec';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../../shared/game-settings.mjs';
export { DEFAULT_SETTINGS, sanitizeSettings } from '../../../shared/game-settings.mjs';

/** 把 qualityPreset 映射到 p5 层仍读取的 quality 字段（向后兼容，不删） */
const syncLegacyQuality = (s: GameSettings): GameSettings => ({
  ...s,
  quality: s.qualityPreset === 'low' ? 'low' : 'high',
});

interface SettingsState {
  settings: GameSettings;
  /** 最终生效的参数（预设 + 覆盖 + 系统降级） */
  spec: QualitySpec;
  hydrated: boolean;
  /** 系统偏好实时改变时只刷新渲染参数，不改写用户设置。 */
  refreshQuality: () => void;
  update: (patch: Partial<GameSettings>) => void;
  /** 切换预设：同事清空覆盖项，并清除被动降级来源 */
  setPreset: (preset: QualityPreset) => void;
  /** 单项覆盖：自动把预设标记为 custom */
  setOverride: <K extends keyof QualitySpec>(key: K, value: QualitySpec[K] | undefined) => void;
  /** 清空全部覆盖项，回到某个预设 */
  resetOverrides: () => void;
  /** 被动降级：仅在 autoDegrade 为 true 时由采样器调用 */
  degrade: (from: 'high' | 'ultra') => boolean;
  /** 恢复被降级前的档位 */
  restoreDegraded: () => void;
  /** 从存档恢复（不含持久化副作用，由 App 负责落盘） */
  hydrate: (settings: Partial<GameSettings> | undefined, systemReduced: boolean) => void;
}

const systemReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const computeSpec = (s: GameSettings, systemReduced = systemReducedMotion()) =>
  resolveQuality(s.qualityPreset, s.qualityOverrides, systemReduced || s.reducedMotion || s.qualityPreset === 'low');

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  spec: computeSpec(DEFAULT_SETTINGS, false),
  hydrated: false,
  refreshQuality: () => set(state => ({ spec: computeSpec(state.settings) })),

  update: (patch) => set((state) => {
    const merged = sanitizeSettings({ ...state.settings, ...patch });
    const next = syncLegacyQuality(merged);
    const systemReduced = typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    return { settings: next, spec: computeSpec(next, systemReduced) };
  }),

  setPreset: (preset) => set((state) => {
    const next = syncLegacyQuality({
      ...state.settings,
      qualityPreset: preset,
      qualityOverrides: preset === 'custom' ? state.settings.qualityOverrides : {},
      degradedFrom: null,
    });
    const systemReduced = typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    return { settings: next, spec: computeSpec(next, systemReduced) };
  }),

  setOverride: (key, value) => set((state) => {
    const overrides = { ...state.settings.qualityOverrides };
    if (value === undefined) delete overrides[key];
    else overrides[key] = value;
    // 覆盖项与某预设完全一致时不算自定义（由 detectPreset 判定）
    const candidate = { ...resolveQuality(state.settings.qualityPreset, overrides), ...overrides } as QualitySpec;
    const detected = detectPreset(candidate);
    const next = syncLegacyQuality({
      ...state.settings,
      qualityOverrides: overrides,
      qualityPreset: detected,
    });
    const systemReduced = typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    return { settings: next, spec: computeSpec(next, systemReduced) };
  }),

  resetOverrides: () => set((state) => {
    const base = state.settings.qualityPreset === 'custom' ? 'high' : state.settings.qualityPreset;
    const next = syncLegacyQuality({ ...state.settings, qualityOverrides: {}, qualityPreset: base });
    return { settings: next, spec: computeSpec(next) };
  }),

  degrade: (from) => {
    const state = get();
    // 契约：autoDegrade 关闭时绝不降档
    if (!state.settings.autoDegrade) return false;
    if (state.settings.qualityPreset !== from) return false;
    const target: QualityPreset = from === 'ultra' ? 'high' : 'low';
    const next = syncLegacyQuality({
      ...state.settings,
      qualityPreset: target,
      degradedFrom: from,
    });
    set({ settings: next, spec: computeSpec(next) });
    return true;
  },

  restoreDegraded: () => set((state) => {
    if (!state.settings.degradedFrom) return state;
    const next = syncLegacyQuality({
      ...state.settings,
      qualityPreset: state.settings.degradedFrom,
      degradedFrom: null,
    });
    return { settings: next, spec: computeSpec(next) };
  }),

  hydrate: (incoming, systemReduced) => set(() => {
    const merged = sanitizeSettings({ ...DEFAULT_SETTINGS, ...(incoming ?? {}) });
    const next = syncLegacyQuality(merged);
    return { settings: next, spec: computeSpec(next, systemReduced), hydrated: true };
  }),
}));
