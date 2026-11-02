# 理韵寻踪 · HUD 与界面重构计划

> 状态：**计划稿，尚未实施代码改动。** 本轮只做审计与设计规划。
> 审计对象：`apps/liyun-explorer`（应用 id `liyun-campus-explorer`，本地 5174）。
> 本文不改变既有发布记录、存档契约或定位逻辑；实施后需按本文件第 9 节重新验收并另行留证。

---

## 0. 一页结论

| 维度 | 现状 | 判断 |
| --- | --- | --- |
| 美术基调 | 二次元新国风赛璐璐剪纸，玉绿 / 奶油金 / 赭金，细金边、纸浪、松枝山石 | **方向正确，保留**。这套语言已经在活动长卷里跑到"成品感"，主 HUD 却没跟上 |
| 布局骨架 | 四角绝对定位 + 手调 `clamp()` + 3 组断点叠加 | **需要重做**。手机上已出现实测碰撞（见 2.1） |
| 组件与状态 | 圆角胶囊 + 只换 `brightness` 的 hover，几乎无按下 / 焦点 / 数值变化反馈 | **需要重做**。这是"网页控件"而不是"游戏 HUD" |
| 动效 | 77 处 animation、48 组 keyframes，但时长 9 档、缓动 5 套、目标各自为政 | **需要统一规格**。有动画，没有节奏 |
| 样式工程 | 7 个样式表、609 个不同 `#hex`、18 个自定义属性、29 处 `!important` | **需要收杆**。改一处颜色要翻三张表 |
| 可访问性 | `role="status"` 有、`aria-live` 缺；Esc 之外几乎没有键盘通路 | **需要补齐**。当前只满足"能看"，不满足"可用" |
| 构建 | TypeScript + Vite 通过；单 chunk JS 1,399 KB（gzip 390 KB），CSS 96.7 KB；`dist/` 28.1 MB | 功能没问题，但首屏与 HUD 重构耦合，建议同期拆包 |

一句话：**风格不用换，骨架要换；不是"美化"，是把它从"网页面板"改成"游戏 HUD"。**

---

## 1. 审计范围与方法

### 1.1 读了什么

| 类别 | 对象 |
| --- | --- |
| 构建 | `package.json`（React 19.2 / Vite 7.3 / p5 1.11 / Vitest 5）、`index.html`、`dist/` 产物 |
| 入口与状态 | `src/App.tsx`(367)、`src/state.ts`、`src/types.ts`、`src/data.ts`（8 地标、权重合计 45%） |
| HUD | `src/hud/Hud.tsx`(173)、`Ornaments.tsx`、`Icon.tsx`(19 枚图标)、`hud.css`(**1012 行**) |
| 场景 | `src/map/MapScene.tsx`(190)、`map.css`、`src/effects/Atmosphere.tsx`(179)、`fog.ts`(607)、`timing.ts` |
| 定位 | `src/location/LocationControls.tsx`、`location.css`、`geolocation.ts`、`deviceHeading.ts`、`campus.ts`、`checkIn.ts` |
| 活动 | `src/activity/ActivityScreen.tsx`(274)、`activity.css`(385)、`artwork.css`、`events.ts`、`ThemeArtwork.tsx` |
| 文档 | `README.md`、`docs/SCENE.md`、`docs/hud-handoff.md`、`docs/creative-brief.md`、`docs/ASSETS.md`、`docs/QA.md`、`docs/activity/QA.md` |
| 证据 | `public/assets/` 全量清单、`qa/` 21 个历史目录、2026-10-28 / 10-29 历史截图 |

### 1.2 怎么验的

- **构建**：`npm run build`（`tsc -b && vite build`）实跑通过，65 modules，告警仅 chunk 体积。
- **实机截图**：用仓库既有 `qa/cdp.js`（headless Edge + CDP，仅回环）在 **1440×900 / 844×390** 两档截取 `?qa=1&preset=fog|explored` 与面板态，截图落在 `.tmp/ui-audit/`（临时证据，不入库）。
- **几何量测**：同一通道注入脚本，取 `.brand / .resource-bar / .fullscreen-control / .map-compass / .campus-progress / .map-menu / .location-controls / .map-help` 及全部 `.map-marker` 的 `getBoundingClientRect()`，做两两求交（阈值 >2px）。
- **静态扫描**：脚本统计各样式表的选择器数、`#hex` 去重数、`!important`、`@keyframes`、`@media`、`prefers-reduced-motion` 覆盖，并把类名与 `src/**/*.tsx|ts` 文本比对，找出未被引用的死样式。

> 历史截图（`qa/liyun-release-20261028/`、`qa/pr2-location-release-20261028/`）显示的是**旧 HUD**（体力 164/200、在线 4 人、第 3 章、左侧五条主线菜单）。这些元素当前源码中已不存在，**不得作为现状依据**；现状以本轮两档实机截图与源码为准。

---

## 2. 现状审计结果

### 2.1 布局：实测已经撞了（最高优先级）

**844×390（手机横屏基线）实测矩形与交叠：**

| 元素 | 位置/尺寸 | 问题 |
| --- | --- | --- |
| `.map-compass` | x=772 y=68 w=57 h=71 | **与 `.location-controls` 交叠 57×34 px**（罗盘被定位卡完全压住） |
| `.location-controls` | x=602 y=105 w=230 h=75 | 与罗盘对撞；且信息密度过高（三行文案） |
| 文萃楼 / 综合教学大楼标签 | 各自 105×44 / 146×44 | **标签交叠 6×37 px**，右侧文字被左侧菱形遮住 |
| `.campus-progress` | x=686 y=298 w=137 h=84 | 底部的"良乡校区·探索度"压在白玉山月牙前景区，**文字与装饰同色区间**，可读性最差 |
| `.map-help` | x=377 y=364 | 距底边仅 9px，视觉上与 44px 触控下限冲突 |

