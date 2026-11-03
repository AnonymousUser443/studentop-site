# 验收入口与分阶段证据

## 2026-11-03 当前实施

本轮开发与本地自动化验收已收口，范围以[README](../README.md)、[SCENE](SCENE.md)、[HUD交接](hud-handoff.md)、[TODO](../TODO.md)与[总证据](../../../qa/ui-implementation-20261103/README.md)为准。菜单已按最新要求改为左抽屉，右侧世界可见。下列证据各有范围，数量有重叠，不能简单相加为全站结论：

| 范围 | 已记录结果 | 证据 |
| --- | --- | --- |
| P0纯清场 | 24对同一App/相机/冻结帧恢复与移除旧死CSS，PNG字节完全一致；不是整版换肤零差异 | [结果](../../../qa/ui-implementation-20261103/pure-cleanup/results.json) |
| 菜单 / 设置 | 114 / 114；六档、八分类、44px、Tab、Select 首 Esc、确认取消与焦点、原入口归还、减少动态、全屏 Portal | [说明](../../../qa/ui-implementation-20261103/menu-settings/README.md)、[最终 JSON](../../../qa/ui-implementation-20261103/menu-settings/verified-focus-fullscreen-2/results.json) |
| HUD 正文懒载 | 45 / 45；图鉴 / 地标六档、testid、焦点循环 / 归还、inert 退场、快速开合、正文独立请求、入口表单 | [说明](../../../qa/ui-implementation-20261103/hud-panels/README.md)、[JSON](../../../qa/ui-implementation-20261103/hud-panels/results.json) |
| 主应用存档 / 会话 | 37 / 37；临时 SQLite / 合成账号、云读取失败门槛、串行重置、清本机、有效内存导出、隔离存储、演出接线 | [说明](../../../qa/ui-implementation-20261103/app-runtime/README.md)、[JSON](../../../qa/ui-implementation-20261103/app-runtime/results.json) |
| 团队标定 UI | 33通过；候选编辑、几何/来源约束、导入导出及隔离 | [作者指南](../src/calibration/AUTHORING.md)、[最终JSON](../src/calibration/qa/final/browser-results.json) |
| 世界 / Cinematic | 51通过；三档实际消费者、5.2/2.4/1s、队列、普通/系统减少动态与六档 | [说明](../../../qa/ui-implementation-20261103/world-cinematic/README.md)、[最终JSON](../../../qa/ui-implementation-20261103/world-cinematic/final/results.json) |
| 分区有限像素 | 修复后103通过；8区24内部点、13共享边、5外边、相邻解锁/重锁、实际pan/wheel对齐、SVG/ImageGen对照 | [范围](../../../qa/ui-implementation-20261103/world-cinematic/final/region-pixels/README.md) |
| 主题 / 对比度 | 旧11帧149文字/70边界，新53帧1380文字/84halo/645控件通过；源码hex51、所列帧computed纯色联合77 | [方法与阈值](../../../qa/ui-implementation-20261103/theme/README.md) |
| 控件反馈 / 安全区 | 20控件，42唯一断言通过；8组合26目标及8次按住最短边44px | [说明](../../../qa/ui-implementation-20261103/control-states/README.md) |
| 当前HUD与标签 | 六档定位卡展开/收拢13项通过，锚点及可见标签无交叠，隐藏标签≤2 | [JSON](../../../qa/ui-implementation-20261103/hud-layouts/results.json) |
| 生产纯键盘 / 音频 | 键盘17、音频19通过；含本地工具提示/隔离和44px链接，三曲解码、多音解锁和门控；GPS显式模拟 | [键盘](../../../qa/ui-implementation-20261103/keyboard-production/results.json)、[音频](../../../qa/ui-implementation-20261103/audio/results.json) |
| 自动降级 | 真实5s/30s低帧注入10通过，暂停/隐藏清零，关闭零采样，双降只播报一次，恢复原档 | [JSON](../../../qa/ui-implementation-20261103/auto-degrade/results.json) |
| 资产 / 字体 / 构建 | 9图637,808B；946字符0缺字；最终14门禁通过 | [ASSETS](ASSETS.md)、[checks](../../../qa/ui-implementation-20261103/checks.json) |

