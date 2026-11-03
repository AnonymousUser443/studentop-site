# HUD、菜单与设置交接

更新于 2026-11-03。当前实现依据[项目入口](../README.md)、[场景契约](SCENE.md)和 [TODO](../TODO.md)继续收口；[V2 方案](UI-REFACTOR-PLAN-V2.md)保留历史设计。用户追加要求已覆盖原“全屏菜单”方案：**菜单是左侧抽屉，右侧游戏世界可见；设置仍为独立全屏页。**

有效局部证据为[菜单设置 114 项](../../../qa/ui-implementation-20261103/menu-settings/README.md)与 [HUD 面板 45 项](../../../qa/ui-implementation-20261103/hud-panels/README.md)。主题、全站对比度、世界 / 演出、字体、最终构建和发布范围以 [QA 索引](QA.md)和[本轮总证据目录](../../../qa/ui-implementation-20261103/)继续收口，不能把旧数字当作本次总验收。

## 框架与入口

`HudFrame.tsx / hud-frame.css` 管理品牌、状态、操作坞、探索环四锚及定位 / 播报锚点。四边由 `--hud-gutter / --hud-top/right/bottom/left` 含安全区统一约束；内部 slot 负责入场，不让 Framer 改写外层锚点坐标。HUD 缩放读取 `--hud-scale`，小档仍须保持实际命中区。

`Hud.tsx` 保留框架、入场账户卡与通用 Modal。`hud/panels/CollectionPanel.tsx / LandmarkPanel.tsx` 通过 `React.lazy` 独立加载，正文样式随模块加载；等待时仍有外壳、关闭与可见提示。可选 `preloadHudPanels(): Promise<void>` 供父层闲时预取。旧 profile / Toggle 的重复设置和账户 UI 已移除，原 `onPanel('profile')` 路径由导航映射到菜单。全部原打卡 testid 保留。

品牌徽章和账户胶囊打开抽屉；品牌标题和探索环保留回中。左下活动 / 图鉴、右上收录入口保留原业务。`HudExtraProps` 的 `announcement / context / onOpenMenu` 不变。活动长卷仍由独立页面负责，不在 HUD 内重画。

## 抽屉与设置

菜单结构为窄竖栏、上方身份卡、下方密排宫格、独立滚动内容和底栏。桌面四列，小横屏三列；关闭 / 竖栏 / 宫格均有至少 44px 命中区。昵称、UID、游客、收录和探索度均来自当前会话 / 探索状态。未开放项显示“即将开放 / 敬请期待”，关于可进入真实内容。

设置八类为控制、按键、图像、声音、消息、账户、数据、其他。悬停为浅亮底，选中为菱形外描边、共享迁移高亮和一次性横向扫光；控件有 press、focus、busy / disabled。减少动态、减少闪光和低档装饰偏好统一收敛，背景模糊与阴影不再固定写死。

参考素材来自用户提供的派蒙菜单与设置局部视频，源视频未改动；比例 / 悬停 / 选中 / 进场连续采样在[参考帧目录](../../../qa/ui-implementation-20261103/menu-settings/reference/)，说明见[菜单设置记录](../../../qa/ui-implementation-20261103/menu-settings/README.md)。这里只按参考结构和节奏风格化，不把截图相似度称为逐像素复刻。

设置直接读写统一字段：地图手势、三档质量与覆盖、HUD 缩放、全屏、音量 / 配乐 / 界面反馈、播报时长、演出和红点。自定义项以 `baseQualityPreset` 比较，页面显示用户配置，保护策略下的实际限制另行说明。账户读取真实 account；数据操作委托父层，不在组件里直接 localStorage / reload。

## 焦点、层级与全屏

菜单 / 设置 / 二次确认使用 Radix Dialog，Select 使用自身弹层。Tab / Shift+Tab 循环，Escape 先关闭 Select 或确认，再由设置回抽屉、抽屉回地图。冷加载前由 `usePageNavigation` 保存真实触发元素，`MenuScreen.returnFocus` 在完整退出后优先归还；设置往返不会覆盖原 HUD 入口。

HUD 原 Modal 继续管理焦点循环，退出期间 inert，保留 Framer 进退场。点击遮罩和 Escape 可关闭。地图 surface 独占 `touch-action:none`，Modal / 设置正文可原生滚动。

浏览器全屏请求 `document.documentElement`，让 body 下的 Dialog、Select 与确认 Portal 处于同一个全屏树。菜单设置局部验收包含原生全屏进入、四类弹层可见和退出；这不替代 iOS / Android 全屏、方向锁和触摸实测。

## 主题与动效所有权

