import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSettings } from '../types';
import { DEFAULT_SETTINGS } from '../../shared/game-settings.mjs';

// Run the hook's lifecycle against a controlled clock; the real store transitions
// are verified separately in useSettings.test.ts.
const harness = vi.hoisted(() => ({
  effect: undefined as undefined | (() => void | (() => void)),
  settings: {} as GameSettings,
  degrade: vi.fn<(from: 'high' | 'ultra') => boolean>(),
}));
vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => { harness.effect = effect; },
  useRef: <T,>(current: T) => ({ current }),
}));
vi.mock('./stores/useSettings', () => ({
  useSettings: <T,>(select: (state: { settings: GameSettings; degrade: typeof harness.degrade }) => T): T => select(harness),
}));
import { useAutoDegrade } from './useAutoDegrade';

let cleanup: undefined | (() => void);
let frameMs: number;
let page: EventTarget & { hidden: boolean };

function mount(paused = false, callback = vi.fn()) {
  cleanup?.();
  useAutoDegrade(paused, callback);
  cleanup = harness.effect?.() ?? undefined;
  return callback;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  harness.settings = { ...DEFAULT_SETTINGS };
  harness.degrade.mockReset().mockImplementation(from => {
    harness.settings = {
      ...harness.settings,
      qualityPreset: from === 'ultra' ? 'high' : 'low',
      degradedFrom: harness.settings.degradedFrom ?? from,
    };
    return true;
  });
  frameMs = 50; // 20 fps
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', page);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), frameMs)));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: ReturnType<typeof setTimeout>) => clearTimeout(id)));
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('automatic quality sampling windows', () => {
  it('requires two complete consecutive low-fps windows and notifies only the first downgrade', () => {
    harness.settings.qualityPreset = 'ultra';
    const notify = mount();
    vi.advanceTimersByTime(5000);
    expect(harness.degrade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(29999);
    expect(harness.degrade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(harness.degrade).toHaveBeenCalledExactlyOnceWith('ultra');
    expect(notify).toHaveBeenCalledExactlyOnceWith({ from: 'ultra', to: 'high', originalPreset: 'ultra' });
    expect(vi.getTimerCount()).toBe(0);

    mount(false, notify); // React rerenders when the store changes to high.
    vi.advanceTimersByTime(35000);
    expect(harness.degrade).toHaveBeenLastCalledWith('high');
    expect(harness.degrade).toHaveBeenCalledTimes(2);
    expect(harness.settings.degradedFrom).toBe('ultra');
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('a healthy window resets the streak instead of accumulating isolated bad windows', () => {
    mount();
    vi.advanceTimersByTime(5000); // bad
    frameMs = 16;
    vi.advanceTimersByTime(30000); // healthy
    frameMs = 50;
    vi.advanceTimersByTime(30000); // bad, not consecutive
    expect(harness.degrade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);
    expect(harness.degrade).toHaveBeenCalledExactlyOnceWith('high');
  });

  it('throws away hidden wall time and the previous bad streak, with no hidden timers', () => {
    mount();
    vi.advanceTimersByTime(5000); // one bad window
    vi.advanceTimersByTime(2000); // a partial second window
    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120000);
    expect(harness.degrade).not.toHaveBeenCalled();
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);
    expect(harness.degrade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);
    expect(harness.degrade).toHaveBeenCalledExactlyOnceWith('high');
  });

  it('the App pause cancels the current window; resume starts a fresh two-window sequence', () => {
    const notify = mount();
    vi.advanceTimersByTime(5000);
    mount(true, notify);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120000);
    mount(false, notify);
    vi.advanceTimersByTime(5000);
    expect(harness.degrade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);
    expect(harness.degrade).toHaveBeenCalledTimes(1);
  });

  it('disabling cancels every timer and raf, removes its listener, and keeps the current preset', () => {
    const remove = vi.spyOn(page, 'removeEventListener');
    const notify = mount();
    vi.advanceTimersByTime(2000);
    harness.settings.autoDegrade = false;
    mount(false, notify);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    vi.advanceTimersByTime(300000);
    expect(harness.degrade).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(harness.settings.qualityPreset).toBe('high');
  });

  it.each(['disabled', 'paused', 'low', 'custom'] as const)('%s registers no sampling or listener', mode => {
    const add = vi.spyOn(page, 'addEventListener');
    if (mode === 'disabled') harness.settings.autoDegrade = false;
    if (mode === 'low' || mode === 'custom') harness.settings.qualityPreset = mode;
    mount(mode === 'paused');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(add).not.toHaveBeenCalled();
  });

  it('allows a new one-time notification after the user restores the original preset', () => {
    const notify = mount();
    vi.advanceTimersByTime(35000);
    harness.settings.qualityPreset = 'high';
    harness.settings.degradedFrom = null;
    mount(false, notify);
    vi.advanceTimersByTime(35000);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
