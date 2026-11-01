# 理韵墨苑 · 2026-10-31

本轮把用户提供的《理韵文化协会活动室.pdf》六页照片转成独立 Three.js/Vite 应用 `apps/liyun-moyuan`，并把入口接入 Win Web 桌面、开始菜单和项目索引。照片只是参考素材；原 PDF、人物和个人物品没有进入运行时资源。

## 代码与场景

- 房间使用照片比例估算的约 9.6 × 14.4 × 3.45 m 内部坐标。
- `room.js`：6087 个体素结构单元、43 个 InstancedMesh 批次；16 张课桌、16 折椅、11 组白柜、4 扇窗、月洞屏、紫幕、顶灯和暖气。
- `decor.js`：14850 个体素陈设单元、26 个 InstancedMesh；2 个博古架、25 件瓷器、6 盆植物、3 幅琴拓、2 把茶椅、3 套桌面笔墨、提篮和壁挂琴。
- `render.js`：世界坐标木纹/纸纤维 Shader、4096 阴影图、SSAO、低强度 Bloom、窗侧光束、确定性微尘、日光/夜读调色。
- 独立字体使用本地 OFL Noto Sans SC / Noto Serif SC 子集；409 个必需码点均覆盖，public 与 Vite `src/assets` 字节一致。

## 命令与结果

```text
node --test qa/workspace-api-tests.mjs                         7/7
node --test qa/node-tests.cjs qa/desktop-node-tests.cjs qa/voxel-shortcut-tests.cjs  通过
npm --prefix apps/liyun-moyuan run build                       通过
node tools/build-site.mjs --check dist-site                   通过
python apps/liyun-moyuan/tools/build-fonts.py --check         通过，409/409，0缺字
Vite preview 4182 `/liyun-moyuan/`：HTML、JS、CSS、两份哈希字体均返回 200
```

最终独立 Edge/SwiftShader 检查见 [browser-final4.json](browser-final4.json)：**19/19**。它真实加载本地 Vite 页面并验证 WebGL canvas、场景统计、全景/茶席/书案/帷幕视角、日夜光、精细开关、自动环顾、复原手记、Escape、390×844 竖屏、844×390 横屏工具栏和无运行时错误。最终截图包括 [全景](browser-final4-overview.png)、[茶席](browser-final4-tea.png)、[讲堂](browser-final4-stage.png) 与 [移动端](browser-final4-mobile.png)。

首次截图验收中保留了两次真实失败证据：一处是测试选择器把场景容器也当成视角按钮，另一处是软件 SwiftShader 截图超时；均已修正测试入口或延长专用截图超时，最终报告没有失败项。OpenCLI 当时没有连接浏览器扩展，因此使用项目已有的隔离 Edge/CDP 夹具；这不等同于物理手机 GPU、iOS Safari 或微信内置浏览器实测。

## 运行入口

开发端口为 `5181`，独立预览端口为 `4181`，构建 base 为 `/liyun-moyuan/`。统一启动器现在管理六项服务；集成证据见 [moyuan-integration-20261031](../moyuan-integration-20261031/QA.md)。本轮只完成本地代码、入口、构建和验收，未提交 PR、未部署树莓派。
