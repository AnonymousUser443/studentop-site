import { BeatThisError, classifyWorkerError } from "../errors";
import {
  activationsToBeatPoints,
  assertValidPcmInput,
  extractBeatActivations,
  validateModelDescriptor,
  type TensorLike,
} from "../pure";
import type { BeatThisModelAsset, BeatThisResult } from "../types";
import type {
  BeatThisWorkerRequest,
  BeatThisWorkerResponse,
} from "./protocol";

interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, TensorLike>>;
}

interface OrtRuntime {
  env?: { wasm?: { wasmPaths?: string } };
  Tensor?: new (type: string, data: Float32Array, dims: number[]) => unknown;
  InferenceSession?: {
    create(url: string, options?: { executionProviders?: string[] }): Promise<OrtSession>;
  };
}

interface WorkerScope {
  onmessage: ((event: { data: BeatThisWorkerRequest }) => void) | null;
  postMessage(message: BeatThisWorkerResponse): void;
}

const scope = globalThis as unknown as WorkerScope;
let model: BeatThisModelAsset | null = null;
let provider: "wasm" | "webgpu" = "wasm";
let runtimePromise: Promise<OrtRuntime> | null = null;
let sessionPromise: Promise<OrtSession> | null = null;
const cancelled = new Set<string>();

function post(response: BeatThisWorkerResponse): void {
  scope.postMessage(response);
}

function errorResponse(requestId: string, error: unknown): BeatThisWorkerResponse {
  const normalized = error instanceof BeatThisError ? error : classifyWorkerError(error);
  return { type: "error", requestId, error: normalized.toData() };
}

async function loadRuntime(): Promise<OrtRuntime> {
  if (!model?.runtimeUrl) {
    throw new BeatThisError(
      "runtime_unavailable",
      "No ONNX Runtime Web URL was supplied; the experiment stays disabled",
    );
  }
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ model.runtimeUrl).then((module) => {
      const runtime = (module as { default?: OrtRuntime }).default ?? (module as OrtRuntime);
      if (!runtime.InferenceSession || !runtime.Tensor) {
        throw new BeatThisError("runtime_unavailable", "The supplied runtime has no ONNX Runtime Web API");
      }
      if (model?.wasmBaseUrl && runtime.env?.wasm) runtime.env.wasm.wasmPaths = model.wasmBaseUrl;
      return runtime;
    });
  }
  return runtimePromise;
}

async function loadSession(): Promise<OrtSession> {
  if (!model) throw new BeatThisError("unsupported", "Worker has not been initialized");
  if (!sessionPromise) {
    const descriptor = model;
    sessionPromise = loadRuntime().then(async (runtime) => {
      try {
        return await runtime.InferenceSession!.create(descriptor.modelUrl, {
          executionProviders: [provider],
        });
      } catch (error) {
        const classified = classifyWorkerError(error);
        if (classified.code === "out_of_memory") throw classified;
        throw new BeatThisError(
          "model_unavailable",
          "The ONNX model could not be loaded",
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  }
  return sessionPromise;
}

function tensorDimensions(modelInput: BeatThisModelAsset["input"], samples: number): number[] {
  const expectedRank = modelInput.layout === "batch-time" ? 2 : 3;
  if (modelInput.shape.length !== expectedRank) {
    throw new BeatThisError("unsupported", "Model input rank does not match its declared layout");
  }
  const dims = modelInput.layout === "batch-time" ? [1, samples] : [1, 1, samples];
  return dims.map((value, index) => {
    const declared = modelInput.shape[index];
    if (declared !== -1 && declared !== value) {
      throw new BeatThisError("unsupported", "Audio length does not match the declared model input shape");
    }
    return value;
  });
}

async function runAnalysis(
  requestId: string,
  audioBuffer: ArrayBuffer,
  sampleRate: number,
  length: number,
  timeoutMs: number,
): Promise<BeatThisResult> {
  if (!model) throw new BeatThisError("unsupported", "Worker has not been initialized");
  if (!Number.isInteger(length) || length <= 0 || audioBuffer.byteLength !== length * 4) {
    throw new BeatThisError("invalid_input", "Transferred PCM buffer length is invalid");
  }
  const pcm = new Float32Array(audioBuffer, 0, length);
  const input = { kind: "pcm" as const, sampleRate, channels: 1 as const, pcm };
  assertValidPcmInput(input, model.input.sampleRate);
  if (model.input.maxSamples !== undefined && length > model.input.maxSamples) {
    throw new BeatThisError("invalid_input", "PCM input exceeds model.maxSamples");
  }
  const runtime = await loadRuntime();
  const Tensor = runtime.Tensor!;
  const session = await loadSession();
  const dims = tensorDimensions(model.input, length);
  const tensor = new Tensor("float32", pcm, dims);
  const runPromise = session.run({ [model.input.name]: tensor });
  // ONNX Runtime has no portable cancellation contract. Race the call and
  // ignore a late result; the adapter can terminate the worker when required.
  runPromise.catch(() => undefined);
  const outputs = await Promise.race([
    runPromise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new BeatThisError("timeout", "Beat analysis timed out")), timeoutMs);
    }),
  ]);
  if (cancelled.has(requestId)) throw new BeatThisError("cancelled", "Beat analysis was cancelled");
  const tensorOutput = outputs[model.output.name];
  const activations = extractBeatActivations(tensorOutput, model.output);
  const points = activationsToBeatPoints(activations, model.output);
  return {
    ...points,
    durationSeconds: length / sampleRate,
    provider,
  };
}

scope.onmessage = (event) => {
  const request = event.data;
  void (async () => {
    try {
      if (request.type === "init") {
        const issues = validateModelDescriptor(request.model);
        if (issues.length) throw new BeatThisError("invalid_model_descriptor", issues.join("; "));
        if (!request.model.runtimeUrl) {
          throw new BeatThisError("runtime_unavailable", "runtimeUrl is required for lazy ONNX loading");
        }
        model = request.model;
        provider = request.provider;
        runtimePromise = null;
        sessionPromise = null;
        post({ type: "ready", requestId: request.requestId, lazy: true });
      } else if (request.type === "analyze") {
        if (!model) throw new BeatThisError("unsupported", "Worker has not been initialized");
        cancelled.delete(request.requestId);
        try {
          const result = await runAnalysis(
            request.requestId,
            request.audio.pcm,
            request.audio.sampleRate,
            request.audio.length,
            request.timeoutMs,
          );
          if (!cancelled.has(request.requestId)) {
            post({ type: "result", requestId: request.requestId, result });
          }
        } finally {
          cancelled.delete(request.requestId);
        }
      } else if (request.type === "cancel") {
        cancelled.add(request.requestId);
      } else if (request.type === "dispose") {
        model = null;
        runtimePromise = null;
        sessionPromise = null;
        cancelled.clear();
        post({ type: "ready", requestId: request.requestId, lazy: true });
      }
    } catch (error) {
      post(errorResponse(request.requestId, error));
    }
  })();
};

