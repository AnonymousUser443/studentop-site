/*! Folia contributors — AGPL-3.0-only. Adapted for Tingchao; see vendor/folia/NOTICE.md. */
import type { BeatFxEvent } from './clock';
// Optional model-based effects remain explicitly disabled. Lyric-driven motion stays active.
export const isBeatFxReady = () => false;
export const isBeatFxHearing = () => false;
export const getBeatFxRotationSign = () => 1;
export const getBeatFxLastBeat = (): BeatFxEvent | null => null;
export const getBeatFxLastDownbeat = (): BeatFxEvent | null => null;
