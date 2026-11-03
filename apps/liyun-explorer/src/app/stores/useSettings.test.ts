import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from './useSettings';
import { QUALITY_PRESETS, resolveQuality } from '../../settings/spec';
import { createInitialState, restoreState } from '../../state';
import { sanitizeCloudState } from '../../account';

afterEach(() => {
  vi.unstubAllGlobals();
  useSettings.getState().hydrate(DEFAULT_SETTINGS, false);
});

describe('custom quality settings contract', () => {
  it.each(['low', 'high', 'ultra'] as const)('keeps every other %s parameter through two overrides and local/cloud round trips', preset => {
    useSettings.getState().setPreset(preset);
    const original = QUALITY_PRESETS[preset];
    useSettings.getState().setOverride('leafCount', original.leafCount + 1);
    useSettings.getState().setOverride('moteCount', original.moteCount + 1);
    const expected = { ...original, leafCount: original.leafCount + 1, moteCount: original.moteCount + 1 };
    expect(useSettings.getState().spec).toEqual(expected);
    expect(useSettings.getState().settings).toMatchObject({ qualityPreset: 'custom', baseQualityPreset: preset });

    const local = restoreState(JSON.stringify({ ...createInitialState(), settings: useSettings.getState().settings }));
    const cloud = sanitizeCloudState(local);
    useSettings.getState().hydrate(cloud.settings, false);
    expect(useSettings.getState().spec).toEqual(expected);
    expect(useSettings.getState().settings.baseQualityPreset).toBe(preset);
    useSettings.getState().resetOverrides();
    expect(useSettings.getState().settings.qualityPreset).toBe(preset);
    expect(useSettings.getState().spec).toEqual(original);
  });

  it('does not save the temporary reduced-motion projection into custom preferences', () => {
    useSettings.getState().hydrate({ qualityPreset: 'ultra', reducedMotion: true }, false);
    useSettings.getState().setOverride('leafCount', 20);
    expect(useSettings.getState().spec).toEqual({ ...QUALITY_PRESETS.ultra, leafCount: 20, cssAmbient: false, inkLayers: 0, backdropBlur: 0 });
    useSettings.getState().update({ reducedMotion: false });
    expect(useSettings.getState().spec).toEqual({ ...QUALITY_PRESETS.ultra, leafCount: 20 });
    useSettings.getState().setOverride('leafCount', undefined);
    expect(useSettings.getState().settings).toMatchObject({ qualityPreset: 'ultra', baseQualityPreset: 'ultra', qualityOverrides: {} });
  });

  it('remembers the original preset over multiple downgrades, serialization and a disabled sampler', () => {
    useSettings.getState().setPreset('ultra');
    expect(useSettings.getState().degrade('ultra')).toBe(true);
    expect(useSettings.getState().degrade('high')).toBe(true);
    expect(useSettings.getState().settings).toMatchObject({ qualityPreset: 'low', degradedFrom: 'ultra' });
    const restored = sanitizeSettings(JSON.parse(JSON.stringify(useSettings.getState().settings)));
    useSettings.getState().hydrate(restored, false);
    useSettings.getState().update({ autoDegrade: false });
    expect(useSettings.getState().settings).toMatchObject({ qualityPreset: 'low', degradedFrom: 'ultra' });
    useSettings.getState().restoreDegraded();
    expect(useSettings.getState().settings).toMatchObject({ qualityPreset: 'ultra', baseQualityPreset: 'ultra', degradedFrom: null, autoDegrade: false });
    expect(useSettings.getState().degrade('ultra')).toBe(false);
    expect(useSettings.getState().spec).toEqual(QUALITY_PRESETS.ultra);
  });

  it('retains the persisted base even when the caller resolves quality directly', () => {
    expect(resolveQuality('custom', { glowLayers: 1 }, false, 'ultra')).toEqual({ ...QUALITY_PRESETS.ultra, glowLayers: 1 });
    expect(sanitizeSettings({ qualityPreset: 'custom', qualityOverrides: { leafCount: 8 } }).baseQualityPreset).toBe('high');
    expect(sanitizeSettings({ quality: 'low' }).baseQualityPreset).toBe('low');
  });

  it('validates all control and message preferences through the shared whitelist', () => {
    const safe = sanitizeSettings({ dragSensitivity: 20, zoomLimit: -1, doubleZoom: 9, messageDuration: '5', showCinematic: 1, redDot: false, rawGPS: { latitude: 40 } });
    expect(safe).toMatchObject({ dragSensitivity: 2, zoomLimit: 1.5, doubleZoom: 1.45, messageDuration: 3.6, showCinematic: true, redDot: false });
    expect(safe).not.toHaveProperty('rawGPS');
    expect(sanitizeSettings({ dragSensitivity: NaN, zoomLimit: Infinity }).dragSensitivity).toBe(1);
    expect(sanitizeSettings({ zoomLimit: Infinity }).zoomLimit).toBe(2.7);
  });
});

describe('motion preference quality projection', () => {
  it('disables decorative effects for the in-game preference at load time', () => {
    useSettings.getState().hydrate({ ...DEFAULT_SETTINGS, reducedMotion: true }, false);
    expect(useSettings.getState().spec).toMatchObject({ cssAmbient: false, inkLayers: 0, backdropBlur: 0 });
    expect(useSettings.getState().settings.qualityPreset).toBe('high');
  });

  it('keeps the game preference when quality overrides are reset', () => {
    useSettings.getState().hydrate({ ...DEFAULT_SETTINGS, reducedMotion: true }, false);
    useSettings.getState().setOverride('backdropBlur', 12);
    useSettings.getState().resetOverrides();
    expect(useSettings.getState().settings.reducedMotion).toBe(true);
    expect(useSettings.getState().spec.cssAmbient).toBe(false);
    expect(useSettings.getState().spec.backdropBlur).toBe(0);
  });

  it('preserves system reduction across automatic downgrade and restoration', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    useSettings.getState().hydrate({ ...DEFAULT_SETTINGS, qualityPreset: 'ultra' }, true);
    expect(useSettings.getState().degrade('ultra')).toBe(true);
    expect(useSettings.getState().spec.cssAmbient).toBe(false);
    useSettings.getState().restoreDegraded();
    expect(useSettings.getState().settings.qualityPreset).toBe('ultra');
    expect(useSettings.getState().settings.reducedMotion).toBe(false);
    expect(useSettings.getState().spec.cssAmbient).toBe(false);
  });

  it('recomputes the runtime projection without changing saved user preferences', () => {
    let reduced = false;
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    useSettings.getState().hydrate(DEFAULT_SETTINGS, false);
    const saved = useSettings.getState().settings;
    reduced = true;
    useSettings.getState().refreshQuality();
    expect(useSettings.getState().spec.cssAmbient).toBe(false);
    expect(useSettings.getState().settings).toBe(saved);
    reduced = false;
    useSettings.getState().refreshQuality();
    expect(useSettings.getState().spec.cssAmbient).toBe(true);
    expect(useSettings.getState().settings).toBe(saved);
  });
});
