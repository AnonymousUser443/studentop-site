# HUD 令牌与动效交接（2026-11-02 重构后）

> 本文件替代 2026-10-28 版。旧版本描述的是"圆角胶囊 + 各自 absolute"的实现，已随 HUD 四锚重构废弃。
> 设计依据：[UI-REFACTOR-PLAN-V2.md](UI-REFACTOR-PLAN-V2.md)；审计数据见 [UI-REFACTOR-PLAN.md](UI-REFACTOR-PLAN.md)。

## 1. 唯一真值：令牌文件

所有样式**只消费 CSS 变量**，禁止裸 `#hex` / 裸毫秒 / 裸 px 圆角。

| 文件 | 作用 |
| --- | --- |
| `src/styles/tokens.css` | 色板、间距、字号、字形、层级、动效、阴影，以及语义别名 `--c-*` |
| `src/styles/quality.css` | 画质预设（`html[data-quality=low|high|ultra]`）覆盖的 `--q-*` 变量 |
| `src/styles/base.css` | reset、字体、全局焦点环、`.sr-only`、`.tabular` |
| `src/motion/transitions.ts` | framer-motion 的时长/缓动/预设，与 tokens.css 一一对应 |

**规则**：新增颜色先查 tokens 有没有近似值；没有才加，且必须同时加语义别名。禁止在组件 CSS 里写 `#f3e8c8` 这类字面值——重构后新增的 5 个样式表实测 0 处裸色。

### 关键令牌速查

```css
/* 间距 4 的倍数 */ --sp-1(4) --sp-2(8) --sp-3(12) --sp-4(16) --sp-5(24) --sp-6(32) --sp-7(48) --sp-8(64)
/* HUD 四边 */    --hud-gutter --hud-top --hud-bottom --hud-left --hud-right（已含 safe-area）
/* 色 */          --jade-950..400 --paper-50..500 --gold-200..600 --bronze-500 --ink-900..300
/* 语义 */        --c-bg --c-surface --c-on-jade --c-on-paper --c-accent --c-cta --c-border
/* 字号 */        --fs-caption --fs-body --fs-title --fs-head --fs-display
/* 字形 */        --font-display（书法，只给标题）--font-ui（正文）
/* 切角 */        --edge-cut-8 --edge-cut-12 --edge-cut-both（剪纸语言，替代圆角卡片）
/* 层级 */        --z-map(1) --z-veil(3) --z-markers(4) --z-hud(10) --z-context(12)
                  --z-panel(30) --z-toast(35) --z-entry(40) --z-menu(70) --z-settings(72) --z-cinematic(80)
/* 动效 */        --d-tap(90) --d-fast(160) --d-base(240) --d-slow(420) --d-scene(900) --d-cinema(1600)
                  --e-out --e-in-out --e-soft --e-spring
```

## 2. HUD 四锚骨架

`src/hud/HudFrame.tsx` 与 `hud-frame.css` **统一负责 HUD 区域的绝对定位**。子组件不再指定四角或视口坐标；SVG、圆环与按钮内部的装饰允许局部定位。

```tsx
<HudFrame
  brand={<Brand onOpenMenu={...} onCenter={...} />}
  status={<StatusBar ... />}
  dock={<ActionDock actions={[...]} />}
  progress={<ProgressRing ... />}
  context={...}   // 可选：右侧定位卡
  announce={...}  // 可选：中轴播报
  inert={...}
  compact={...}   // 面板打开时整体降到 0.56 透明
/>
```

四锚对应 `--hud-top/right/bottom/left`，移动端只改 `--hud-gutter` 一处，四个锚点全部跟随。

**实测（2026-11-02，`?qa=1&preset=explored`）**：

| 视口 | 区块交叠 | 触控目标 < 44px |
| --- | --- | --- |
| 1440×900 | 0 | 0 |
| 1024×600 | 0 | 0 |
| 844×390 | 0 | 0 |
| 667×375 | 0 | 0 |

> 重构前 844×390 存在罗盘与定位卡相撞 57×34px、两枚地标标签相撞 6×37px。

## 3. 五态契约

