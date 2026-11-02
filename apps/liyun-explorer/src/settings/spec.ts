/**
 * 画质系统：预设即"下游参数的命名组合"。
 * 规则：任何渲染参数都必须在这里出现，禁止在组件里写裸数字。
 * 详见 docs/UI-REFACTOR-PLAN-V2.md 6.1 / 6.2。
 */
export type QualityPreset = 'low' | 'high' | 'ultra' | 'custom';

export interface QualitySpec {
  /** p5 像素密度 */
  pixelDensity: number;
  /** 云雾层帧率 */
  fogFps: number;
  /** 光效层帧率 */
  lightFps: number;
  /** 落叶数量 */
  leafCount: number;
  /** 微光粒子数量 */
  moteCount: number;
  /** 分区云纹层数 0=纯色 1=单层 2=叠加湍流 */
  inkLayers: 0 | 1 | 2;
  /** 面板毛玻璃半径 px，0 = 关闭 */
  backdropBlur: number;
  /** 墨散解锁保真度 */
  inkRevealFidelity: 'simple' | 'full';
  /** HUD 呼吸 + 纸面微尘 */
  cssAmbient: boolean;
  /** 阴影层级 */
  dropShadows: 'flat' | 'soft' | 'rich';
  /** 阴影质量：是否启用 p5 多层光晕 */
  glowLayers: 1 | 2 | 3;
}

export const QUALITY_PRESETS: Record<'low' | 'high' | 'ultra', QualitySpec> = {
  low: {
    pixelDensity: 1,
    fogFps: 24,
    lightFps: 30,
    leafCount: 6,
    moteCount: 10,
    inkLayers: 0,
    backdropBlur: 0,
    inkRevealFidelity: 'simple',
    cssAmbient: false,
    dropShadows: 'flat',
    glowLayers: 1,
  },
  high: {
    pixelDensity: 1.25,
    fogFps: 30,
    lightFps: 45,
    leafCount: 14,
    moteCount: 28,
    inkLayers: 1,
    backdropBlur: 6,
    inkRevealFidelity: 'full',
    cssAmbient: true,
    dropShadows: 'soft',
    glowLayers: 2,
  },
  ultra: {
    pixelDensity: 1.5,
    fogFps: 30,
    lightFps: 60,
    leafCount: 21,
    moteCount: 44,
    inkLayers: 2,
    backdropBlur: 10,
    inkRevealFidelity: 'full',
    cssAmbient: true,
    dropShadows: 'rich',
    glowLayers: 3,
  },
};

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  low: '低 · 流畅',
  high: '高 · 推荐',
  ultra: '极致',
  custom: '自定义',
};

/** 预设 + 覆盖项 → 最终参数。覆盖项逐键覆盖，非法值忽略。 */
export function resolveQuality(
  preset: QualityPreset,
  overrides: Partial<QualitySpec> = {},
  forceLow = false,
): QualitySpec {
  const base = preset === 'custom' || preset === 'low' || preset === 'high' || preset === 'ultra'
    ? { ...QUALITY_PRESETS[preset === 'custom' ? 'high' : preset] }
    : { ...QUALITY_PRESETS.high };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;
    if (key in base) (base as unknown as Record<string, unknown>)[key] = value;
  }
  // 系统级降级：reducedMotion 或用户手动"低"时，强制关掉环境层
  if (forceLow) {
    base.cssAmbient = false;
    base.inkLayers = 0;
    base.backdropBlur = 0;
  }
  return base;
}

/** 从完整 spec 反推"是否等于某个预设"，用于显示"自定义"态 */
export function detectPreset(spec: QualitySpec): QualityPreset {
  for (const key of ['low', 'high', 'ultra'] as const) {
    const preset = QUALITY_PRESETS[key];
    const same = (Object.keys(preset) as (keyof QualitySpec)[]).every(k => preset[k] === spec[k]);
    if (same) return key;
  }
  return 'custom';
}