**1440×900 实测：** HUD 元素之间无交叠（`.resource-bar` 右缘 1336 / 全屏钮左缘 1357），但 `.location-controls`（x 1136–1422, y 270–364）**完整压住 真理之塔 标签**（x 1116–1295, y 306–372，交叠 159×58 px）。原因不是定位错误，而是图层顺序：地图标记 `z-index:4` 在 HUD `z-index:10` 之下，而定位卡是不透明深色块——标签被合法地盖住了。

**结构性问题：**

1. 所有区块都是 `position:absolute` + 各自手调 `clamp()`，**没有栅格或锚点契约**；只要断点一多，`@media` 就会互相覆盖。当前 `hud.css` 里有 31 个 `@media` 块、3 组断点族（`max-height:560/max-width:1000`、`max-width:720 + landscape`、`max-height:410/350`），最后一条命中的规则决定布局，**改一处要跨三处同步**。
2. 左上品牌区宽 403px（1440×900），占屏 28%，在 844 档缩到 218×64 后又把校门徽章压成 76px。品牌/身份带与交互按钮耦合在同一个 `button` 里（`.brand-copy` 同时是"回中"按钮）。
3. 右下 `campus-progress` 单独承担"校区名 + 探索度 + 进度条 + UID"四项信息，宽度 202px，在手机档降到 137px 时 `campus-name` 字号仍有 28px，导致**数字与校区名抢同一行宽**。
4. ``.map-help` 与 iOS 安全区无关联（`bottom:17px` 硬编码对照 `safe-area-inset-bottom` 只在菜单用了）。

### 2.2 设计系统：几乎不存在

| 指标 | 实测 |
| --- | --- |
| 样式表 | 7 个，共 1,645 行 |
| 不同 `#hex` 色值 | **609 个**（`hud.css` 独占 359） |
| 自定义属性 | 18 个（`--jade/--gold/--cream/--muted/--ease` + `--activity-*` 6 个 + `--hud-inset/--nav-width`） |
| `!important` | 29 处 |
| `animation:` 声明 / `@keyframes` | 77 / 48 |
| `transition:` | 26（分布在 6 个文件，用 9 种时长：`.14s .15s .17s .18s .2s .26s .3s .42s .82s`） |
| 缓动 | 5 套：`--ease: cubic-bezier(.22,.8,.2,1)`、`var(--activity-ease): (.22,1,.36,1)`、`(.22,.78,.24,1)`、`ease`、`ease-in-out` |
| `prefers-reduced-motion` 覆盖块 | 10 处（覆盖不全：见 2.4） |
| 字体 | Noto Serif SC（正文/UI）+ Ma Shan Zheng（书法标题）——**但 `location-controls`、`check-in-status` 用了 `font-family: system-ui`，和全局衬线直接断裂** |

**色彩语言是隐性的**：金 `#d4b874 / #c6ac68 / #c8b274 / #d8bd7a / #cfbd8b…` 至少有 12 个近似值在同时使用；深绿底有 `#193c37 / #244a3f / #21493e / #24483f / #1b3d35 / #2d5343 / #345745` 等 9 档。**没有"HUD 金的唯一真值"**，导致同屏出现 4 种金边色差。

### 2.3 视觉层级与可读性

1. **数值不可读**：右下探索度进度条高 9px（手机档 5px），条内用 `#a6b986` 压在 `#193d32` 上，`transition: width .8s` 有动但**没有数值滚动或迸发反馈**；`campus-progress p` 的 `探索度` 与 `37%` 用同一行 flex 平铺，扫读时先读到标签而不是数字。
2. **标记密度失控**：地标标签是"菱形宝石 + 18px 衬线名 + 12px 副标题 + 渐隐底条"，桌面 6 个可同时入画时总占宽约 990px；手机档 `label-left` 翻转逻辑已被 `.map-marker.label-left` 的 4 条渐变覆盖规则拆成 3 处，容易出现右侧标签压建筑。地名 18px 与"文萃楼"这类四字名的字距 `.05em` 叠加后，在 13px 档（`max-width:900`）退化为主次不分的双行块。
3. **弹窗**：地标详情是**纯静态竖排纸笺**，没有"打卡进度环 / 距离 / 范围"的可视化，只有一段 `check-in-status` 文本；`role="status"` 在，但状态切换没有动画或色彩跃迁（`is-ready` 只改 3 个属性）。
4. **图鉴**：8 格 3 列网格，已点亮/未点亮仅靠图标与底色区分（`#e6ddba` vs `#e6dfb8`，**两色差 ΔE 极小**），未点亮态缺少"暗格 / 剪影"的游戏语言。
5. **入场卡**：`entry-frame` 用 16px 重复 SVG 做满幅边框，在 460px 卡宽下重复 28 次，**读起来像条形码/纹章墙**；海报级的"一纸山水"标题（25px 书法）与下方三行表单说明在同一层级竞争，`entry-content > p` 的字号 25px 大于 `enter-campus` 按钮的 20px。
6. **按钮层级**：`.parchment-button`（深绿实心）与 `.outline-button`（透明白底描边）差异只靠底色；`.map-menu-button` 与 `.resource-pill` 是同一套"胶囊 + 内嵌双线"视觉，但一个是主操作（活动一览）一个是状态展示（收录数），**权重被拉平**。

### 2.4 动效

**已有的好底子**：发现事件是完整的四段式时间轴（0–0.43 玩家行进 / 0.39–0.90 云层擦除 / 0.43–1.00 环形流光 + 星芒 / 结束收敛），`Atmosphere.tsx` 用 `performance.now()` 绝对时间轴而非累帧，`reducedMotion` 时缩短至 400ms 并保留轻量圆环。这层**不动，只挂 GPU 装饰层**。

**问题：**