另有[按下态命中区 36 / 36 项](../../../qa/ui-implementation-20261103/menu-settings/press-hitareas/results.json)：六档中按住菜单关闭 / 竖栏、设置关闭 / 默认 / 返回与确认取消，按钮自身不缩小，实际 DOM rect 均不小于 44px。

最终单测19文件153项、服务端存储10项/HTTP9项通过。dist20,908,923B（19.9403028MiB），首屏静态JS图gzip214,068B；精确方法见[不变量](../../../qa/ui-implementation-20261103/invariants.json)。浏览器使用临时独立Edge，输入为CDP；模拟GPS不证明现场定位、物理触摸/罗盘或扬声器听音，对比度也仅证明报告所列帧和采样范围。用户已明确安排真机部分稍后由队员执行，[待填表](../../../qa/ui-implementation-20261103/FIELD-ACCEPTANCE.md)保持未执行。主应用HTTP503与缺图拦截均为精确记录的故障注入，不忽略其他错误。

演出正常 5.2 秒 / reduced 1 秒 / quick 2.4 秒是主视觉时间轴；结束后保留故事终态，等待手动继续，不按总页面停留时间误判动画。推荐边界 / 分区 / 打卡候选未现场确认，校准工具与 `--apply` 审查流程见[作者指南](../src/calibration/AUTHORING.md)。

默认开发 / 预览端口仍为回环 5174 / 4174，本轮独立集成 QA 可复用 5176。所有开发 `qa=1` 模式均隔离普通探索 / 会话键和真实账号；生产不提供 DEVQA。新 `getUi / getRegions / unlockRegion / previewCinematic` 见 [README](../README.md)与 [SCENE](SCENE.md)。

---

## 历史迁移记录入口

> **历史证据状态：迁移前旧应用 qa 目录未迁入。** 下方旧数字和描述只供追溯，不是 2026-11-03 的通过声明；不可复核的旧截图 / JSON 已明确标识。2026-11-02 的 HUD 记录另见 [HUD 动效验收](../../../qa/hud-motion-20261102/QA.md)和[后续审查](../../../qa/ui-refactor-audit-20261102/README.md)。

## 当前已记录的基线

负责人在[本轮 baseline.json](../../../qa/upgrade-20261027/baseline.json)记录：2026-10-27 21:16（Asia/Shanghai）理韵3个测试文件、13项通过、0失败；TypeScript/Vite构建成功，仍有原p5大包提示。这是本轮真实基线记录，不是下方缺失的旧报告，也不是完整浏览器验收。

## 当前复核方式

2026-10-29 活动长卷的当前实现、截图和局部回归见 [activity/QA.md](activity/QA.md)，实际检查见 [feature-20261029/checks.json](../../../qa/feature-20261029/checks.json)。该轮证据放在根 `qa/liyun-activity-20261029/`，不混入早期迁移验收目录；下方历史描述保留其原语境。

从仓库根执行：

~~~powershell
npm --prefix apps/liyun-explorer test
npm --prefix apps/liyun-explorer run build
node apps/liyun-explorer/scripts/asset-manifest.mjs --check
~~~

开发服务固定回环 5174；构建预览固定回环 4174。浏览器验收先按 OpenCLI 规范尝试，桥接不可用时记录原因并使用已授权的仓库独占临时浏览器路径。记录真实命令、断言、视口、输入方式与截图；2026-11-03 新证据放入本轮独立目录。普通存档验证须另用临时 profile，不能借开发 QA 模式触碰真实用户数据。

---

## 历史原文（未经本轮复验）

日期：2026-10-27，Asia/Shanghai。交付范围为本地前端首版：8 个地标、地图与探索反馈、存档、HUD、个人主页（含设置）、活动中心与简版图鉴。全部首版地标为 45%，3% / 37% 为固定验收预设。

