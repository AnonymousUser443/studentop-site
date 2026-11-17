import { describe, expect, it } from "vitest";
import { BeatThisAdapter } from "./adapter";
import type { BeatThisCapabilities, BeatThisModelAsset } from "./types";

const capabilities: BeatThisCapabilities = {
  webAssembly: { available: true },
  webGpu: { available: false, reason: "test" },
  worker: { available: true },
  audioDecode: { available: false, reason: "test" },
};

const model: BeatThisModelAsset = {
  format: "onnx",
  modelUrl: "/model.onnx",
  runtimeUrl: "/ort.js",
  input: { kind: "mono-pcm", name: "audio", layout: "batch-time", shape: [1, -1], sampleRate: 22_050 },
  output: {
    name: "events", layout: "batch-frame-task", beatIndex: 0, downbeatIndex: 1,
    activation: "probability", threshold: 0.5, frameHopSeconds: 0.02,
  },
};

describe("Beat This! adapter fallback", () => {
  it("stays disabled when no model or runtime URL is injected", async () => {
    const adapter = new BeatThisAdapter();
    expect(adapter.getStatus().state).toBe("disabled");
    await expect(adapter.analyze({
      kind: "pcm", sampleRate: 22_050, channels: 1, pcm: new Float32Array([0]),
    })).rejects.toMatchObject({ code: "disabled" });
  });

  it("reports unsupported core primitives without creating a worker", async () => {
    let created = false;
    const adapter = new BeatThisAdapter({
      model,
      capabilities: {
        ...capabilities,
        webAssembly: { available: false, reason: "test" },
      },
      workerFactory: () => {
        created = true;
        throw new Error("should not be called");
      },
    });
    await expect(adapter.analyze({
      kind: "pcm", sampleRate: 22_050, channels: 1, pcm: new Float32Array([0]),
    })).rejects.toMatchObject({ code: "unsupported" });
    expect(created).toBe(false);
  });
});