1. **没有统一节奏**。面板 `scroll-open`(0.5s)、`scroll-unroll`(0.82s)、`rod-*-out`(0.82s)、toast(0.3s)、entry-pop(0.62s) 各自定义，活动页用 `--activity-fast: 140ms` + `260ms` 另一套；玩家感知不到"这是同一个游戏"。
2. **Toast 只有进场没有退场**：`game-toast` 靠 `setTimeout` 卸载（`App.tsx` 3600ms），CSS 只有 `toast-in`，消失是**瞬断**。连续打卡会互相顶替，无队列。
3. **面板动画与高度变化打架**：`clip-path: inset(0 0 100% 0)` 自顶向下铺开，若内容高度在动画中被 `scrollIntoView` 改变，会出现半截裁切（本轮截图已捕获到 0.5s 动画中途的中灰蒙层）。
4. **死代码**：`.hud-modal.is-scroll` 系列（`hud.css:276–290`）在 `Hud.tsx` 中**从未挂载**，永远不生效；`hud.css:560–1012` 共约 **450 行** `event-* / pano-* / festival-*` 既不被 `ActivityScreen` 使用（活动页用自己的 `activity.css`），也不被 `Hud` 使用——属于旧活动长卷残留。
5. **移动端开销**：`Atmosphere` 两个 p5 实例（fog 30fps + light 60fps，`pixelDensity 1.5`）叠 DOM 帧动效（`pano-* 7 组`、`char-idle`、`wave`、`cloud-drift`），844×390 同时跑 ≥12 组动画。
6. **无状态机**：UI 没有 `idle / hover / press / focus / busy / disabled` 的统一表现层；唯一反馈是 `filter: brightness(1.14)` 与 `translateY(1px)`。

### 2.5 交互与可访问性

| 项 | 现状 | 缺口 |
| --- | --- | --- |
| 键盘 | Esc 关面板（`App.tsx:139`）；`Modal`/`ActivityScreen` 有 Tab 循环 | **没有**：`1–4` 面板热键、`M` 回中、`F` 全屏、`L` 定位、方向键平移、`Enter` 确认打卡 |
| 焦点 | `focus-visible: outline 2px` 全局 | 地图地标焦点环 3px（`map.css`），与 HUD 不一致；焦点在 HUD↔地图↔弹窗之间的"返回"没有统一策略 |
| 读屏 | `role="status"` / `aria-label` 共 38 处 | **探索度与收录数的变化没有 `aria-live`**，数值变更不可播报（这是本作最核心的状态） |
| 触控 | 多数按钮 44–56px | `resource-pill` 手机档 44px、`.map-help` 仅 17px 高（不可点但与底边冲突）；`location-controls` 按钮 34px（低于 44） |
| 对比度 | 未系统校验，本轮实算 10 组（WCAG 相对亮度） | **达标**：`.map-help` 5.19、`.map-marker-name small` 7.80、`.map-menu-button` 8.26、`.landmark-description` 4.93、入场卡小字 5.62 / 标签 5.69。**不达标**：`.panel-footnote` **3.23**、`.eyebrow` **3.40**（均 < 4.5:1，且都是 11px 小字）。另：`.campus-progress small`（UID）压在半透明月牙前景上，矩形取样无法代表真实底色，需在 P2 重新取样 |
| 声效反馈 | `audio.playUnlock()` 单一提示音 | 无 hover/点击/面板开合的**界面音层**，也没有"静音下用视觉替代"的映射 |

### 2.6 工程与性能

| 指标 | 实测 |
| --- | --- |
| JS 单 chunk | 1,399.0 KB（gzip 390.3 KB）—— React + p5 + 全部业务同包 |
| CSS | 96.7 KB（gzip 22.9 KB），含约 450 行死样式 |
| `dist/` 总量 | **28.1 MB / 36 文件**（音频 11 OPUS+MP3 ≈ 20 MB，两套字体 TTF+WOFF2 ≈ 6.5 MB，两套地图 PNG+WebP ≈ 6 MB） |
| 字体 | `NotoSerifSC-UI.woff2` **327,384 B**、`MaShanZheng-UI.woff2` **316,300 B**（`ASSETS.md` 记的是 222,552 / 187,600 B，**文档与实物已不符**）；`MaShanZheng-Regular.ttf` 5,857,936 B 仍随 `public/` 发布 |
| 未引用样式 | `hud.css` 192 个类中 **84 个**无引用（含 `events-* / pano-* / festival-* / story-nav / nav-medallion / guide-steps / account-card` 等）；`map.css` 3 个（`map-player / map-player-light / map-water-ribbons`） |
| 重复资源 | `campus_no_labels.webp` 与 `campus.webp` 字节完全相同（各 1,070,594 B），PNG 两份各 1,973,144 B |

> 结论：**样式与资产的清理本身就是重构的一部分**，不做的话新皮肤只会叠在旧债上。

---

## 3. 重构目标与设计原则

### 3.1 目标（可验收）

1. **游戏标准 HUD**：四角信息、中轴提示、底部操作坞、右侧上下文卡、中心可交互视口——一眼能分出"状态 / 操作 / 反馈"三层。
2. **动效成体系**：一套时长与缓动令牌，所有交互有明确的进/退场，发现事件仍是最高光但不再孤单。
3. **任何断点不撞**：从 1920×1080 到 844×390 到 667×375，HUD 元素两两不交叠（地标标签除外，见 4.4 的避让规则）。
4. **风格延续**：玉绿 / 奶油金 / 赭金 / 宣纸质感 / 剪纸硬边 / 书法标题**全部保留**；变的只有骨架、层级、节奏与可读性。
5. **不破坏契约**：`HudProps` 接口、`data-testid`（`activity-entry / activity-return / check-in-button / check-in-status / game-stage / map-scene / poi-* / real-location-marker / heading-sector`）、`?qa=1` 预设、`window.__LIYUN__` 调试面、存档键 `liyun.exploration.v2`、图层顺序（SCENE.md 表）、WGS84 映射——**一律不动**。

### 3.2 五条原则

