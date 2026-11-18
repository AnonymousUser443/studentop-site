import { describe, expect, it } from "vitest";
import { hasCoreBeatThisCapabilities, probeBeatThisCapabilities } from "./capabilities";

describe("Beat This! capability probe", () => {
  it("probes WebAssembly, WebGPU, Worker, and audio decode independently", async () => {
    const result = await probeBeatThisCapabilities({
      WebAssembly: { validate: () => true },
      Worker: function FakeWorker() {},
      navigator: { gpu: { requestAdapter: async () => ({}) } },
      AudioContext: function FakeAudioContext() {},
    });
    expect(result.webAssembly.available).toBe(true);
    expect(result.webGpu.available).toBe(true);
    expect(result.worker.available).toBe(true);
    expect(result.audioDecode.available).toBe(true);
    expect(hasCoreBeatThisCapabilities(result)).toBe(true);
  });

  it("reports unsupported browser primitives instead of assuming them", async () => {
    const result = await probeBeatThisCapabilities({});
    expect(result.webAssembly.available).toBe(false);
    expect(result.webGpu.available).toBe(false);
    expect(result.worker.available).toBe(false);
    expect(result.audioDecode.available).toBe(false);
    expect(hasCoreBeatThisCapabilities(result)).toBe(false);
  });
});

