# 理韵寻踪 · UI 重构计划 V2（架构级 / 游戏 HUD 标准）

> **2026-11-03 实施入口与用户覆盖要求：** 当前代码、职责与验证范围见 [README](../README.md)、[SCENE](SCENE.md)、[HUD 交接](hud-handoff.md)、[QA 索引](QA.md)和 [TODO](../TODO.md)。用户后续明确推翻本方案中的全屏菜单：现采用派蒙式**左侧抽屉，右侧校园世界保持可见**；窄竖栏 / 身份卡 / 宫格及设置分类的悬停、选中扫光按本地视频关键帧风格化为玉绿宣纸金线，见[参考与 114 项局部验收](../../../qa/ui-implementation-20261103/menu-settings/README.md)。设置仍是独立全屏页。
>
> 下方“计划稿，本轮不写重构代码”与正文示意图是编制时原文，保留历史设计，不代表当前未实施。独立分区、团队标定、队列、数据语义与Cinematic已实现并完成本地验收；分区仍为未现场确认推荐稿，演出时间轴5.2/1/2.4秒，终态等待继续。[本轮总证据](../../../qa/ui-implementation-20261103/README.md)记录实际范围、字节门禁及用户已安排稍后由队员执行的真机/现场事项，没有发布生产，不能由计划目标反推未测部分已经通过。

> 状态：**计划稿，本轮不写重构代码。**
> 取代关系：本文件在 [UI-REFACTOR-PLAN.md](UI-REFACTOR-PLAN.md)（V1）基础上扩围。V1 的**审计数据仍然有效**（第 2 节的实测结论、609 色/84 死类/交叠像素等），但**技术选型、架构、界面体系、范围**以本文件为准。V1 的"不引入动画库/UI 框架"一条作废。
> 适用：`apps/liyun-explorer`（React 19.2 / Vite 7.3 / TS 5.9 / p5 1.11 / Vitest 5）。

### 已落实的实施口径（优先于下方历史草案）

- **§9.2 / P4a 几何前提已纠正**：`support_polygon_uv`只表示定位采样覆盖；仅2/8原地标在其内，不能要求全部游戏分区在此凸包内。运行时使用独立推荐游戏边界与8分区，几何工具支持一般凹多边形；六份地图/标定输入及原始地标UV不变。内容和现场确认由标定工坊处理。
- **§6.3.1 / §12.4冲突已统一**：连续两个有效低帧窗口才降档（首5s、后30s），暂停/隐藏丢弃窗口。没有按“压到20fps后5s内”同时验两套矛盾规则；浏览器用真实墙钟故障注入，原结果独立保存。
- **§7和手机宫格布局采用最新用户要求**：左抽屉保留世界，按本地派蒙视频的窄竖栏与紧凑宫格布局；不再将旧全屏宽度或固定手机3列视为验收目标。命中区、滚动、焦点与六档边界仍必须通过。
- **§10时长指视觉时间轴**：正常5.2s、快版2.4s、减少动态1s；末帧保留供阅读，用户继续/点击/Esc/Space离开。
- **§12.4体积沿用工程既有门禁**：20MiB（20×1024²字节），首屏静态JS图独立gzip总计不超过600,000字节。报告同时给精确字节，不混用MB/MiB。
- P0纯删除另有[隔离对照](../../../qa/ui-implementation-20261103/pure-cleanup/results.json)：在同一最终App恢复/移除原始死样式，六档四态24对PNG完全相同。它不等于历史整版重画对比；当前布局、颜色和真实像素差分分别报告，主题色变化保留。

---

## 0. 本轮需求变更摘要（相对 V1）

| # | 新要求 | 对计划的影响 |
| --- | --- | --- |
| 1 | **允许 GSAP + framer-motion + UI 框架**，支持大规模架构重构 | 推翻 V1「不引动画库」的取舍；新增依赖预算、分包与动效引擎分层（5 节） |
| 2 | **视觉与交互体验为核心宗旨** | 验收权重调整：视觉/手感为一等公民，性能通过"画质预设"而非砍效果来保证（6 节） |
| 3 | 手机端性能改为**用户可选预设：低 / 高 / 极致** | 新增设置页与画质预设系统，涉及存档 v3 迁移与云端白名单（6.4） |
| 4 | 个人主页改成**《原神》派蒙菜单式**：上部个人信息 + 下部次级入口宫格 + 最左功能栏 | 废弃现有 `profile` 弹窗，新建全屏 Menu 页（7 节） |
| 5 | 设置界面参考**原神设置页**：左侧分类栏 + 右侧长条设置行 | 新建独立 Settings 页（8 节） |
| 6 | **地图分区未解锁时被水墨云纹遮住**，解锁播放"水墨退去"动画 | 新增分区数据契约 + 分区遮罩渲染层 + 授权工具（4 节，**本轮最大的新架构**） |
| 7 | 解锁瞬间**全屏演出**：打卡点 + 手绘插画 + 小故事 | 新建 Cinematic 演出模板，素材未定但模板先落地（9 节） |
| 8 | 打卡点、片区、故事、插画**最终内容未定** | 一切内容走**数据驱动 + 占位素材兜底**，不硬编码任何地标（10 节） |

---

## 1. 现状复核（V1 审计结论，仍有效）