| 原则 | 含义 | 反例（现状） |
| --- | --- | --- |
| **信息分层** | 状态常驻但弱（数值 / 账号），操作常驻但强（按钮 / 坞），反馈瞬时但亮（toast / 发现） | 收录数与活动入口同为胶囊，权重相同 |
| **单一真值** | 色、字、间距、时长全部走令牌，组件只消费 | 12 个近似金色、9 档时长 |
| **动则有因** | 每个动画必须能回答"它在说明什么状态变化" | `pano-*` 7 组装饰动画同时跑 |
| **触控优先** | 44px 下限、拇指热区（左右下角）、横屏安全区 | `location-controls` 按钮 34px |
| **克制的华丽** | 装饰只在边缘与转场出现，正文区永远干净可读 | 入场卡满幅纹章边 |

---

## 4. 新 HUD 设计规格

### 4.1 空间骨架

采用 **"三带四锚"**：上下两条 HUD 带 + 中央自由视口；四个角各一个锚点。

```text
┌──────────────────────────────────────────────────────────────┐
│ ① 品牌身份带（左）                    ② 状态带（右上）        │
│  校门徽 + 理韵寻踪 + 校区/季节          收录 · 账号 · 全屏     │
│                                                              │
│    ┌──────────────────────────────────────────────────┐      │
│    │                                                  │      │
│    │            ③ 中央视口（地图 + 地标 + 玩家）        │ ④ 上下文卡 │
│    │                                                  │ （定位/详情）│
│    │                                                  │      │
│    └──────────────────────────────────────────────────┘      │
│ ⑤ 操作坞（左下：活动 / 图鉴）        ⑥ 探索进度环（右下）      │
│                    ⑦ 中轴提示层（toast / 发现播报）           │
└──────────────────────────────────────────────────────────────┘
```

| 锚点 | 内容 | 尺寸契约 | 层级 |
| --- | --- | --- | --- |
| ① 品牌 | 徽章(可点→个人主页) + 标题(可点→回中) | 桌面 360×128 / 手机 176×52 | 10 |
| ② 状态 | 收录胶囊、账号胶囊、全屏钮 | 高 44（手机 40），右对齐，间距 8 | 10 |
| ③ 视口 | 地图、标记、玩家指针 | 全屏，四周留 `--hud-gutter` | 1–9 |
| ④ 上下文 | 定位卡 / 地标速览 | 宽 ≤ 300，右侧距边 `--hud-gutter` | 12 |
| ⑤ 操作坞 | 活动一览、收集图鉴 | 按钮 132×52（手机 112×46） | 10 |
| ⑥ 进度 | 探索度环形 + 校区名 + 存档方式 | 直径 96–120 环 | 10 |
| ⑦ 提示 | toast、发现播报、连击 | 居中，宽度 ≤ 520 | 35 |

**栅格与令牌（新增 `src/styles/tokens.css`）**

```css
:root{
  /* 换行坐标：所有 HUD 缩进只用这一组 */
  --hud-gutter:   clamp(16px, 2.2vw, 40px);   /* 四边统一 */
  --hud-top:      max(var(--hud-gutter), env(safe-area-inset-top));
  --hud-bottom:   max(var(--hud-gutter), env(safe-area-inset-bottom));
  --hud-left:     max(var(--hud-gutter), env(safe-area-inset-left));
  --hud-right:    max(var(--hud-gutter), env(safe-area-inset-right));

  /* 间距刻度 4 的倍数 */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px;

  /* 色板：去重后的唯一真值 */
  --jade-900:#12332f; --jade-800:#193c37; --jade-700:#21493e; --jade-600:#2d5343; --jade-500:#3d6b57;
  --paper-100:#fdf6e2; --paper-200:#f3e8c8; --paper-300:#e6ddba; --paper-400:#d3c79f;
  --gold-300:#e8cf83; --gold-400:#d4b874; --gold-500:#b8933f; --gold-600:#8a6a30;
  --bronze:#a75029;      /* 活动/限时的赭金，只用于强调 CTA */
  --ink-900:#1f3a2f; --ink-700:#33513f; --ink-500:#596751; --ink-400:#8b7b51;
  --state-ready:#4c7657; --state-warn:#b46c4d; --state-info:#5b7d8a;

  /* 透明度阶梯，替代零散 8 位 hex */
  --a-08:.08; --a-16:.16; --a-32:.32; --a-56:.56; --a-80:.80; --a-96:.96;

  /* 字体 */
  --font-display:'Ma Shan Zheng','KaiTi',serif;   /* 只有标题/校区名 */
  --font-ui:'Noto Serif SC','Songti SC',SimSun,serif;
  --fs-caption:clamp(10px,.72vw,12px); --fs-body:clamp(12px,.88vw,15px);
  --fs-title:clamp(15px,1.1vw,19px);   --fs-head:clamp(22px,1.8vw,34px);
  --fs-display:clamp(32px,2.9vw,57px);

  /* 形状：剪纸硬边 + 微圆角，圆角只用于"状态胶囊" */
  --r-cut:3px; --r-pill:999px; --edge-cut:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);

  /* 动效令牌（见 5.1） */
  --d-instant:90ms; --d-fast:160ms; --d-base:240ms; --d-slow:420ms; --d-scene:900ms; --d-cinematic:1600ms;
  --e-out:cubic-bezier(.16,1,.3,1);
  --e-in-out:cubic-bezier(.45,0,.25,1);
  --e-soft:cubic-bezier(.22,.8,.2,1);
  --e-spring:cubic-bezier(.22,1.32,.36,1);
}
```

> 迁移规则：新组件只允许引用令牌；旧样式表按"逐块替换 → 删除"推进，**不做一次性大重写**（第 6 节分阶段）。

### 4.2 品牌区（①）

- 保留校门徽 SVG 与书法标题，**拆开两个命中区**：徽章 → 个人主页；标题 → 回中。
- 增加一条**节气/时段细线**（"良乡 · 秋"），复用现有 `entry-flourish` 的语言，弱化到 `--fs-caption`。
- 手机档：标题降为 24px，副题隐藏，徽章 52px；不再出现 `--nav-width` 这类只服务旧菜单的变量。
- 品牌整体加 `is-compact` 态：面板打开时自动缩到 60% 并降透明度 `.56`（避免与弹窗争视觉）。

