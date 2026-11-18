import type { BeatThisCapabilities, CapabilityCheck } from "./types";

export interface CapabilityEnvironment {
  WebAssembly?: { validate?: (bytes: BufferSource) => boolean };
  Worker?: unknown;
  navigator?: {
    gpu?: { requestAdapter?: () => Promise<unknown> };
  };
  AudioContext?: unknown;
  OfflineAudioContext?: unknown;
}

const EMPTY_WASM_MODULE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

function probeWasm(environment: CapabilityEnvironment): CapabilityCheck {
  if (!environment.WebAssembly || typeof environment.WebAssembly.validate !== "function") {
    return { available: false, reason: "WebAssembly.validate is unavailable" };
  }
  try {
    return environment.WebAssembly.validate(EMPTY_WASM_MODULE)
      ? { available: true }
      : { available: false, reason: "WebAssembly validation failed" };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function probeWorker(environment: CapabilityEnvironment): CapabilityCheck {
  return typeof environment.Worker === "function"
    ? { available: true }
    : { available: false, reason: "Worker constructor is unavailable" };
}

function probeAudioDecode(environment: CapabilityEnvironment): CapabilityCheck {
  return typeof environment.AudioContext === "function" ||
    typeof environment.OfflineAudioContext === "function"
    ? { available: true }
    : { available: false, reason: "AudioContext/OfflineAudioContext is unavailable" };
}

async function probeWebGpu(environment: CapabilityEnvironment): Promise<CapabilityCheck> {
  const gpu = environment.navigator?.gpu;
  if (!gpu || typeof gpu.requestAdapter !== "function") {
    return { available: false, reason: "navigator.gpu.requestAdapter is unavailable" };
  }
  try {
    const adapter = await gpu.requestAdapter();
    return adapter
      ? { available: true }
      : { available: false, reason: "WebGPU adapter request returned null" };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Probe without creating a worker, AudioContext, or model session. */
export async function probeBeatThisCapabilities(
  environment: CapabilityEnvironment = globalThis,
): Promise<BeatThisCapabilities> {
  const [webGpu] = await Promise.all([probeWebGpu(environment)]);
  return {
    webAssembly: probeWasm(environment),
    webGpu,
    worker: probeWorker(environment),
    audioDecode: probeAudioDecode(environment),
  };
}

export function hasCoreBeatThisCapabilities(capabilities: BeatThisCapabilities): boolean {
  return capabilities.webAssembly.available && capabilities.worker.available;
}

