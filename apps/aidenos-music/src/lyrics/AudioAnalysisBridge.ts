import { motionValue, type MotionValue } from "motion/react";
import type { AudioBands } from "../vendor/folia/types";

/**
 * The optional analyser boundary used by the lyric/visual stages.
 *
 * Values may be either normalised (0..1) or Web Audio-style byte levels
 * (0..255). The renderer boundary accepts both, while invalid snapshots are
 * reduced to an idle frame instead of leaking NaN/Infinity into Pixi.
 */
export interface AudioAnalysisSnapshot {
  energy: number;
  bass: number;
  lowMid: number;
  mid: number;
  vocal: number;
  treble: number;
  spectrum: Uint8Array;
  transient: number;
  beat?: boolean;
  downbeat?: boolean;
}

export type NormalizedAudioAnalysisSnapshot = AudioAnalysisSnapshot;
export type AudioAnalysisListener = (
  snapshot: AudioAnalysisSnapshot | null | undefined,
) => void;

/** A deliberately small duck-typed source so MusicRuntime need not depend on analysis. */
export interface AudioAnalysisSource {
  subscribe(listener: AudioAnalysisListener): (() => void) | void;
  getSnapshot?: () => AudioAnalysisSnapshot | null | undefined;
}

export interface AudioAnalysisMotionValues {
  /** Overall power, passed to Sonnet as `audioPower`. */
  energy: MotionValue<number>;
  audioPower: MotionValue<number>;
  bass: MotionValue<number>;
  lowMid: MotionValue<number>;
  mid: MotionValue<number>;
  vocal: MotionValue<number>;
  treble: MotionValue<number>;
  spectrum: MotionValue<Uint8Array<ArrayBufferLike>>;
  transient: MotionValue<number>;
  /** Presence flags are exposed for future consumers; they are never inferred. */
  beat: MotionValue<number>;
  downbeat: MotionValue<number>;
  /** The shape Folia's Pixi runtime already understands. */
  audioBands: AudioBands;
}

export interface AudioAnalysisLifecycle {
  /** The owning stage is mounted and visible. */
  active?: boolean;
  /** Host reduced-motion preference. */
  reduced?: boolean;
  /** Document or surface is hidden. */
  hidden?: boolean;
}

