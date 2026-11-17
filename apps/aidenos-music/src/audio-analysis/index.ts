import {
  AUDIO_BAND_NAMES,
  DEFAULT_AUDIO_BAND_RANGES,
  type AudioAnalysisAnalyserNode,
  type AudioAnalysisAudio,
  type AudioAnalysisContext,
  type AudioAnalysisController,
  type AudioAnalysisNode,
  type AudioAnalysisMediaElementSourceNode,
  type AudioAnalysisOptions,
  type AudioAnalysisSnapshot,
  type AudioAnalysisStatus,
  type AudioAnalysisVisibilityTarget,
  type AudioBandLevels,
  type AudioBandName,
  type AudioBandRanges,
  type FrequencyRange,
  type SpectrumAnalysisOptions,
} from "./types";

export * from "./types";

const DEFAULT_FFT_SIZE = 1_024;
const DEFAULT_SAMPLE_INTERVAL = 1_000 / 60;
const DEFAULT_SAMPLE_RATE = 44_100;

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function clampPositive(value: number, fallback: number): number {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function cloneRanges(
  ranges?: Partial<AudioBandRanges>,
): AudioBandRanges {
  const result = {} as AudioBandRanges;
  for (const name of AUDIO_BAND_NAMES) {
    const input = ranges?.[name] ?? DEFAULT_AUDIO_BAND_RANGES[name];
    const minHz = Math.max(0, finite(input.minHz, 0));
    const maxHz = Math.max(minHz, finite(input.maxHz, minHz));
    result[name] = { minHz, maxHz };
  }
  return result;
}

function isArrayLike(value: unknown): value is ArrayLike<number> {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ArrayLike<number>).length === "number"
  );
}

function maxValue(values: ArrayLike<number>): number {
  let result = 0;
  for (let index = 0; index < values.length; index += 1)
    result = Math.max(result, finite(values[index]));
  return result;
}

/** Convert byte analyser magnitudes (0..255) to immutable 0..1 numbers. */
export function normalizeSpectrum(data: ArrayLike<number> | null | undefined): number[] {
  if (!isArrayLike(data)) return [];
  const scale = maxValue(data) > 1 ? 1 / 255 : 1;
  const result = new Array<number>(data.length);
  for (let index = 0; index < data.length; index += 1)
    result[index] = clamp(finite(data[index]) * scale);
  return result;
}

/** British spelling retained for callers that use the language of the UI. */
export const normaliseSpectrum = normalizeSpectrum;
export const normalizeFrequencyData = normalizeSpectrum;
export const normaliseFrequencyData = normalizeSpectrum;

function normalisedValues(data: ArrayLike<number>): number[] {
  // Pure helpers are often called with either a Uint8Array from an AnalyserNode
  // or an already-normalised array in tests. Treat values above one as bytes.
  const scale = maxValue(data) > 1 ? 1 / 255 : 1;
  const result = new Array<number>(data.length);
  for (let index = 0; index < data.length; index += 1)
    result[index] = clamp(finite(data[index]) * scale);
  return result;
}

function emptyBands(): AudioBandLevels {
  return { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0 };
}

/**
 * Average magnitudes in each frequency range. The input can be normalised or
 * analyser bytes; values are interpreted accordingly and always returned 0..1.
 */
export function computeBandLevels(
  spectrum: ArrayLike<number> | null | undefined,
  sampleRate: number,
  options: { fftSize?: number; bandRanges?: Partial<AudioBandRanges> } = {},
): AudioBandLevels {
  const result = emptyBands();
  if (!isArrayLike(spectrum) || spectrum.length === 0) return result;
  const values = normalisedValues(spectrum);
  const rate = finite(sampleRate);
  if (rate <= 0) return result;
  const fftSize = Math.max(
    2,
    Math.round(finite(options.fftSize, spectrum.length * 2)),
  );
  const ranges = cloneRanges(options.bandRanges);
  for (const name of AUDIO_BAND_NAMES) {
    const range = ranges[name];
    let sum = 0;
    let count = 0;
    for (let index = 0; index < values.length; index += 1) {
      const frequency = (index * rate) / fftSize;
      if (frequency >= range.minHz && frequency < range.maxHz) {
        sum += values[index];
        count += 1;
      }
    }
    result[name] = count ? clamp(sum / count) : 0;
  }
  return result;
}