只列与本轮决策直接相关的部分，完整数据见 [V1 第 2 节](UI-REFACTOR-PLAN.md#2-现状审计结果)。

- **实测交叠**：844×390 下罗盘与定位卡重叠 57×34px、两枚地标标签重叠 6×37px；1440×900 下定位卡盖住真理之塔标签 159×58px。
- **样式工程**：7 表 1,645 行、**609 个不同 `#hex`**、18 个 CSS 变量、29 处 `!important`、`hud.css` 192 类中 **84 类无引用**（含 450 行旧活动长卷残留）。
- **动效**：77 处 animation / 48 组 keyframes，**时长散成 9 档、缓动 5 套**；toast 无退场；`.is-scroll` 系列从未挂载。
- **可访问性**：`.panel-footnote` 3.23:1、`.eyebrow` 3.40:1 不达标；探索度与收录数**无 `aria-live`**；`location-controls` 字体是 `system-ui`，与全局衬线断裂。
- **构建**：JS 单 chunk 1,399 KB（gzip 390 KB）、CSS 96.7 KB、`dist/` 28.1 MB。
- **测试基线**：9 文件 / 85 项全绿（重构必须保持）。

### 1.1 本轮新增核查：三个会挡住需求的事实

| 发现 | 证据 | 影响 |
| --- | --- | --- |
| **地图没有分区几何** | `src/data.ts` 里 8 个地标只有一个 `regionId` 字符串（`wencui/beihu/library/teaching/wenbo/sports/tower/park`），**没有任何片区 polygon**；`map.json` 只有整幅 `view_box` | "水墨遮住某片区"必须先造分区数据 + 授权工具（9.2）。**但**：`selected_model.json` 里已有一份 7 顶点 `support_polygon_uv`（标定有效覆盖范围）可作父边界，`model-transform.mjs` 有现成的点在多边形内判定——省一半工作量 |
| **云存档会吞掉新字段** | `src/account.ts` 的 `sanitizeCloudState()` 白名单硬编码：`version: 2`，settings 仅收 `music/volume/quality/reducedMotion/track` | 新增 `qualityPreset` 等字段**必须同步改客户端白名单 + 服务端**，否则刷新后设置丢失（6.4） |
| **活动页已自成一套视觉** | `activity.css` 385 行、自带 `--activity-*` 令牌，与新 HUD 令牌是两套 | 需做"令牌对齐"，否则同作两套金/两套纸（5.5） |

---

## 2. 目标态一览（先看画面）

```text
┌─ 游戏世界（MapScene + Atmosphere，保留） ─────────────────────────┐
│                                                                    │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  分区遮罩层（C 层）：未解锁片区 = 云纹水墨 + 留白 + 淡墨边   │     │
│   │  → 解锁时播放「墨散」时间轴，片区渐显                        │     │
│   ├──────────────────────────────────────────────────────────┤     │
│   │  地标层（D 层）：菱形 + 纸条标签（确定性避让）               │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  ① 品牌身份带       ② 状态带(收录/账号/全屏)                       │
│                                                                    │
│  ④ 上下文卡(定位/详情)         ⑥ 探索环                             │
│  ⑤ 操作坞(活动/图鉴)                      ⑦ 播报层                  │
└────────────────────────────────────────────────────────────────────┘
        │ 点击品牌徽章 / 账号胶囊
        ▼
   ┌─ 派蒙式个人菜单（全屏，7 节） ─┐   ┌─ 设置页（全屏，8 节） ─┐
   │ 头像+昵称+签名+UID+冒险等阶    │   │ 左：控制/按键/图像/…   │
   │ ─────────────────────────────  │   │ 右：长条设置行 + 弹层  │
   │ 左功能栏 │ 4 列次级入口宫格     │   │ 底部：恢复默认/应用    │
   └────────────────────────────────┘   └────────────────────────┘
        │ 打卡成功 / 分区解锁
        ▼
   ┌─ Cinematic 全屏演出（9 节模板） ────────────────┐
   │ 印章 → 手绘插画 ken-burns → 地标名 → 小故事       │
   │ → 探索度滚动 → "已收录"落印 → 收起回地图           │
   └──────────────────────────────────────────────────┘
```

---

## 3. 技术选型与依赖预算

### 3.1 选什么

| 层 | 选型 | 版本策略 | 理由 |
| --- | --- | --- | --- |
| UI 运行时 | React 19.2（不变） | 现有 | 不动 |
| **声明式 UI 动效** | **framer-motion**（`framer-motion` 包） | `^14`（实测 14.9.0，peer 支持 React 19） | `AnimatePresence` 直接解决"toast 无退场""面板瞬断"；`layout` 自动处理宫格/长条重排；`useReducedMotion` 内建；变体（variants）天生适配"五态" |
| **场景级时间轴** | **GSAP** + `@gsap/react`（`useGSAP`） | `^3.15` / `^2.1`（实测 3.15.0 / 2.1.2） | 分区墨散、Cinematic 演出这类**多目标、带时间点回调、可 seek、可暂停**的序列，GSAP 时间轴比声明式更可控；`useGSAP` 自动清理 |
| **无障碍 UI 原语** | **Radix UI Primitives**（`@radix-ui/react-dialog / tabs / select / slider / switch / tooltip / collapsible`） | 按需装 | 只要行为不要皮肤：焦点陷阱、`aria-modal`、键盘导航、屏幕阅读器语义现成，**完全自绘视觉**，不与国风美术打架；替代手写 Modal 的焦点循环 |
| 状态管理 | **Zustand**（`zustand`） | `^5`（实测 5.0.16） | 现在 `App.tsx` 有 30+ 个 `useState` + 一堆 `xxxRef` 镜像；拆 store 是"架构级重构"的必要前提（4.1） |
| 样式 | **CSS Modules + 令牌文件**（不进 Tailwind） | — | 现有是手写全局 CSS，Tailwind 会引发大面积改写；Modules 只解决"作用域"，令牌解决"单一真值" |
| 图标 | 保留自绘 `Icon.tsx`（19 枚）+ 新 UI 图标补齐 | — | 剪纸描边风格是资产，不换 Lucide |

### 3.2 不选什么（明确写死）

- **不用 MUI / Chakra / Ant Design / shadcn 全套**：它们的默认视觉、间距、圆角、阴影体系与本作"剪纸硬边 + 宣纸 + 金线"直接冲突，覆盖成本大于自建；体积也不允许。
- **不用 Three.js / R3F**：地图是 2D 位图 + DOM/SVG 标记，没有 3D 需求。
- **不用 Tailwind**：理由同上（改写面积）。
- **不用 Lottie**：需要外部导出资产与运行时，且无法接数据（`+N%` 之类动态值）。

### 3.3 依赖预算与分包

| 包 | gzip 估算 | 加载策略 |
| --- | --- | --- |
| framer-motion | ~40–45 KB | 首屏（HUD 过渡要用） |
| GSAP core | ~25–30 KB | **懒加载**：仅在地图就绪后 `import()`；分区墨散首次触发前预取 |
| Radix（5–6 个 primitives） | ~20–25 KB | 设置页/菜单页**懒加载** |
| Zustand | ~1.5 KB | 首屏 |
| p5（现有） | ~90 KB（现与业务合包） | 拆为独立 chunk，**延后到 `Atmosphere` 挂载后** |
| 目标 | **首屏 JS gzip ≤ 600 KB** | 现状 390 KB（含 p5 与全部面板），拆分后首屏应更低 |

> 硬规则：**面板/设置/菜单/演出四个界面一律 `React.lazy` + 预取**，不塞进首屏包。

---

## 4. 新架构

### 4.1 目录与职责（重构后）

```text
src/
├─ app/
│  ├─ stores/             zustand：useExploration / useUi / useSettings / useCinematic
│  ├─ router.tsx          'map' | 'menu' | 'settings' | 'cinematic'（轻量状态机，不引 react-router）
│  └─ providers.tsx       MotionConfig(reducedMotion) + 画质上下文 + 音效上下文
├─ styles/
│  ├─ tokens.css          ← 唯一真值（色/间距/字号/时长/缓动/层级）
│  ├─ quality.css         画质预设的运行时变量（低/高/极致）
│  └─ base.css            全局 reset、字体、焦点环
├─ world/                 游戏世界（原 map/ + effects/ + location/）
│  ├─ MapScene.tsx        地图与手势（逻辑不变）
│  ├─ Markers.tsx         地标层（新增避让求解）
│  ├─ fog/                分区遮罩层（4 节）
│  ├─ fx/                 p5 环境层（Atmosphere 拆薄）
│  └─ locate/             定位（原 location/，仅换皮）
├─ hud/                   常驻 HUD（3 节骨架）
│  ├─ HudFrame.tsx        四锚定位
│  ├─ Brand.tsx / StatusPills.tsx / ActionDock.tsx / ProgressRing.tsx
│  ├─ ContextCard.tsx     定位/详情上下文（收拢-展开）
│  ├─ Announce.tsx        播报层（队列）
│  └─ ui/                 通用原语：PaperPanel / CutButton / GoldRule / Seal / Toggle
├─ menu/                  派蒙式个人菜单（7 节）
├─ settings/              设置页（8 节）
├─ cinematic/             打卡/解锁演出（9 节）
├─ content/               内容层：landmarks / regions / stories / events（数据驱动）
└─ data/                  现有 data.ts 精简为再导出
```

迁移规则：**旧文件不原地大改**，新目录先与旧并存（双入口可切），每阶段把一块业务迁过去，最后删旧 —— 这样任何一步都能回滚。

### 4.2 状态拆分（Zustand）

| Store | 持有 | 说明 |
| --- | --- | --- |
| `useExploration` | `discoveredIds / unlockedRegionIds / playerUV / progress` | 对应存档 v3，与其他逻辑解耦 |
| `useUi` | `route / activePanel / selectedId / toastQueue / cinematicPayload` | 纯 UI，刷新即失 |
| `useSettings` | `qualityPreset / music / uiSound / volume / reducedMotion / flash / track` | 持久化，需过云端白名单 |
| `useLocation` | 定位/朝向（保持 volatile，**永不入存档**） | 语义不变 |

`App.tsx` 从 367 行收到 **约 120 行**（只做生命周期装配与订阅）。

---

## 5. 动效引擎分层

### 5.1 分层原则（谁负责什么，不许越界）

| 场景 | 引擎 | 例子 |
| --- | --- | --- |
| 组件进出、布局重排、悬停按下、弹层 | **framer-motion** | 面板开合、宫格 hover、设置行选中、托盘滑入、toast 队列 |
| 多目标编排、需 seek/暂停/时间回调 | **GSAP timeline** | 分区墨散、Cinematic 演出、发现事件的装饰层（3.2s 四段） |
| 每帧高频、依赖相机/时间的绘制 | **p5 / Canvas**（保留） | 云雾、落叶、微光、环形流光 |
| 纯装饰循环（呼吸、漂移） | **CSS animation** | HUD 呼吸、纸面微尘 |

**铁律**：同一元素不得被两套引擎同时写 `transform`（GSAP 与 framer 抢 `transform` 是经典事故）。跨引擎交接必须通过"容器层"隔离：framer 管外层布局，GSAP 管内层时间轴。

### 5.2 动效令牌（统一三级 + 缓动）

```css
:root{
  --d-tap:90ms;      /* 按下 */
  --d-fast:160ms;    /* hover / 焦点 / 小状态 */
  --d-base:240ms;    /* 展开 / 收拢 */
  --d-slow:420ms;    /* 面板 / 页切换 */
  --d-scene:900ms;   /* 场景级 */
  --d-cinema:1600ms; /* 演出段 */

  --e-out:cubic-bezier(.16,1,.3,1);      /* 进入，快出慢停 */
  --e-in-out:cubic-bezier(.45,0,.25,1);  /* 双向 */
  --e-soft:cubic-bezier(.22,.8,.2,1);    /* 微交互 */
  --e-spring:cubic-bezier(.22,1.32,.36,1);/* 落印/弹入 */
}
/* framer 侧同一套数值导出为 TS 常量，避免两处漂移 */
```

`motion/transitions.ts` 导出 `spring.soft / spring.pop / tween.base / tween.page`，**所有 `transition` 必须引用它**，禁止内联裸数字。

### 5.3 五态组件契约

每个可交互件必须实现：`idle / hover / press / focus-visible / busy|disabled`。

| 态 | 表现 | 时长 |
| --- | --- | --- |
| hover | 亮度 +1.06，金线沿周长描一圈（`stroke-dashoffset` 或 `scaleX` 底线） | `--d-fast` |
| press | `translateY(1px)` + 内阴影加深 + 轻微 `scale(.985)` | `--d-tap` |
| focus | 2px 奶油金外环，offset 4px，**与 hover 可叠加** | 即时 |
| busy | `opacity .6` + 内嵌旋转弧（不用 spinner 图片） | 循环 |
| disabled | `opacity .38` + `saturate(.4)`，去 hover | 即时 |

### 5.4 reduced-motion 契约（三级降级）

`useReducedMotion()` → 全局 `<MotionConfig reducedMotion="user">`；GSAP 侧读同一信号走 `gsap.timeline({paused})` 的"跳帧模式"（直接 `seek(totalDuration)` 到终态，仅保留 ≤200ms 的淡变）。

**系统设置**（`prefers-reduced-motion`）与**游戏内开关**（设置页「减少动态效果」）取**或**关系：任一为真要降级。

### 5.5 与活动长卷的令牌对齐

`activity.css` 的 `--activity-jade/paper/gold/bronze/ease/fast` 改为**引用全局令牌**（`var(--jade-800)` 等），保留其变量名做别名以零改动兼容。活动页视觉本轮不动，只做取值对齐，避免同作两套金色。

---

## 6. 画质预设系统（低 / 高 / 极致）

### 6.1 设计要点

- 三档预设 + **每项可单独覆盖**（覆盖后该行标记"自定义"，整页预设显示"自定义"）——与参考图 2 的交互一致。
- 预设是**下游参数的命名组合**，不是散落开关：

```ts
type QualityPreset = 'low' | 'high' | 'ultra' | 'custom';
interface QualitySpec {
  pixelDensity: 1 | 1.25 | 1.5;      // p5
  fogFps: 24 | 30 | 30;
  lightFps: 30 | 45 | 60;
  leafCount: 6 | 14 | 21;
  moteCount: 10 | 28 | 44;
  inkLayers: 0 | 1 | 2;              // 云雾层数
  backdropBlur: 0 | 6 | 10;          // 面板毛玻璃
  inkRevealFidelity: 'simple' | 'full' | 'full';  // 墨散：简单淡出 / 完整湍流
  cssAmbient: false | true | true;   // HUD 呼吸 + 纸面微尘
  dropShadows: 'flat' | 'soft' | 'rich';
}
```

### 6.2 三档对照

| 参数 | 低 | 高 | 极致 |
| --- | --- | --- | --- |
| p5 像素密度 | 1.0 | 1.25 | 1.5 |
| 雾/光层帧率 | 24 / 30 | 30 / 45 | 30 / 60 |
| 落叶 / 微光 | 6 / 10 | 14 / 28 | 21 / 44 |
| 分区云纹层数 | 0（纯色 + 边框） | 1 | 2（叠加湍流位移） |
| 墨散解锁动画 | 淡出 320ms | 完整（1.4s） | 完整 + 附加墨点飞溅/纸纤维抖动 |
| 面板毛玻璃 | 关（纯色） | 6px | 10px + 内发光 |
| HUD 呼吸 / 纸尘 | 关 | 开 | 开 |
| 阴影 | 平涂 | 柔 | 多层（drop-shadow ×2） |
| 目标帧率（844×390） | ≥28 | ≥30 | ≥30（不强求 60） |

### 6.3 自动降级（默认开，**必须可关闭**）

- 首帧起 5s 采样 `requestAnimationFrame`，平均 < 26fps 且预设为"高/极致" → **静默降一档**并在播报层提示一次「已为你切换到流畅模式，可在设置中改回」。
- **开关：`settings.autoDegrade`（默认 `true`）**，位置在设置页「图像」分类底部：

  ```text
  [自动降级             ● ]   临时卡顿时自动降低画质
  ```

- **关闭时的行为（关键语义）**：
  1. 不采样、不降档、不提示——用户选的档位就是最终档位；
  2. 关闭后**不会**回滚已经发生的降级（避免"开关一拨画面突变"），需要用户在预设行手动改回；
  3. 降级发生时（开关开着）**记录 `degradedFrom`**，设置页在该行显示「曾因性能降级 · 点此恢复原档」，用户可一键回到原档位。
- 语义理由：临时资源不足（后台更新、其他标签页占满、热节流）不应演变成**永久的视觉效果降级**。这个开关把决定权还给用户。
- `document.hidden`、竖屏、`activePanel` 打开时统一 `paused`（现有行为，保持）。

### 6.3.1 采样器实现约束

```ts
// app/stores/useSettings.ts 内部
// 只在 autoDegrade === true 且 preset 为 high|ultra 时启动采样器
// 采样窗口：首次进入后 5s；此后每 30s 复采一次（用户可能切后台再回来）
// 触发降档需连续两个窗口 < 26fps，避免一次掉帧就降
// 降档后在 settings 里写 degradedFrom: 'ultra' | 'high'
```

- 采样器必须能**被完全停用**（`autoDegrade=false` 时不注册任何 `requestAnimationFrame` 计时逻辑，不留后台开销）。

### 6.4 存档 schema v3 与云端白名单（**必须改的真契约**）

```ts
// types.ts
export type ExplorationState = {
  version: 3;
  discoveredIds: string[];
  unlockedRegionIds: string[];
  playerUV: UV;
  settings: {
    music: boolean; volume: number; track: number;
    uiSound: boolean;
    reducedMotion: boolean;
    reduceFlash: boolean;              // 减少强闪光（光敏防护）
    qualityPreset: 'low'|'high'|'ultra'|'custom';
    qualityOverrides: Partial<QualitySpec>;  // 自定义覆盖项
    autoDegrade: boolean;              // 自动降级开关，默认 true（见 6.3）
    degradedFrom: 'high'|'ultra'|null; // 被动降级的来源档位，供"恢复原档"用
    hudScale: 0.9 | 1 | 1.12;          // UI 缩放
  };
};
```

迁移规则（`state.ts` + `account.ts` 两处都要改，否则云端会吞字段）：

| 来源 | 行为 |
| --- | --- |
| v2 本地存档 | 补默认值升级为 v3，**保留** `discoveredIds` |
| v1 存档 | 维持现状（只迁设置，不计打卡） |
| v3 云端 | `sanitizeCloudState` 加白名单：未知 `qualityPreset` 回 'high'，`qualityOverrides` 逐键校验类型与取值范围，`hudScale` 限三选一 |
| 服务端 SQLite | `store.mjs` 无 schema 变更（state 是 JSON blob），但**需要一次 `sanitizeProgress` 兼容测试** |

> 注意：这是**唯一会碰服务端契约的部分**。计划上把它单列为 P2 的验收门禁，不与 UI 混提。

---

## 7. 个人菜单（派蒙式）

### 7.1 布局（参考图 1 的骨架，视觉换成本作语言）

```text
┌───────────────────────────────────────────────────────────────────┐
│ ←返回                                                             │
│ ┌─────────────────────────────┐                                   │
│ │ 头像(菱形框)  昵称          │         （背景：地图虚化 + 云纹）   │
│ │              签名(可空)      │                                   │
│ │ 冒险等阶 58   ▓▓▓▓░ 探索度   │                                   │
│ │ UID · 学号   校区/季节       │                                   │
│ └─────────────────────────────┘                                   │
│ ┌──┬──────────────────────────────────────────────────────────┐   │
│ │📜│ ┌────────┐┌────────┐┌────────┐┌────────┐                │   │
│ │🗺│ │收集图鉴│ │活动一览│ │  设置  │ │  档案  │                │   │
│ │⚙│ └────────┘└────────┘└────────┘└────────┘                │   │
│ │🏆│ ┌────────┐┌────────┐┌────────┐┌────────┐                │   │
│ │📖│ │  足迹  │ │  成就  │ │  小故事│ │  关于  │                │   │
│ │ │ └────────┘└────────┘└────────┘└────────┘                │   │
│ └──┴──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

- **左功能栏**（竖排，48×48 命中 + 图标）：卷轴(活动) / 地图(回图) / 齿轮(设置) / 奖章(成就) / 书(图鉴)。**当前页高亮为"玉底 + 金角"**，hover 时图标轻抬 2px。
- **上信息卡**：头像用菱形框（复用 `.modal-emblem` 的 45° 语言）；昵称用 `--font-display`；**"冒险等阶"改为本作的"寻踪阶"**（由探索度换算，纯展示，不入存档）；进度条复用探索环的弧色，横向版。
- **下宫格**：4 列自适应（`repeat(4, minmax(0,1fr))`），每格 = 纸底 + 玉色图标 + 名称 + 右下角"提示点"（新内容红点，参考图里的红色小点）。**宫格由配置数组驱动**（7.4），UI 不写死入口。
- 移动横屏：宫格变 **3 列 × 2 行**并允许纵向滚动；左栏变**底部横向条**（拇指热区）。

### 7.2 与现有功能的关系

| 现有 | 新去处 |
| --- | --- |
| `profile` 弹窗（含设置） | **拆两页**：菜单页（个人信息）/ 设置页（参数） |
| `collection` 弹窗 | 保留为弹窗，但从菜单宫格与操作坞**双入口**进入 |
| `activity` 长卷 | 不变，从宫格与操作坞进入 |
| 「重置进度」「全屏」「退出登录」 | 全部迁入设置页（"账户 / 数据"分类），菜单页只做跳转 |

### 7.3 动效

- **进入**：地图 `scale(1)→1.04` + `blur(0→6px)`（`--d-slow`），菜单纸面从左侧 `translateX(-6%)` 滑入并 `clip-path` 展开；宫格项 `stagger 40ms` 逐格淡入上浮。
- **切页**：功能栏高亮块用 framer `layoutId="rail-active"` 平滑迁移；内容区 `AnimatePresence mode="wait"` + 横向 12px 位移。
- **返回**：反向 220ms，地图 `blur` 归零。

### 7.4 入口配置（不硬编码）

```ts
// content/menu.ts
export const MENU_ENTRIES = [
  { id:'collection', label:'收集图鉴', icon:'chest', badge:()=>unseenCount(), to:{route:'collection'} },
  { id:'activities', label:'活动一览', icon:'scroll', badge:()=>newEventCount(), to:{route:'activities'} },
  { id:'settings',   label:'设置',     icon:'settings', to:{route:'settings'} },
  { id:'archive',    label:'旅途档案', icon:'book', enabled:false, hint:'即将开放' },
  { id:'achievements', label:'寻踪成就', icon:'star', enabled:false, hint:'即将开放' },
  { id:'stories',    label:'地标小故事', icon:'leaf', enabled:false, hint:'随打卡点解锁' },
  { id:'about',      label:'关于',     icon:'scroll', to:{route:'about'} },
] as const;
```
> 未开放的入口**显式置 `enabled:false`** 并显示"即将开放"，不放假入口（与现有"不显示虚构任务/在线人数"的约定一致）。

---

## 8. 设置页

### 8.1 布局（参考图 2）

```text
┌──────────────────────────────────────────────────────────────┐
│ ⚙ 设置 / 图像                                          ✕      │
│                                                              │
│  ◆ 控制       图像                                           │
│  ◆ 按键       [画面预设        低 ▾ ]  ← 长条行（1200×56）    │
│  ◈ 图像       [渲染精度        高 ▾ ]                        │
│  ◆ 声音       [特效质量        高 ▾ ]                        │
│  ◆ 消息       [动态模糊        开 ▾ ]                        │
│  ◆ 账户       ── 自定义 ─────────────────────────────        │
│  ◆ 数据       [帧率上限        60 ▾ ]                        │
│  ◆ 其他       [减少动态效果     ● ]                          │
│                                                              │
│                              [恢复默认]  [应用并返回]         │
└──────────────────────────────────────────────────────────────┘
```
- 左侧分类竖向，选中项**菱形 + 金色高亮 + 一条扫光**（参考图 2 的 `◈ 图像` 态）。
- 右侧每行是**宣纸长条**：左侧标签，右侧当前值 + 下拉箭头；`hover` 时金色描边 + 值文字微亮。下拉用 Radix `Select`（自绘，弹层为深玉卡片 + 选中行勾选）。
- 右侧滚动条细金线（参考图 2 右缘那根），`::-webkit-scrollbar` 自绘。
- 底部固定操作条，"应用"是唯一赭金主按钮。

### 8.2 分类与条目（全部落到真实可调项，避免假开关）

| 分类 | 条目 | 类型 | 落点 |
| --- | --- | --- | --- |
| **控制** | 拖动灵敏度 / 缩放倍率上限 / 双击缩放倍率 | 滑条 | `MapScene` 常量改为可配置 |
| **按键** | 快捷键总览（只读表）、重置为默认 | 表格 | 新增热键系统 |
| **图像** | **画面预设（低/高/极致/自定义）**、渲染精度、特效质量、云雾层数、减少动态效果、减少强闪光 | 下拉/开关 | `QualitySpec` |
| **声音** | 音乐开关、曲目、音量、**界面音效开关** | 开关/下拉/滑条 | `useAudio` + 新 `ui-sfx` |
| **消息** | 播报停留时长、是否播放恭喜演出、红点提示 | 下拉/开关 | `useUi` |
| **账户** | 昵称、学号、UID（只读）、退出登录 | 只读+按钮 | 现有 `account` |
| **数据** | 清空本机存档、**重置探索进度**（二次确认）、导出存档 JSON | 按钮 | 现有 `reset` |
| **其他** | 语言（预留，当前仅中文）、关于/许可、版本号 | 只读 | — |

### 8.3 交互细节

- **改预设即为即时预览**：切换"低/高/极致"立刻看到背景云雾/毛玻璃变化，无需"应用"（"应用"只负责落盘 + 关闭）。
- 单改某项 → 该行出现"◇ 已自定义"小标记，预设行显示"自定义"。
- 底部"恢复默认"需二次确认（复用现有 `resetArmed` 的两段式，不要弹窗套弹窗）。
- **字体**：删除 `system-ui`，全页 `--font-ui`；数值用 `font-variant-numeric: tabular-nums` 防跳动。

---

## 9. 分区遮罩（水墨云纹）与解锁动画

### 9.1 这是本轮最大的一块新架构

现有地图是**一张完整位图**，没有任何分区几何（见 1.1）。要实现"某片区被水墨遮住、解锁后墨散"，必须先引入**分区数据契约**。

### 9.2 分区数据契约（`content/regions.ts` + `regions.json`）

```jsonc
{
  "schema_version": 1,
  "map_id": "campus-v04-eaa124716c51375f",
  "regions": [
    {
      "id": "beihu",
      "name": "北湖",
      "subtitle": "湖光拾忆",
      // 多边形：画布 UV 坐标（u/v ∈ [0,1]，与地标同一套 UV，禁止像素坐标）
      "polygon": [[0.12,0.18],[0.34,0.15],[0.38,0.42],[0.16,0.46]],
      // 可选：更精细的遮罩贴图（相对 public/），存在时优先
      "maskImage": null,
      "unlock": { "type": "landmark", "landmarkId": "beihu" },
      "revealOrder": 1,
      "meta": { "progress": 7, "accent": "lake" }
    }
  ]
}
```

**已有可复用的锚点（本轮新发现，直接省一半工作量）**：`src/location/data/selected_model.json` 里已有一份 `support_polygon_uv` —— **7 个顶点的 UV 多边形**，是 WGS84 标定模型的"有效覆盖范围"：

```text
[0.1757,0.6095] [0.3281,0.2624] [0.4560,0.2628] [0.5294,0.3198]
[0.5290,0.3764] [0.2321,0.7246] [0.1775,0.7254]
```

它的意义是：
1. **它就是"校园实际覆盖区"的现成外轮廓** —— 可作为所有分区 polygon 的**父边界**（每个分区必须落在它内部）。范围之外本来就没有标定，用云纹盖住反而语义正确。
2. `src/location/vendor/model-transform.mjs` 已有 `supportXY()`，是一份**可用的点在多边形内判定**实现（含距离与软权重），`verify-regions.mjs` 与 `region-author.html` 可直接复用，不必新写几何工具。

> 因此第 9 节的实现顺序建议微调：先画 1 个覆盖 `support_polygon_uv` 的"整幅未解锁"遮罩（最小可用形态），再往里切分区。这样即使分区内容没定，**地图也已经能表现出"整片迷雾待开启"**。

**约束（写进文档、写进校验脚本）**：
- 坐标**只用 `{u,v}`**，与 `ASSETS.md` 的坐标契约一致，缩放/裁切不影响含义。
- `polygon` 至少 3 点多边形，允许凹多边形（用 `fill-rule: evenodd`）。
- `id` 必须与 `LANDMARKS[].regionId` 的取值域一致；未定义的 `regionId` 视为"无分区"（永远可见，兜底不阻塞）。
- `maskImage` 若存在，优先于 polygon，作为更高精度的艺术遮罩。

### 9.3 渲染方案（为什么这么选）

| 方案 | 评价 |
| --- | --- |
| A. SVG `clipPath` 挖洞 + 上层水墨贴图 | **选它**。分区是静态几何，SVG mask 一次写好，缩放随相机 `transform` 走，无重绘成本；水墨纹理作为 `pattern`/`<image>` 填充 |
| B. Canvas/WebGL 着色器 | 过度设计；要维护 GL 上下文与降级路径 |
| C. DOM 覆盖块 + `clip-path: polygon()` | 可行但每分区一个元素、边角羽化难做 |

**结构**：

```text
<MapScene>
  <MapImage/>                       ← 底图（不受影响）
  <RegionVeil>                       ← 新增图层，z-index 在底图之上、地标之下
    <svg viewBox="0 0 4000 4958" preserveAspectRatio="none">
      <defs>
        <filter id="ink-displace">…feTurbulence + feDisplacementMap…</filter>
        <pattern/gradient 云纹>
      </defs>
      {unlocked 之外的每个分区 → <path d=… fill=url(#ink) filter=url(#ink-displace)/>}
    </svg>
  </RegionVeil>
  <Markers/>  ← 地标层
</MapScene>
```

**未解锁态视觉（对应参考图 3）**：
- 填充：宣纸白 `.96` 底 + 双层云纹（`bezier` 长弧）+ 极淡墨色堆叠，**中心留白更多、边缘更浓**（像未展开的画卷）。
- 边界：1px 淡墨描边 + 8px 内侧羽化（`feGaussianBlur`），避免硬切出现"贴纸感"。
- 上叠一枚**玺印式"未启"小章**（`opacity .5`）+ 片区名（书法、半透明），让玩家知道"这里有什么，但还没开"。
- 分片之间**允许重叠**（视觉上像同一张纸的多处卷起），但不能遮住已解锁分区的边缘 24px，避免出现"漏光缝"。

**已解锁的片区**：完全不渲染（不是 `opacity:0`，是 `display:none`），保证零开销。

### 9.4 解锁动画（GSAP 时间轴，可 seek）

```ts
// 总时长 1400ms（极致）/ 900ms（高）/ 320ms（低，纯淡出）
const tl = gsap.timeline({ paused:true });
tl.to(veilPath, { '--ink-dissolve': 1, duration: .9, ease: 'power2.inOut' }, 0)
  .to(veilPath, { filter: 'url(#ink-displace-boil)', duration: .9 }, 0)
  .to(sealEl,   { scale: 1.4, opacity: 0, rotate: 12, duration: .5, ease: 'back.in' }, .1)
  .to(inkDots,  { opacity: 0, y: -18, stagger: .04, duration: .6 }, .25)
  .fromTo(unlockedMask, { attr:{ 'stroke-dashoffset': 1 }, }, { attr:{ 'stroke-dashoffset': 0 }, duration: .8 }, .3)
  .add(() => announce('北湖 已启'), .8);
```

- `--ink-dissolve` 驱动的实现：SVG `mask` 里放一张**阈值渐变**（`feComponentTransfer` 的 `type="discrete"` 配合 `feOffset`），或更简单稳妥地用 `mask-image: radial-gradient` + `CSS mask-composite` 的多层擦除；**具体实现留给 P4a 的 PoC 定夺**（计划里给出验收标准，不锁死实现）。
- 解锁顺序建议：**由玩家当前位置向外**（用距离排序），或按 `revealOrder`，两者取配置；默认按 `revealOrder`。

### 9.5 分区授权工具（没有它就做不了内容）

新增 `scripts/region-author.html`（本地静态页，**不发版**）：
1. 载入 `campus_no_labels.webp`，按 `view_box` 显示；
2. 鼠标点击描多边形，实时显示 `{u,v}` 顶点；
3. 输入 `id / name / unlock`，导出 `regions.json` 片段；
4. 侧栏显示"哪些地标的 UV 落在此多边形内"（点-多边形包含测试），**用于自检分区是否漏掉地标**。

验收：作者的产物经 `node scripts/verify-regions.mjs` 校验（id 合法、顶点 ∈ [0,1]、每个 `LANDMARKS[].regionId` 都至少被一个 polygon 覆盖、多边形不自交）。

---

## 10. 打卡 / 解锁全屏演出（Cinematic）

### 10.1 内容未定，所以先做"模板 + 插槽"

演出分两型，共用一个组件外壳：

| 型 | 触发 | 主体 |
| --- | --- | --- |
| **Landmark** | 打卡成功 | 该地标的手绘插画 + 名称 + 小故事 |
| **Region** | 片区解锁 | 该片区的插画 + 片区名 + 一句引言 |

### 10.2 版面（16:9 与 21:9 都成立）

```text
┌──────────────────────────────────────────────────────────────┐
│  CHAPTER · 卷一                        （右上：探索度 +N%）    │
│                                                              │
│   ┌────────────────────────┐    ┌──────────────────────┐      │
│   │                        │    │  北  湖               │      │
│   │   手绘插画（16:9 容器） │    │  ── 湖光拾忆 ──      │      │
│   │   ken-burns 缓慢推近    │    │  「风过湖心…」        │      │
│   │                        │    │  小故事正文（2–4 行） │      │
│   └────────────────────────┘    │  [继续探索]          │      │
│                                 └──────────────────────┘      │
│  ────── 金线由左向右延伸 ──────   （底部：纸浪前景）           │
└──────────────────────────────────────────────────────────────┘
```

### 10.3 素材插槽与占位兜底（关键：内容没定也能先做完）

```ts
interface LandmarkStory {
  id: string;
  name: string;
  subtitle: string;
  chapter: string;          // '卷一 · 湖光'
  story: string[];          // 段落数组
  verse: string;            // 一句题词（已有字段，沿用）
  art?: {                   // 全部可选
    hero?: string;          // '/assets/landmarks/beihu/hero.webp' 1920×1080
    thumb?: string;         // 列表缩略图 480×270
    palette?: [string,string,string]; // 插画主色，用于没图时的程序化兜底
  };
}
```

**兜底规则（三级）**：
1. 有 `hero` → 直接显示；
2. 无 `hero` → **程序化生成"剪纸山水"占位图**（SVG：远山三层 + 日月 + 云带，配色取 `palette` 或默认玉绿）。这层必须做，否则内容未定期间演出是空框；
3. 连 `palette` 也无 → 纯纸纹 + 印章底纹。

> 约定素材路径 `public/assets/landmarks/<id>/{hero,thumb}.webp`，**与文案一起放进 `content/landmarks.ts`**；内容同学只需丢图 + 填 JSON，前端零改动。

### 10.4 时间轴（GSAP，总 5.2s，可跳过）

| 时刻 | 事件 |
| --- | --- |
| 0–320ms | 画面压暗 + 纸浪自下而上覆盖（`clip-path` 或 `scaleY`） |
| 240ms | 印章从 1.8 落至 1（`back.out`），伴随一次纸面凹陷阴影 |
| 320–900ms | 插画容器 `clip-path` 自中展开；图内 ken-burns 起（8s 线性，超出演出时长，靠"继续"才停） |
| 600ms | 章节号与地标名逐字淡入（framer `staggerChildren .05`） |
| 900ms | 金线自左向右画满（`scaleX 0→1`），下方正文逐行错峰淡入 |
| 1300ms | 右上"探索度 +N%"数字滚动（复用进度环的同一函数） |
| 全程 | 底部一行小字提示「点击任意处继续 / Esc 跳过」 |
| 退出 | 反向 420ms；返回地图时把探索环与收录数**同步补间到新值**（不要瞬间跳） |

- **可跳过**：任意点击/Esc/`Space` → `tl.seek(totalDuration)` 后立即走退出，**跳过不改变数据**（数据在演出开始前已提交）。
- **reduced-motion**：跳过 ken-burns 与逐字，只保留淡入；总时长 ≤1.2s。
- **音频**：落印音 + 一次"翻页"；受 `uiSound` 开关控制。

### 10.5 与现有发现事件的关系

现有 `MapScene` 的玩家行进 + `Atmosphere` 的云擦除/环形流光（3.2s 四段式）**保留**，改为演出的"前奏（Pre-roll）"：

```text
打卡点击 → 位置校验 → 提交状态
   → Pre-roll（3.2s，现有地图内演出）
   → Curtain（320ms 压暗）
   → Cinematic（5.2s 全屏演出）
   → 返回地图（进度环补间到新值）
```

若"消息"分类里关闭"播放恭喜演出"，则 Pre-roll 后直接回到地图 + 播报，不进入 Cinematic。

---

## 11. 实施路线（替代 V1 第 6 节）

**总工期约 22–26 人日**（含 PoC 与内容工具，不含美术产出）。

| 阶段 | 内容 | 产出/门禁 | 人日 |
| --- | --- | --- | --- |
| **P0 清场** | 删 `hud.css` 560–1012 死样式与 `.is-scroll`；删 `map.css` 3 个死类；`dist` 去 TTF 与重复地图；修 `ASSETS.md` 字数字节 | 前后逐像素无差异；`dist` 28.1→≈18 MB；85 项测试全绿 | 0.5 |
| **P1 地基** | `tokens.css` + `base.css`；装 framer-motion 14 / GSAP 3.15 / Radix / Zustand 5；建 `app/` 目录与 4 个 store；`App.tsx` 瘦身；vite 分包 | 首屏 JS ≤ 600 KB gzip；`data-testid` 枚举无缺失 | 3 |
| **P2 契约** | 存档 v3 + `sanitizeCloudState` 白名单 + 迁移测试；`QualitySpec` 落地 | v2→v3→云端往返不丢字段（新增单测 6 项） | 2 |
| **P3 HUD 骨架** | `HudFrame` 四锚；状态带/操作坞/上下文卡收拢-展开；地标避让求解 | 六档视口零交叠；对比度 ≥4.5:1 | 3 |
| **P4a 分区 PoC** | `RegionVeil` 渲染 + **先做覆盖 `support_polygon_uv` 的整幅未解锁遮罩**（最小可用），再做一条硬编码分区的墨散时间轴；**验证能否做出"水墨退去"的质感**与手机帧率 | PoC 视频 + 844×390 帧率实测（低/高两档）；决定 mask 实现方案 | 2 |
| **P4b 分区完整** | `regions.json` 契约 + 校验脚本 + `region-author.html`；多分区并行渲染；解锁触发与持久化 | 每片区可独立解锁；`verify-regions.mjs` 通过 | 2.5 |
| **P5 菜单页** | 派蒙式菜单（上信息 + 左栏 + 宫格）；入口配置化；动效 | 1440/844 两档截图；键盘全通路；未开放项有明确"即将开放" | 2.5 |
| **P6 设置页** | 8 分类 30+ 条目；预设 + 覆盖；即时预览；二次确认 | 每项都真实生效（表格逐项验证）；自定义态正确回显 | 3 |
| **P7 Cinematic** | 演出外壳 + 两级兜底插画 + 时间轴 + 跳过/降级 | 有图/无图两种内容都能跑；5.2s 与 ≤1.2s（reduced）两条路径 | 2 |
| **P8 收口** | 热键系统、`ui-sfx`、播报队列、自动降级、文档更新（SCENE/handoff/README/ASSETS） | 无鼠标可完成全流程；`prefers-reduced-motion` 全覆盖断言 | 2 |

**里程碑切分（可独立交付）**：
- **M1 = P0+P1+P2+P3**：HUD 换骨完成，观感已换代，其余功能不变（风险最低，建议先发）。
- **M2 = P4a+P4b**：分区迷雾 + 解锁动画（新玩法，需美术配合定分区）。
- **M3 = P5+P6**：菜单与设置（用户可感知的"系统感"）。
- **M4 = P7+P8**：演出与收口。

---

## 12. 验收矩阵（新增/修订部分）

### 12.1 布局与视觉

- 六档视口（1920×1080 / 1440×900 / 1280×720 / 1024×600 / 844×390 / 667×375）× 四态（地图/菜单/设置/演出）：HUD 区块两两交叠 = 0；地标标签被降级数量 ≤ 2。
- **色彩一致性**：全站不同 `#hex` 从 609 降到 **≤ 80**（令牌化后），同屏金色不超过 2 档；用脚本统计 `getComputedStyle` 去重。
- 文本对比度 ≥ 4.5:1、UI 边界 ≥ 3:1（含新菜单/设置/演出的全部小字）。

### 12.2 交互

- 五态覆盖：所有 `button/[role=button]` 具备 hover/press/focus/busy|disabled 的可观察差异（脚本抽样 20 个）。
- 键盘：无鼠标完成「进地图 → 开菜单 → 进设置 → 切预设 → 返回 → 选地标 → 打卡 → 演出 → 跳过 → 开图鉴 → 开活动」。
- 焦点：模态开启后焦点进入、循环、关闭后回到触发元素（现有能力，需在菜单/设置/演出三处都成立）。

### 12.3 分区与演出

- `verify-regions.mjs`：id 合法、顶点 ∈[0,1]、每个 `regionId` 有覆盖、无自交。
- 分区未解锁时，其 polygon 内**不出现任何可读地图片段**（用像素采样断言：该区域平均色接近宣纸色）。
- 解锁后该区域像素与底图一致（采样比对）。
- 演出：有图 / 无图（兜底 SVG）/ 关闭演出 三条路径均可完成"打卡 → 回到地图"且数据正确。

### 12.4 性能与画质

- 844×390 三档预设实测：低 ≥28fps、高 ≥30fps、极致 ≥30fps（`requestAnimationFrame` 采样 5s）。
- 首屏 JS gzip ≤ 600 KB；`dist/` ≤ 20 MB。
- 自动降级：人为把帧率压到 20fps 时，5s 内触发降档并播报一次。

### 12.5 契约与不回归

- `npm test` 9 文件 85 项 + 新增用例（v3 迁移 6 项、分区 4 项）全绿。
- `data-testid` 全量枚举与 P0 基线一致（**允许新增，不允许减少**）。
- `window.__LIYUN__` 接口保持（新增 `setPreset/regions` 亦须同步文档）。
- 存档键、`?qa=1&preset=fog|explored` 的 0% / 37% 不变；云端往返不丢字段。
- `npm run build`、`asset-manifest --check`、`verify-calibrated-map` 通过。

### 12.6 证据留存

`qa/ui-refactor-v2-YYYYMMDD/`：四态 × 六档截图、`measure.json`、`contrast.json`、`perf.json`（三档帧率）、`regions-check.json`、`motion.md`、`checks.json`。按 `docs/QA.md` 约定，**不作为已发布证据**，发布需另行授权。

---

## 13. 风险与取舍

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| **水墨遮罩做不出质感** | 参考图 3 的云纹是手绘/厚涂级别，纯 CSS/SVG 难还原 | P4a 先做 PoC，**两条路线并行**：① SVG `feTurbulence` 位移；② 美术产出一张全幅"未解锁云纹"贴图 + `mask` 挖洞（效果最稳，但需要美术）。PoC 结论决定走哪条，写进文档 |
| **动画库抢 transform** | GSAP 与 framer 同时写同一元素会抖 | 5.1 的分层铁律 + code review 检查项 |
| **演出时长劝退** | 每次打卡 8s+（前奏 3.2 + 演出 5.2） | 设置项"播放恭喜演出"可关；演出内任意点击可跳过；连续打卡自动缩短为"快速版"（2.4s） |
| **分区工具没人用** | polygon 手描精度低，易漏地标 | `region-author.html` 内置"地标是否落在多边形内"自检 + `verify-regions.mjs` 硬门禁 |
| **v3 存档破坏** | 白名单漏项导致云端回滚丢设置 | P2 单独验收 + 往返单测；上线前用真实账号做一次"改设置→退出→重登"验证 |
| **依赖膨胀** | 4 个新依赖 | 3.3 的预算是硬门禁；分包不达标不进入 P5 |
| **范围蔓延** | 本次已含菜单/设置/分区/演出四块 | 明确"本轮不做"清单（下） |

### 明确不做（本轮）

- 不改地图几何、UV 契约、WGS84 映射、打卡判定逻辑。
- 不重构活动长卷视觉（只做令牌别名对齐）。
- 不做 3D、不做角色立绘动画、不做多人。
- 不做多语言（设置里只保留占位）。
- 不改账号/服务端的表结构（仅白名单与迁移）。
- 不写真实内容（打卡点/故事/插画）：只交付**模板 + 占位 + 数据契约**。

---

## 14. 与既有文档的关系

| 文档 | 变更 |
| --- | --- |
| `docs/SCENE.md` | 图层表新增「分区遮罩层」「演出层」；事件表补 Pre-roll / Curtain / Cinematic 三段 |
| `docs/hud-handoff.md` | 重写为令牌 + 五态 + 动效分层 + 依赖清单 |
| `docs/ASSETS.md` | 修字数字节；新增 `regions.json`、`assets/landmarks/<id>/` 的素材规范 |
| `README.md` | 更新"当前内容范围"（菜单/设置/分区/演出）；启动命令新增依赖安装说明 |
| `docs/ACCOUNT.md` | 记录 v3 settings 白名单与迁移策略 |
| `docs/QA.md` | 引用本文件为验收入口；12.6 的证据目录登记 |
| `docs/creative-brief.md` | 不变（情绪命题与美术约束仍有效） |

---

## 15. 下一步（等确认即可开工）

1. **确认技术栈**（framer-motion + GSAP + Radix + Zustand）与分包预算。
2. **确认里程碑顺序**：建议先交付 **M1**（HUD 换骨，不改玩法），拿到观感后决定 M2 的分区质感方向。
3. **P4a 的 PoC 需要你拍板一件事**：水墨云纹走"纯程序生成"还是"美术出贴图 + mask"。前者零美术成本但质感有上限，后者效果最接近参考图 3 但需要美术资源。
4. 内容（打卡点/片区/故事/插画）在模板落地后随时可以进来，不阻塞开发。
