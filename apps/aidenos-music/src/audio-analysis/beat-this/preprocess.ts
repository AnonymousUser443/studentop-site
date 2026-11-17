import { BeatThisError } from "./errors";

export const BEAT_THIS_SAMPLE_RATE = 22_050;
export const BEAT_THIS_N_FFT = 1_024;
export const BEAT_THIS_HOP_LENGTH = 441;
export const BEAT_THIS_N_MELS = 128;

export interface LogMelSpectrogram {
  readonly data: Float32Array;
  readonly frames: number;
  readonly mels: number;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Linear resampling is sufficient for the experimental browser path. */
export function resampleMonoPcm(
  pcm: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0)
    throw new BeatThisError("invalid_input", "PCM sampleRate must be positive");
  if (!Number.isFinite(outputSampleRate) || outputSampleRate <= 0)
    throw new BeatThisError("invalid_input", "Target sampleRate must be positive");
  if (inputSampleRate === outputSampleRate) return new Float32Array(pcm);
  const length = Math.max(1, Math.round((pcm.length * outputSampleRate) / inputSampleRate));
  const result = new Float32Array(length);
  const ratio = inputSampleRate / outputSampleRate;
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(pcm.length - 1, left + 1);
    const amount = position - left;
    result[index] = finite(
      pcm[Math.min(pcm.length - 1, left)] * (1 - amount) + pcm[right] * amount,
    );
  }
  return result;
}

function reflectIndex(index: number, length: number): number {
  if (length <= 1) return 0;
  let value = index;
  while (value < 0 || value >= length) {
    if (value < 0) value = -value;
    else value = 2 * length - value - 2;
  }
  return value;
}

function hzToMel(value: number): number {
  return 2_595 * Math.log10(1 + value / 700);
}

function melToHz(value: number): number {
  return 700 * (10 ** (value / 2_595) - 1);
}

function buildMelFilters(sampleRate: number): Float32Array[] {
  const filters: Float32Array[] = [];
  const minMel = hzToMel(30);
  const maxMel = hzToMel(Math.min(11_000, sampleRate / 2));
  const points = new Float32Array(BEAT_THIS_N_MELS + 2);
  for (let index = 0; index < points.length; index += 1)
    points[index] = melToHz(minMel + ((maxMel - minMel) * index) / (points.length - 1));
  for (let mel = 0; mel < BEAT_THIS_N_MELS; mel += 1) {
    const left = points[mel];
    const center = points[mel + 1];
    const right = points[mel + 2];
    const filter = new Float32Array(BEAT_THIS_N_FFT / 2 + 1);
    const area = Math.max(1e-6, right - left);
    for (let bin = 0; bin < filter.length; bin += 1) {
      const frequency = (bin * sampleRate) / BEAT_THIS_N_FFT;
      const rising = center > left ? (frequency - left) / (center - left) : 0;
      const falling = right > center ? (right - frequency) / (right - center) : 0;
      filter[bin] = Math.max(0, Math.min(1, rising, falling)) * (2 / area);
    }
    filters.push(filter);
  }
  return filters;
}

function fftMagnitude(frame: Float32Array): Float32Array {
  const size = frame.length;
  const real = new Float32Array(frame);
  const imaginary = new Float32Array(size);
  for (let source = 1, target = 0; source < size; source += 1) {
    let bit = size >> 1;
    for (; target & bit; bit >>= 1) target ^= bit;
    target ^= bit;
    if (source < target) {
      const value = real[source];
      real[source] = real[target];
      real[target] = value;
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let currentCosine = 1;
      let currentSine = 0;
      const half = length >> 1;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const oddReal = real[odd] * currentCosine - imaginary[odd] * currentSine;
        const oddImaginary = real[odd] * currentSine + imaginary[odd] * currentCosine;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextCosine = currentCosine * cosine - currentSine * sine;
        currentSine = currentSine * cosine + currentCosine * sine;
        currentCosine = nextCosine;
      }
    }
  }
  const result = new Float32Array(size / 2 + 1);
  const scale = 1 / Math.sqrt(BEAT_THIS_N_FFT);
  for (let index = 0; index < result.length; index += 1)
    result[index] = Math.hypot(real[index], imaginary[index]) * scale;
  return result;
}

/**
 * Browser implementation of Beat This!' torchaudio log-mel frontend.
 * Frames are returned row-major as time x 128 mel bins.
 */
export function computeBeatThisLogMel(
  pcm: Float32Array,
  sampleRate = BEAT_THIS_SAMPLE_RATE,
): LogMelSpectrogram {
  if (!(pcm instanceof Float32Array) || pcm.length === 0)
    throw new BeatThisError("invalid_input", "PCM data must be non-empty");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new BeatThisError("invalid_input", "PCM sampleRate must be positive");
  const frames = Math.max(1, Math.ceil(pcm.length / BEAT_THIS_HOP_LENGTH));
  const filters = buildMelFilters(sampleRate);
  const output = new Float32Array(frames * BEAT_THIS_N_MELS);
  const window = new Float32Array(BEAT_THIS_N_FFT);
  for (let index = 0; index < window.length; index += 1)
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / BEAT_THIS_N_FFT);
  const frame = new Float32Array(BEAT_THIS_N_FFT);
  for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    const center = frameIndex * BEAT_THIS_HOP_LENGTH;
    for (let index = 0; index < frame.length; index += 1)
      frame[index] = pcm[reflectIndex(center + index - BEAT_THIS_N_FFT / 2, pcm.length)] * window[index];
    const magnitudes = fftMagnitude(frame);
    for (let mel = 0; mel < filters.length; mel += 1) {
      const filter = filters[mel];
      let energy = 0;
      for (let bin = 0; bin < magnitudes.length; bin += 1)
        energy += magnitudes[bin] * filter[bin];
      output[frameIndex * BEAT_THIS_N_MELS + mel] = Math.log1p(1_000 * Math.max(0, energy));
    }
  }
  return { data: output, frames, mels: BEAT_THIS_N_MELS };
}