### 4.3 状态带（②）与操作坞（⑤）

- **状态胶囊降权**：收录改为"图标 + 数字"（`8/8`），**去掉"收录"文字标签**（`aria-label` 保留完整语义）；账号胶囊保留昵称但截断到 6 字 + 省略号。
- **操作坞升级为主 CTA**：`.map-menu-button` 改为**切角纸片 + 左侧菱形徽 + 右下快捷键角标**，两枚按钮之间加 1px 竖分隔线；按下时 `translateY(1px) + 内阴影`，hover 时金色描边走一圈。
- 新增**"最近一处"微指示**：坞右侧一枚小箭头 + 最近未点亮地标名，点击直接 `select()`（数据现成：`LANDMARKS` 未发现项）。
- 快捷键角标：`A`(活动) / `C`(图鉴) / `M`(回中) / `F`(全屏) / `L`(定位)，在桌面 hover 时淡入，触屏永不显示。

### 4.4 地标标记（③ 内）

| 项 | 新规格 |
| --- | --- |
| 视觉 | 菱形宝石保留，**减小到 44px(手机 40px)**；文字条改为"宣纸纸条 + 左切角 + 金色顶线"，副题只在 `selected` 或 `discovered` 时出现 |
| 名称 | `--fs-title`(15–19px)，`letter-spacing:.02em`，**四字名不换行** |
| 层级 | 未发现 = 灰绿 `.56`；可打卡 = 玉绿 + 呼吸光；已点亮 = 金色描边 + 静态刻痕；信标 = 赭金 + 独立塔体（保留） |
| **避让规则（新增，替代 `label-left` 二分法）** | 标签默认向右；若与已绘制标签或视口右侧 `--hud-gutter` 冲突 → 向左；若仍冲突 → 只画菱形 + 名（隐去副题）；再冲突 → 只画菱形。**优先级按"已发现 > 未发现 > 信标"**，同一帧内确定性求解（不依赖 DOM 顺序） |
| 触控 | 命中区 ≥ 44×44（`padding` 外扩，不改锚点） |
| 缩放的连续性 | 缩放 < 0.55 时自动退化为"点 + 名"；缩放 > 1.2 时副题恢复显示 |

### 4.5 探索进度（⑥）：从"细条"到"环"

- 右下改为**玉璧式环形进度**：外环 1.5px 金线，内环 6px 玉绿弧，弧长 = `progress%`，**数值居中用 `--font-display`**（当前最大 45%，环不会满，留白即"未知"）。
- 环形右侧竖排：校区名（书法，**只在桌面**）、存档方式（`游客 · 本机` / `UID: xxxx`）。
- 数值变化：`0→45` 时用 **1200ms 数字滚动 + 环弧 `stroke-dashoffset` 同步缓动 + 一次金色扫光**；`prefers-reduced-motion` 时直接跳到终值且只保留 200ms 亮度变化。
- `aria-live="polite"` 播报：`探索度 37%，已点亮 7 / 8 处地标`。

### 4.6 上下文卡（④）——解决"定位卡压地标"

- 定位卡只在 `status !== 'off'` 时出现，**默认收拢为右下 44px 圆钮（"◎ 定位"）**，点击后向左展开为 280px 卡片（`width` 过渡 `--d-base`），带 **自动避让**：与可见地标标签求交，若交叠则整体下移/上移一档（`top: 30% → 42% → 18%` 三档择优）。
- 三行文案分级：状态行（主，`--fs-body`）、朝向行（次，`.80` 透明）、距离行（高亮 `--gold-300`，带"◈"前缀）。
- **字体统一**：删除 `font-family: system-ui`，改用 `--font-ui`，与全局衬线一致。
- 按钮最小高度 44px（当前 34px 不合规）。

### 4.7 弹窗体系（地标 / 图鉴 / 个人主页）

**统一骨架**（新组件 `<Panel>` 取代 `Modal`）：

```text
┌ 卷轴横轴（左） ─────────────────────── 卷轴横轴（右） ┐
│ 徽章  眉题 / 标题                              ✕    │
│ ──────────────────────────────────────────────────  │
│ 主体区（可滚动，overscroll:contain）                 │
│ ──────────────────────────────────────────────────  │
│ 次操作        主操作（右，切角实心）                 │
└──────────────────────────────────────────────────────┘
```

- **入场**：`clip-path: inset(0 0 100% 0) → inset(0)`（420ms `--e-out`），但**改为从触发点径向展开**（`transform-origin` 取被点地标的屏幕坐标），而不是永远居中铺开——这是"游戏感"的关键。
- **退场**：反向 200ms，**必须有**（当前是直接卸载）。
- **地标详情新增可视化**：
  - 顶部一枚**打卡范围环**：以地标为中心，半径按 `checkInRadius` 映射，环内画真实距离弧（在有定位时）；无定位则显示"待定位"虚线环。
  - 状态三态色块：`待发现`(纸灰) / `已进入范围`(玉绿 + 一次脉冲) / `可打卡`(赭金 + 呼吸)。
  - 打卡成功后**原地播放一次"盖印"**：赭金印章从 1.6 缩放砸落到 1，带 6px 纸面凹陷阴影，300ms。
- **图鉴**：未点亮格改为**纸纹暗格 + 剪影图标 + 右下角小锁**；已点亮格左上角加"收录顺序"小号数字；整格 hover 抬起 2px 并透出该地标的一句 `verse`。
- **个人主页**：设置区拆为"听觉 / 画面 / 操作 / 数据"四个可折叠分组（`<details>` 语义），减少单页滚动长度；滑块改为**自绘金色轨 + 菱形游标**（`accent-color` 无法做出游戏感）。

