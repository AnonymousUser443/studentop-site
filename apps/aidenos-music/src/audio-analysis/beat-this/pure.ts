import { BeatThisError } from "./errors";
import type {
  BeatPoint,
  BeatThisModelAsset,
  BeatThisModelOutput,
  BeatThisPcmInput,
} from "./types";

export interface TensorLike {
  data: ArrayLike<number>;
  dims: readonly number[];
}

/** Return descriptor issues without touching the network or a runtime. */
export function validateModelDescriptor(model: BeatThisModelAsset): string[] {
  const issues: string[] = [];
  if (!model || model.format !== "onnx") issues.push("format must be onnx");
  if (!model?.modelUrl || typeof model.modelUrl !== "string") {
    issues.push("modelUrl is required");
  }
  const input = model?.input;
  if (!input || input.kind !== "mono-pcm") {
    issues.push("input.kind must be mono-pcm");
  } else {
    if (!input.name) issues.push("input.name is required");
    if (!Number.isFinite(input.sampleRate) || input.sampleRate <= 0) {
      issues.push("input.sampleRate must be positive");
    }
    const expectedRank = input.layout === "batch-time" ? 2 : 3;
    if (
      !Array.isArray(input.shape) ||
      input.shape.length !== expectedRank ||
      input.shape.some((dim) => !Number.isInteger(dim) || dim < -1 || dim === 0)
    ) {
    issues.push(`input.shape must be ${expectedRank} dimensions with positive or -1 values`);
    }
    if (input.maxSamples !== undefined &&
        (!Number.isInteger(input.maxSamples) || input.maxSamples <= 0)) {
      issues.push("input.maxSamples must be a positive integer");
    }
  }
  const output = model?.output;
  if (!output || !output.name) issues.push("output.name is required");
  else issues.push(...validateOutputDescriptor(output));
  return issues;
}

export function validateOutputDescriptor(output: BeatThisModelOutput): string[] {
  const issues: string[] = [];
  if (output.layout !== "batch-frame-task" && output.layout !== "batch-task-frame") {
    issues.push("output.layout must declare a supported rank-3 axis order");
  }
  if (output.activation !== "probability" && output.activation !== "logit") {
    issues.push("output.activation must be probability or logit");
  }
  if (!Number.isInteger(output.beatIndex) || output.beatIndex < 0) {
    issues.push("output.beatIndex must be a non-negative integer");
  }
  if (!Number.isInteger(output.downbeatIndex) || output.downbeatIndex < 0) {
    issues.push("output.downbeatIndex must be a non-negative integer");
  }
  if (output.beatIndex === output.downbeatIndex) {
    issues.push("output.beatIndex and output.downbeatIndex must differ");
  }
  if (!Number.isFinite(output.frameHopSeconds) || output.frameHopSeconds <= 0) {
    issues.push("output.frameHopSeconds must be positive");
  }
  if (!Number.isFinite(output.threshold)) {
    issues.push("output.threshold must be finite");
  }
  if (output.minIntervalSeconds !== undefined &&
      (!Number.isFinite(output.minIntervalSeconds) || output.minIntervalSeconds < 0)) {
    issues.push("output.minIntervalSeconds must be non-negative");
  }
  return issues;
}

export function assertValidPcmInput(
  input: BeatThisPcmInput,
  expectedSampleRate?: number,
): void {
  if (input?.kind !== "pcm" || input.channels !== 1) {
    throw new BeatThisError("invalid_input", "Beat This! requires mono PCM input");
  }
  if (!Number.isFinite(input.sampleRate) || input.sampleRate <= 0) {
    throw new BeatThisError("invalid_input", "PCM sampleRate must be positive");
  }
  if (expectedSampleRate !== undefined && input.sampleRate !== expectedSampleRate) {
    throw new BeatThisError(
      "invalid_input",
      `PCM sampleRate ${input.sampleRate} does not match model sampleRate ${expectedSampleRate}`,
    );
  }
  if (!(input.pcm instanceof Float32Array) || input.pcm.length === 0) {
    throw new BeatThisError("invalid_input", "PCM data must be a non-empty Float32Array");
  }
  for (let i = 0; i < input.pcm.length; i += 1) {
    if (!Number.isFinite(input.pcm[i])) {
      throw new BeatThisError("invalid_input", "PCM data contains a non-finite sample");
    }
  }
  if (input.sourceDurationSeconds !== undefined &&
      (!Number.isFinite(input.sourceDurationSeconds) || input.sourceDurationSeconds < 0)) {
    throw new BeatThisError("invalid_input", "sourceDurationSeconds must be non-negative");
  }
}

