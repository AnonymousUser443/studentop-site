import { describe, expect, it, vi } from "vitest";
import type { AudioAnalysisSnapshot } from "./AudioAnalysisBridge";
import {
  createAudioAnalysisBridge,
  createIdleAudioAnalysisSnapshot,
  adaptAudioAnalysisSnapshot,
  findAudioAnalysisSource,
  isAudioAnalysisSnapshot,
  normalizeAudioAnalysisSnapshot,
  normalizeAudioLevel,
  shouldAcceptAudioAnalysisFrame,
  shouldRunAudioAnalysis,
} from "./AudioAnalysisBridge";

const snapshot = (patch: Partial<AudioAnalysisSnapshot> = {}): AudioAnalysisSnapshot => ({
  energy: 0.4,
  bass: 64,
  lowMid: 0.2,
  mid: 0.3,
  vocal: 0.5,
  treble: 1,
  spectrum: new Uint8Array([0, 32, 255]),
  transient: 0.25,
  ...patch,
});

describe("AudioAnalysisBridge", () => {
  it("normalizes normalised and byte levels while preserving the spectrum copy", () => {
    expect(normalizeAudioLevel(-1)).toBe(0);
    expect(normalizeAudioLevel(0.5)).toBe(0.5);
    expect(normalizeAudioLevel(255)).toBe(1);
    expect(normalizeAudioLevel(Number.NaN)).toBe(0);

    const source = snapshot({ beat: true, downbeat: false });
    const result = normalizeAudioAnalysisSnapshot(source);
    expect(result).toMatchObject({
      energy: 0.4,
      bass: 64 / 255,
      treble: 1,
      transient: 0.25,
      beat: true,
      downbeat: false,
    });
    expect(result.spectrum).toEqual(source.spectrum);
    expect(result.spectrum).not.toBe(source.spectrum);
    source.spectrum[1] = 200;
    expect(result.spectrum[1]).toBe(32);
  });

  it("fails closed for invalid frames instead of inventing event data", () => {
    const idle = createIdleAudioAnalysisSnapshot();
    const rawInvalid = {
      ...snapshot(),
      vocal: Infinity,
      spectrum: [0, 1, 2],
      beat: "yes",
    };
    expect(isAudioAnalysisSnapshot(rawInvalid)).toBe(false);
    const invalid = normalizeAudioAnalysisSnapshot(rawInvalid);
    expect(invalid).toEqual(idle);
    expect(invalid.beat).toBeUndefined();
    expect(invalid.downbeat).toBeUndefined();
    expect(isAudioAnalysisSnapshot({ ...snapshot(), spectrum: [] })).toBe(false);
  });

  it("adapts the analyser controller's nested frame without changing the public contract", () => {
    const result = adaptAudioAnalysisSnapshot({
      energy: 0.5,
      transient: 0.25,
      spectrum: [0, 0.5, 1],
      bands: { bass: 0.1, lowMid: 0.2, mid: 0.3, vocal: 0.4, treble: 0.5 },
      available: true,
      active: true,
    });
    expect(result).toMatchObject({ energy: 0.5, bass: 0.1, vocal: 0.4, transient: 0.25 });
    expect(result?.spectrum).toEqual(new Uint8Array([0, 128, 255]));
    expect(adaptAudioAnalysisSnapshot({
      energy: 1,
      transient: 0,
      spectrum: [],
      bands: { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0 },
      available: false,
      active: false,
    })).toBeNull();
  });

  it("throttles accepted frames and keeps explicit beat flags only", () => {
    expect(shouldAcceptAudioAnalysisFrame(Number.NEGATIVE_INFINITY, 0, 50)).toBe(true);
    expect(shouldAcceptAudioAnalysisFrame(0, 49, 50)).toBe(false);
    expect(shouldAcceptAudioAnalysisFrame(0, 50, 50)).toBe(true);

    let time = 0;
    const bridge = createAudioAnalysisBridge({ throttleMs: 50, now: () => time });
    const unsubscribe = vi.fn();
    let listener: ((value: AudioAnalysisSnapshot) => void) | undefined;
    const source = {
      subscribe: (next: (value: AudioAnalysisSnapshot) => void) => {
        listener = next;
        return unsubscribe;
      },
    };
    bridge.connect(source);
    listener?.(snapshot({ energy: 0.2 }));
    expect(bridge.values.energy.get()).toBe(0.2);
    time = 20;
    listener?.(snapshot({ energy: 0.9, transient: 1 }));
    expect(bridge.values.energy.get()).toBe(0.2);
    time = 51;
    listener?.(snapshot({ energy: 0.9, transient: 1 }));
    expect(bridge.values.energy.get()).toBe(0.9);
    expect(bridge.values.transient.get()).toBe(1);
    expect(bridge.values.beat.get()).toBe(0);
    listener?.(snapshot({ energy: 0.9, beat: true }));
    expect(bridge.values.beat.get()).toBe(0); // still inside the throttle window
    time = 102;
    listener?.(snapshot({ energy: 0.9, beat: true, downbeat: true }));
    expect(bridge.values.beat.get()).toBe(1);
    expect(bridge.values.downbeat.get()).toBe(1);
    expect(unsubscribe).not.toHaveBeenCalled();
    bridge.disconnect();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(bridge.values.energy.get()).toBe(0);
  });

  it("stops and clears on reduced motion or hidden state, then resumes from the source", () => {
    let listener: ((value: AudioAnalysisSnapshot) => void) | undefined;
    let subscriptions = 0;
    let cleanups = 0;
    const source = {
      subscribe: (next: (value: AudioAnalysisSnapshot) => void) => {
        listener = next;
        subscriptions += 1;
        return () => {
          cleanups += 1;
          listener = undefined;
        };
      },
    };
    const bridge = createAudioAnalysisBridge();
    bridge.connect(source, { active: true });
    listener?.(snapshot({ energy: 0.8 }));
    expect(bridge.values.energy.get()).toBe(0.8);
    expect(shouldRunAudioAnalysis({ active: true, reduced: false, hidden: false })).toBe(true);
    expect(shouldRunAudioAnalysis({ active: true, reduced: true, hidden: false })).toBe(false);
    expect(shouldRunAudioAnalysis({ active: true, reduced: false, hidden: true })).toBe(false);

    bridge.setLifecycle({ hidden: true });
    expect(bridge.running).toBe(false);
    expect(bridge.values.energy.get()).toBe(0);
    expect(cleanups).toBe(1);
    listener?.(snapshot({ energy: 1 }));
    expect(bridge.values.energy.get()).toBe(0);

    bridge.setLifecycle({ hidden: false });
    expect(bridge.running).toBe(true);
    expect(subscriptions).toBe(2);
    listener?.(snapshot({ energy: 0.6 }));
    expect(bridge.values.energy.get()).toBe(0.6);

    bridge.setLifecycle({ reduced: true });
    expect(bridge.running).toBe(false);
    expect(bridge.values.energy.get()).toBe(0);
  });

  it("discovers only an explicit optional source and leaves an ordinary runtime untouched", () => {
    const source = { subscribe: () => () => {} };
    expect(findAudioAnalysisSource({ audioAnalysis: source })).toBe(source);
    expect(findAudioAnalysisSource({ subscribe: () => () => {} })).toBeNull();
    expect(findAudioAnalysisSource(null)).toBeNull();
  });
});

