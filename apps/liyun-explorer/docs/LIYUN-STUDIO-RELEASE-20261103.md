# 在线校园内容工坊 · 生产发布回执

已于 **2026-11-03 23:10:49（Asia/Shanghai）** 按所有者“同步、推送远端和树莓派”的明确授权发布。多人端完整验收按所有者要求由其手动完成，代理仅做构建门禁和上线基本确认。

| 项目 | 实际结果 |
| --- | --- |
| 工坊入口 | https://liyun.studentop.cn:14355/studio/ |
| 玩家入口 | https://liyun.studentop.cn:14355/ |
| 发布源码提交 | `d937a0780122c1114696b87b0a42f810522fc957`，已推送 `origin/main` |
| release | `liyun-studio-20261103T150729Z-96390a540a` |
| 玩家资源版本 | `c832d8ec9dd83e8df4f34da2` |
| 原始玩家构建 | 20,917,008 B，低于20MiB |
| 包装后玩家文件 | 20,919,492 B，低于20MiB；工坊独立构建 |
| 前端 / 账号 / 工坊 | 三个 `current` 指针均指向上述release |
| 服务 | `liyun-account.service` 与新增 `liyun-author.service` 健康 |

已提交本轮V2重构、生成占位素材、作者工具、协作服务、部署脚本、说明与证据。校园网恢复相关的原有修改和后续出现的 `_mooc/` 不在本次提交范围内。

上线确认：公网体检 **8 PASS / 0 FAIL**；隔离浏览器只查看受口令保护的加入页、玩家入口及游客地图，**4项通过、浏览器错误0**。玩家和工坊静态文件经树莓派本机TLS逐项校验；未登录读取团队草稿为401。原账号、会话、打卡和进度表数量保持一致；发布前SQLite备份及旧版本指针已保留。域名、证书、frp和其他项目未调整。

数据位置：私有草稿、会话与照片为 `/var/lib/liyun-author`（专用用户、私有权限）；公开发布配置为 `/var/lib/liyun-content/published.json`。新协作服务只监听回环8790，由现有同域nginx反代。协作口令在服务器私密文件中保存，维护者本机也单独保存交接副本，**没有进入Git、前端、公开包或发布日志**。

此次部署只初始化推荐草稿，**未代替团队发布草稿**。初始边界、点位和插画仍按推荐/概念占位处理。成员编辑会自动保存草稿；预览后明确确认发布，玩家刷新才读取新配置。实际操作见[团队指南](STUDIO-GUIDE.md)。

回滚点：前端此前为 `/opt/projects/liyun/releases/liyun-ui-20261103T120627Z-e3f0d3f42a`，账号此前为 `/opt/projects/liyun-api/releases/liyun-ui-20261103T120047Z-2da7680f86`。事务备份与回执在 `/var/lib/aiden-release-history/liyun-studio-20261103T150729Z-96390a540a`。团队开始发布新景点后，优先单独回退前端，保留支持新ID的账号白名单与协作数据；不要用发布前数据库覆盖后续写入。

证据：[事务回执](../../../qa/studio-collaboration-20261103/deployment.json)、[公网确认](../../../qa/studio-collaboration-20261103/preflight.txt)、[基础页面确认](../../../qa/studio-collaboration-20261103/production-smoke.json)。此前未完成的多人浏览器记录仍保留，不能与本次基本确认混为完整验收。
