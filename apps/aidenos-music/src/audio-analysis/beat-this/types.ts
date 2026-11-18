/**
 * Browser-side contracts for the Beat This! experiment.
 *
 * The adapter deliberately requires a complete model descriptor. There is no
 * baked-in model URL, tensor name, sample rate, or output shape in this
 * experiment; the host must supply and verify those values.
 */

export type BeatThisSupportState = "idle" | "disabled" | "unsupported" | "ready";

export interface CapabilityCheck {
  available: boolean;
  reason?: string;
}

export interface BeatThisCapabilities {
  webAssembly: CapabilityCheck;
  webGpu: CapabilityCheck;
  worker: CapabilityCheck;
  audioDecode: CapabilityCheck;
}

export type BeatThisExecutionProvider = "wasm" | "webgpu";

export type BeatThisInputLayout =
  | "batch-time"
  | "batch-channel-time"
  | "batch-time-frequency";

export interface BeatThisModelInput {
  /** The only input representation implemented by this experiment. */
  kind: "mono-pcm";
  /** Exact ONNX input tensor name. */
  name: string;
  layout: BeatThisInputLayout;
  /** One-based? No: ordinary zero-based tensor dimensions; -1 means dynamic. */
  shape: readonly number[];
  sampleRate: number;
  maxSamples?: number;
  /** Browser preprocessing required before the ONNX tensor is created. */
  preprocess?: "beat-this-log-mel";
}

export type BeatThisActivationKind = "probability" | "logit";

export type BeatThisOutputLayout =
  | "batch-frame-task"
  | "batch-task-frame";

export interface BeatThisModelOutput {
  /** Exact ONNX output tensor name. */
  name: string;
  layout: BeatThisOutputLayout;
  /** Task indices in the final task dimension. */
  beatIndex: number;
  downbeatIndex: number;
  activation: BeatThisActivationKind;
  frameHopSeconds: number;
  threshold: number;
  /** Optional event spacing; no spacing is imposed when omitted. */
  minIntervalSeconds?: number;
}

export interface BeatThisModelAsset {
  format: "onnx";
  /** URL supplied by the host; no URL is guessed by the adapter. */
  modelUrl: string;
  /** URL of a browser-compatible ONNX Runtime module, loaded only on demand. */
  runtimeUrl?: string;
  /** Passed through to ONNX Runtime Web when the WASM provider is selected. */
  wasmBaseUrl?:
    | string
    | { mjs: string; wasm: string };
  /** WebGPU is optional; the adapter falls back to WASM when unavailable. */
  preferredExecutionProvider?: BeatThisExecutionProvider;
  input: BeatThisModelInput;
  output: BeatThisModelOutput;
}

export interface BeatThisPcmInput {
  kind: "pcm";
  sampleRate: number;
  channels: 1;
  /** Mono, interleaved (one sample per frame), finite Float32 samples. */
  pcm: Float32Array;
  sourceDurationSeconds?: number;
}

export interface BeatThisEncodedAudioInput {
  kind: "encoded-audio";
  /** An owned copy is made before decode; callers may transfer their buffer. */
  data: ArrayBuffer;
  mimeType?: string;
}

export type BeatThisAudioInput = BeatThisPcmInput | BeatThisEncodedAudioInput;

export interface SerializedBeatThisPcmInput {
  kind: "pcm";
  sampleRate: number;
  channels: 1;
  pcm: ArrayBuffer;
  length: number;
  sourceDurationSeconds?: number;
}

export interface BeatPoint {
  timeSeconds: number;
  confidence: number;
}

export interface BeatThisResult {
  beats: BeatPoint[];
  downbeats: BeatPoint[];
  durationSeconds: number;
  provider: BeatThisExecutionProvider;
}

export type BeatThisErrorCode =
  | "disabled"
  | "unsupported"
  | "invalid_input"
  | "invalid_model_descriptor"
  | "runtime_unavailable"
  | "model_unavailable"
  | "timeout"
  | "cancelled"
  | "out_of_memory"
  | "inference_failed"
  | "worker_failed";

export interface BeatThisErrorData {
  code: BeatThisErrorCode;
  message: string;
  details?: string;
}

export interface BeatThisStatus {
  state: BeatThisSupportState;
  reason?: string;
  capabilities?: BeatThisCapabilities;
}