### 4.8 入场卡（EntryGate）

- 去掉满幅重复纹章边，改为**四角 L 形金角 + 上下两条细金线**；卡片宽度从 460 → 420，内边距收紧。
- 层级重排：`一纸山水，万般理韵`（display 32px）→ 一句话副题（caption）→ 表单 → 主按钮（赭金实心，唯一高饱和元素）→ 游客入口（下划线文字）→ 小字说明。
- 保留云 / 山 / 水三层 SVG 动效，但**降频**（`cloud-drift` 22/34/26s → 统一 40s，透明度 `.5→.34`），并改为 `transform` 合成层（已是）而不触发重排。
- 加 **`enter` 转场**：点"登录并进入"后，卡片 `scale(1.06) + opacity 0`（320ms），同时地图层从 `blur(6px) scale(1.02)` 收到清晰（`--d-scene`），云雾擦除一次——替代当前"直接移除遮罩"。

---

## 5. 动效与视觉特效规格

### 5.1 节奏令牌（三级）

| 级别 | 时长 | 缓动 | 用途 |
| --- | --- | --- | --- |
| **微交互** | 90–160ms | `--e-soft` | hover、按下、焦点环、开关、胶囊 |
| **转场** | 200–420ms | `--e-out`（进入）/ `--e-in-out`（双向） | 弹窗、面板、上下文卡展开、标签避让移动 |
| **场景** | 900–1600ms | `--e-spring` / 自定义曲线 | 发现事件、解锁、区域开启、入场 |

**强制规则**：同一层级内的所有动画时长必须取自同一档；不同档之间比例约 1:2.5:5，形成可感知的节奏差。

### 5.2 发现事件（保留 + 外挂装饰层）

不变的部分：`MapScene` 玩家插值 + `Atmosphere` 云擦除 / 环形流光 / 星芒（`SCENE.md` 四段式照旧）。

新增（全部在独立图层 `<DiscoveryLayer>`，`pointer-events:none`，不碰现有 p5）：

| 时间点 | 效果 | 实现 |
| --- | --- | --- |
| 0ms | 屏幕边缘一圈金色内发光（`inset box-shadow` 0 → 18px → 0，900ms） | 纯 CSS 单元素 |
| 0–430ms | 一道细光从玩家菱形沿直线飞向目标（`offset-path` 或 SVG `stroke-dashoffset`） | SVG |
| 430ms | 地标菱形**放大脉冲** 1 → 1.18 → 1（180ms），同时释放 2 圈同心涟漪（错峰 120ms） | CSS `scale` + 伪元素 |
| 430–900ms | 4 缕金雾从菱形四向飘散（`transform: translate` + `opacity`），30% 概率生成 1 片银杏叶（复用 `drawLeaf` 的形状，改为 DOM 版） | CSS 变量驱动 |
| 900ms | 底部中轴播报卡入场：`translateY(100%) → 0`（280ms `--e-out`），展示地标名 + `verse` + `探索度 +N%` | `<Announce>` |
| 1800ms | 印章式"已 收 录"（`parchment` 纹理 + 赭金 + 旋转 -6°）砸落，`scale(1.6)→(1)` 300ms | CSS |
| 3200ms | 播报卡 `translateY(0) → -12px` + `opacity 0`（260ms）后卸载 | CSS |

`prefers-reduced-motion`：只保留"边缘发光 200ms"与"播报卡淡入"，其余全部跳过；播报卡停留时间不变（信息可读性优先），玩家位移改为瞬移（现状已如此）。

### 5.3 环境层（常驻，克制的华丽）

| 层 | 现状 | 新规格 |
| --- | --- | --- |
| 云 / 雾 | p5 fog 30fps | 保留；**新增**低画质时 fog 降到 24fps，短屏禁用 light 层的 `pixelDensity 1.5` |
| 落叶 | p5，25 片取 9/21 | 保留；手机档 9 片改 6 片，速度 -20% |
| 微光 | p5，52 粒取 16/44 | 保留；只在地图上半屏（天空/湖面）生成，避免压住地标文字 |
| **HUD 呼吸** | 无 | 新增：操作坞与进度环每 6s 一次 `opacity 1 → .92 → 1`（仅在 idle > 3s 时），让静止画面不"死" |
| **纸面微尘** | 无 | 新增：全屏 12 粒极淡光点（`opacity ≤ .12`），`translateY` 漂移 24s，独立合成层 |
| **信标** | 脉冲 + 轨道星 | 保留；新增"4 缕气旋"围绕塔体慢转（20s/圈） |

**性能闸门**：任一帧内同时活跃的 CSS 动画 ≤ 8 个；所有 HUD 动画只用 `transform / opacity / filter`；`will-change` 只加在被真正持续动画的元素上，播报卡卸载前移除。

### 5.4 界面过渡语言（"纸·光·墨"三件套）

1. **纸**：面板、播报卡、上下文卡一律用"纸片展开"——`clip-path` 或 `scaleY` 从 0.96 展开，附带 1px 金线由中心向两端生长（`scaleX` 0→1，`--d-fast`）。
2. **光**：任何"获得 / 达成"用金色扫光（`linear-gradient(100deg, transparent 35%, #ffeab755 50%, transparent 65%)` + `translateX(-120% → 120%)`），时长 900ms，**同一屏同时只允许一处扫光**（活动页现有的 `event-sheen` 6.5s 无限扫光要改成一次性）。
3. **墨**：关闭 / 撤销用"墨迹收拢"——`opacity` + `scale(.98)` + 轻微 `blur(2px)`（120ms），替代现在的直接消失。

### 5.5 状态机（每个可交互元素必须五态）

`idle` → `hover`（亮度 +1.08 且金描边描一圈 1px） → `press`（`translateY(1px)` + 内阴影加深 + 90ms） → `focus-visible`（2px 奶油金外环，offset 4px，**与 hover 可叠加**） → `busy`（`.60` 透明 + 内嵌旋转弧，仅 CTA）/ `disabled`（`.38` 透明 + `saturate(.4)`，去 hover）。

