# 20 控件状态与非零安全区补充验收

2026-11-03，补任务书 §12.2。最终 [42 / 42 个唯一断言通过](final/results.json)，控制台、网络错误均为 0。覆盖 **20 个实际启用控件、4 组真实忙碌或禁用状态、2 次原生安全区读回、8 个页面 / 视口组合、8 次小屏按住尺寸检查**。本目录不重跑或替代菜单 114、按压命中区 36、HUD 45 项旧记录。

## 20 个实际控件

| 范围 | 实际启用控件 | 数量 |
| --- | --- | ---: |
| HUD | 旅途徽记、回中标题、图鉴操作坞、账号状态丸、定位到我 | 5 |
| 地图 | 当前可见地标标记 | 1 |
| 菜单 | 关闭、游客登录、设置宫格、设置快捷栏 | 4 |
| 设置 | 关闭、控制分类、拖动灵敏度滑条、双击缩放下拉、恢复默认、播放演出开关 | 6 |
| 图鉴 | 已收入图鉴的地标卡 | 1 |
| 标定 | 拖动地图工具 | 1 |
| 活动 | 已选目录项、主操作按钮 | 2 |

完整样本与每次差异在 [state-samples.json](final/state-samples.json)。最终 20 个样本均有 `hover ≠ normal`、`press ≠ hover`、`focus ≠ normal` 的可观察差异，原生 Tab 焦点与 `:focus-visible` 均成立。普通和按住矩形的最小短边实际为 **44px**。

[browser.cjs](browser.cjs) 使用真实 CDP mouse move / mouse press / mouse release 与键盘 Tab；记录按钮本身、最多 18 个内部元素及有内容伪元素的颜色、填充、描边、内线、阴影、变换、焦点环等 computed style。没有用 class、强制伪状态或改 DOM 属性伪装交互。

五态按业务语义抽样：

- 菜单「旅途档案」真实 `disabled`，可见「即将开放」。
- 标定尚未编辑时的「撤销」真实禁用，透明度为 `.48`。
- 活动导航真实进入 `navigating`，容器 `aria-busy=true`，主操作禁用并显示「正在展开…」与旋转弧；已选目录项同时禁用。
- 定位真实进入 pending / disabled / `aria-busy=true`，显示「定位中…」。此处仅用一个不回调的定位 provider 保持等待态，没有提供坐标或绕过打卡判定。

最终上述三组普通视觉比较没有等价项。合理的语义例外是：Select 在 pointerdown 即展开真实列表并改变箭头 / expanded 状态，无需再加缩放；同步导航、滑条、开关不制造不存在的 busy；活动目录在导航禁用时保留选中色和 `opacity:1`，由所属页的 busy 语义、主操作文字和旋转弧共同反馈等待状态。

## 非零安全区

先从本机 Edge 的 `/json/protocol` 读取 `Emulation.setSafeAreaInsetsOverride` 和 `SafeAreaInsets` schema，再调用原生 CDP。两个视口都用临时无交互元素读回 `env(safe-area-inset-*)`，实际值与请求一致：

| 视口 | top | right | bottom | left |
| --- | ---: | ---: | ---: | ---: |
| 844 × 390 | 12px | 44px | 21px | 44px |
| 667 × 375 | 12px | 44px | 21px | 44px |

菜单、设置、Cinematic、标定各 2 个视口，共 **8 个页面组合、26 个命中区**通过。[safe-area.json](final/safe-area.json) 保留逐个矩形、中心遮挡检测和原生 schema。

检查标准为：实际启用；中心命中自身或内部元素；滚动到目标后整个矩形位于安全范围；宽高至少 44px。边界与尺寸容许 `.1px` 浮点误差（实现判定下限 `43.9px`），实际最小值为 44px。安全区与小屏按住阶段启用游戏内减少动态；定向普通状态复验明确设置系统 `no-preference`，读回 `systemReduced=false / gameReduced=false / data-motion=full`。