每个可交互件必须实现 `idle / hover / press / focus-visible / busy|disabled`：

| 态 | 表现 | 时长 |
| --- | --- | --- |
| hover | 亮度 +1.06～1.16，金描边或位移 -2px | `--d-fast` |
| press | `translateY(1px)` 或 `scale(.98)` | `--d-tap` |
| focus-visible | 2px `--gold-300` 外环，offset 4px；切角元素改用 inset 环 | 即时 |
| busy | opacity .6 + 内嵌旋转弧 | 循环 |
| disabled | opacity .38～.45 + 去 hover | 即时 |

全局焦点环在 `base.css`，组件不必重复实现——但**切角（clip-path）元素会裁掉 outline**，这类元素需自行用 `box-shadow: inset 0 0 0 2px var(--gold-300)` 补焦点环（见 `.menu-rail-button:focus-visible`）。

## 4. 动效分层（铁律）

| 场景 | 引擎 | 文件 |
| --- | --- | --- |
| 组件进出、布局重排、宫格错峰 | **framer-motion** | `src/motion/transitions.ts` |
| 多目标编排、需 seek/暂停 | **GSAP**（后续 P4/P7 使用） | 尚未接入 |
| 每帧高频、跟相机 | **p5 / Canvas** | `src/effects/Atmosphere.tsx` |
| 纯装饰循环 | **CSS animation** | 各组件 CSS |

**禁止**：GSAP 与 framer 同时写同一元素的 `transform`。跨引擎只通过容器层隔离——framer 管外层布局，GSAP 管内层时间轴。

所有 `transition` 必须引用 `tween.xxx` / `spring.xxx`，禁止内联 `{ duration: 0.24 }` 这类裸数字。

## 5. 画质预设与降级

```text
useSettings.settings.qualityPreset  →  'low' | 'high' | 'ultra' | 'custom'
useSettings.spec (QualitySpec)      →  实际渲染参数（预设 + qualityOverrides + 系统降级）
```

- `src/settings/spec.ts`：`QUALITY_PRESETS` / `resolveQuality()` / `detectPreset()` / `QUALITY_LABELS`
- 消费方：`Atmosphere` 读取 `spec.pixelDensity / fogFps / lightFps / leafCount / moteCount`（**不再读 `settings.quality`**）
- `settings.quality`（`'high'|'low'`）保留为**派生字段**，仅供遗留代码；由 `useSettings` 从 preset 自动映射

### 自动降级（`settings.autoDegrade`，默认开）

`src/app/useAutoDegrade.ts`：

- `autoDegrade === false` → **完全不注册 rAF 采样**，零后台开销
- 仅 `high`/`ultra` 生效；首窗 5s，之后每 30s
- **需连续两个窗口 < 26fps** 才降档（避免一次掉帧就降）
- 页面隐藏或 `paused` 时不计入采样
- 降档写入 `degradedFrom`，设置页显示「曾因性能自动降级 · 恢复原档」

> 语义：临时资源不足不应变成永久降质。开关关闭后用户选的档位就是最终档位。

## 6. 键盘热键

`src/app/useHotkeys.ts`，仅在「已进入 + 非竖屏 + 在地图路由 + 无弹窗」时生效：

| 键 | 行为 |
| --- | --- |
| A | 活动一览 |
| C | 收集图鉴 |
| M | 回到中心 |
| F | 全屏 |
| L | 定位到我 |
| Esc | 关闭（设置 → 菜单 → 地图，逐级返回） |

输入框内、带 Ctrl/Alt/Meta 时不触发。

## 7. 路由与页面

`App.tsx` 内的 `route` 状态（不引 react-router）：

```text
'map'      → 地图 + HUD
'menu'     → 派蒙式个人菜单（懒加载 src/menu/MenuScreen.tsx）
'settings' → 设置页（懒加载 src/settings/SettingsScreen.tsx，依赖 Radix）
```

两者都用 `React.lazy` + `Suspense`，**不进首屏包**。

## 8. 存档 schema v3

`liyun.exploration.v2` 键名不变，结构升级到 `version: 3`：