| 真值 | 内容 |
| --- | --- |
| `styles/tokens.css` | 色板、语义别名、间距、字体、层级、时长、缓动与阴影 |
| `styles/quality.css`、Provider | 实际 `--q-blur / --q-shadow / --q-ambient` 等运行信号 |
| `styles/base.css` | 字体、reset、通用焦点和减少动态路径 |
| `motion/transitions.ts` | Framer `tween / spring` 与统一时序 |

新增 UI 用主题变量，先查已有语义令牌；切角或滚动裁切区域把焦点环放到内侧。Framer 管按钮和页面进入 / 退出 / layout，CSS 管颜色、描边与装饰；GSAP 管区域墨散、Cinematic 内层时间轴。禁止 CSS / GSAP / Framer 争写同一元素的 transform。p5 仅负责环境绘制。

2026-11-02 的四锚错峰、同步探索环、定位折叠与系统减少动态基础保留，历史证据见 [HUD 动效验收](../../../qa/hud-motion-20261102/QA.md)。本轮不要用该轮 34 项或旧首屏大小代替新的页面 / 构建证明。

## 画质与自动降级

`useSettings.settings` 是持久偏好；`useSettings.spec` 是预设 + 覆盖 + 全局保护解析出的实际参数。12 项 `QualitySpec` 覆盖密度、云雾 / 光效帧率、粒子、云纹、模糊、墨散、环境呼吸、阴影和光晕。单项修改保留基底，不再从 custom 静默退回 high。减少动态的系统偏好与游戏偏好取或，减少闪光单独控制高亮。

自动降级默认开启，仅 high / ultra 在未暂停地图上注册采样：5 秒首窗、30 秒后续窗、连续两个有效窗口低于 26fps 才降档。暂停 / 隐藏丢弃窗口和连续计数；关闭后清理采样但不自动恢复。多次降级保留最初 `degradedFrom`，一段经历只播报一次，用户可恢复原档。配置值不能被报告为实测手机 FPS。

## 状态、队列与数据语义

`App` 只装配，controller 与 hooks 拆分会话、地图、发现和页面职责；探索 / 设置 / UI / Cinematic 各有 store。路由为 `map / menu / settings / calibration`，不是平行存档。播报 FIFO 保存每条 duration，遮挡时保留队首、恢复后重新计时；演出也用独立队列。

重置进度、清空本机与恢复默认有独立确认。重置保留设置并串行同步空探索；清本机移除本地探索和会话但不删云端；导出当前有效内存快照。初次云读取失败时暂停自动 PUT，先重试读取，避免旧本机状态覆盖云端。完整数据与会话规则见 [ACCOUNT.md](ACCOUNT.md)。

键名 `liyun.exploration.v2` 保持，结构 v3；设置包括 `qualityPreset / baseQualityPreset / qualityOverrides / autoDegrade / degradedFrom / uiSound / reduceFlash / hudScale / dragSensitivity / zoomLimit / doubleZoom / messageDuration / showCinematic / redDot` 以及原配乐字段。`shared/game-settings.mjs` 是浏览器和 API 共同白名单；独立 `unlockedRegionIds` 不再被地标集合覆盖。

## 区域、演出与作者工具

独立区域纸墨遮罩位于地标下，GSAP 负责解锁退去。当前外边界 / 分区是推荐稿，未现场确认，定位凸包不等于游戏边界。团队通过 `?tool=calibration` 或 [`public/calibrate.html`](../public/calibrate.html) 编辑、导出和审查；明确确认后才按[作者指南](../src/calibration/AUTHORING.md)执行 dry-run / `--apply`。冻结底图、模型和公共 UV 不为迁就轮廓而修改。

Cinematic 主视觉时间轴正常 5.2 秒、减少动态 1 秒、quick 2.4 秒，结束后保留阅读终态，需手动继续。跳过 / 关闭不撤销先提交的探索。8 张生成 hero 和墨纹均为概念占位，缺图用程序山水兜底，来源与最终尺寸 / 清单入口见 [ASSETS.md](ASSETS.md)。

## 后续验收与字体

中文使用 Noto Serif SC，书法标题使用 Ma Shan Zheng，本地 WOFF2 + OFL。新文案和 JSON 内容须重新生成子集并检查 cmap；本轮最终字节、哈希、产物与首屏预算待总记录补齐。旧 327,384 / 316,300 B 是 2026-11-02 快照，不是本轮定稿。

DEVQA 新增 `getUi / getRegions / unlockRegion / previewCinematic`，详见 [SCENE.md](SCENE.md)。所有开发 QA 模式隔离普通存储，生产不提供调试桥。菜单 114、HUD 正文 45、主应用 37、校准 UI 33 是局部证据，不声称现场 GPS、手机触摸、实际听音、全站对比度或生产发布完成。
