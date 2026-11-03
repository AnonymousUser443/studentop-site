import { describe, expect, it, vi } from 'vitest';
import { createInitialState, SAVE_KEY } from '../state';
import { createCloudWriter, exportSnapshot, loadExploration, resetSnapshot, runtimeMode } from './saveLifecycle';

describe('save lifecycle and isolated authoring modes', () => {
  it.each(['?qa=1&preset=explored', '?qa=1&preset=fog', '?tool=calibration', '?qa=1'])('%s never reads the ordinary archive', search => {
    const getItem = vi.fn(() => { throw new Error('ordinary archive must not be read'); });
    const state = loadExploration(runtimeMode(search, true), false, { getItem });
    expect(getItem).not.toHaveBeenCalled();
    expect(state.version).toBe(3);
    expect(state.discoveredIds.length).toBe(search.includes('explored') ? 7 : 0);
  });

  it('ignores QA query capabilities in production but keeps the explicit author tool isolated', () => {
    expect(runtimeMode('?qa=1&preset=explored', false)).toMatchObject({ qa: false, isolated: false, preset: null });
    expect(runtimeMode('?tool=calibration', false)).toMatchObject({ calibration: true, isolated: true });
  });

  it('restores a regular archive and falls back safely when storage is unavailable', () => {
    const saved = { ...createInitialState(), discoveredIds: ['tower'], unlockedRegionIds: ['park'] };
    const getItem = vi.fn((key: string) => key === SAVE_KEY ? JSON.stringify(saved) : null);
    expect(loadExploration(runtimeMode('', true), false, { getItem })).toEqual(saved);
    expect(loadExploration(runtimeMode('', true), false, { getItem: () => { throw new Error('private mode'); } }).discoveredIds).toEqual([]);
  });

  it('resets exploration while retaining the complete settings object', () => {
    const state = { ...createInitialState(), discoveredIds: ['tower'], unlockedRegionIds: ['park'], settings: { ...createInitialState().settings, messageDuration: 5 as const, zoomLimit: 3.8, music: false } };
    const reset = resetSnapshot(state);
    expect(reset.discoveredIds).toEqual([]);
    expect(reset.unlockedRegionIds).toEqual([]);
    expect(reset.settings).toBe(state.settings);
    expect(state.discoveredIds).toEqual(['tower']);
  });

  it('exports the current memory snapshot through the strict cloud whitelist, including independent regions', () => {
    const state = { ...createInitialState(), unlockedRegionIds: ['park'], playerUV: { u: .123, v: .456, rawGPS: 'private-location' }, rawGPS: 'private-location', settings: { ...createInitialState().settings, redDot: false, secret: 'private-secret' } };
    const exported = exportSnapshot(state);
    const parsed = JSON.parse(exported);
    expect(parsed.unlockedRegionIds).toEqual(['park']);
    expect(parsed.playerUV).toEqual(createInitialState().playerUV);
    expect(parsed.settings.redDot).toBe(false);
    expect(exported).not.toContain('private-');
  });
});

describe('serial cloud writes', () => {
  it('awaits an older in-flight save before sending the empty reset and resolves only after the reset is stored', async () => {
    const sends: string[][] = [];
    let releaseFirst: () => void = () => undefined, releaseReset: () => void = () => undefined;
    const save = vi.fn((_token: string, state: ReturnType<typeof createInitialState>) => {
      sends.push(state.discoveredIds);
      return new Promise<void>(resolve => { if (sends.length === 1) releaseFirst = resolve; else releaseReset = resolve; });
    });
    const write = createCloudWriter(save, () => 'synthetic-token');
    const older = write('synthetic-token', { ...createInitialState(), discoveredIds: ['tower'] });
    let finished = false;
    const reset = write('synthetic-token', createInitialState()).then(() => { finished = true; });
    await vi.waitFor(() => expect(sends).toEqual([['tower']]));
    expect(finished).toBe(false);
    releaseFirst(); await older;
    await vi.waitFor(() => expect(sends).toEqual([['tower'], []]));
    expect(finished).toBe(false);
    releaseReset(); await reset;
    expect(finished).toBe(true);
  });

  it('an earlier failure cannot block a later explicit reset', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const write = createCloudWriter(save, () => 'synthetic-token');
    await expect(write('synthetic-token', createInitialState())).rejects.toThrow('offline');
    await expect(write('synthetic-token', createInitialState())).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('drops queued saves after the current local session is detached', async () => {
    let token: string | null = 'synthetic-token';
    const save = vi.fn().mockResolvedValue(undefined);
    const write = createCloudWriter(save, () => token);
    const queued = write('synthetic-token', createInitialState());
    token = null;
    await queued;
    expect(save).not.toHaveBeenCalled();
  });
});