export interface AudioAnalysisBridgeOptions {
  /** Minimum time between accepted snapshots. Defaults to ~30 Hz. */
  throttleMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface AudioAnalysisBridge {
  readonly values: AudioAnalysisMotionValues;
  readonly running: boolean;
  /** Connects an optional source and returns an idempotent cleanup function. */
  connect(
    source: AudioAnalysisSource | null | undefined,
    lifecycle?: AudioAnalysisLifecycle,
  ): () => void;
  /** Detaches the source and returns all values to the neutral frame. */
  disconnect(): void;
  /** Changes visibility/reduced-motion state without touching React state. */
  setLifecycle(lifecycle: AudioAnalysisLifecycle): void;
  /** Useful for source adapters and deterministic tests. */
  push(snapshot: AudioAnalysisSnapshot | null | undefined, at?: number): boolean;
  /** Clears values and throttle history while keeping the connection alive. */
  reset(): void;
}

const LEVEL_KEYS = [
  "energy",
  "bass",
  "lowMid",
  "mid",
  "vocal",
  "treble",
  "transient",
] as const;

const DEFAULT_THROTTLE_MS = 1000 / 30;

function idleSnapshot(): NormalizedAudioAnalysisSnapshot {
  return {
    energy: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    vocal: 0,
    treble: 0,
    spectrum: new Uint8Array(),
    transient: 0,
  };
}

/** A fresh neutral snapshot; callers cannot mutate bridge state through it. */
export function createIdleAudioAnalysisSnapshot(): NormalizedAudioAnalysisSnapshot {
  return idleSnapshot();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isByteSpectrum(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/** Structural validation is intentionally strict so malformed data fails closed. */
export function isAudioAnalysisSnapshot(
  value: unknown,
): value is AudioAnalysisSnapshot {
  if (!isRecord(value) || !isByteSpectrum(value.spectrum)) return false;
  if (!LEVEL_KEYS.every((key) => typeof value[key] === "number" && Number.isFinite(value[key])))
    return false;
  return (
    (value.beat === undefined || typeof value.beat === "boolean") &&
    (value.downbeat === undefined || typeof value.downbeat === "boolean")
  );
}

/**
 * Matches Folia's existing audio-level convention: values above one are
 * treated as byte levels, while values in 0..1 stay normalised.
 */
export function normalizeAudioLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const level = value > 1 ? value / 255 : value;
  return Math.min(1, Math.max(0, level));
}

/**
 * Normalises a source frame and copies its spectrum. Invalid frames return a
 * neutral frame so a broken analyser cannot poison the lyric renderer.
 */
export function normalizeAudioAnalysisSnapshot(
  value: unknown,
): NormalizedAudioAnalysisSnapshot {
  const adapted = adaptAudioAnalysisSnapshot(value);
  if (!adapted) return idleSnapshot();
  return {
    energy: normalizeAudioLevel(adapted.energy),
    bass: normalizeAudioLevel(adapted.bass),
    lowMid: normalizeAudioLevel(adapted.lowMid),
    mid: normalizeAudioLevel(adapted.mid),
    vocal: normalizeAudioLevel(adapted.vocal),
    treble: normalizeAudioLevel(adapted.treble),
    spectrum: new Uint8Array(adapted.spectrum),
    transient: normalizeAudioLevel(adapted.transient),
    // Do not derive beat events from energy/transient. Only explicit flags pass through.
    ...(adapted.beat === undefined ? {} : { beat: adapted.beat }),
    ...(adapted.downbeat === undefined ? {} : { downbeat: adapted.downbeat }),
  };
}

/**
 * The public boundary above is intentionally tiny. A controller adapter may
 * still hand us the analyser module's nested `{ bands, spectrum: number[] }`
 * frame; accept that shape here without adding it to MusicRuntime or making it
 * part of the stage contract. `available:false`/`active:false` is an idle
 * frame, which also makes hidden/reduced controller notifications fail safe.
 */
export function adaptAudioAnalysisSnapshot(value: unknown): AudioAnalysisSnapshot | null {
  if (isAudioAnalysisSnapshot(value)) return value;
  if (!isRecord(value) || !isRecord(value.bands)) return null;
  if (value.available === false || value.active === false) return null;
  const bands = value.bands;
  const values = [value.energy, value.transient, bands.bass, bands.lowMid, bands.mid, bands.vocal, bands.treble];
  if (!values.every((entry) => typeof entry === "number" && Number.isFinite(entry))) return null;
  const spectrum = toByteSpectrum(value.spectrum);
  if (!spectrum) return null;
  return {
    energy: value.energy as number,
    bass: bands.bass as number,
    lowMid: bands.lowMid as number,
    mid: bands.mid as number,
    vocal: bands.vocal as number,
    treble: bands.treble as number,
    spectrum,
    transient: value.transient as number,
    ...(typeof value.beat === "boolean" ? { beat: value.beat } : {}),
    ...(typeof value.downbeat === "boolean" ? { downbeat: value.downbeat } : {}),
  };
}

function toByteSpectrum(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (!isRecord(value) || typeof value.length !== "number" || !Number.isFinite(value.length)) return null;
  const length = Math.max(0, Math.floor(value.length));
  const result = new Uint8Array(length);
  let maximum = 0;
  for (let index = 0; index < length; index += 1) {
    const entry = value[index];
    if (typeof entry !== "number" || !Number.isFinite(entry)) return null;
    maximum = Math.max(maximum, entry);
  }
  const scale = maximum > 1 ? 1 / 255 : 1;
  for (let index = 0; index < length; index += 1) {
    const entry = value[index] as number;
    result[index] = Math.round(Math.min(1, Math.max(0, entry * scale)) * 255);
  }
  return result;
}

function putValues(
  values: AudioAnalysisMotionValues,
  snapshot: NormalizedAudioAnalysisSnapshot,
) {
  values.energy.set(snapshot.energy);
  values.bass.set(snapshot.bass);
  values.lowMid.set(snapshot.lowMid);
  values.mid.set(snapshot.mid);
  values.vocal.set(snapshot.vocal);
  values.treble.set(snapshot.treble);
  values.spectrum.set(snapshot.spectrum);
  values.transient.set(snapshot.transient);
  values.beat.set(snapshot.beat === true ? 1 : 0);
  values.downbeat.set(snapshot.downbeat === true ? 1 : 0);
}

export function createAudioAnalysisMotionValues(
  initial: NormalizedAudioAnalysisSnapshot = idleSnapshot(),
): AudioAnalysisMotionValues {
  const energy = motionValue(initial.energy);
  const bass = motionValue(initial.bass);
  const lowMid = motionValue(initial.lowMid);
  const mid = motionValue(initial.mid);
  const vocal = motionValue(initial.vocal);
  const treble = motionValue(initial.treble);
  const spectrum = motionValue<Uint8Array<ArrayBufferLike>>(
    new Uint8Array(initial.spectrum),
  );
  const transient = motionValue(initial.transient);
  const beat = motionValue(initial.beat === true ? 1 : 0);
  const downbeat = motionValue(initial.downbeat === true ? 1 : 0);
  return {
    energy,
    audioPower: energy,
    bass,
    lowMid,
    mid,
    vocal,
    treble,
    spectrum,
    transient,
    beat,
    downbeat,
    audioBands: { bass, lowMid, mid, vocal, treble, spectrum },
  };
}

/** Pure lifecycle gate used by the bridge and by tests. */
export function shouldRunAudioAnalysis(
  lifecycle: Required<AudioAnalysisLifecycle>,
): boolean {
  return lifecycle.active && !lifecycle.reduced && !lifecycle.hidden;
}

function readClock(clock: () => number): number {
  const value = clock();
  return Number.isFinite(value) ? value : 0;
}

function validThrottleMs(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : DEFAULT_THROTTLE_MS;
}

/** Pure frame gate used by the bridge; no timers or React state are involved. */
export function shouldAcceptAudioAnalysisFrame(
  lastAcceptedAt: number,
  timestamp: number,
  throttleMs = DEFAULT_THROTTLE_MS,
): boolean {
  const interval = validThrottleMs(throttleMs);
  if (interval === 0 || !Number.isFinite(lastAcceptedAt)) return true;
  return Number.isFinite(timestamp) && timestamp - lastAcceptedAt >= interval;
}

/**
 * Creates a small, allocation-free-enough subscription bridge. It never calls
 * setState: accepted frames only update MotionValue instances consumed by Pixi.
 */
export function createAudioAnalysisBridge(
  options: AudioAnalysisBridgeOptions = {},
): AudioAnalysisBridge {
  const values = createAudioAnalysisMotionValues();
  const throttleMs = validThrottleMs(options.throttleMs);
  const now = options.now ?? (() =>
    typeof performance !== "undefined" ? performance.now() : Date.now());
  let lifecycle: Required<AudioAnalysisLifecycle> = {
    active: true,
    reduced: false,
    hidden: false,
  };
  let source: AudioAnalysisSource | null = null;
  let unsubscribe: (() => void) | null = null;
  let connection = 0;
  let lastAcceptedAt = Number.NEGATIVE_INFINITY;

  const reset = () => {
    putValues(values, idleSnapshot());
    lastAcceptedAt = Number.NEGATIVE_INFINITY;
  };

  const isRunning = () => shouldRunAudioAnalysis(lifecycle);

  const detachSubscription = () => {
    connection += 1;
    const cleanup = unsubscribe;
    unsubscribe = null;
    if (cleanup) {
      try {
        cleanup();
      } catch {
        // A third-party source is optional; teardown remains fail-safe.
      }
    }
  };

  const attachSubscription = () => {
    if (!source || !isRunning() || unsubscribe) return;
    const token = ++connection;
    const listener: AudioAnalysisListener = (snapshot) => {
      if (token !== connection) return;
      bridge.push(snapshot);
    };
    let cleanup: (() => void) | void = undefined;
    try {
      cleanup = source.subscribe(listener);
      unsubscribe = typeof cleanup === "function" ? cleanup : () => {};
      const initial = source.getSnapshot?.();
      if (initial !== undefined && initial !== null) bridge.push(initial);
    } catch {
      if (typeof cleanup === "function") {
        try {
          cleanup();
        } catch {
          /* Best-effort cleanup for a source that threw during setup. */
        }
      }
      unsubscribe = null;
      reset();
    }
  };

  const reconcile = () => {
    if (isRunning()) attachSubscription();
    else {
      detachSubscription();
      reset();
    }
  };

  const bridge: AudioAnalysisBridge = {
    values,
    get running() {
      return isRunning() && (!!source || !!unsubscribe);
    },
    connect(nextSource, nextLifecycle = {}) {
      detachSubscription();
      source = nextSource ?? null;
      lifecycle = {
        active: nextLifecycle.active ?? true,
        reduced: nextLifecycle.reduced ?? false,
        hidden: nextLifecycle.hidden ?? false,
      };
      reset();
      reconcile();
      let connected = true;
      return () => {
        if (!connected) return;
        connected = false;
        if (source === nextSource) bridge.disconnect();
      };
    },
    disconnect() {
      source = null;
      lifecycle = { ...lifecycle, active: false };
      detachSubscription();
      reset();
    },
    setLifecycle(nextLifecycle) {
      lifecycle = {
        ...lifecycle,
        ...nextLifecycle,
      };
      reconcile();
    },
    push(snapshot, at = readClock(now)) {
      if (!isRunning()) return false;
      const adapted = adaptAudioAnalysisSnapshot(snapshot);
      const valid = adapted !== null;
      const normalized = valid
        ? normalizeAudioAnalysisSnapshot(adapted)
        : idleSnapshot();
      const timestamp = Number.isFinite(at) ? at : readClock(now);
      // Invalid data is an immediate fail-safe reset, even inside the throttle window.
      if (!valid) {
        putValues(values, normalized);
        lastAcceptedAt = timestamp;
        return true;
      }
      if (!shouldAcceptAudioAnalysisFrame(lastAcceptedAt, timestamp, throttleMs))
        return false;
      putValues(values, normalized);
      lastAcceptedAt = timestamp;
      return true;
    },
    reset,
  };

  return bridge;
}

/**
 * Locate a source without adding an analysis field to MusicRuntime. This is
 * intentionally permissive for future runtime adapters while preserving a
 * no-source/no-op path for today's runtime.
 */
export function findAudioAnalysisSource(value: unknown): AudioAnalysisSource | null {
  if (!isRecord(value)) return null;
  for (const key of ["audioAnalysis", "analysis", "audioAnalyzer"]) {
    const candidate = value[key];
    if (
      isRecord(candidate) &&
      typeof candidate.subscribe === "function"
    )
      return candidate as unknown as AudioAnalysisSource;
  }
  for (const key of ["subscribeAudioAnalysis", "subscribeAnalysis"]) {
    const subscribe = value[key];
    if (typeof subscribe !== "function") continue;
    const getSnapshot = value["getAudioAnalysisSnapshot"];
    return {
      subscribe: (listener) =>
        (subscribe as (listener: AudioAnalysisListener) => (() => void) | void).call(value, listener),
      ...(typeof getSnapshot === "function"
        ? {
            getSnapshot: () =>
              (getSnapshot as () => AudioAnalysisSnapshot | null | undefined).call(value),
          }
        : {}),
    };
  }
  return null;
}

