# 项目文档索引

日常从[根目录启动说明](../README.md)、[应用目录](../apps/README.md)和[贡献流程](../CONTRIBUTING.md)进入。源码、公开资源、验收证据与部署工具分别维护，应用自己的设计和接口文档保留在对应 `apps/<应用>/docs/` 或应用 README。

| 主题 | 入口 |
| --- | --- |
| 听潮 | [应用与接口](../apps/aidenos-music/README.md)、[实施记录](tingchao/PROGRESS.md)、[验收](tingchao/QA-20261116.md)、[2026-11-16 发布收据](tingchao/RELEASE-20261116.md) |
| 音乐踩点工作站 | [用法、存档迁移与验收](MUSIC-WORKSTATION.md) |
| 理韵寻踪 | [工程说明](../apps/liyun-explorer/README.md)、[2026-11-16 Git 收口](../apps/liyun-explorer/docs/SYNC-20261116.md)、[宣纸与性能复核](../apps/liyun-explorer/docs/performance-20261115/QA.md) |
| 桌面与本地开发 | [任务管理器](TASK-MANAGER.md)、[缓存与资源版本](CACHE-UPDATES.md)、[协作维护](COLLABORATION.md) |
| 测试与画面 | [QA 入口](../qa/README.md)、[旧桌面截图归档](../qa/archive/legacy-desktop/README.md) |
| 树莓派维护 | [部署说明](../deploy/README.md)、[项目维护手册](../deploy/PROJECTS.md)、[发布权限](../DEPLOYMENT-POLICY.md) |

## 本机目录

`.local/` 只放本机资料，`.tmp/` 放临时验收及隔离工作区，`.release-local/` 放发布暂存与本机收据，`dist-site/` 为可重建产物；以上均由 Git 忽略。2026-11-16 已将原根目录 `_mooc/` 的完整资料归档到 `.local/coursework/mooc/`，逐文件路径、大小和 SHA256 校验一致。本机归档不进入远端，也不供主站静态服务器访问。

公共启动器、应用名和发布资源路径保留现有位置。历史发布记录保留原日期和当时事实；Git 合并不表示再次部署。
