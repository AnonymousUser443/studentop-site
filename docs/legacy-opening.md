# 原神启动 · 独立原版入口（本地恢复）

## 范围与状态

本入口保留旧项目的原版天空、白云、柱路、相机推进、门模型、Toon 材质与 Bloom 开门效果；没有用当前程序化校园替代原版。原版与「理韵 · 纸境入场」同时保留：

| 用途 | 桌面 id | 本地入口 | 产物 |
| --- | --- | --- | --- |
| 原创北理校园 | `genshin-start` | `http://127.0.0.1:8081/` | `dist` |
| 原版学习演示 | `genshin-original` | `http://127.0.0.1:8081/legacy.html` | `dist-legacy` |

原版生产路径暂定为同一原开场域的 `/legacy.html`，**尚未部署**。本任务不连接生产、不安装依赖、不启动服务、不部署。真实 WebGL 与自然开门流程已由 Lead 冷缓存浏览器验收通过；两套构建由 Lead 独占执行并最终核对，未部署。

## 实现边界

- [独立页面](<../apps/genshin-start/legacy.html>) 与 [页面控制](<../apps/genshin-start/src/legacy/main.ts>) 保留原 Logo、开始图标、点击进入图像及年龄提示；加载、返回和跳过按钮始终可用。原生竖屏可操作，不再把整个页面强行旋转。
- [原版运行适配器](<../apps/genshin-start/src/legacy/runtime.ts>) 组合现存旧组件，保留原来的镜头、道路与门流程；不导入旧 Game 的顶层音频预载、横屏原型替换或吞错进度逻辑。13 个 GLB 完整载入后才显示开始入口。旧共享组件、旧 minified bundle 与原资源不改写、不删除。
- 复用现有安全出口模块与 `GameManager.restart()`：DEV 和回环测试默认进入 `http://127.0.0.1:5174/`；生产公网默认保持既有理韵 URL。预注入覆盖只接受绝对 http(s)、无凭据；本地页面不允许覆盖成非回环目的地。`?skip=1`、`?skip`、`#skip` 保留，`?skip=0`不跳过。
- 返回主页在本地为 `http://127.0.0.1:8899/`，生产为原个人主页地址；不是未经校验的 referrer/history 导航。
- 声音默认关闭。主动点击声音开关后才加载/播放本地 BGM 和音效；不自动播放，不加载 B 站介绍、统计脚本或联网探测。
- `loading → welcome → journey → door → entering` 沿原模型自然行进。错误进入 `fallback`：初始化失败、资源失败、45秒加载超时或上下文丢失均有可读提示、返回/跳过、重新载入；不把失败资源计为完成、不用假 phase 冒充开门。
- 单一受控渲染循环（桌面 60fps / 粗指针 30fps），DPR 上限 1.5 / 1；后台停止帧，用户可暂停。DOM 与 WebGL 事件、模型材质纹理及 renderer 在清理时释放，不强制制造 contextlost。老组件会缓存可变模型，开发 HMR 采用该原版页面完整重载，而非危险的半热挂载；校园页面逻辑不变。

## 同源 Draco 与构建隔离

全部 13 个旧 GLB 使用 Draco 压缩。现存 xviewer 指向外部解码器，已用 [专用插件](<../apps/genshin-start/scripts/legacy-assets.mjs>) 对**服务/构建中的代码**作一次精确 URL 替换为 `/_legacy-draco/`；共享 minified 文件本身不修改。解码器取自已安装的 Three.js glTF 目录，不下载、不安装新依赖。

校园 Vite 仅注册 `apply:serve` 的 legacy 支持插件：只 transform 旧 xviewer 路径、只接管 `/_legacy-draco/` 明确白名单请求。其常规生产构建仍 `copyPublicDir:false`，没有把 legacy.html 追加到校园 Rollup input，也不复制原版资源进校园 dist。

独立 [legacy Vite 配置](<../apps/genshin-start/vite.legacy.config.ts>) 仅构建 legacy.html，输出 dist-legacy，同样禁用默认整 public 复制。精确携带 31 个 Genshin 文件、3 个离线 decoder、原 favicon 与说明/许可证，并生成资源 SHA-256 清单；缺少任何必需资产即失败。

```powershell
# 仅检查本地资产和授权状态，不构建、不写产物
node scripts/build-legacy.mjs --check

# 在 Lead 互斥构建窗口内运行；只生成 dist-legacy
node scripts/build-legacy.mjs

# 离线边界测试，不启动 HTTP 服务
node scripts/legacy-boundaries.test.mjs
```

