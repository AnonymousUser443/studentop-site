import { BeatThisError } from "./errors";
import { assertValidPcmInput } from "./pure";
import type {
  BeatThisEncodedAudioInput,
  BeatThisPcmInput,
} from "./types";

export interface AudioDecodeEnvironment {
  AudioContext?: new () => {
    decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
    close?: () => Promise<void>;
  };
  webkitAudioContext?: new () => {
    decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
    close?: () => Promise<void>;
  };
}

export function audioBufferToMonoPcm(buffer: AudioBuffer): BeatThisPcmInput {
  if (!buffer || !Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0 || buffer.length <= 0) {
    throw new BeatThisError("invalid_input", "Decoded AudioBuffer is empty or has an invalid sample rate");
  }
  const channels = buffer.numberOfChannels;
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new BeatThisError("invalid_input", "Decoded AudioBuffer has no channels");
  }
  const pcm = new Float32Array(buffer.length);
  for (let channel = 0; channel < channels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) pcm[index] += samples[index] / channels;
  }
  const input: BeatThisPcmInput = {
    kind: "pcm",
    sampleRate: buffer.sampleRate,
    channels: 1,
    pcm,
    sourceDurationSeconds: buffer.duration,
  };
  assertValidPcmInput(input);
  return input;
}

export async function decodeEncodedAudio(
  input: BeatThisEncodedAudioInput,
  environment: AudioDecodeEnvironment = globalThis,
): Promise<BeatThisPcmInput> {
  if (!(input.data instanceof ArrayBuffer) || input.data.byteLength === 0) {
    throw new BeatThisError("invalid_input", "Encoded audio must contain a non-empty ArrayBuffer");
  }
  const Context = environment.AudioContext ?? environment.webkitAudioContext;
  if (!Context) {
    throw new BeatThisError("unsupported", "Audio decoding is unavailable in this browser");
  }
  const context = new Context();
  try {
    // decodeAudioData may detach or consume its argument in some browsers.
    const decoded = await context.decodeAudioData(input.data.slice(0));
    return audioBufferToMonoPcm(decoded);
  } catch (error) {
    if (error instanceof BeatThisError) throw error;
    throw new BeatThisError(
      "invalid_input",
      "The browser could not decode the supplied audio",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    if (context.close) {
      try {
        await context.close();
      } catch {
        // Closing a decoder is best effort; the decode result/error is already settled.
      }
    }
  }
}

