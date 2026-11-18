# 音乐踩点工作站

入口：个人站 → **翻阅项目** → **音乐踩点工作站**（`/projects/music-workstation/`）。它是独立静态页，不需要登录，也不调用听潮的音乐服务。音频由浏览器在本机解码；不会上传音频、标记或文件名。

- **鼠标**：点按或拖动波形定位，`Shift` 拖动平移，`Ctrl` / `⌘` + 滚轮缩放。可拖动轨道中的标记，松手后只提交一次修改。
- **触屏**：点时间轴定位，横滑平移、双指捏合缩放，竖滑仍用于滚动页面。打点板可以直接点按，不需要键盘。
- **精修**：点标记或列表选中，按按钮前移/后移 10 ms，或用 `Alt` + `←` / `→`；同时按 `Shift` 可微调 1 ms。清空、移除轨道、导入替换和移动都可撤销。
- **存档**：本机暂存按文件名、大小、修改时间识别。要从原来的独立 HTML 或另一台设备迁移，请先导出 JSON，在本站载入同一音频后再导入。`mwtap-1` 旧文件仍可导入；新版 JSON 也包含自定义轨道。CSV 用于查看，不是无损备份。

## 开发与验收

```powershell
node tools/dev-workspace.mjs --site-only
# http://127.0.0.1:8899/projects/music-workstation/
node --test qa/music-workstation-model.test.mjs
node tools/build-site.mjs
node tools/build-site.mjs --check dist-site
node qa/music-workstation-browser.mjs --build dist-site
```

浏览器回归使用临时回环服务和隔离 Chromium 配置，生成 WAV 测试数据，覆盖桌面、390 px 触控模拟、错误恢复、暂存和导入导出，不使用个人文件。稳定视图中播放只更新播放头和时间，不重画静态波形。波形使用分时段计算的峰值缓存，长音频仍需完整解码，并受设备内存与浏览器音频格式支持限制。

该页由现有主站 `dist-site` 发布，包含版本化脚本与样式。无需增加 DNS、证书、nginx 路由或 Node 服务；按 `DEPLOYMENT-POLICY.md` 原子发布并核实页面的标题、指纹和浏览器交互。
