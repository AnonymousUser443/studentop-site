# UI 重构验收证据（2026-11-02）

范围：**M1（HUD 换骨）+ M3（菜单页 / 设置页）**。不含 M2（分区水墨遮罩）与 M4（打卡全屏演出）。
计划：[UI-REFACTOR-PLAN-V2.md](../../apps/liyun-explorer/docs/UI-REFACTOR-PLAN-V2.md)；交接：[hud-handoff.md](../../apps/liyun-explorer/docs/hud-handoff.md)。

> 按 `docs/QA.md` 的约定：**本目录不构成"已发布"证据**。生产发布需另行授权并留发布记录。

## 执行环境

- 日期：2026-11-02（Asia/Shanghai）
- 入口：本地开发服务 `http://127.0.0.1:5174/?qa=1&preset=explored`（固定预设，隔离普通存档）
- 浏览器：headless Edge（`qa/lib.js` + CDP，仅回环，禁止公网请求）
- 视口：1920×1080 / 1440×900 / 1024×600 / 844×390 / 667×375

## 断言语义

`measure.json` 每行是一次 CDP 求值结果，`evalResult` 字段包含：

- `rects`：五类 HUD 区块的 `getBoundingClientRect()`
- `overlaps`：区块两两相交面积 >2px 的组合（应为空）
- `tooSmall`：`.hud-frame button` 中宽或高 <44px 的目标（应为空）
- `ok`：`overlaps` 与 `tooSmall` 都为空

脚本在求值返回 `ok: false` 时会以非零退出（`qa/lib.js` 的 `evaluation()` 主动抛错），
所以 `measure.json` 里出现 `"ok":false` 即代表该视口未通过。

## 结果

| 视口 | 区块交叠 | 触控目标 <44px | 结论 |
| --- | ---: | ---: | --- |
| 1920×1080 | 0 | 0 | PASS |
| 1440×900 | 0 | 0 | PASS |
| 1024×600 | 0 | 0 | PASS |
| 844×390 | 0 | 0 | PASS |
| 667×375 | 0 | 0 | PASS |

对照改造前（2026-11-02 审计，见 UI-REFACTOR-PLAN.md 第 2.1 节）：

- 844×390：罗盘与定位卡相撞 **57×34px**；两枚地标标签相撞 **6×37px**
- 1440×900：定位卡完整覆盖真理之塔标签 **159×58px**

## 截图

`shots/`

| 文件 | 内容 |
| --- | --- |
| `hud-1440x900.png` / `hud-844x390.png` | 新四锚 HUD（探索环在右下、操作坞左下、状态带右上） |
| `menu-1440x900.png` / `menu-844x390.png` | 派蒙式个人菜单 |
| `settings-1440x900.png` / `settings-844x390.png` | 设置页 |

## 代码侧验证（本地实跑）

| 检查 | 结果 |
| --- | --- |
| `npx tsc -b --noEmit` | 零错误 |
| `npm test` | 9 文件 / **88 项**全绿（含新增 v3 迁移 3 项） |
| `npm run build` | 成功；首屏 gzip ≈482 KB（React 100 + p5 269 + motion 53 + 主包 54 + 其他 5） |
| 分包 | menu / settings 独立 chunk，不进首屏 |
| 新样式表裸色 | 5 个样式表 **0 处** `#hex` |
| `hud.css` | 1012 → 499 行（纯删除 513 行死样式） |
| `map.css` | 46 → 42 行 |

## 未覆盖 / 需真人复验

- **真实设备触摸与手势**：本轮只有 headless 合成视口，未在真机验证双指缩放、安全区、横屏锁定。
- **`prefers-reduced-motion` 全量断言**：样式与 hook 已覆盖，但没有用 `document.getAnimations()` 做逐项断言。
- **对比度实测**：新组件沿用令牌（与原值一致），但菜单/设置/探索环三处新增文案**未重新跑 WCAG 计算**。
- **自动降级**：逻辑与开关已实现，但未在真实低帧率场景下验证"连续两个窗口 <26fps 才降档"。
- **键盘全通路**：热键已实现，未做完整"无鼠标完成全流程"走查。