```ts
settings: {
  music, volume, track, reducedMotion, quality,   // 沿用
  qualityPreset: 'low'|'high'|'ultra'|'custom',  // 新增
  qualityOverrides: Partial<QualitySpec>,        // 新增
  autoDegrade: boolean,                          // 新增
  degradedFrom: 'high'|'ultra'|null,             // 新增
  uiSound: boolean, reduceFlash: boolean,        // 新增
  hudScale: 0.9|1|1.12,                          // 新增
}
```

**云端白名单必须同步**：`src/account.ts` 的 `sanitizeCloudState()` 逐字段声明；`account.test.ts` 断言了完整键集，漏字段会直接测试失败。

服务端 `server/progress.mjs` 兼容 v1/v2/v3，输出 v3；设置的递归白名单由 `shared/game-settings.mjs` 同时供 API 与浏览器使用。真实 HTTP 已验证 v3 保存、登出、重登后设置及打卡不丢失；SQLite schema 保持 2。未来发布须同时更新前端和 API，参见服务端 README。

## 9. 字体

Noto Serif SC（正文/UI）+ Ma Shan Zheng（书法标题），本地 WOFF2 子集，无外部请求。

- 实测字节：`NotoSerifSC-UI.woff2` = 327,384 B、`MaShanZheng-UI.woff2` = 316,300 B
- 改文案后须重跑 `scripts/fonts-build.ps1` 重新生成字符子集，否则出现豆腐块
- 字体声明已迁到 `src/styles/base.css`（原在 hud.css）

## 10. 已知未完成（M2 / M4 范围）

| 项 | 状态 |
| --- | --- |
| 分区水墨遮罩 + 解锁动画 | 未开始（M2） |
| 打卡全屏演出（Cinematic） | 未开始（M4） |
| 设置页「控制 / 消息 / 账户」部分条目 | 标「（开发中）」，仅本地 state |
| `about` 页面 | 菜单里有入口，暂时回到地图 |
| ui-sfx 界面音效 | 仅有开关，无实际音效 |

## 11. HUD 动效精调（2026-11-02）

本轮实现及证据见 [HUD 动效验收](../../../../qa/hud-motion-20261102/QA.md)。原 M1/M3 验收保留为历史快照。

- 四锚位置静止，内部 `hud-slot` 使用 420ms 进入、90ms 错峰；启程前 HUD 隐藏且 inert。
- `HudButton` 统一 hover/press；44px 级按钮增加到 46px，使 `.985` 按压缩放后仍超过 44px。切角按钮使用 inset 焦点环。按钮 transform 由 framer 独占。
- 探索环改为单个 MotionValue 同时驱动数值与圆弧，修正原 `0.9 / 1000` 的单位错误，取消第二层 CSS 圆弧过渡。持续更新从当前值续接；扫光只在增长时播放一次。
- `useMotionPreferences()` 将系统与游戏开关取或，并监听系统偏好实时变化。减少动态直接终态；低画质、减少闪光关闭 HUD 装饰；页面隐藏时暂停 CSS 装饰。
- 定位卡纳入 context 锚点；手机默认收拢。详情保留稳定 DOM/`aria-controls`，收拢后立即 inert；异常会自动展开。所有定位按钮保持 46px。
- `AnimatePresence` 处理面板进退场；退场时 inert，打开前保存焦点，关闭后归还。地图被面板、菜单或设置覆盖时暂停 Canvas 环境绘制。
- 设置从 store 单向写回 App 存档，修复设置页新值被旧存档覆盖的问题。菜单昵称、收录数与探索度读取实际状态。
- 地标文字与四锚、其他标签相撞时收起文字，菱形与经纬锚点保持不变。ResizeObserver 只观察 HUD 尺寸，测量与写入分批执行，不逐帧写 React state。
- `activity-entry` 与新 `dock-activities` 测试入口同时保留；播报以文本标识，修复等长文本复用 key 的问题。应用层目前仍采用最新一条提示策略，完整播报队列属于后续 P8。

构建另剔除源 TTF 与历史地图副本，保留源码资产、两份 OFL、当前标定 WebP/PNG；最终产物约 19.11 MiB，首屏 JS gzip 约 484 KiB。