历史运行地址为 localhost:4173 / localhost:5173；当时的服务会话和 qa/index.html 不属于当前环境。现用 5174 / 4174，启动命令见 [README](../README.md)。

## 结果与证据

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript 与生产构建 | 通过，生成 `dist/` | 构建日志（旧 qa/build.log，未迁入） |
| Vitest | 13 / 13，通过；0 失败 | JSON 报告（旧 qa/vitest.json，未迁入） |
| 浏览器菜单与基本交互 | 25 / 25，通过 | 基本检查（旧 qa/browser-functional.json，未迁入） |
| 完整内容、曲目、键盘和重置 | 12 / 12，通过 | 内容检查（旧 qa/browser-content.json，未迁入） |
| 鼠标从地标开始拖动 | 镜头移动，抬起没有误开详情 | 原生拖动（旧 qa/browser-native-drag.json，未迁入） |
| 实际点击「前往探索」 | 详情关闭，发现塔，进度 3% → 8% | 原生探索（旧 qa/browser-native-explore.json，未迁入） |
| 双指缩放与抬一指续拖 | 两场景通过：1.5 倍、UV 锚点误差 0、续拖 20/20 | 合成触摸事件（旧 qa/browser-gestures.json，未迁入） |
| 不冻结的探索动效 | 行进、雾散与光效自然完成 | 逐帧取样（旧 qa/browser-live-timeline.json，未迁入） |
| 行进中切换目标 | 旧镜头停止；从当前画面位置衔接；两次发现保留 | 中断检查（旧 qa/browser-interruption.json，未迁入） |
| 普通模式 BGM | 入场手势启动所选 Opus；收到真实 `playing` 事件 | 入场与存档（旧 qa/browser-normal-before-refresh.json，未迁入） |
| 刷新恢复 | 进度 8%、玩家位置与设置和保存值一致 | 恢复检查（旧 qa/browser-normal-restored.json，未迁入） |
| 桌面全屏 | 原生点击进入成功，退出成功 | 全屏检查（旧 qa/browser-fullscreen.json，未迁入） |
| 全屏不支持回退 | 给出提示，横屏地图仍可操作 | 内容检查（旧 qa/browser-content.json，未迁入） |
| 构建预览 | 图片、字体、2 个 Canvas 正常；不开放 QA API | 生产检查（旧 qa/browser-production.json，未迁入） |
| 控制台 | 验收页与构建页均 0 条捕获消息 | 开发记录（旧 qa/browser-console.json，未迁入）、构建记录（旧 qa/browser-production-console.json，未迁入） |

双指场景通过真实 React 事件路径派发合成 PointerEvents，分别验证分步操作与“最后一次双指移动 → 第二指抬起 → 剩余一指移动”在同一任务中的快速切换；它不是物理触屏实测。鼠标拖动、探索确认与桌面全屏使用 OpenCLI 原生输入。

普通存档测试使用独立的 `127.0.0.1:5173` 来源，固定预设不覆写 `localhost:5173` 的正常存档。发现事件仍处于活动状态时，保存值已包含完整发现结果；随后刷新恢复同一结果。音乐测试记录了实际播放与隐藏页面后的暂停。

## 静帧与响应式

构图按参考图安排左上书法标识、五个异形入口、顶部资源、右侧罗盘、左下工具和右下进度。中央使用已校准校园底图，保留建筑、道路和完整画布 UV；色块、云纹和前景按赛璐璐剪纸方向绘制。

以下五档横屏均检查了 15 个主要 HUD 按钮：目标至少 44×44 CSS 像素，未发现按钮越界或相互重叠。地图角落被前景遮挡的标签会隐藏，平移地图或从图鉴仍可进入相应地标。较小屏幕的信标标签按剩余空间向左排版。

