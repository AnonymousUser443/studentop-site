/*! Folia contributors — AGPL-3.0-only. Adapted for Tingchao; see vendor/folia/NOTICE.md. */
// Compatibility type only; model-based beat analysis is not part of this port.
export interface BeatFxEvent { t: number; barPos?: number; tone?: {low:number;mid:number;high:number}; }