667 布局截图已实际查看。它们来自首轮已通过的安全区几何采样；后续非布局反馈修正与标定小字背板不改变命中区，最终数值以 JSON 为准：

- [左抽屉与安全色带](final/safe-menu-667.png)
- [设置分类、滑条与固定底栏](final/safe-settings-667.png)
- [Cinematic 继续按钮与文字区](final/safe-cinematic-667.png)
- [标定工具栏换行与属性滚动区](final/safe-calibration-667.png)

## 两尺寸按住检查

四类按钮 × 两个视口，共 **8 / 8**。按住时均匹配 `:active`、有内部装饰或填充差异，矩形没有缩到 44px 以下。[pressed-hitareas.json](final/pressed-hitareas.json) 保留精确小数，下面单位为 CSS px：

| 控件 | 844 × 390 时按住矩形 | 667 × 375 时按住矩形 |
| --- | --- | --- |
| 定位按钮 | 172 × 44 | 145.44 × 44 |
| Cinematic 继续 | 180 × 44 | 180 × 44 |
| 活动关闭 | 49.03 × 49.03 | 49.03 × 49.03 |
| 活动主操作 | 168.47 × 44 | 116.06 × 68 |

这里测量 `getBoundingClientRect()`；活动关闭的悬停旋转会扩大外接矩形。按压效果放在内部图标 / 箭头或内线，按钮外壳保持尺寸。

## 修复与证据追踪

本次修复了地图标记、滑条、开关缺少独立按压反馈，已知图鉴卡悬停被选中样式覆盖，活动目录缺少悬停反馈。活动 CTA 内部箭头按压规则移到 hover 后，确保不被同优先级规则覆盖。菜单左侧增加安全色带；设置响应式边距保留 `env()`；标定整体内容和 Cinematic 文字 / 操作区避让安全边界。新增反馈均使用已有 tokens。

父代理同步去掉 HudButton 按压时外壳 `.985` 缩放，并补回中标题的内部文字按压色；活动关闭 / CTA / 目录按压移到内部装饰，Cinematic 继续改用内线，保持 44px 外壳。最终 CSS 不再由本任务修改。

最终结果由 [aggregate.cjs](aggregate.cjs) 按断言名合并真实采样，不把复验重复累计：

| 原始记录 | 结果 | 用途 |
| --- | --- | --- |
| [完整首轮](final/first-pass-results.json) | 36 / 42 | 保留当时的两个反馈缺口、两次未捕获的 busy 瞬态、两个 CTA 按压失败 |
| [状态定向复验](targeted-states/results.json) | 6 / 6 | 两个反馈控件及真实 busy / disabled 观测；显式普通动态与 30ms 读取导航态 |
| [安全区 / 按住定向复验](targeted-safe-held/results.json) | 18 / 18 | 修复 CTA 规则顺序后复验相同安全区与按住目标，不新增截图 |
| [最终唯一断言](final/results.json) | **42 / 42** | 20 个不同启用控件，按原断言名替换复验结果 |

更早的 `baseline* / native-input` 是脚本准备与缺口定位记录，不作为最终通过证据。首轮 JSON、样本、命中区均另存为 `final/first-pass-*`，没有抹掉失败历史。

从仓库根重新采集到独立目录，可运行：

```powershell
$env:CONTROL_QA_OUT='qa/ui-implementation-20261103/control-states/reproduction'
$env:CONTROL_QA_MODE='all'
$env:CONTROL_QA_ONLY=''
node qa/ui-implementation-20261103/control-states/browser.cjs
```

本轮是 localhost:5176、临时 Edge profile、DEV 隔离预设与桌面视口模拟。它没有验证真实手机触摸、刘海硬件、GPS / 朝向、实听音频、正常 FPS、全站对比度或生产部署；这些范围以父任务各自的独立记录为准。既有存档、公开 UV 和地图标定输入未在此脚本修改。
