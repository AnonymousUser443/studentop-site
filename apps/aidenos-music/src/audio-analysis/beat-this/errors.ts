import type { BeatThisErrorCode, BeatThisErrorData } from "./types";

export class BeatThisError extends Error {
  readonly code: BeatThisErrorCode;
  readonly details?: string;

  constructor(code: BeatThisErrorCode, message: string, details?: string) {
    super(message);
    this.name = "BeatThisError";
    this.code = code;
    this.details = details;
  }

  toData(): BeatThisErrorData {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  static from(value: unknown, fallback: BeatThisErrorCode = "inference_failed"):
    BeatThisError {
    if (value instanceof BeatThisError) return value;
    const message = value instanceof Error ? value.message : String(value);
    return new BeatThisError(fallback, message);
  }
}

export function classifyWorkerError(value: unknown): BeatThisError {
  if (value instanceof BeatThisError) return value;
  const message = value instanceof Error ? value.message : String(value);
  const normalized = message.toLowerCase();
  if (/out of memory|allocat|memory limit|memory access|array buffer.*large/.test(normalized)) {
    return new BeatThisError("out_of_memory", message);
  }
  if (/timeout|timed out/.test(normalized)) {
    return new BeatThisError("timeout", message);
  }
  if (/cancel/.test(normalized)) {
    return new BeatThisError("cancelled", message);
  }
  if (/fetch|network|load|404|not found/.test(normalized)) {
    return new BeatThisError("model_unavailable", message);
  }
  return new BeatThisError("inference_failed", message);
}