export const calculateBandLevels = computeBandLevels;
export const computeBands = computeBandLevels;

/** RMS of normalised magnitudes. Empty input has zero energy. */
export function computeEnergy(
  spectrum: ArrayLike<number> | null | undefined,
): number {
  if (!isArrayLike(spectrum) || spectrum.length === 0) return 0;
  const values = normalisedValues(spectrum);
  let sumSquares = 0;
  for (const value of values) sumSquares += value * value;
  return clamp(Math.sqrt(sumSquares / values.length));
}

export const calculateEnergy = computeEnergy;

/** Highest normalised magnitude in a frame. */
export function computePeak(
  spectrum: ArrayLike<number> | null | undefined,
): number {
  if (!isArrayLike(spectrum) || spectrum.length === 0) return 0;
  const values = normalisedValues(spectrum);
  return clamp(Math.max(...values));
}

/**
 * Positive energy change used as a lightweight beat/transient signal.
 * Falling energy does not create a transient. A threshold removes low-level
 * jitter and is expressed in the same 0..1 units as energy.
 */
export function computeTransient(
  currentEnergy: number,
  previousEnergy: number | null | undefined,
  threshold = 0,
): number {
  if (previousEnergy == null) return 0;
  const current = clamp(currentEnergy);
  const previous = clamp(previousEnergy);
  const gate = clamp(threshold);
  return clamp(Math.max(0, current - previous - gate) / Math.max(1e-9, 1 - gate));
}

export const calculateTransient = computeTransient;

function freezeSnapshot(snapshot: AudioAnalysisSnapshot): AudioAnalysisSnapshot {
  // Freezing the arrays prevents a visualizer from accidentally mutating the
  // controller's current frame while still keeping snapshots cheap to read.
  Object.freeze(snapshot.spectrum);
  Object.freeze(snapshot.bands);
  return Object.freeze(snapshot);
}

export function createEmptyAudioAnalysisSnapshot(
  timestamp = 0,
  available = false,
  active = false,
): AudioAnalysisSnapshot {
  return freezeSnapshot({
    timestamp: finite(timestamp),
    spectrum: [],
    bands: emptyBands(),
    energy: 0,
    transient: 0,
    peak: 0,
    available,
    active,
  });
}

export const emptyAudioAnalysisSnapshot = createEmptyAudioAnalysisSnapshot;

/**
 * Pure frame analysis. `data` is normally the Uint8Array returned by an
 * AnalyserNode; `previousEnergy` lets a controller calculate transients
 * without keeping state in this function.
 */
export function analyzeSpectrum(
  data: ArrayLike<number> | null | undefined,
  sampleRate: number,
  options: SpectrumAnalysisOptions = {},
): AudioAnalysisSnapshot {
  const spectrum = normalizeSpectrum(data);
  const energy = computeEnergy(spectrum);
  const bands = computeBandLevels(spectrum, sampleRate, options);
  return freezeSnapshot({
    timestamp: finite(options.timestamp),
    spectrum,
    bands,
    energy,
    transient: computeTransient(
      energy,
      options.previousEnergy,
      options.transientThreshold,
    ),
    peak: computePeak(spectrum),
    available: options.available ?? true,
    active: options.active ?? true,
  });
}

export const analyseSpectrum = analyzeSpectrum;
export const analyzeFrequencyData = analyzeSpectrum;