命令工作目录为应用根目录。旧硬编码启动脚本不执行；独立构建脚本只清理由专用 Vite 配置指定的 dist-legacy，不触碰校园 dist。常规 package 依赖与构建脚本保持不变。

## 素材与许可审计

实际只读 preflight：31 个 Genshin 文件共 **7,886,601 bytes**；现存 xviewer bundle **1,205,574 bytes**，不是估算。

**公开再分发阻断尚未解除。** 旧 bundle 首行要求伴随 xviewer.module.min.js.LICENSE.txt，但文件缺失。原仓库 MIT 不等于已授权第三方游戏模型、图片、音频或商标，不能宣称所有原版素材许可齐全。保留本地学习体验，不据此部署。

[权利状态说明](<../apps/genshin-start/src/legacy/NOTICE.txt>) 随独立产物复制。离线 Draco 的现有 README 声明 Apache-2.0，已附该 README 与从已安装包取得的标准 Apache-2.0 条款文本，并附 Three MIT、原仓库 MIT；没有伪造缺失的 xviewer 原始许可证。公开发布前仍需补齐并核对全部第三方 notices。

## 验收记录与稳定接口

已实际执行且退出码 0：完整应用 `tsc --noEmit`、校园配置与 legacy 配置分别类型检查、三个桌面 JS 语法检查、资产只读 preflight、离线 decoder transform/白名单/MIME/路径/方法测试。这些静态检查不替代浏览器或产物验收。

Lead 的 [真实原版浏览器报告](<../qa/revision-20261028/legacy-browser.json>) 已实际读取：`ok:true`，**15 项检查全部通过**。方法为隔离 Edge/CDP 冷 profile、禁止外部网络、使用真实原版资源与自然行进，没有注入期望出口或 fakePhase。包括：13 GLB 完整加载、同源 Draco wrapper/WASM、无运行时外联、无自动 MP3/声音需主动开启、暂停、自然到门、开门后实际落地本地 5174、流程无非预期错误、手机不强制旋转、contextlost/no-WebGL 可用降级、降级入口与 skip 的真实本地导航。

campus 实际 read_image 核对了四张证据：
- [原版欢迎场景](<../qa/revision-20261028/original-welcome.png>)：蓝天白云、前中后柱路及原启动图标正常；不与校园场景叠加。
- [自然抵达天空之门](<../qa/revision-20261028/original-door.png>)：门模型真实出现，保留点击进入状态。
- [手机原生竖屏](<../qa/revision-20261028/original-mobile.png>)：390×844 未旋转，开始/返回/跳过可见。
- [上下文丢失静态入口](<../qa/revision-20261028/original-context-fallback.png>)：明确故障提示，重新载入、返回与跳过仍可用。

首轮浏览器曾因旧 Vite 实例缓存未载入新 mjs 插件而 decoder 404/超时。Lead 重启自有统一 runner 后直测同源 WASM 200、served bundle 已去除 gstatic，随后完整冷缓存验收通过；没有通过修改场景或隐藏错误绕过这次环境失败。独立与校园 build 的最终产物结果仍以 Lead 的互斥构建报告为准，不在此提前宣称完成。

DEV + 回环 + `?qa=1` 时提供 `window.__LEGACY_QA__`：`phase`、`snapshot()`、`start()`、`enter()`、`loseContext()`；没有 fakePhase、伪造资源或覆盖出口功能，生产不挂该全局。稳定选择器：`#legacy-shell[data-phase]`、`#legacy-start`、`#legacy-enter`、`#legacy-skip`。

浏览器验收建议：
1. 同源 decoder 的 JS/WASM 返回 200，模型完整加载；请求只到本地源，不依赖 gstatic。
2. welcome 保留原版天空和柱路；点击开始后自然到 door，点击进入触发原门动画/Bloom 并真实落地本地 5174。
3. 声音关闭时无自动音频播放；主动开启/关闭能真实控制音轨。
4. no-WebGL、单模型失败及 contextlost 不空白；返回、skip、noscript 均可走。
5. 桌面双击 `genshin-original` 打开独立原版，双击 `genshin-start` 仍为校园；两入口不互相替换。
6. 独立 build 产物资源完整且未改写校园 dist；最终部署不在本次范围内。
