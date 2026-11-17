import { decodeEncodedAudio, type AudioDecodeEnvironment } from "./audio";
import {
  probeBeatThisCapabilities,
  hasCoreBeatThisCapabilities,
  type CapabilityEnvironment,
} from "./capabilities";
import { BeatThisError } from "./errors";
import { assertValidPcmInput, validateModelDescriptor } from "./pure";
import type {
  BeatThisAudioInput,
  BeatThisCapabilities,
  BeatThisModelAsset,
  BeatThisResult,
  BeatThisStatus,
  BeatThisSupportState,
} from "./types";
import type {
  BeatThisWorkerLike,
  BeatThisWorkerRequest,
  BeatThisWorkerResponse,
} from "./worker/protocol";

export interface BeatThisAdapterOptions {
  /** Complete descriptor injected by the host; there is no default model. */
  model?: BeatThisModelAsset;
  capabilities?: BeatThisCapabilities;
  capabilityEnvironment?: CapabilityEnvironment;
  audioDecodeEnvironment?: AudioDecodeEnvironment;
  workerFactory?: () => BeatThisWorkerLike;
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (response: BeatThisWorkerResponse) => void;
  reject: (error: BeatThisError) => void;
  timer: ReturnType<typeof setTimeout>;
  abortCleanup?: () => void;
}

