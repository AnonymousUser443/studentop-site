# Beat This! small0 线上实验

听潮现在把官方 Beat This! `small0` 模型作为一个手动开启的浏览器功能发布。模型和 ONNX Runtime Web 都从同源静态资源加载，推理在 Worker 中执行，默认关闭，不会参与普通播放初始化。

## 线上资源

- 模型：`site/assets/media/beat-this/small0.onnx`
- Runtime：ONNX Runtime Web 1.31.1 的 WASM 模块
- 运行时资源：`ort.min.mjs`、`ort-wasm-simd-threaded.mjs` 和对应 WASM 文件
- 模型输入：`[1, 1500, 128]`，每帧 20 ms，22,050 Hz
- 模型输出：`[1, 1500, 2]`，依次为 beat 和 downbeat logits

## 浏览器处理链路

1. 用户在“听潮实验开关”中打开 small0。
2. 当前歌曲的已签名音频地址通过匿名 CORS 下载。下载失败、响应异常或资源过大时，自动停止本次实验，不影响播放器。
3. 浏览器使用 `AudioContext.decodeAudioData()` 解码为单声道 PCM。
4. Worker 内进行线性重采样、1,024 点 FFT、441 样本 hop、128 维 Slaney mel 滤波和 `log1p(1000 * mel)`，生成 Beat This! 所需的 log-mel 频谱。
5. 频谱按 1,500 帧分块，补零后送入 ONNX Runtime Web WASM。每个分块的有效帧会被截回，结果合并后转换为节拍和强拍时间点。
6. 当前歌曲的结果缓存在本浏览器会话中，关闭开关会取消未完成的下载和推理。

small0 不接管 `<audio>` 元素，也不调用 `createMediaElementSource()`。它读取歌曲副本执行离线分析，因此和实时频谱开关互相独立。

## 模型来源和许可

模型来自 [CPJKU/beat_this](https://github.com/CPJKU/beat_this) 官方 `small0` checkpoint，转换脚本使用官方模型定义加载权重后导出固定形状 ONNX。模型与官方代码按 MIT License 记录在 `apps/aidenos-music/licenses/beat-this-MIT.txt`。ONNX Runtime Web 使用 MIT License，记录在 `apps/aidenos-music/licenses/onnxruntime-web-MIT.txt`。

## 验收

- `npm test` 覆盖 log-mel 预处理、Worker 契约、适配器错误回退和音频分析，总计 76 个测试。
- `npm run build` 会生成 Worker 分片，并将模型资源交给站点发布器进行扩展名和校验和检查。
- 线上只在用户手动开启后下载音频和 WASM 运行时。默认打开听潮不会加载 small0。