function normalizeFftSize(value: number | undefined): number {
  const target = Math.round(finite(value, DEFAULT_FFT_SIZE));
  let size = 32;
  while (size < target && size < 32_768) size *= 2;
  if (size > target && size > 32) {
    const lower = size / 2;
    size = target - lower < size - target ? lower : size;
  }
  return Math.min(32_768, Math.max(32, size));
}

function defaultVisibilityTarget(): AudioAnalysisVisibilityTarget | null {
  try {
    const candidate = (globalThis as typeof globalThis & {
      document?: AudioAnalysisVisibilityTarget;
    }).document;
    return candidate ?? null;
  } catch {
    return null;
  }
}

function defaultContextFactory(): AudioAnalysisContext | null {
  try {
    const root = globalThis as typeof globalThis & {
      AudioContext?: new () => AudioAnalysisContext;
      webkitAudioContext?: new () => AudioAnalysisContext;
    };
    const Constructor = root.AudioContext ?? root.webkitAudioContext;
    return Constructor ? new Constructor() : null;
  } catch {
    return null;
  }
}

function visibleFrom(target: AudioAnalysisVisibilityTarget | null): boolean {
  if (!target) return true;
  try {
    if (typeof target.hidden === "boolean") return !target.hidden;
    if (typeof target.visibilityState === "string")
      return target.visibilityState !== "hidden";
  } catch {
    /* A host shell can expose a throwing visibility getter. */
  }
  return true;
}

function audioIsPlaying(audio: AudioAnalysisAudio | null): boolean {
  if (!audio) return false;
  try {
    return audio.paused !== true && audio.ended !== true;
  } catch {
    return false;
  }
}

function safeDisconnect(node: AudioAnalysisNode | null): void {
  try {
    node?.disconnect?.();
  } catch {
    /* Teardown should never affect playback. */
  }
}

function safeClose(context: AudioAnalysisContext | null): void {
  try {
    const result = context?.close?.();
    if (result && typeof (result as Promise<void>).catch === "function")
      void (result as Promise<void>).catch(() => undefined);
  } catch {
    /* Contexts can already be closed by a host shell. */
  }
}

function isOptionsObject(
  value: AudioAnalysisAudio | AudioAnalysisOptions | null | undefined,
): value is AudioAnalysisOptions {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    "audio" in candidate ||
    "audioContext" in candidate ||
    "createAudioContext" in candidate ||
    "contextFactory" in candidate ||
    "fftSize" in candidate ||
    "visibilityTarget" in candidate ||
    "allowCrossOrigin" in candidate
  );
}

export class AudioAnalyzer implements AudioAnalysisController {
  private readonly options: AudioAnalysisOptions;
  private readonly audio: AudioAnalysisAudio | null;
  private readonly now: () => number;
  private readonly ranges: AudioBandRanges;
  private readonly sampleIntervalMs: number;
  private readonly requestFrame: ((callback: (timestamp: number) => void) => unknown) | null;
  private readonly cancelFrame: ((handle: unknown) => void) | null;
  private readonly timeout: ((callback: () => void, delayMs: number) => unknown) | null;
  private readonly clearTimeoutHandle: ((handle: unknown) => void) | null;
  private readonly visibilityTarget: AudioAnalysisVisibilityTarget | null;
  private readonly closeAudioContext: boolean;
  private readonly allowCrossOrigin: boolean;
  private readonly visibilityListener: EventListener;
  private readonly playListener: EventListener;
  private readonly pauseListener: EventListener;
  private readonly listeners = new Set<(snapshot: AudioAnalysisSnapshot) => void>();
  private readonly fftSize: number;
  private readonly transientThreshold: number;
  private context: AudioAnalysisContext | null = null;
  private sourceNode: AudioAnalysisMediaElementSourceNode | null = null;
  private analyser: AudioAnalysisAnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private previousEnergy: number | null = null;
  private frameHandle: unknown = null;
  private resumePromise: Promise<boolean> | null = null;
  private visibilityOverride: boolean | null = null;
  private visible: boolean;
  private enabledValue = true;
  private disposed = false;
  private statusValue: AudioAnalysisStatus = "idle";
  private snapshotValue: AudioAnalysisSnapshot;

