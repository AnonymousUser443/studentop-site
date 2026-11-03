# 菜单与设置验收

有效结果：[`verified-focus-fullscreen-2/results.json`](verified-focus-fullscreen-2/results.json)，**114 / 114 通过，浏览器错误 0**。`npx tsc -b --pretty false` 通过。

追加按下态命中区结果：[`press-hitareas/results.json`](press-hitareas/results.json)，**36 / 36 通过，浏览器错误 0**。菜单关闭 / 竖栏把缩放移到内部图标，设置按钮使用内描边按压反馈，按钮自身不缩小；六档原生鼠标按住时的真实 DOM rect 均不小于 44px。此项是对原 114 项闲置 / 悬停几何检查的补充。

本次保留派蒙式左侧结构：窄竖栏、身份卡、密排宫格、右侧可见世界。材质改为玉绿、宣纸与金线；悬停使用内描边与轻亮底，按下收缩，分类使用菱形描边、共享选中底与一次性横向扫光。菜单采用项目 `tween.page`，退出保留 DOM；减少动态使用 `tween.tap`，扫光受减少动态与强闪光偏好约束。模糊与阴影读取全局画质变量。

菜单、设置和确认框使用 Radix Dialog 管理焦点；Select 使用其独立弹层。菜单接受父导航在冷加载前保存的 `returnFocus`，先保留真实 HUD 触发者，再在完整退出后归还。设置的选择、确认、返回依次处理 Escape。

设置直接读取统一 store，画质显示用户配置并以 `baseQualityPreset` 比较单项自定义；减少动态的实际限制另行说明。账户读取真实会话；导出、重置进度、清空本机与标定由 App 回调执行。恢复默认、重置进度、清空本机分别展示确认，UI 不直接访问 localStorage 或 reload。关于页提供版本、存档说明和随包字体许可。未开放菜单项有可见标识。

验证范围：1920×1080、1440×900、1280×720、1024×600、844×390、667×375，每档检查八类设置。包括 44px 命中区、页面边界与滚动、菜单右侧世界、焦点进入/循环/归还、Select 首次 Escape、确认取消/焦点、单项画质自定义、减少动态、原生全屏中的菜单/Select/确认 Portal，以及退场 DOM 移除。使用已有 `qa/lib.js` 的独占临时 Edge 档案、CDP 指针与键盘输入，只访问本机 5176 的 QA 预设。真实账号云端往返、手机触摸/GPS和实际听音由总验收另行记录。

最终截图在 [`verified-focus-fullscreen-2/shots`](verified-focus-fullscreen-2/shots)。本次实际查看了桌面/短横屏菜单与设置、短屏图像/数据页、关于、全屏菜单、全屏 Select 和确认截图。

视频关键帧与连续采样保存在 [`reference`](reference)，源视频未改动。`menu-entry-strip-3s.png` 记录 3.0–3.7s 的退 HUD / 菜单渐现；`menu-open.png`、`menu-hover.png` 与 `settings-select.png` 用于比例、悬停与扫光对照。原 `shots/`、`results.json`（60 / 61，冷加载焦点缺陷）以及第一次续跑被并行 HMR 中断的 `verified-focus-fullscreen/` 全部保留，不能替代最终结果。
