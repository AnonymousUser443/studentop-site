# 手机开始菜单与搜索 · 2026-10-31

开发验收基线：`e8c17ff2d03cbb39ff85b042dfb1d9e7c401af9c` 加本次主页工作区改动。构建版本 `2d6f20fd4b6c2f6098f6db38` 随后已通过PR #13合并并部署；原始开发证据保留，生产验收见下文。

## 离线与构建

`before-node-tests.txt` 在修复前记录21项窗口/外壳测试，16通过、5失败，覆盖自动聚焦、触屏聚焦、键盘高度关闭、可视区域补偿和返回应用列表的问题。小型DOM夹具仅验证事件与焦点状态，不证明CSS布局或原生触摸。

`after-node-tests.txt` 为修复后的相关Node回归56/56：

```text
node --test --test-reporter=tap qa/node-tests.cjs qa/desktop-node-tests.cjs qa/window-overflow-tests.cjs qa/update-check-tests.cjs qa/voxel-shortcut-tests.cjs
```

全部 `site/assets/js/*.js` 逐个语法检查通过。`node tools/build-site.mjs --out .release-local/mobile-shell-20261031/site` 及对应 `--check` 通过，候选包含44份版本资源及3个HTML入口。日志中本机绝对工作区路径已替换为 `<workspace>`，测试事实、失败与计数保留。

## 浏览器

OpenCLI可连接，但隔离测试页被浏览器标记为hidden，原生点击因此被工具拒绝。最终使用项目自有Edge/CDP、全新临时档案及合成门禁服务；结束关闭本次Edge与其夹具。

```text
node qa/mobile-shell-20261031/browser.cjs --out qa/mobile-shell-20261031/<新的结果文件>.json
```

已有结果和同名前缀截图拒绝覆盖。首次[浏览器报告](browser-checks.json)79/79通过，截图人工复核发现网页结果SVG默认尺寸偏大；限定16px并增加断言后，[最终报告](browser-final.json) **83/83** 通过，包含实际受测源码SHA256和Edge版本。

- 四档手机视口：390×844、360×800、320×568、844×390。
- CDP实际触摸事件打开开始/搜索，容器取得焦点；显式点击输入框并插入中文后正确过滤。
- CDP真实调整布局视口高度模拟键盘弹出/收回；面板身份、输入值与焦点保留，底层应用保持打开，面板边界位于可用区域内。
- 保持布局844高，通过VisualViewport受控属性和resize/scroll事件分别模拟可视高度480及偏移60；实际浏览器CSS布局保持面板可见，撤销夹具后空间恢复。
- 返回已固定应用、宽度旋转关闭及Escape焦点恢复；桌面1440×900、1366×768仍自动聚焦和搜索。
- 无浏览器异常、失败HTTP或未取消网络错误。

最终截图已人工复核：[开始菜单](browser-final-mobile-start-no-keyboard.png)、[布局高度缩小](browser-final-layout-keyboard-search.png)、[可视区域缩小](browser-final-visual-keyboard-search.png)。

这些结果不等同于物理手机的系统输入法、iOS Safari或微信内置浏览器实测；未读取真实门禁答案或创建生产登录会话。

## 生产验收补记

发布基线 `dd8c91426ab25e183dc285cf8ed3ac36b0403090`，主页current指向 `/opt/win11-home/releases/20261031T074956Z`。发布脚本自检成功，[公网检查](public-results.json)于2026-10-31 15:53（北京时间）67/67通过，覆盖三个HTML入口、44份版本资源字节、TLS、邻站页面和API、门禁配置、监控匿名401、构建索引403与旧资源兼容。

只读重跑入口（默认拒绝覆盖已有报告）：

```text
node qa/mobile-shell-20261031/public-check.mjs <该版本构建目录> <新的报告.json>
```

部署摘要见[deployment.json](deployment.json)，发布指针与服务状态见[post-state.json](post-state.json)。本轮只切换主页版本，保留上一release；生产验收不增加真机输入法覆盖范围。
