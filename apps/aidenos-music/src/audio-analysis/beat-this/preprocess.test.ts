import {
  BEAT_THIS_N_MELS,
  BEAT_THIS_SAMPLE_RATE,
  computeBeatThisLogMel,
  resampleMonoPcm,
} from "./preprocess";
import { describe, expect, it } from "vitest";

describe("Beat This! browser preprocessing", () => {
  it("resamples mono PCM without changing the source when rates match", () => {
    const input = new Float32Array([0, 0.5, -0.25, 1]);
    expect(resampleMonoPcm(input, 22_050, 22_050)).toEqual(input);
  });

  it("produces finite time x 128 log-mel frames", () => {
    const pcm = new Float32Array(BEAT_THIS_SAMPLE_RATE / 2);
    for (let index = 0; index < pcm.length; index += 1)
      pcm[index] = Math.sin((2 * Math.PI * 440 * index) / BEAT_THIS_SAMPLE_RATE);
    const spectrogram = computeBeatThisLogMel(pcm);
    expect(spectrogram.mels).toBe(BEAT_THIS_N_MELS);
    expect(spectrogram.frames).toBeGreaterThan(0);
    expect(spectrogram.data.length).toBe(spectrogram.frames * BEAT_THIS_N_MELS);
    expect([...spectrogram.data].every(Number.isFinite)).toBe(true);
  });
});
