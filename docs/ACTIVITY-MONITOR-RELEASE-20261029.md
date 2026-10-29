# 理韵活动页与桌面监控生产发布 · 2026-10-29

所有者本次明确要求“开始部署到树莓派，接入真实的生产环境”。已发布 PR #8 合并后的应用代码 `f320dadbb99130c53f3dafac97a72d83de1e3fac`，目标为主页、理韵静态前端和桌面认证代理。其他应用、账号后端、私有数据与监控采样服务保持原状态。

- [生产桌面](https://studentop.cn:14355/?open=rpi-task-manager)，重新解锁后打开任务管理器。
- [生产理韵](https://liyun.studentop.cn:14355/)，左下“活动一览”展开长卷。
- 本次事务 `activity-monitor-20261029T154940Z-f320dadbb9`；三个当前目录分别位于相应根目录的 `releases/activity-monitor-20261029T154940Z-f320dadbb9`。
- 主页版本 `76b1376dbbf99a19cb3a2308`，理韵素材版本 `413a191099e1600e90e473b8`。

## 发布和兼容性

以私有上传目录、SHA-256清单和共享flock锁执行事务；先以生产服务账号验证真实回环监控，再安装认证代码与单一增量nginx路由，nginx -t通过后原子切换。仅重启desktop-auth并reload nginx，监控、账号、霜降和frpc进程未重启。

旧理韵公共字体存在30天缓存，本次把Vite publicDir资源与动态奖励前缀统一封装到内容版本路径。所有旧资源及旧入口保留，新素材命名空间也追加至前一release，回滚后新发出的URL仍可读取。新封装工具为tools/build-liyun-release.mjs，事务为deploy/apply-activity-monitor.mjs。

回滚目标：主页 `/opt/win11-home/releases/20261029T072148Z`；理韵 `/opt/projects/liyun/releases/liyun-20261028T163300Z-f5059312f8`；认证 `/opt/projects/desktop-auth/releases/20261028T110253Z-e2bc44a0e3`。原nginx片段、systemd单元与基线备份在 `/var/lib/aiden-release-history/activity-monitor-20261029T154940Z-f320dadbb9`。首次自检将内部清单误当公开页面，实际触发一次自动回滚；修正检查后重新发布成功，详见回滚说明收据。未删除历史release，未变更数据库schema或私密问答。

## 实际验证

- 树莓派本机通过正常TLS/Host路由，逐文件验证 215 个公开文件的长度与SHA-256；内部构建清单仍返回403。
- 真实监控服务127.0.0.1:8765继续由rpi-monitor低权限运行。新代理在desktop-auth账号下取得真实CPU/内存/磁盘/网络/温度及进程，连续三条SSE序号递增；退出后断流。探针使用临时独立合成门禁，不读取所有者答案，不生成生产授权会话，主机名/进程细节未保存到公开证据。
- 公网匿名监控请求401、跨源403、数据no-store；正常所有者认证后的公网浏览器流程仍需本人解锁，未以运维手段绕过。
- 主页及任务管理器、理韵账号health和其他站点入口通过。配置外的项目指针和进程保持一致。
- 正式理韵构建在本地隔离浏览器成功加载版本化字体、插画与四枚奖励；未恢复此前停止的账号/云存档全流程验收。

见[发布收据](../qa/release-activity-monitor-20261029/deployment.json)、[真实监控探针](../qa/release-activity-monitor-20261029/real-monitor.json)、[公网检查](../qa/release-activity-monitor-20261029/public-http.json)、[发布后状态比对](../qa/release-activity-monitor-20261029/post-state.json)、[正式构建浏览器检查](../qa/release-activity-monitor-20261029/artifact-browser.json)、[回滚记录](../qa/release-activity-monitor-20261029/rollback-note.json)。

发布后另一次只读盘点确认9个应用指针、6项服务和7份配置均符合预期；监听端口没有变化，仍为回环地址。提交到仓库的事务脚本及真实监控探针与实际上传文件的SHA-256相同。

未上线活动仍为预告，奖励仍是构想。生产接入不改变GPS打卡、账号/云存档格式或活动授权规则。未测物理手机帧率、iOS/微信；保留原p5单包体积提示。
