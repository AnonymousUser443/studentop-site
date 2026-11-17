/** Names used by the audio analyser's coarse frequency bands. */
export type AudioBandName = "bass" | "lowMid" | "mid" | "vocal" | "treble";

export const AUDIO_BAND_NAMES: readonly AudioBandName[] = [
  "bass",
  "lowMid",
  "mid",
  "vocal",
  "treble",
] as const;

export interface FrequencyRange {
  /** Inclusive lower edge in Hz. */
  minHz: number;
  /** Exclusive upper edge in Hz. */
  maxHz: number;
}

export type AudioBandLevels = Record<AudioBandName, number>;
export type AudioBandRanges = Record<AudioBandName, FrequencyRange>;

/**
 * Ranges intentionally overlap in the vocal/mid area. Vocal energy is a
 * useful visual signal even when a track has little energy in the full mid
 * band, while keeping the bands useful for a simple five-column visualizer.
 */
export const DEFAULT_AUDIO_BAND_RANGES: AudioBandRanges = {
  bass: { minHz: 20, maxHz: 140 },
  lowMid: { minHz: 140, maxHz: 400 },
  mid: { minHz: 400, maxHz: 2_500 },
  vocal: { minHz: 250, maxHz: 4_000 },
  treble: { minHz: 4_000, maxHz: 20_000 },
};

/** A deliberately small structural type shared by HTMLAudioElement and RuntimeAudio. */
export interface AudioAnalysisAudio {
  paused?: boolean;
  ended?: boolean;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}

export interface AudioAnalysisNode {
  connect(destination: unknown): unknown;
  disconnect?(): void;
}

export interface AudioAnalysisAnalyserNode extends AudioAnalysisNode {
  fftSize: number;
  frequencyBinCount: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
  getByteFrequencyData(data: Uint8Array): void;
}

export interface AudioAnalysisMediaElementSourceNode extends AudioAnalysisNode {}

/**
 * Only the Web Audio members used by the module are described here. Keeping
 * this structural makes the analyser easy to test with a small fake context.
 */
export interface AudioAnalysisContext {
  readonly destination?: unknown;
  readonly state?: string;
  readonly sampleRate?: number;
  createAnalyser?(): AudioAnalysisAnalyserNode;
  createMediaElementSource?(
    audio: AudioAnalysisAudio,
  ): AudioAnalysisMediaElementSourceNode;
  resume?(): void | Promise<void>;
  suspend?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

export interface AudioAnalysisVisibilityTarget {
  readonly hidden?: boolean;
  readonly visibilityState?: string;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}

export type AudioAnalysisStatus =
  | "idle"
  | "ready"
  | "unavailable"
  | "disposed";

export interface AudioAnalysisSnapshot {
  /** Timestamp supplied by the controller's clock, in milliseconds. */
  readonly timestamp: number;
  /** Normalised magnitudes (0..1), one value per analyser frequency bin. */
  readonly spectrum: readonly number[];
  readonly bands: Readonly<AudioBandLevels>;
  /** RMS of the normalised frequency magnitudes (0..1). */
  readonly energy: number;
  /** Positive energy change from the previous frame (0..1). */
  readonly transient: number;
  /** Highest normalised frequency magnitude in this frame (0..1). */
  readonly peak: number;
  /** Whether a Web Audio analyser is available for this source. */
  readonly available: boolean;
  /** Whether the controller is actively sampling this frame. */
  readonly active: boolean;
}

export interface SpectrumAnalysisOptions {
  /** FFT size that produced the data. Defaults to data.length * 2. */
  fftSize?: number;
  bandRanges?: Partial<AudioBandRanges>;
  previousEnergy?: number | null;
  transientThreshold?: number;
  timestamp?: number;
  available?: boolean;
  active?: boolean;
}

export interface AudioAnalysisOptions {
  /** The one HTMLAudioElement/RuntimeAudio source owned by the music runtime. */
  audio?: AudioAnalysisAudio | null;
  /** Use an already-created context (mostly useful for tests or a host shell). */
  audioContext?: AudioAnalysisContext | null;
  /** Lazily called by resume() after playback has begun. */
  createAudioContext?: () => AudioAnalysisContext;
  /** Alias retained for callers that use the shorter factory name. */
  contextFactory?: () => AudioAnalysisContext;
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
  bandRanges?: Partial<AudioBandRanges>;
  /** Minimum delay for the setTimeout fallback when RAF is unavailable. */
  sampleIntervalMs?: number;
  now?: () => number;
  requestAnimationFrame?: (callback: (timestamp: number) => void) => unknown;
  cancelAnimationFrame?: (handle: unknown) => void;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  visibilityTarget?: AudioAnalysisVisibilityTarget | null;
  /** Close a context created/injected for this controller on dispose (default true). */
  closeAudioContext?: boolean;
  /**
   * Permit a MediaElementAudioSourceNode for a cross-origin media URL. This is
   * opt-in because a CDN without CORS makes the source output zeroes and can
   * otherwise turn an otherwise audible HTMLAudioElement into silence.
   */
  allowCrossOrigin?: boolean;
  transientThreshold?: number;
}

export interface AudioAnalysisController {
  getSnapshot(): AudioAnalysisSnapshot;
  readonly snapshot: AudioAnalysisSnapshot;
  readonly status: AudioAnalysisStatus;
  readonly available: boolean;
  readonly running: boolean;
  /** Whether sampling has been explicitly enabled by the user/host. */
  readonly enabled: boolean;
  subscribe(listener: (snapshot: AudioAnalysisSnapshot) => void): () => void;
  /** Initialise/resume only after the source is playing. Never calls audio.play(). */
  resume(): Promise<boolean>;
  start(): Promise<boolean>;
  /** Stop sampling without pausing or otherwise mutating the source audio. */
  stop(): void;
  /** Enable or disable sampling. Disabling never pauses the source audio. */
  setEnabled(enabled: boolean): void;
  pause(): void;
  /** Capture one frame if an analyser has already been initialised. */
  sample(timestamp?: number): AudioAnalysisSnapshot;
  setVisibility(visible: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

