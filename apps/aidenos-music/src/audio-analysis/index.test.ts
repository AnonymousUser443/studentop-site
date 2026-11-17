import { describe, expect, it, vi } from "vitest";
import {
  analyzeSpectrum,
  computeBandLevels,
  computeEnergy,
  computeTransient,
  createAudioAnalyzer,
  normalizeSpectrum,
} from "./index";

class FakeAudio {
  paused = false;
  ended = false;
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }
}

class FakeAnalyser {
  fftSize = 8;
  frequencyBinCount = 4;
  smoothingTimeConstant = 0;
  minDecibels = -100;
  maxDecibels = -30;
  values = new Uint8Array([0, 64, 128, 255]);
  connect = vi.fn();
  disconnect = vi.fn();

  getByteFrequencyData(target: Uint8Array): void {
    target.set(this.values.subarray(0, target.length));
  }
}

class FakeContext {
  state = "suspended";
  sampleRate = 8;
  destination = {};
  analyser = new FakeAnalyser();
  source = { connect: vi.fn(), disconnect: vi.fn() };
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createAnalyser = vi.fn(() => this.analyser);
  createMediaElementSource = vi.fn(() => this.source);
}

class FakeVisibility {
  hidden = false;
  private listener: EventListener | null = null;
  addEventListener(_type: string, listener: EventListener): void {
    this.listener = listener;
  }
  removeEventListener(_type: string, listener: EventListener): void {
    if (this.listener === listener) this.listener = null;
  }
  setHidden(value: boolean): void {
    this.hidden = value;
    this.listener?.(new Event("visibilitychange"));
  }
}

describe("audio analysis pure helpers", () => {
  it("normalises byte and already-normalised spectra without mutating input", () => {
    const bytes = new Uint8Array([0, 128, 255]);
    expect(normalizeSpectrum(bytes)).toEqual([0, 128 / 255, 1]);
    expect(normalizeSpectrum([0, 0.5, 1])).toEqual([0, 0.5, 1]);
    expect([...bytes]).toEqual([0, 128, 255]);
  });

  it("maps bins into custom bands and keeps values bounded", () => {
    const bands = computeBandLevels([0, 128, 255, 255], 8, {
      fftSize: 8,
      bandRanges: {
        bass: { minHz: 0, maxHz: 1 },
        lowMid: { minHz: 1, maxHz: 2 },
        mid: { minHz: 2, maxHz: 3 },
        vocal: { minHz: 3, maxHz: 4 },
        treble: { minHz: 4, maxHz: 5 },
      },
    });
    expect(bands).toEqual({
      bass: 0,
      lowMid: 128 / 255,
      mid: 1,
      vocal: 1,
      treble: 0,
    });
  });

  it("computes RMS energy and only reports rising transients", () => {
    expect(computeEnergy([0, 0.5, 1])).toBeCloseTo(Math.sqrt(1.25 / 3));
    expect(computeEnergy([])).toBe(0);
    expect(computeTransient(0.9, 0.2, 0.1)).toBeCloseTo(2 / 3);
    expect(computeTransient(0.2, 0.9)).toBe(0);
    expect(analyzeSpectrum(new Uint8Array([0, 255]), 8).transient).toBe(0);
  });
});

describe("AudioAnalyzer boundaries", () => {
  it("falls back without an audio element or browser Web Audio support", async () => {
    const missing = createAudioAnalyzer(null);
    expect(missing.getSnapshot()).toMatchObject({
      available: false,
      active: false,
      energy: 0,
    });
    await expect(missing.resume()).resolves.toBe(false);
    expect(missing.status).toBe("idle");
    missing.dispose();

    const audio = new FakeAudio();
    const unavailable = createAudioAnalyzer(audio, {
      createAudioContext: () => {
        throw new Error("no AudioContext");
      },
    });
    await expect(unavailable.resume()).resolves.toBe(false);
    expect(unavailable.status).toBe("unavailable");
    expect(audio.paused).toBe(false);
    unavailable.dispose();
  });

  it("initialises lazily after play, samples, and disposes its graph", async () => {
    const audio = new FakeAudio();
    const context = new FakeContext();
    const frames: Array<() => void> = [];
    const listener = vi.fn();
    const analyzer = createAudioAnalyzer(audio, {
      createAudioContext: () => context,
      requestAnimationFrame: (callback) => {
        frames.push(() => callback(0));
        return frames.length;
      },
      cancelAnimationFrame: vi.fn(),
    });

    expect(context.createAnalyser).not.toHaveBeenCalled();
    analyzer.subscribe(listener);
    await expect(analyzer.resume()).resolves.toBe(true);
    expect(context.createAnalyser).toHaveBeenCalledTimes(1);
    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio);
    expect(analyzer.available).toBe(true);
    expect(analyzer.running).toBe(true);
    frames.shift()?.();
    expect(analyzer.snapshot.spectrum).toEqual([0, 64 / 255, 128 / 255, 1]);
    expect(analyzer.snapshot.energy).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalled();

    analyzer.dispose();
    expect(context.source.disconnect).toHaveBeenCalled();
    expect(context.analyser.disconnect).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
    expect(analyzer.status).toBe("disposed");
    expect(analyzer.available).toBe(false);
  });

  it("stops and resumes sampling with visibility without touching playback", async () => {
    const audio = new FakeAudio();
    const context = new FakeContext();
    const visibility = new FakeVisibility();
    const frames: Array<() => void> = [];
    const analyzer = createAudioAnalyzer(audio, {
      createAudioContext: () => context,
      visibilityTarget: visibility,
      requestAnimationFrame: (callback) => {
        frames.push(() => callback(0));
        return frames.length;
      },
      cancelAnimationFrame: vi.fn(),
    });
    await analyzer.resume();
    expect(analyzer.running).toBe(true);
    visibility.setHidden(true);
    expect(analyzer.running).toBe(false);
    expect(audio.paused).toBe(false);
    visibility.setHidden(false);
    expect(analyzer.running).toBe(true);
    audio.dispatch("pause");
    expect(analyzer.running).toBe(false);
    analyzer.dispose();
  });
});