  constructor(options: AudioAnalysisOptions = {}) {
    this.options = options;
    this.audio = options.audio ?? null;
    this.now = options.now ?? (() => Date.now());
    this.ranges = cloneRanges(options.bandRanges);
    this.sampleIntervalMs = Math.max(
      16,
      finite(options.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL),
    );
    this.fftSize = normalizeFftSize(options.fftSize);
    this.transientThreshold = clamp(options.transientThreshold ?? 0.05);
    this.closeAudioContext = options.closeAudioContext ?? true;
    this.allowCrossOrigin = options.allowCrossOrigin === true;
    this.visibilityTarget =
      options.visibilityTarget === undefined
        ? defaultVisibilityTarget()
        : options.visibilityTarget;
    this.visible = visibleFrom(this.visibilityTarget);

    const globalRoot = globalThis as typeof globalThis & {
      requestAnimationFrame?: (callback: FrameRequestCallback) => number;
      cancelAnimationFrame?: (handle: number) => void;
      setTimeout?: typeof setTimeout;
      clearTimeout?: typeof clearTimeout;
    };
    this.requestFrame =
      options.requestAnimationFrame ??
      (typeof globalRoot.requestAnimationFrame === "function"
        ? (callback) =>
            globalRoot.requestAnimationFrame?.(() => callback(this.now()))
        : null);
    this.cancelFrame =
      options.cancelAnimationFrame ??
      (typeof globalRoot.cancelAnimationFrame === "function"
        ? (handle) => globalRoot.cancelAnimationFrame?.(handle as number)
        : null);
    this.timeout =
      options.setTimeout ??
      (typeof globalRoot.setTimeout === "function"
        ? (callback, delayMs) => globalRoot.setTimeout?.(callback, delayMs)
        : null);
    this.clearTimeoutHandle =
      options.clearTimeout ??
      (typeof globalRoot.clearTimeout === "function"
        ? (handle) => globalRoot.clearTimeout?.(handle as number)
        : null);

    this.snapshotValue = createEmptyAudioAnalysisSnapshot(this.now());
    this.visibilityListener = () => this.handleVisibilityChange();
    this.playListener = () => {
      if (this.enabledValue && this.analyser && this.visible && audioIsPlaying(this.audio))
        this.beginSampling();
    };
    this.pauseListener = () => this.stop();

    try {
      this.visibilityTarget?.addEventListener?.(
        "visibilitychange",
        this.visibilityListener,
      );
      this.audio?.addEventListener?.("play", this.playListener);
      this.audio?.addEventListener?.("playing", this.playListener);
      this.audio?.addEventListener?.("pause", this.pauseListener);
      this.audio?.addEventListener?.("ended", this.pauseListener);
    } catch {
      /* Host objects are allowed to omit or reject optional event methods. */
    }
  }

  get snapshot(): AudioAnalysisSnapshot {
    return this.snapshotValue;
  }

  get status(): AudioAnalysisStatus {
    return this.statusValue;
  }

  get available(): boolean {
    return !this.disposed && !!this.analyser;
  }

