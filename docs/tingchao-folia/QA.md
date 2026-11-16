# 听潮 Folia 迁移与验收

2026-11-16，北京时间。本地分支 `codex/music-folia-lyrics`，基线 `0bdee8d`。
本记录对应当前工作区改动；未提交、推送或执行树莓派发布。既有校园网络及文化站点等待处理改动保留。

## 交付

- 仓库有权授权的原创源码改为 AGPL-3.0-only；第三方许可保持各自范围。完整条款、范围分别在根 `LICENSE` 与 `LICENSE-SCOPE.md`。仓库可见性未变更。
- 听潮沉浸歌词右上角新增“随行／演出”，默认随行，模式偏好在本浏览器保存。
- 演出使用 Folia Sonnet 的原始时间轴编译、排版和 Pixi 渲染核心。固定上游提交 `1f73b512e27ea640a045451c8af7ef2082264788`；72 个来源模块与 4 个适配边界的原始／移植 SHA-256 保存在 `UPSTREAM.json`，校验 76 项均匹配。
- `src/lyrics/foliaAdapter.ts` 是毫秒领域数据到秒制渲染数据的唯一转换边界；没有接入 Folia 账号、音频引擎、后端、主题库或模型推理。
- 沿用 CSS 主题色与原创昼夜海景。动态歌词使用已有完整中文 Tingchao UI 字库，曲名保留 Jade Serif；避免同句字体回退混排。关闭红青副本、残影、强色散与额外主题图标，降低辉光和镜头幅度，加入桌面文字安全区。
- 主站继续按需挂载 React 原生窗口；首页、随行歌词不加载 Sonnet/Pixi。演出也不创建音频元素。
- 画布隐藏时取消视觉时钟并销毁 GPU 资源；暂停时停止连续绘制。初始化失败、上下文丢失、小窗口、减少动态效果均回退到原歌词。
- 锁定 `pixi.js@8.21.0`、`@chenglou/pretext@0.0.9`。Motion 复用宿主依赖。许可正文随 native entry 保存；当前未版本化音乐目录清理过时构建块，已有版本化 release 不受此操作影响。

## 实际检查

| 检查 | 结果 |
| --- | --- |
| `npm --prefix apps/aidenos-music run build` | TypeScript 与 Vite 通过 |
| `npm --prefix apps/aidenos-music test` | 41 项通过，包含新增 Adapter／时钟测试 |
| `node --test qa/music-proxy-tests.mjs qa/music-release-tests.mjs` | 28 项通过 |
| `node --test qa/music-workspace-tests.mjs` | 5 项通过，启动器、监听构建及自有服务清理正常 |
| `node tools/build-music.mjs --stage-only` | 编译模块压缩、完整许可保留、过期块清理通过 |
| `node tools/build-site.mjs` / `--check dist-site` | 通过；最终本地版本 `032b43de72b5729e41977ebe` |
| `git diff --check` | 通过 |
| OpenCLI 浏览器 | 19 项通过，记录位于 `qa/tingchao-folia/checks-*.json` |

浏览器仅操作临时合成门禁、音乐账号、歌曲与低音量本地 WAV，没有登录或编辑真实音乐账号，也没有连接生产服务。

19 项浏览器断言覆盖：首开懒加载、默认随行、真实 Sonnet 画布、单音频及无 iframe；昼夜配色、偏好恢复、暂停点击字幕定位；快速连切两首、最小化释放画布、关窗续播、锁屏切歌、解锁保留暂停及未处理错误检查；390px 窄窗口、减少动态效果、上下文丢失和禁止 WebGL 初始化；实际 GPU 绘制及暂停后的零连续绘制。

两轮实际画面审查覆盖 1366×768、1920×1080 与 390×844 截图。第一轮发现辉光偏强、动态字库混排及文字出界；第二轮收敛光效、统一动态字库，并调整舞台安全区。`night-before-tuning.png` 保留第一轮画面，其余昼夜与窄窗图为后续结果。

## 性能实测与范围

本机 Chrome，浏览器视口 1258×727、画布 CSS 1214×365，drawing buffer 1518×456。排除初始 3 帧后的 117 个浏览器 RAF 样本：中位数 **16.7ms**，P95 **16.8ms**；同期捕获 1354 次本画布 WebGL 绘制调用。数据见 `qa/tingchao-folia/performance.json`。

该测量反映当前机器的浏览器帧调度，不代表所有设备上的通用帧率承诺。渲染 ticker 上限为 60 FPS；暂停稳定后连续 500ms 的新增 GPU draw call 为零。小画布主动使用随行，模型节拍分析保持关闭。

`npm audit` 没有报告新增 Pixi／Pretext 链的告警；仍报告既有固定网易云 SDK 的 `pac-proxy-agent → get-uri → basic-ftp` 链 4 项 high，本轮没有扩大为 SDK 升级。

## 本地复现

```powershell
npm --prefix apps/aidenos-music ci
node tools/dev-workspace.mjs --site-only --music
```

在 AidenOS 打开听潮、播放歌曲、展开沉浸歌词，点击“演出”。若需要隔离浏览器验证，用 `qa/tingchao/fixture.mjs` 启动合成桌面，再使用 OpenCLI 驱动 `qa/tingchao-folia/browser-checks.mjs` 的 `bootstrap`、`visual`、`lifecycle`、`fallback`、`performance` 阶段；向 bootstrap 传入该 fixture 返回的回环 origin。

私人运行不会自动公开仓库。若未来分发或向其他人提供修改版网络服务，应按适用 AGPL 条款提供对应源码；仅保留署名与许可正文不能替代源码提供。当前没有执行这次迁移的生产发布。
