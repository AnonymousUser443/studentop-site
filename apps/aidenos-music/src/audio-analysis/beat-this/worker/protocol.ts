import type {
  BeatThisErrorData,
  BeatThisExecutionProvider,
  BeatThisModelAsset,
  BeatThisResult,
  SerializedBeatThisPcmInput,
} from "../types";

export type BeatThisWorkerRequest =
  | {
      type: "init";
      requestId: string;
      model: BeatThisModelAsset;
      provider: BeatThisExecutionProvider;
    }
  | {
      type: "analyze";
      requestId: string;
      audio: SerializedBeatThisPcmInput;
      timeoutMs: number;
    }
  | { type: "cancel"; requestId: string }
  | { type: "dispose"; requestId: string };

export type BeatThisWorkerResponse =
  | { type: "ready"; requestId: string; lazy: true }
  | { type: "progress"; requestId: string; phase: "runtime" | "model" | "inference" }
  | { type: "result"; requestId: string; result: BeatThisResult }
  | { type: "error"; requestId: string; error: BeatThisErrorData };

export interface BeatThisWorkerLike {
  onmessage: ((event: { data: BeatThisWorkerResponse }) => void) | null;
  onerror: ((event: { error?: unknown; message?: string }) => void) | null;
  postMessage(message: BeatThisWorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

