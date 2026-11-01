# 理韵墨苑生产验收 · 2026-11-01

受测生产源码为PR #15合并提交 `26c8ae3b428cb63e9c41b3cd57b6392f6a44d6f4`。应用与Win Web入口均已部署，主页版本为 `5cb9607d0ca3b8864064b935`。实际版本、回滚与部署过程见[发布记录](../../docs/MOYUAN-RELEASE-20261101.md)。

| 证据 | 实际结果 |
| --- | --- |
| [preflight.json](preflight.json) | 本地27/27、六服务7/7、构建/语法/打包通过；原场景19/19的渲染源码哈希一致 |
| [release-manifest.json](release-manifest.json) / [pi-receipt.json](pi-receipt.json) | 墨苑8文件、918460字节；服务器SHA-256和TLS/SNI检查通过，主页切换成功 |
| [public.json](public.json) | 公网24/24：精确字节、入口版本、308及404语义和相邻应用200 |
| [browser-production.json](browser-production.json) | 实际Chrome/OpenCLI17/17，控制台0错误 |
| [project-entry.json](project-entry.json) / [desktop-entry.json](desktop-entry.json) | 生产项目索引链接与点击正确；桌面、开始菜单和项目注册数据一致 |
| [pi-before.txt](pi-before.txt) / [pi-after.txt](pi-after.txt) | 邻站和认证版本指针保持原值，nginx/frpc/desktop-auth进程保持，定时器active，nginx语法通过 |

生产截图：[全景](production-overview.png)、[室内](production-interior.png)、[夜读](production-night.png)、[移动尺寸](production-mobile.png)。移动图是Chrome临时视口覆盖；未测试物理手机GPU、iOS或微信内置浏览器。

保留相同本地发布产物时，可运行 `node qa/moyuan-release-20261101/verify-public.mjs qa/<新的结果文件>.json` 做只读公网复验。浏览器脚本 `production-browser.ps1` 使用本次专属OpenCLI会话；重测应修改会话/截图目标并使用新的报告路径，不覆盖本轮证据。2026-10-31本地报告保留当时未部署的历史事实。
