# HUD 面板独立懒载验收

[`results.json`](results.json)：**45 / 45 通过，浏览器错误 0**。TypeScript 构建检查通过。

`Hud.tsx` 保留四锚框架、通用 Modal、入口账户表单与原 `HudExtraProps` 契约。图鉴正文和地标正文分别通过 `React.lazy` 加载，正文 CSS 随 lazy 模块加载，外壳在等待时提供可见加载提示。`preloadHudPanels(): Promise<void>` 是可选的父层闲时预取入口，本组件不主动拉取正文。已移除旧 profile 和 Toggle 的重复账户/设置 UI。

本机 5176 的独占临时 Edge QA 档案记录到独立请求：`CollectionPanel.tsx`、`panels.css`、`LandmarkPanel.tsx`。六档 1920×1080、1440×900、1280×720、1024×600、844×390、667×375 下，图鉴与地标弹窗的页面边界、44px 按钮、焦点进入/归还通过；图鉴双向 Tab 循环、inert 退场、完整卸载、快速开合、减少动态通过。未发现地标的 `check-in-status` / `check-in-button` 保留，范围显示使用实际 eligibility radius，回退地标值。入口卡及三个登录输入保持可用。截图在 [`shots`](shots)，已实际查看桌面图鉴、短屏地标、打卡状态与入口卡。

[`css-prune.json`](css-prune.json) 记录首轮静态清理：移除 296 个正文迁移或源码无引用的选择器。之后又清理了无 DOM 对应的旧品牌容器及无用关键帧，并将公共 Modal/活动地图返回卡迁移到令牌。交接时 `hud.css` 为 **13,858 B / 30 个不同裸 hex**（原为 43,879 B / 231 个），新 `panels.css` 为 **6,731 B / 0 个裸 hex**。剩余旧裸色主要在入口卡与 BrandGate 装饰，已交接统一主题代理继续处理。

未修改 App、hooks、共享存档、地图标定、hud-frame、progress-ring 或 hud-shells。地图可见锚点与存档公开 UV 由既有父层逻辑提供。
