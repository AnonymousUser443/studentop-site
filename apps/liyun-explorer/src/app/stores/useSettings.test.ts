import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, useSettings } from './useSettings';

afterEach(() => {
  vi.unstubAllGlobals();
  useSettings.getState().hydrate(DEFAULT_SETTINGS, false);
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
