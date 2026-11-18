import { describe, expect, it } from "vitest";
import { BeatThisError } from "./errors";
import {
  activationsToBeatPoints,
  assertValidPcmInput,
  extractBeatActivations,
  validateModelDescriptor,
} from "./pure";
import type { BeatThisModelAsset } from "./types";

const output = {
  name: "events",
  layout: "batch-frame-task" as const,
  beatIndex: 0,
  downbeatIndex: 1,
  activation: "probability" as const,
  frameHopSeconds: 0.5,
  threshold: 0.7,
};

const model: BeatThisModelAsset = {
  format: "onnx",
  modelUrl: "/models/beat-this.onnx",
  runtimeUrl: "/vendor/onnxruntime-web.js",
  input: { kind: "mono-pcm", name: "audio", layout: "batch-time", shape: [1, -1], sampleRate: 22_050 },
  output,
};

describe("Beat This! pure contract helpers", () => {
  it("requires an explicit model tensor contract", () => {
    expect(validateModelDescriptor(model)).toEqual([]);
    expect(validateModelDescriptor({
      ...model,
      input: { ...model.input, shape: [1, 0] },
    })).toContain("input.shape must be 2 dimensions with positive or -1 values");
  });

  it("decodes declared frame/task axes and returns only local maxima", () => {
    const activations = extractBeatActivations({
      dims: [1, 3, 2],
      data: new Float32Array([0.1, 0.8, 0.9, 0.2, 0.3, 0.95]),
    }, output);
    const points = activationsToBeatPoints(activations, output);
    expect(points.beats).toHaveLength(1);
    expect(points.beats[0].timeSeconds).toBe(0.5);
    expect(points.beats[0].confidence).toBeCloseTo(0.9, 5);
    expect(points.downbeats).toHaveLength(2);
    expect(points.downbeats.map((point) => point.timeSeconds)).toEqual([0, 1]);
    expect(points.downbeats[0].confidence).toBeCloseTo(0.8, 5);
    expect(points.downbeats[1].confidence).toBeCloseTo(0.95, 5);
  });

  it("supports explicit logit outputs without guessing the model format", () => {
    const logitOutput = { ...output, activation: "logit" as const, threshold: 0.7 };
    const points = activationsToBeatPoints({
      beats: [-2, 2, -2],
      downbeats: [-2, -2, -2],
    }, logitOutput);
    expect(points.beats[0].timeSeconds).toBe(0.5);
    expect(points.beats[0].confidence).toBeCloseTo(0.8808, 3);
    expect(points.downbeats).toEqual([]);
  });

  it("rejects wrong channels, sample rates, and non-finite PCM", () => {
    expect(() => assertValidPcmInput({
      kind: "pcm", sampleRate: 22_050, channels: 2 as 1, pcm: new Float32Array([0]),
    }, 22_050)).toThrow(BeatThisError);
    expect(() => assertValidPcmInput({
      kind: "pcm", sampleRate: 48_000, channels: 1, pcm: new Float32Array([0]),
    }, 22_050)).toThrow(/does not match/);
    expect(() => assertValidPcmInput({
      kind: "pcm", sampleRate: 22_050, channels: 1, pcm: new Float32Array([Number.NaN]),
    })).toThrow(/non-finite/);
  });
});

