# V2 重构复核证据 · 2026-11-02

对应交付：[TODO.md](../../apps/liyun-explorer/TODO.md)。基线 `14a087b`，应用重构提交 `05b7e32`。本轮只审查，没有修改业务实现或发布。

## 文件

| 文件 | 内容 |
| --- | --- |
| `static-audit.mjs` / `static.json` | 可重跑的只读源码与产物审查；在独立 Node 内存中复现 custom 画质基底丢失、独立区域字段重算；调用现有 modelSupport 核对地标与采样 hull |
| `browser-audit.js` / `browser.json` | 注入固定 QA 页的 DOM 记录器与当次记录；截图视口变化时捕获布局 / 控件大小、焦点与页面状态 |
| `contrast.json` | 菜单 4 类正常小字的 computed color / font-size 与不透明纸色渐变两端对比度抽查 |
| `checks.json` | 本轮实际执行的代码、构建、素材检查结果与覆盖边界 |
| `shots/` | 当前 HUD；菜单 / 设置各 1440×900、844×390、667×375 |

## 重跑

在仓库根运行 `node qa/ui-refactor-audit-20261102/static-audit.mjs`。需要当前应用依赖与一次成功构建；脚本只写本目录的 `static.json`，不写源码或用户存档。基线对照固定为本轮重构提交的父版本，后续复用时应显式更新比较口径。

浏览器使用 OpenCLI 2.0.1 / Chrome 独立 session `liyun-refactor-audit`，入口仅 `http://127.0.0.1:5174/?qa=1&preset=explored`。将 `browser-audit.js` 文本传给 `opencli browser eval`，再通过页面控件切换菜单 / 设置；`window.__refactorAudit.capture(label)` 可追加快照。截图命令使用 `--width / --height` 暂时调整视口，resize 快照保留实际尺寸。

本轮关闭自动降级，仅改变固定 QA 页的运行时设置；没有操作用户账号、真实重置、清空或导出，也没有读取普通存档。账户 HTTP 回归仅使用临时合成账号 / SQLite。

## 证据边界

- OpenCLI 原生输入因窗口可见性检查未派发；本次页面交互使用 DOM 点击和合成 KeyboardEvent。Select 的 ArrowDown→Esc 层级复现已记录，不能据此宣称真键盘 / 手机已通过。
- `smallControls` 是当前 scope 内 button / role=slider 的 DOM 矩形；不直接把数量当成整个页面可访问性评分。844 菜单的关闭钮 40×40、5 个功能栏按钮 42×42 可直接核实。
- 下拉列表在 Radix Portal 内时，焦点不在 `.settings-screen` 后代是正常的；设置进入焦点缺失的结论来自 `settings-open-control`，不是来自 Portal 快照。
- 对比度只抽查菜单 4 类非禁用小字，不是全站 WCAG 审计。字号、颜色与渐变端点来自实际 computed style。
- CSS 609→485 是源码 hex 去重，不能当成运行时 computed-style 颜色数。
- 自动降级暂停逻辑为源码发现，尚无低帧率 / 隐藏页面注入测试；现有六档 HUD、帧率和完整生产预览记录仍在 `qa/hud-motion-20261102/`，本轮没有重跑它们。
- 截图 / JSON 是本地审查证据，不代表生产状态。