### 5.6 交互音（可选，默认关）

- 新增 `ui-sfx` 层：面板开（低频"噗"）、按钮确认（短木鱼）、打卡成功（保留现有 `playUnlock` 并加一层和声）。
- 受 `settings.music` 与新的 `settings.uiSound` 双开关控制；Web Audio 合成，**不新增采样文件**（与 `ASSETS.md` 的现有做法一致）。
- 静音时的视觉替代映射必须在验收里写明：确认 = 金闪、失败 = 横向抖动 120ms。

---

## 6. 分阶段实施路线

| 阶段 | 目标 | 主要改动 | 产出/验收 | 预估 |
| --- | --- | --- | --- | --- |
| **P0 清场** | 去掉旧债，不改观感 | 删除 `hud.css:560–1012`（活动长卷残留）与 `.is-scroll` 死规则；`map.css` 3 个死类；`dist` 去掉 `MaShanZheng-Regular.ttf` 与重复 `campus*.png/webp`；同步修正 `ASSETS.md` 的字体字节数 | 截图与 P0 前**逐像素无差异**；`asset-manifest --check` 通过；`dist` 从 28.1 MB → ≈ 18 MB | 0.5 天 |
| **P1 令牌与骨架** | 建立单一真值 + 四锚栅格 | 新增 `styles/tokens.css`；新建 `hud/HudFrame.tsx` 承担四角定位；`Hud.tsx` 只保留内容；替换 `--hud-inset` 为 `--hud-*` 四值；统一字体（去掉 `system-ui`） | 1440×900 / 1280×720 / 844×390 / 667×375 四档截图，元素零交叠 | 1.5 天 |
| **P2 核心 HUD 换皮** | 徽记、状态带、操作坞、进度环、标记 | `Ornaments` 增加金角组件；进度环新组件（SVG + 数字滚动）；标记避让算法（同一帧确定性求解）；上下文卡收拢/展开 + 自动避让 | 交互五态齐全；对比度全部 ≥ 4.5:1；`aria-live` 补全 | 2.5 天 |
| **P3 弹窗体系** | 统一 Panel + 地标可视化 + 图鉴/主页 | 新 `<Panel>`（径向展开、必退场、焦点陷阱复用现有实现）；打卡范围环；盖印动画；图鉴暗格；主页分组折叠 + 自绘滑块 | 三张面板 2 档视口截图；键盘全通路（Tab/Shift+Tab/Esc/Enter） | 2 天 |
| **P4 动效系统** | 发现事件外挂层 + 播报队列 + 环境微动 | `<DiscoveryLayer>`、`<Announce>`（队列 + 进出场）、HUD 呼吸、纸面微尘、纸/光/墨三件套统一 | 录制 3 段动效（960×540，5–8s）作为证据；`reducedMotion` 逐项核对表 | 2 天 |
| **P5 交互扩展** | 键盘、快捷键、音效 | 热键 `A/C/M/F/L/Esc`；方向键平移；`Enter` 确认打卡；`ui-sfx` 层；静音替代映射 | 键盘走查脚本通过；无鼠标可完成"打卡 + 看图鉴 + 开活动" | 1 天 |
| **P6 加固** | 性能、拆分、文档 | JS 拆包（`p5` 动态 `import()`、面板懒加载）；CSS 死类清零；`prefers-reduced-motion` 全覆盖；更新 `hud-handoff.md` / `SCENE.md` 图层表 | 首屏 JS gzip ≤ 600 KB；低画质 844×390 稳定 ≥ 28fps；五张实机截图 + 量测 JSON | 1.5 天 |

**总计约 11 人日**（不含真机定位回归）。每阶段独立可回滚：P0–P2 只动 `hud/` 与样式，P3 动面板渲染但保留 `HudProps`，P4 纯新增图层，P5 新增监听器，P6 只动构建配置。

---

## 7. 验收标准（可量化）

### 7.1 布局（脚本可测，沿用本轮量测方法）

在 **1920×1080 / 1440×900 / 1280×720 / 1024×600 / 844×390 / 667×375** 六档，`?qa=1&preset=explored` 下：

- HUD 八类区块（品牌/状态带/全屏/罗盘或进度环/操作坞/上下文卡/帮助/播报）**两两交叠面积 = 0**。
- 地标标签：允许交叠，但**任一行文字的可见字符区不得被其它标签覆盖**；被降级到"只画菱形"的数量 ≤ 同屏 2 个。
- 所有可点目标 `getBoundingClientRect()` 的最短边 ≥ 44px（桌面可放宽到 40px，但需在文档标注）。
- 安全区：`env(safe-area-inset-*)` 生效时，四角元素不进入 inset 区域（用 CDP `Emulation.setDeviceMetricsOverride` + 自定义 `--safe` 变量模拟）。

### 7.2 可读性与无障碍

- 文本对比度 ≥ 4.5:1，UI 边界 ≥ 3:1（用 axe-core 或脚本按 `getComputedStyle` 计算，逐对记录）。
- `prefers-reduced-motion: reduce` 下：`animation-duration` 全部 ≤ 200ms 或 `none`，且**无任何无限循环动画**；用 `document.getAnimations()` 断言。
- 键盘：不碰鼠标可完成 ①进入 → ②选地标 → ③定位 → ④打卡 → ⑤开图鉴 → ⑥开活动 → ⑦关活动 → ⑧改设置。
- 读屏：探索度、收录数、打卡状态变化各有一次 polite 播报；面板 `aria-modal` + 焦点陷阱 + 关闭后焦点回到触发元素（现状已有，需保持）。

### 7.3 动效

- 每个动画在代码中可追溯到 5.1 的三档之一；新增动画必须写进 `docs/hud-handoff.md` 的动效表。
- 发现事件在 `reducedMotion` 下总时长 ≤ 600ms，且仍能明确识别"哪个地标被点亮"。
- 连点 3 个地标：播报卡不重叠、不丢失、队列按 FIFO 展示（当前会互相覆盖）。

