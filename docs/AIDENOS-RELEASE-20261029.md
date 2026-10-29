# AidenOS 主页授权发布 · 2026-10-29

所有者在本次会话明确要求“开始部署到树莓派”。本次仅发布已合并 PR #5 的主页静态产物，部署代码为 `e2323827d2e344ffc393707608c2ee448a6512e4`；不重跑此前已停止的整站全流程验收。

- 公网入口：[主页](https://studentop.cn:14355/)。
- 新 release：`/opt/win11-home/releases/20261029T072148Z`，已原子切换 `current`。
- 线上内容版本：`2897dae74f2ca40ce525c26e`。
- 回滚目标保留：`/opt/win11-home/releases/20261028T110253Z-e2bc44a0e3`，旧入口 SHA-256 与发布前一致。

## 发布与检查

使用项目已有 `deploy/deploy-site.sh dist-site`：先校验本地版本化产物及现有同源认证服务，上传新目录，取得发布锁，检查 nginx，再原子切换与 reload；脚本保留自检失败自动回滚。本次成功，无需回滚，也未实际执行回切测试。

- 树莓派 HTTP / HTTPS 入口均返回 200，版本与本地工件一致。
- `deploy/checksum-compare.sh dist-site /opt/win11-home/current`：162 个入口及素材文件 SHA-256 全部一致；项目索引另外经公网逐字节核对。
- [公网只读检查](../qa/aidenos-release-20261029/public-http.json) 36/36：新页面、聚字脚本、样式、底图、两份字体、MIME、缓存头、旧版本 namespace 和匿名认证状态。未提交真实答案、未改真实限流记录，也未登录理韵或操作云存档。
- 发布前后七个项目 `current` 指针、五项服务主进程与相关 nginx / systemd 配置哈希均一致；仅主页 `current` 更新。nginx reload 后继续 active，账号与门禁服务未重启。

[发布收据](../qa/aidenos-release-20261029/deployment.json)记录实际版本、回滚点和检查范围。源码功能的 20 项门禁合约与 22 项局部浏览器检查见[开发验收](boot/QA.md)，不把本次只读上线检查当作全站业务验收。

## 指纹与缓存

开发验收产物为 `94e2c0a496003d6f79431339`。合并后 Windows 检出将 `site/index.html` 和 `site/assets/css/boot-lock.css` 转为 CRLF，Git 规范内容及代码语义未变；构建指纹按原始字节计算，所以本次重新构建后的实际发布版本为 `2897dae74f2ca40ce525c26e`。已校验其构建清单与线上文件，不能沿用旧指纹描述当前版本。

新页面引用内容版本路径；旧 namespace 继续保留。已打开的桌面按现有更新机制提示刷新，未保存的便笺仍可取消刷新；不清理用户浏览器数据。
