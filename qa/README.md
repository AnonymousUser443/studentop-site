# qa/ · 浏览器端到端验收

用 **Chrome DevTools Protocol** 驱动无头 Edge 跑真实浏览器检查：不引入 Playwright/Puppeteer，只依赖 `chrome-remote-interface`。

## 准备

```bash
npm i -g chrome-remote-interface      # 全局装一次即可
# 需要本机有 Edge：默认 C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe
```

## 脚本

| 脚本 | 作用 |
| --- | --- |
| `cdp.js` | 通用小工具：打开 URL → 等渲染 → 执行一段 JS → 截图。`node cdp.js --url U --out x.png --size 1680x959 --wait 2000 --eval "expr"` |
| `interact.js` | 主页 **29 项交互检查**（开始菜单/搜索/日历/窗口拖动缩放最小化/终端命令/设置/贴边/无横向滚动…），作为 `--eval-file` 传给 cdp.js |
| `locktest.js` | 锁屏解锁流程检查 |
| `shortcut-test.js` | 桌面**快捷方式真实双击**（CDP Input 事件，非 JS 模拟）：确认三个图标各自在新标签页打开正确站点 |
| `genshin-flow-test.js` | 开场端到端：`?skip=1` 直跳 + 完整流程（点开始 → 等门 → 点击开门 → 落到理韵寻踪），并输出每一步耗时 |

## 用法

```bash
# 主页 29 项检查
node cdp.js --url "https://studentop.cn:14355/?skipLock=1" --out shot.png \
  --size 1680x959 --wait 2200 --eval-file interact.js

# 三个桌面快捷方式
node shortcut-test.js                      # 默认打线上主页

# 开场端到端（先 --mode skip 快速验跳转，再 flow 验整条动画）
node genshin-flow-test.js --url "https://genshin.studentop.cn:14355/" --mode both
```

输出统一是 JSON：`{ ok, errors, evalResult }`，`errors` 里收集页面异常与 console.error，方便当 CI 断言用。

## 截图

`final-desktop.png` / `live-desktop-3.png`（主页）、`final-projects-window.png`（项目作品）、
`live-liyun.png` / `live-frost.png`（两个项目）、`genshin-1-login.png` / `genshin-2-door.png`（开场两幕）、`shot-projects-page.png`（/projects/ 索引页）。