export function sigmoid(value: number): number {
  // Stable enough for the finite activations accepted below.
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

export function activationValue(value: number, kind: "probability" | "logit"): number {
  return kind === "logit" ? sigmoid(value) : value;
}

/**
 * Read a single explicitly-described [batch, frame, task] or
 * [batch, task, frame] tensor. Unknown ranks/layouts are rejected rather than
 * guessed.
 */
export function extractBeatActivations(
  tensor: TensorLike,
  output: BeatThisModelOutput,
): { beats: number[]; downbeats: number[] } {
  if (!tensor || !Array.isArray(tensor.dims) || tensor.dims.length !== 3) {
    throw new BeatThisError("inference_failed", "Model output must be a rank-3 tensor");
  }
  if (tensor.dims[0] !== 1) {
    throw new BeatThisError("inference_failed", "Model output batch dimension must be 1");
  }
  const frameCount = output.layout === "batch-frame-task" ? tensor.dims[1] : tensor.dims[2];
  const taskCount = output.layout === "batch-frame-task" ? tensor.dims[2] : tensor.dims[1];
  if (!Number.isInteger(frameCount) || frameCount <= 0 ||
      !Number.isInteger(taskCount) || taskCount <= 0 ||
      output.beatIndex >= taskCount || output.downbeatIndex >= taskCount) {
    throw new BeatThisError("inference_failed", "Model output dimensions do not match descriptor");
  }
  if (tensor.data.length < frameCount * taskCount) {
    throw new BeatThisError("inference_failed", "Model output data is shorter than its dimensions");
  }
  const beats: number[] = [], downbeats: number[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const beatOffset = output.layout === "batch-frame-task"
      ? frame * taskCount + output.beatIndex
      : output.beatIndex * frameCount + frame;
    const downbeatOffset = output.layout === "batch-frame-task"
      ? frame * taskCount + output.downbeatIndex
      : output.downbeatIndex * frameCount + frame;
    beats.push(Number(tensor.data[beatOffset]));
    downbeats.push(Number(tensor.data[downbeatOffset]));
  }
  if (beats.some((value) => !Number.isFinite(value)) || downbeats.some((value) => !Number.isFinite(value))) {
    throw new BeatThisError("inference_failed", "Model output contains non-finite activations");
  }
  return { beats, downbeats };
}

function activationsToPoints(
  values: readonly number[],
  output: BeatThisModelOutput,
): BeatPoint[] {
  const points: BeatPoint[] = [];
  const minIntervalFrames = output.minIntervalSeconds === undefined
    ? 0
    : Math.ceil(output.minIntervalSeconds / output.frameHopSeconds);
  for (let index = 0; index < values.length; index += 1) {
    const confidence = activationValue(values[index], output.activation);
    if (!Number.isFinite(confidence) || confidence < output.threshold) continue;
    const previous = index > 0 ? activationValue(values[index - 1], output.activation) : -Infinity;
    const next = index + 1 < values.length
      ? activationValue(values[index + 1], output.activation)
      : -Infinity;
    if (confidence < previous || confidence < next) continue;
    const candidate: BeatPoint = {
      timeSeconds: index * output.frameHopSeconds,
      confidence,
    };
    const last = points.at(-1);
    if (last && index - Math.round(last.timeSeconds / output.frameHopSeconds) < minIntervalFrames) {
      if (candidate.confidence > last.confidence) points[points.length - 1] = candidate;
    } else {
      points.push(candidate);
    }
  }
  return points;
}

export function activationsToBeatPoints(
  activations: { beats: readonly number[]; downbeats: readonly number[] },
  output: BeatThisModelOutput,
): { beats: BeatPoint[]; downbeats: BeatPoint[] } {
  if (activations.beats.length !== activations.downbeats.length) {
    throw new BeatThisError("inference_failed", "Beat and downbeat activation lengths differ");
  }
  return {
    beats: activationsToPoints(activations.beats, output),
    downbeats: activationsToPoints(activations.downbeats, output),
  };
}

