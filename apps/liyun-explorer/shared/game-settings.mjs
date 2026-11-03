// Browser and zero-dependency Node API share this strict, environment-free whitelist.
export const DEFAULT_SETTINGS = {
  music: true, volume: 0.35, track: 0, quality: 'high', reducedMotion: false,
  qualityPreset: 'high', baseQualityPreset: 'high', qualityOverrides: {}, autoDegrade: true, degradedFrom: null,
  uiSound: true, reduceFlash: false, hudScale: 1,
  dragSensitivity: 1, zoomLimit: 2.7, doubleZoom: 1.45,
  messageDuration: 3.6, showCinematic: true, redDot: true,
};
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const num = (value, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
const pick = (value, choices) => typeof value === 'string' && choices.includes(value) ? value : undefined;

export function sanitizeSettings(raw) {
  const input = record(raw), d = DEFAULT_SETTINGS;
  const preset = input.qualityPreset ?? (input.quality === 'low' ? 'low' : d.qualityPreset);
  const validPreset = pick(preset, ['low', 'high', 'ultra', 'custom']) ?? d.qualityPreset;
  const baseQualityPreset = validPreset === 'custom'
    ? pick(input.baseQualityPreset, ['low', 'high', 'ultra']) ?? d.baseQualityPreset
    : validPreset;
  return {
    music: typeof input.music === 'boolean' ? input.music : d.music,
    volume: num(input.volume, 0, 1) ?? d.volume,
    track: Number.isInteger(input.track) && input.track >= 0 && input.track <= 2 ? input.track : d.track,
    quality: baseQualityPreset === 'low' ? 'low' : 'high',
    reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : d.reducedMotion,
    qualityPreset: validPreset,
    baseQualityPreset,
    qualityOverrides: sanitizeOverrides(input.qualityOverrides),
    autoDegrade: typeof input.autoDegrade === 'boolean' ? input.autoDegrade : d.autoDegrade,
    degradedFrom: pick(input.degradedFrom, ['high', 'ultra']) ?? null,
    uiSound: typeof input.uiSound === 'boolean' ? input.uiSound : d.uiSound,
    reduceFlash: typeof input.reduceFlash === 'boolean' ? input.reduceFlash : d.reduceFlash,
    hudScale: [0.9, 1, 1.12].includes(input.hudScale) ? input.hudScale : d.hudScale,
    dragSensitivity: num(input.dragSensitivity, 0.6, 2) ?? d.dragSensitivity,
    zoomLimit: num(input.zoomLimit, 1.5, 4) ?? d.zoomLimit,
    doubleZoom: [1.2, 1.45, 1.8].includes(input.doubleZoom) ? input.doubleZoom : d.doubleZoom,
    messageDuration: [2.4, 3.6, 5].includes(input.messageDuration) ? input.messageDuration : d.messageDuration,
    showCinematic: typeof input.showCinematic === 'boolean' ? input.showCinematic : d.showCinematic,
    redDot: typeof input.redDot === 'boolean' ? input.redDot : d.redDot,
  };
}

function sanitizeOverrides(raw) {
  const source = record(raw), out = {};
  for (const [key, min, max, rounded] of [
    ['pixelDensity', .75, 2, false], ['fogFps', 10, 60, true], ['lightFps', 10, 60, true],
    ['leafCount', 0, 40, true], ['moteCount', 0, 80, true], ['inkLayers', 0, 2, true],
    ['backdropBlur', 0, 24, true], ['glowLayers', 1, 3, true],
  ]) {
    const value = num(source[key], min, max);
    if (value !== undefined) out[key] = rounded ? Math.round(value) : value;
  }
  const fidelity = pick(source.inkRevealFidelity, ['simple', 'full']);
  if (fidelity) out.inkRevealFidelity = fidelity;
  if (typeof source.cssAmbient === 'boolean') out.cssAmbient = source.cssAmbient;
  const shadow = pick(source.dropShadows, ['flat', 'soft', 'rich']);
  if (shadow) out.dropShadows = shadow;
  return out;
}