function defaultWorkerFactory(): BeatThisWorkerLike {
  return new Worker(new URL("./worker/beat-this.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as BeatThisWorkerLike;
}

function errorFromData(response: Extract<BeatThisWorkerResponse, { type: "error" }>): BeatThisError {
  return new BeatThisError(response.error.code, response.error.message, response.error.details);
}

/**
 * A deliberately un-wired adapter. It owns a worker only after an explicit
 * analysis request and never invents a result when a capability/model is
 * missing.
 */
export class BeatThisAdapter {
  private readonly options: BeatThisAdapterOptions;
  private readonly model?: BeatThisModelAsset;
  private readonly workerFactory: () => BeatThisWorkerLike;
  private readonly timeoutMs: number;
  private capabilities?: BeatThisCapabilities;
  private worker: BeatThisWorkerLike | null = null;
  private requestCounter = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private readyPromise: Promise<void> | null = null;
  private state: BeatThisSupportState;
  private reason: string | undefined;

  constructor(options: BeatThisAdapterOptions = {}) {
    this.options = options;
    this.model = options.model;
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.timeoutMs = Math.max(1_000, options.timeoutMs ?? 45_000);
    this.capabilities = options.capabilities;
    this.state = this.model?.runtimeUrl ? "idle" : "disabled";
    this.reason = this.model
      ? this.model.runtimeUrl ? undefined : "runtime-url-not-configured"
      : "model-not-configured";
  }

  getStatus(): BeatThisStatus {
    return {
      state: this.state,
      ...(this.reason ? { reason: this.reason } : {}),
      ...(this.capabilities ? { capabilities: this.capabilities } : {}),
    };
  }

  private nextRequestId(prefix: string): string {
    this.requestCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.requestCounter.toString(36)}`;
  }

  private setUnsupported(state: "disabled" | "unsupported", reason: string): never {
    this.state = state;
    this.reason = reason;
    throw new BeatThisError(state, reason);
  }

  private onWorkerMessage = (event: { data: BeatThisWorkerResponse }): void => {
    const response = event.data;
    if (response.type === "progress") return;
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    this.pending.delete(response.requestId);
    clearTimeout(pending.timer);
    pending.abortCleanup?.();
    if (response.type === "error") {
      if (response.error.code === "runtime_unavailable" ||
          response.error.code === "model_unavailable" ||
          response.error.code === "out_of_memory") {
        this.state = "unsupported";
        this.reason = response.error.code;
      }
      pending.reject(errorFromData(response));
    } else pending.resolve(response);
  };

  private onWorkerError = (event: { error?: unknown; message?: string }): void => {
    const message = event.error instanceof Error
      ? event.error.message
      : event.message ?? "Beat This! worker failed";
    const error = new BeatThisError("worker_failed", message);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.abortCleanup?.();
      pending.reject(error);
    }
    this.pending.clear();
    this.state = "unsupported";
    this.reason = "worker-failed";
  };

  private request<T extends BeatThisWorkerResponse>(
    request: BeatThisWorkerRequest,
    transfer: Transferable[] = [],
    timeoutMs = this.timeoutMs,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!this.worker) return Promise.reject(new BeatThisError("worker_failed", "Worker is not available"));
    if (signal?.aborted) return Promise.reject(new BeatThisError("cancelled", "Beat analysis was cancelled"));
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        if (settled) return;
        this.pending.delete(request.requestId);
        cleanup();
        if (this.worker) this.worker.postMessage({ type: "cancel", requestId: request.requestId });
        reject(new BeatThisError("cancelled", "Beat analysis was cancelled"));
      };
      const timer = setTimeout(() => {
        if (settled) return;
        this.pending.delete(request.requestId);
        cleanup();
        if (this.worker && request.type === "analyze") {
          this.worker.postMessage({ type: "cancel", requestId: request.requestId });
        }
        reject(new BeatThisError("timeout", "Beat analysis timed out"));
      }, timeoutMs);
      this.pending.set(request.requestId, {
        resolve: (response) => { cleanup(); resolve(response as T); },
        reject: (error) => { cleanup(); reject(error); },
        timer,
        abortCleanup: () => signal?.removeEventListener("abort", onAbort),
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        this.worker!.postMessage(request, transfer);
      } catch (error) {
        this.pending.delete(request.requestId);
        cleanup();
        reject(new BeatThisError("worker_failed", "Could not send request to worker", String(error)));
      }
    });
  }

  private async ensureCapabilities(inputKind: BeatThisAudioInput["kind"]): Promise<void> {
    if (!this.model) this.setUnsupported("disabled", "model-not-configured");
    if (!this.model.runtimeUrl) this.setUnsupported("disabled", "runtime-url-not-configured");
    const issues = validateModelDescriptor(this.model);
    if (issues.length) this.setUnsupported("disabled", `invalid-model-descriptor: ${issues.join("; ")}`);
    if (!this.capabilities) {
      this.capabilities = await probeBeatThisCapabilities(this.options.capabilityEnvironment);
    }
    if (!hasCoreBeatThisCapabilities(this.capabilities)) {
      this.setUnsupported("unsupported", "worker-or-wasm-unavailable");
    }
    if (inputKind === "encoded-audio" && !this.capabilities.audioDecode.available) {
      this.setUnsupported("unsupported", "audio-decoder-unavailable");
    }
  }

  private async ensureWorkerReady(inputKind: BeatThisAudioInput["kind"]): Promise<void> {
    await this.ensureCapabilities(inputKind);
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      try {
        this.worker = this.workerFactory();
        this.worker.onmessage = this.onWorkerMessage;
        this.worker.onerror = this.onWorkerError;
        const preferred = this.model!.preferredExecutionProvider;
        const provider = preferred === "webgpu" && this.capabilities!.webGpu.available
          ? "webgpu"
          : "wasm";
        const requestId = this.nextRequestId("init");
        const response = await this.request({
          type: "init",
          requestId,
          model: this.model!,
          provider,
        }, [], 15_000);
        if (response.type !== "ready") throw new BeatThisError("worker_failed", "Worker did not acknowledge init");
        this.state = "ready";
        this.reason = undefined;
      } catch (error) {
        this.state = "unsupported";
        this.reason = "worker-init-failed";
        this.worker?.terminate();
        this.worker = null;
        this.readyPromise = null;
        throw error instanceof BeatThisError ? error : new BeatThisError("worker_failed", String(error));
      }
    })();
    return this.readyPromise;
  }

  async analyze(input: BeatThisAudioInput, signal?: AbortSignal): Promise<BeatThisResult> {
    await this.ensureWorkerReady(input.kind);
    const pcm = input.kind === "encoded-audio"
      ? await decodeEncodedAudio(input, this.options.audioDecodeEnvironment)
      : input;
    assertValidPcmInput(
      pcm,
      this.model!.input.preprocess ? undefined : this.model!.input.sampleRate,
    );
    const copy = new Float32Array(pcm.pcm);
    const buffer = copy.buffer as ArrayBuffer;
    const requestId = this.nextRequestId("analyze");
    const response = await this.request({
      type: "analyze",
      requestId,
      audio: {
        kind: "pcm",
        sampleRate: pcm.sampleRate,
        channels: 1,
        pcm: buffer,
        length: copy.length,
        ...(pcm.sourceDurationSeconds === undefined ? {} : { sourceDurationSeconds: pcm.sourceDurationSeconds }),
      },
      timeoutMs: this.timeoutMs,
    }, [buffer], this.timeoutMs, signal);
    if (response.type !== "result") throw new BeatThisError("worker_failed", "Worker did not return an analysis result");
    return response.result;
  }

  dispose(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.abortCleanup?.();
      pending.reject(new BeatThisError("cancelled", "Beat This! adapter was disposed"));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.state = this.model?.runtimeUrl ? "idle" : "disabled";
    this.reason = this.model?.runtimeUrl ? undefined : "runtime-url-not-configured";
  }
}

