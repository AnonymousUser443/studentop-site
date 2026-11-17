# 听潮 Beat This! 浏览器实验

这是一份隔离实验：代码只位于 `apps/aidenos-music/src/audio-analysis/beat-this/`，没有接入 `runtime/index.ts`、`domain.ts`、UI 或部署配置。实验的目标是验证浏览器端懒加载 ONNX Runtime 与模型所需要的边界，不能把没有经过模型契约验证的输出当成节拍结果。

## 已核验的事实与当前结论

- Beat This! 官方仓库的 README 将实现描述为 Python/PyTorch 推理，发布的模型是 PyTorch Lightning checkpoints；README 同时说明模型从 spectrogram 产生逐帧 beat/downbeat logits，并在预处理阶段生成单声道 22 kHz 音频和 spectrogram。在本次核验的 README/模型定义范围内，没有可直接交给本实验的浏览器 ONNX 张量契约。参考：[官方仓库 README](https://github.com/CPJKU/beat_this/blob/main/README.md)、[官方模型定义](https://github.com/CPJKU/beat_this/blob/main/beat_this/model/beat_tracker.py)。
- 论文说明任务是估计 beat 与 downbeat 的时间位置，并以逐帧预测为基础；这不等于已经存在可在本项目中加载的 ONNX 文件或预处理实现。参考：[Beat This! 论文](https://arxiv.org/abs/2407.21658)。
- ONNX Runtime Web 官方文档要求 Web 应用使用 ONNX 模型；浏览器端可选择 WASM、WebGL、WebGPU 或 WebNN 执行提供程序，WASM 支持全部 ONNX operators，而 GPU 提供程序只有子集。参考：[ONNX Runtime Web 文档](https://onnxruntime.ai/docs/tutorials/web/)。
- 当前 `aidenos-music` 依赖中没有 `onnxruntime-web`，因此本实验没有盲目改 `package.json`，也没有假定官方 PyTorch checkpoint 可由浏览器直接读取。

因此，当前实验的默认状态是 **disabled/unsupported**：没有同时注入完整模型描述和浏览器兼容的 ONNX Runtime URL 时，不会创建推理结果。`BeatThisAdapter` 只有在调用 `analyze()` 时才创建 Worker；Worker 收到 `init` 时只校验描述，首次分析才动态加载 runtime 和模型。

## 输入契约

宿主必须传入 `BeatThisModelAsset`，不能只传一个模型 URL：

```ts
{
  format: "onnx",
  modelUrl: "/models/beat-this.onnx",
  runtimeUrl: "/vendor/onnxruntime-web.js",
  wasmBaseUrl: "/vendor/onnxruntime-wasm/", // 可选
  preferredExecutionProvider: "webgpu",      // 可选，不能用时回退 wasm
  input: {
    kind: "mono-pcm",
    name: "audio",
    layout: "batch-time" | "batch-channel-time",
    shape: [1, -1],
    sampleRate: 22050,
  },
  output: {
    name: "events",
    layout: "batch-frame-task" | "batch-task-frame",
    beatIndex: 0,
    downbeatIndex: 1,
    activation: "probability" | "logit",
    frameHopSeconds: 0.02,
    threshold: 0.5,
    minIntervalSeconds: 0.05,                 // 可选
  },
}
```

上面的数值只是契约形状示例，不是对官方 Beat This! 模型的猜测。实际模型若要求 spectrogram、不同轴顺序、多个输出或不同采样率，应先转换并验证后再注入；本实验会对未声明的 rank/轴/任务索引返回 `unsupported` 或 `inference_failed`，不会自动猜测。

音频输入有两种形式：

1. `pcm`：非空、有限的单声道 `Float32Array`，带精确 `sampleRate`；适配器复制后把 `ArrayBuffer` 转移给 Worker，调用方不应继续依赖原始缓冲区的所有权。
2. `encoded-audio`：拥有的编码音频 `ArrayBuffer`，可选 MIME 类型；适配器在主线程使用 `AudioContext.decodeAudioData()` 解码并混合为单声道 PCM。浏览器没有 AudioContext/OfflineAudioContext 时明确返回 `unsupported`。

不在契约中的内容（例如 URL 过期策略、隐式重采样、从文件名推断采样率）都不会由适配器补齐。

## 能力探测与回退

`probeBeatThisCapabilities()` 独立探测 WebAssembly、WebGPU adapter、Worker 构造器和 AudioContext。核心推理要求 Worker + WebAssembly；WebGPU 仅是可选 provider，WebGPU 不可用时使用 WASM。编码音频额外要求 audio decode。探测只看浏览器能力，不下载 runtime 或模型。

状态含义如下：

- `idle`：模型和 runtime URL 已注入，尚未创建 Worker。
- `ready`：Worker 已确认描述，模型仍然按需加载。
- `disabled`：缺少模型 URL、runtime URL 或描述不完整，功能关闭。
- `unsupported`：浏览器能力、Worker 初始化或运行时不满足要求。

所有回退都会带可读的 `reason` 和 `BeatThisError.code`。不会把原始音频能量、随机值或旧结果冒充 beat/downbeat。

## Worker 消息协议

`worker/protocol.ts` 定义了结构化 clone 消息：

- `init(requestId, model, provider)`：校验完整描述并返回 `{ type: "ready", lazy: true }`；不下载模型。
- `analyze(requestId, audio, timeoutMs)`：转移 PCM buffer，首次调用时动态 `import(runtimeUrl)`，再用 `modelUrl` 创建 ONNX session。
- `cancel(requestId)`：记录取消标记。ONNX Runtime 没有统一的中断接口，因此适配器会忽略迟到结果，必要时由宿主 `dispose()` 终止 Worker。
- `dispose(requestId)`：清理 session 引用并终止后续工作。
- Worker 只发送 `progress`、`result` 或带错误码的 `error`；`result` 明确包含 `beats`、`downbeats`、`durationSeconds` 和实际 provider。

Worker 和适配器均有超时处理。超时、取消、模型下载失败、runtime API 缺失、输出 rank/维度不符、内存分配失败会分别映射到 `timeout`、`cancelled`、`model_unavailable`、`runtime_unavailable`、`inference_failed` 或 `out_of_memory`；不会返回部分或伪造结果。

## 为什么暂不新增依赖

ONNX Runtime Web 是后续真正接入时的候选依赖，但当前仓库没有经过验证的 Beat This! ONNX 导出文件、输入预处理或输出张量名称。先使用 `runtimeUrl` 注入和 adapter 隔离可以审查加载/回退边界；只有在拿到可复现的 ONNX 导出、许可证、模型哈希、预处理和输出契约后，才应评估把 `onnxruntime-web` 加入 `package.json`。本实验不宣称已经在浏览器完成 Beat This! 推理。

## 验证

在 `apps/aidenos-music` 目录运行：

```sh
npm test -- src/audio-analysis/beat-this
npm run build
```

纯函数测试覆盖 tensor 轴解码、概率/logit 峰值转换、PCM 契约和能力探测；adapter 测试覆盖缺少模型/运行时及核心能力不足时的 disabled/unsupported 回退。测试没有使用伪造的 beat 结果作为运行时输出。