| 尺寸 | 截图 |
| --- | --- |
| 1920×1080 | 初始迷雾（旧 qa/01-fog-1920x1080.png，未迁入） |
| 1366×768 | 常规笔记本（旧 qa/06-fog-1366x768.png，未迁入） |
| 2560×1080 | 宽屏（旧 qa/07-fog-2560x1080.png，未迁入） |
| 844×390 | 手机横屏（旧 qa/05-fog-844x390.png，未迁入） |
| 667×375 | 较小横屏（旧 qa/04-fog-667x375.png，未迁入） |
| 390×844 | 竖屏引导（旧 qa/08-portrait-390x844.png，未迁入） |

布局数据见 browser-layout.json（旧 qa/browser-layout.json，未迁入）。390×844 时显示横屏提示、HUD inert、地图禁用、效果停止持续绘制；返回原横屏后相机与进度恢复。该截图由桌面视口模拟生成，显示电脑窗口提示；触控设备使用手动旋转手机的文案。

手机设置面板支持独立滚动，底部全屏与重置操作可达。地图独占 `touch-action:none`，弹层的祖先均保留 `auto`。设置首屏（旧 qa/09-settings-844x390.png，未迁入）、滚动到底部（旧 qa/11-settings-controls-844x390.png，未迁入）、滚动数据（旧 qa/browser-settings-scroll.json，未迁入）。另存 图鉴（旧 qa/10-collection-1366x768.png，未迁入） 和 构建入场（旧 qa/12-production-entry-1920x1080.png，未迁入）。

## 动态与性能

固定种子 42；迷雾静帧固定在 8000ms，点亮静帧固定为发现事件后 1900ms。点亮中（旧 qa/02-discovering-1920x1080.png，未迁入） 与 已探索 37%（旧 qa/03-explored-1920x1080.png，未迁入） 可和初始画面重复比较。

未冻结的实际动画取样中，玩家在约 1.4 秒抵达目标；约 2.4 秒时目标点雾层 alpha 为 0；约 3.45 秒时事件已清除。切换远处目标的取样中，衔接前后指针差约 1.3 像素，旧镜头后续漂移为 0。

| 实测画布 | 浏览器 rAF | 迷雾 | 流光 | Canvas 像素密度 |
| --- | ---: | ---: | ---: | ---: |
| 1920×1080 | 60.2 FPS | 30.3 FPS | 60.2 FPS | 1.5 |
| 844×390 | 60.0 FPS | 29.8 FPS | 29.8 FPS | 1 |

数据来自可见桌面 Chromium，每档约 2.2 秒，直接读取 p5 实际帧数，不用配置值代替测量值。移动档是桌面浏览器上的相应画布尺寸，不能代表手机 GPU、温控或电池模式。原始性能数据（旧 qa/browser-performance.json，未迁入）。

## 本轮修复与范围

- 透明前景被 SVG 云边盖住，已调整为 z9，并移除重复的粗略松枝。
- 小横屏信标文字越界、前景与地标标签重叠，已处理标签方向和角落遮挡。
- 旋转期间旧镜头动画继续写入，以及竖屏键盘仍能触达 HUD，已处理取消、镜头快照和 inert。
- 快速抬起第二指时，React 连续事件提交可能晚一帧，已缓存最新请求相机。
- 连续探索时指针和镜头衔接出现跳跃，已使用已绘制的呈现快照，并同步地图与玩家变换。
- 地图禁用触摸动作曾影响设置滚动，已把手势抑制限制到地图本身。

未进行 iOS/Android 真机全屏、横屏锁定、物理双指和移动音频策略实测。源码保留失败回退，当前验收涵盖桌面原生全屏及桌面移动视口。构建有 p5 导致的单包体积提示（约 364KB gzip），构建成功；如需公网分发，可后续拆分与延迟加载特效包。

在线人数、活动日期和 `/36` 为 Mock（体力与章节仅保留面板说明）；任务、联机、GPS、相机与后端接入属于后续范围。素材来源与许可见 [ASSETS.md](ASSETS.md)，完整本地文件哈希见 [asset-manifest.json](asset-manifest.json)。