### 7.4 性能

- 首屏 JS gzip ≤ 600 KB（当前 390 KB 已是首屏 + p5，拆分后 `p5` 延后加载）。
- 844×390 低画质：`requestAnimationFrame` 采样 5s，平均 ≥ 28fps；`prefers-reduced-motion` 下静止时总动画数 ≤ 3。
- `dist/` ≤ 20 MB（去掉重复地图与 TTF）。

### 7.5 不回归

- `npm test`（Vitest **9 个测试文件 / 85 项**，本轮实跑全绿：timing 3、geometry 5、events 14、account 7、campus 6、state 7、geolocation 12、deviceHeading 18、checkIn 13）保持全绿。
- `data-testid` 清单与 `window.__LIYUN__` 接口逐项仍在（用脚本枚举 `document.querySelectorAll('[data-testid]')` 与 `Object.keys(window.__LIYUN__)` 对比 P0 基线）。
- 存档键、`?qa=1&preset=fog|explored` 的 0% / 37% 数值不变。
- `npm run build`、`node scripts/asset-manifest.mjs --check`、`node scripts/verify-calibrated-map.mjs` 通过。

### 7.6 证据留存

新增根目录 `qa/ui-refactor-YYYYMMDD/`（与既有 `qa/<topic>-<date>/` 约定一致），至少包含：

```text
shots/  {1440x900,844x390,667x375}-{map,panel,collection,activity}.png
measure.json      六档视口下 HUD 矩形与交叠结果
contrast.json     逐元素对比度计算
motion.md         reducedMotion 逐项核对
checks.json       断言清单（ok/checks 结构，可被 qa/lib.js 校验）
```

> 按 `docs/QA.md` 的现行约定：**本文档与后续截图都不构成"已发布"证据**，生产发布需另行授权并留发布记录。

---

## 8. 风险与取舍

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| **动效叠加卡顿** | 现有 p5 双层 + 新增 DOM 层，手机档可能掉帧 | P4 先在 844×390 用 reducedMotion 关闭环境层测基线；新增层全部 `will-change` 受控；帧率闸门写进 7.4 |
| **"太像网页"回潮** | 令牌化容易把设计压平，变成卡片堆 | 明确保留三项"非网页"特征：书法标题、切角/剪纸边、金线描边；禁止使用圆角卡片 + 阴影堆叠的通用 SaaS 观感 |
| **风格漂移** | 新色板 `--gold-400:#d4b874` 与旧 `#c6ac68` 混用会花 | P1 只建令牌不动色；P2 逐块替换并截图比对，**同一屏内金色只允许 2 档**（400 描边 / 300 高亮） |
| **活动长卷耦合** | `hud.css` 与 `activity.css` 有同名 `event-* / pano-*` 家族 | P0 先删 `hud.css` 侧残留，确认活动页无回归；活动页本轮**不重构**，只保证不被影响 |
| **契约破坏** | 重构易误删 `data-testid` / `__LIYUN__` | 7.5 的枚举对比作为 P0 与每阶段卡的硬门禁 |
| **字体子集抖动** | 改文案后需重跑 `fonts-build.ps1`，否则出现豆腐块 | P2/P3 文案定稿后统一重跑 + `--check`；把这一步写进阶段完成定义 |
| **文档失真** | `ASSETS.md` 的字体字节数已与实际不符 | P0 一并修正，并在资产清单里记录本次变更原因 |

### 取舍（明确不做）

- **不换美术风格**，不引入写实水墨/水彩（`creative-brief.md` 已否定）。
- **不动地图几何、UV 契约、WGS84 映射、打卡判定**（`SCENE.md` / `REAL-LOCATION.md` 的范围）。
- **不在本轮重构活动长卷视觉**（`activity.css` 已达标），只做接口兼容。
- **不引入 UI 框架/动画库**（GSAP、framer-motion 等）：现有依赖只有 React/p5，新增运行时与拆分目标冲突；动效用 CSS + 少量 `requestAnimationFrame` 足够。

---

## 9. 与现有文档的关系

| 文档 | 影响 |
| --- | --- |
| `docs/SCENE.md` | 图层表需要更新（新增 `<DiscoveryLayer>`、`<Announce>`）；相位时长表在 P4 后补充"外部装饰层"列 |
| `docs/hud-handoff.md` | 需重写为"令牌 + 五态 + 动效档位"的交接说明；字体重建流程不变 |
| `docs/ASSETS.md` | 修正两份 WOFF2 的字节数；补充 `dist` 瘦身说明 |
| `README.md` | "当前内容范围"中"HUD 界面"段落需同步新结构（左活动/图鉴、右上状态、右下环、上下文卡） |
| `docs/QA.md` | 引用本计划作为 UI 重构的验收入口；在 7.6 的基础上补充实际执行时间/版本 |
| `docs/creative-brief.md` | 无需改动；本计划不改变情绪命题与美术约束 |

---

## 10. 立即可做的第一批动作（P0 清单）

1. 删除 `src/hud/hud.css` 第 560–1012 行（活动长卷残留）与 `.hud-modal.is-scroll` 相关 276–290 行，跑一次 `npm run build` + 浏览活动页确认无回归。
2. 删除 `src/map/map.css` 中 `.map-player`、`.map-player-light`、`.map-water-ribbons`（无引用）。
3. 从 `public/assets/` 移出 `MaShanZheng-Regular.ttf`、`maps/campus.webp`、`maps/campus.png`（与 `calibrated/` 字节相同），更新 `asset-manifest` 与 `ASSETS.md`。
4. 修正 `ASSETS.md` 的两处字体字节数，注明实测时间。
5. 用 `qa/cdp.js` 生成 P0 基线：六档视口 × `preset=fog|explored` 的矩形/交叠 JSON，作为后续每个阶段的对照。