  get running(): boolean {
    return this.frameHandle !== null || this.snapshotValue.active;
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  getSnapshot(): AudioAnalysisSnapshot {
    return this.snapshotValue;
  }

  subscribe(listener: (snapshot: AudioAnalysisSnapshot) => void): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async resume(): Promise<boolean> {
    if (this.disposed || !this.enabledValue || !audioIsPlaying(this.audio))
      return false;
    if (this.resumePromise) return this.resumePromise;
    this.resumePromise = this.resumeInternal().finally(() => {
      this.resumePromise = null;
    });
    return this.resumePromise;
  }

  start(): Promise<boolean> {
    return this.resume();
  }

  stop(): void {
    if (this.disposed) return;
    this.cancelScheduledFrame();
    this.previousEnergy = null;
    if (this.snapshotValue.active) {
      this.snapshotValue = createEmptyActivitySnapshot(
        this.snapshotValue,
        false,
      );
      this.emit();
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.enabledValue = enabled === true;
    if (!this.enabledValue) {
      this.stop();
      return;
    }
    if (audioIsPlaying(this.audio))
      void this.resume().catch(() => false);
  }

  pause(): void {
    this.stop();
  }

  sample(timestamp = this.now()): AudioAnalysisSnapshot {
    if (this.disposed || !this.analyser || !this.frequencyData) return this.snapshotValue;
    try {
      this.analyser.getByteFrequencyData(this.frequencyData);
      const next = analyzeSpectrum(this.frequencyData, this.sampleRate(), {
        fftSize: this.analyser.fftSize || this.fftSize,
        bandRanges: this.ranges,
        previousEnergy: this.previousEnergy,
        transientThreshold: this.transientThreshold,
        timestamp,
        available: true,
        active: this.snapshotValue.active,
      });
      this.previousEnergy = next.energy;
      this.snapshotValue = next;
      this.emit();
    } catch {
      this.markUnavailable();
    }
    return this.snapshotValue;
  }

  setVisibility(visible: boolean): void {
    this.visibilityOverride = visible === true;
    this.visible = this.visibilityOverride;
    if (!this.visible) this.stop();
    else if (this.analyser && audioIsPlaying(this.audio)) this.beginSampling();
  }

  setVisible(visible: boolean): void {
    this.setVisibility(visible);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScheduledFrame();
    try {
      this.visibilityTarget?.removeEventListener?.(
        "visibilitychange",
        this.visibilityListener,
      );
      this.audio?.removeEventListener?.("play", this.playListener);
      this.audio?.removeEventListener?.("playing", this.playListener);
      this.audio?.removeEventListener?.("pause", this.pauseListener);
      this.audio?.removeEventListener?.("ended", this.pauseListener);
    } catch {
      /* Teardown remains best-effort for host objects. */
    }
    safeDisconnect(this.sourceNode);
    safeDisconnect(this.analyser);
    if (this.closeAudioContext) safeClose(this.context);
    this.context = null;
    this.sourceNode = null;
    this.analyser = null;
    this.frequencyData = null;
    this.previousEnergy = null;
    this.statusValue = "disposed";
    this.snapshotValue = createEmptyAudioAnalysisSnapshot(this.now());
    this.listeners.clear();
  }

  private async resumeInternal(): Promise<boolean> {
    if (!this.enabledValue) return false;
    if (!(await this.crossOriginProbe())) return false;
    if (!this.ensureAnalyser()) return false;
    try {
      if (this.context?.state === "closed") return false;
      // Calling resume only from this explicit method preserves browser
      // autoplay policy: construction and passive visibility changes never
      // attempt to start an AudioContext.
      await this.context?.resume?.();
    } catch {
      return false;
    }
    if (this.disposed || !this.analyser || !audioIsPlaying(this.audio)) return false;
    this.statusValue = "ready";
    if (this.visible) this.beginSampling();
    return true;
  }

  private ensureAnalyser(): boolean {
    if (this.analyser && this.frequencyData) return true;
    if (this.disposed || !this.audio || this.statusValue === "unavailable")
      return false;
    // A MediaElementAudioSourceNode replaces the element's normal output with
    // the Web Audio graph. If the remote server does not grant CORS, browsers
    // expose zeroes from the source; connecting that graph to destination would
    // make playback silent. Refuse the graph unless the host explicitly opts
    // into a known CORS-safe cross-origin source.
    if (!this.allowCrossOrigin && this.audioIsCrossOrigin()) return false;
    let context: AudioAnalysisContext | null = null;
    try {
      context =
        this.options.audioContext ??
        this.options.createAudioContext?.() ??
        this.options.contextFactory?.() ??
        defaultContextFactory();
      if (!context?.createAnalyser || !context.createMediaElementSource)
        throw new Error("Web Audio analyser is unavailable");
      if (context.state === "closed") throw new Error("AudioContext is closed");
      const analyser = context.createAnalyser();
      const source = context.createMediaElementSource(this.audio);
      if (!analyser || !source) throw new Error("Unable to create Web Audio nodes");

      try {
        analyser.fftSize = this.fftSize;
      } catch {
        /* Browser implementations may reject an out-of-range host value. */
      }
      try {
        analyser.smoothingTimeConstant = clamp(
          this.options.smoothingTimeConstant ?? 0.75,
        );
      } catch {
        /* Keep the implementation's default smoothing. */
      }
      try {
        if (this.options.minDecibels !== undefined)
          analyser.minDecibels = finite(this.options.minDecibels, -100);
        if (this.options.maxDecibels !== undefined)
          analyser.maxDecibels = finite(this.options.maxDecibels, -30);
      } catch {
        /* Keep the implementation's default decibel range. */
      }

      // Connect only the analyser graph. The source element itself is never
      // paused, rewound, or assigned a new src, so an unavailable graph cannot
      // interrupt playback.
      source.connect(analyser);
      if (context.destination !== undefined) analyser.connect(context.destination);

      this.context = context;
      this.sourceNode = source;
      this.analyser = analyser;
      this.frequencyData = new Uint8Array(
        Math.max(1, Math.floor(analyser.frequencyBinCount || this.fftSize / 2)),
      );
      this.statusValue = "ready";
      return true;
    } catch {
      safeDisconnect(this.sourceNode);
      safeDisconnect(this.analyser);
      if (context && this.closeAudioContext) safeClose(context);
      this.context = null;
      this.sourceNode = null;
      this.analyser = null;
      this.frequencyData = null;
      this.statusValue = "unavailable";
      return false;
    }
  }

  private beginSampling(): void {
    if (
      this.disposed ||
      !this.enabledValue ||
      !this.analyser ||
      !this.frequencyData ||
      !this.visible ||
      !audioIsPlaying(this.audio)
    )
      return;
    if (!this.snapshotValue.active) {
      this.snapshotValue = createEmptyActivitySnapshot(
        this.snapshotValue,
        true,
      );
      this.emit();
    }
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (
      this.disposed ||
      !this.snapshotValue.active ||
      this.frameHandle !== null
    )
      return;
    if (this.requestFrame) {
      this.frameHandle = this.requestFrame(() => {
        this.frameHandle = null;
        if (!this.snapshotValue.active || !this.visible || !audioIsPlaying(this.audio)) {
          this.stop();
          return;
        }
        this.sample(this.now());
        this.scheduleFrame();
      });
    } else if (this.timeout) {
      this.frameHandle = this.timeout(() => {
        this.frameHandle = null;
        if (!this.snapshotValue.active || !this.visible || !audioIsPlaying(this.audio)) {
          this.stop();
          return;
        }
        this.sample(this.now());
        this.scheduleFrame();
      }, this.sampleIntervalMs);
    }
  }

  private cancelScheduledFrame(): void {
    if (this.frameHandle === null) return;
    try {
      if (this.requestFrame && this.cancelFrame) this.cancelFrame(this.frameHandle);
      else if (this.clearTimeoutHandle) this.clearTimeoutHandle(this.frameHandle);
    } catch {
      /* A stale RAF/timeout handle is harmless. */
    }
    this.frameHandle = null;
  }

  private sampleRate(): number {
    const rate = finite(this.context?.sampleRate, DEFAULT_SAMPLE_RATE);
    return rate > 0 ? rate : DEFAULT_SAMPLE_RATE;
  }

  private handleVisibilityChange(): void {
    if (this.visibilityOverride !== null) return;
    this.visible = visibleFrom(this.visibilityTarget);
    if (!this.visible) this.stop();
    else if (this.enabledValue && this.analyser && audioIsPlaying(this.audio))
      this.beginSampling();
  }

  private audioIsCrossOrigin(): boolean {
    const candidate = this.audio as AudioAnalysisAudio & {
      currentSrc?: string;
      src?: string;
    };
    const source = candidate.currentSrc || candidate.src;
    if (!source) return false;
    try {
      const root = globalThis as typeof globalThis & {
        location?: { href?: string; origin?: string };
      };
      const origin = root.location?.origin;
      if (!origin) return false;
      return new URL(source, root.location?.href || origin).origin !== origin;
    } catch {
      // A malformed/host-specific URL is left to the normal Web Audio guard.
      return false;
    }
  }

  /**
   * Probe the signed media URL before calling createMediaElementSource(). The
   * probe is deliberately an OPTIONS request: it reads only CORS policy and
   * avoids downloading the track or changing the element's playback state.
   */
  private async crossOriginProbe(): Promise<boolean> {
    if (!this.audioIsCrossOrigin() || this.allowCrossOrigin === false) return true;
    const candidate = this.audio as AudioAnalysisAudio & {
      currentSrc?: string;
      src?: string;
      crossOrigin?: string;
    };
    if (candidate.crossOrigin !== "anonymous") return false;
    const source = candidate.currentSrc || candidate.src;
    if (!source || typeof fetch !== "function") return false;
    try {
      const root = globalThis as typeof globalThis & {
        location?: { href?: string; origin?: string };
      };
      const origin = root.location?.origin;
      const response = await fetch(source, {
        method: "OPTIONS",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      const allowed = response.headers.get("Access-Control-Allow-Origin");
      return Boolean(
        response.ok &&
          allowed &&
          (allowed === "*" || (!!origin && allowed === origin)),
      );
    } catch {
      return false;
    }
  }

  private markUnavailable(): void {
    this.cancelScheduledFrame();
    safeDisconnect(this.sourceNode);
    safeDisconnect(this.analyser);
    if (this.closeAudioContext) safeClose(this.context);
    this.context = null;
    this.sourceNode = null;
    this.analyser = null;
    this.frequencyData = null;
    this.statusValue = "unavailable";
    this.snapshotValue = createEmptyAudioAnalysisSnapshot(this.now());
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.snapshotValue);
      } catch {
        /* A visualizer listener must not break audio sampling. */
      }
    }
  }
}

function createEmptyActivitySnapshot(
  previous: AudioAnalysisSnapshot,
  active: boolean,
): AudioAnalysisSnapshot {
  return freezeSnapshot({
    timestamp: previous.timestamp,
    spectrum: [...previous.spectrum],
    bands: { ...previous.bands },
    energy: previous.energy,
    transient: previous.transient,
    peak: previous.peak,
    available: previous.available,
    active,
  });
}

export function createAudioAnalyzer(
  audio: AudioAnalysisAudio | null | undefined,
  options?: Omit<AudioAnalysisOptions, "audio">,
): AudioAnalysisController;
export function createAudioAnalyzer(
  options?: AudioAnalysisOptions,
): AudioAnalysisController;
export function createAudioAnalyzer(
  audioOrOptions?: AudioAnalysisAudio | AudioAnalysisOptions | null,
  maybeOptions: Omit<AudioAnalysisOptions, "audio"> = {},
): AudioAnalysisController {
  if (isOptionsObject(audioOrOptions))
    return new AudioAnalyzer(audioOrOptions);
  return new AudioAnalyzer({ ...maybeOptions, audio: audioOrOptions ?? null });
}

/** Alias used by hosts that call the controller an audio-analysis runtime. */
export const createAudioAnalysis = createAudioAnalyzer;
export const createAudioAnalysisRuntime = createAudioAnalyzer;

