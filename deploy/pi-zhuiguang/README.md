# 《追光者》发布与演讲

桌面上的「追光者」会打开 [正式舞台](https://studentop.cn:14355/zhuiguang/?role=display&motion=on)。
[提词器](https://studentop.cn:14355/zhuiguang/?role=presenter)与[观众端](https://studentop.cn:14355/zhuiguang/?role=audience)共用同场状态。

首次在演讲电脑打开舞台时保持联网，等到显示「离线缓存已就绪」。输入正式口令，按空格开始，方向键翻页，V 播放或暂停影片，F 全屏。缓存跨次保留，联网重新打开舞台时按 SHA-256 更新变更文件。离线期间由本机放映与操作，观众端和提词器的实时同步及投递需保持联网。舞台离线准备只覆盖演讲路径。

P8-19 掌声结束后手动推进到 P8-20，私信默认开放 30 分钟。提词器停在该页并授权即可查看。正式口令仅保存在树莓派，所有者可用 `ssh biteraiden-pi 'sudo -n cat /etc/zhuiguang/stage.env'` 查看。

## 所有者发布

1. 在演讲源工程执行 `node scripts/prepare-production.mjs --strict`。
2. 设置 `PRESENTATION_BASE=/zhuiguang/` 和 `PRESENTATION_DIST=dist-pi`，运行 `npm run build`。
3. 执行 `node scripts/package-pi.mjs <新暂存目录>`，随后在桌面仓库执行 `pwsh -File deploy/deploy-zhuiguang.ps1 -PackageDirectory <同一目录>`。`-Check` 仅生成本地包。
4. 桌面快捷方式变更走桌面现有版本化构建和发布。服务切换与桌面发布共用服务器锁。

运行目录 `/opt/projects/zhuiguang/releases/`，私有状态与 SQLite 在 `/var/lib/zhuiguang/data`，每天本机快照写到 `/var/lib/zhuiguang/backups` 并保留最近 14 份。备份使用 SQLite 在线备份 API，落盘前做完整性检查。私信正文只在数据库和备份中，必要服务日志用 `journalctl -u zhuiguang -u zhuiguang-backup` 查看，投递与审核事件写数据库审计表。
