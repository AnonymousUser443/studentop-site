import type { BeatThisModelAsset } from "./types";

/** The checked-in descriptor for the browser small0 release. */
export const BEAT_THIS_SMALL0_MODEL: BeatThisModelAsset = {
  format: "onnx",
  modelUrl: "/assets/media/beat-this/small0.onnx",
  runtimeUrl: "/assets/media/beat-this/ort.min.mjs",
  wasmBaseUrl: "/assets/media/beat-this/",
  preferredExecutionProvider: "wasm",
  input: {
    kind: "mono-pcm",
    name: "log_mel",
    layout: "batch-time-frequency",
    shape: [1, 1_500, 128],
    sampleRate: 22_050,
    preprocess: "beat-this-log-mel",
  },
  output: {
    name: "activations",
    layout: "batch-frame-task",
    beatIndex: 0,
    downbeatIndex: 1,
    activation: "logit",
    frameHopSeconds: 0.02,
    threshold: 0.35,
    minIntervalSeconds: 0.08,
  },
};
