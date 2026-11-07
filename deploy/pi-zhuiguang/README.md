# 《追光者》发布与演讲

桌面保留「追光者 · 大屏」和「追光者 · 观众」。[提词器](https://studentop.cn:14355/zhuiguang/?role=presenter)授权后创建六位场次号，大屏和观众凭同一号码加入。大屏按 Q 投影当场二维码，手机可直接扫码加入。首次演出前让舞台预加载至「离线缓存已就绪」，再开始放映。

P8-19 谢幕后推进至 P8-20。观众可私发一封信，只有授权提词器能读正文。按需启用抽签。最后点击「结束本场」并确认，互动关闭，记录可由提词器在场次管理器查看。旧测试入口会跳转到同一场次入口。

## 发布

从 [演讲源码](../../apps/zhuiguang/) 执行 `npm ci`，设置 `PRESENTATION_BASE=/zhuiguang/` 和 `PRESENTATION_DIST=dist-pi`，再执行 `npm run build`。运行 `node scripts/package-pi.mjs <新暂存目录>`，随后从仓库执行 `pwsh -File deploy/deploy-zhuiguang.ps1 -PackageDirectory <同一目录>`。`-Check` 只生成本地包。首次配置或轮换口令时，`-CredentialDirectory` 可指向仓库外含有 `stage.env` 的私有目录。

发布事务校验媒体指纹、备份数据库、检查 nginx 配置、切换 release 并验证 HTTPS。探针失败会恢复上一版服务和路由。旧测试服务在新版通过验证后停止。

## 数据与维护

发布目录为 `/opt/projects/zhuiguang/releases/`。数据保存在 `/var/lib/zhuiguang/data`，场次总表是 `shows.sqlite`，留言、投票、抽签和页面进度按六位号放在 `rooms/` 下。原正式场数据归入「旧版演讲记录」。私密信只进入授权接口和 SQLite。每日备份位于 `/var/lib/zhuiguang/backups`，备份脚本验证完整性并保留最近 14 份。

公网验收包含三个角色入口、场次 WebSocket、媒体 HTTP Range 与离线播放。备份和演出服务日志可由站点维护者查看。
