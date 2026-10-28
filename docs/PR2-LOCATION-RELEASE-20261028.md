# 定位/账号融合与理韵新版发布记录

## 两个 PR 的处理结果

- [PR #3](https://github.com/AnonymousUser443/studentop-site/pull/3) 账号与云端进度已由团队合并，基线 `16130a0`。
- [PR #2](https://github.com/AnonymousUser443/studentop-site/pull/2) 原本 `DIRTY`，与主分支在 README、package.json、App.tsx、types.ts、vite.config.ts 五处冲突。
- 冲突在 `integrate/pr2-location-20261028` 上逐项语义融合，提交 merge `f5059312f8fdeeedc76d477ed92dbabc08ea9877`；推回 `feat/campus-location` 后 PR 变为 `MERGEABLE/CLEAN`，已合并为 `c03c85815c3d0dd5644121db3629f69bab4fb2da`。
- 本地 `main` 已快进到该结果并接上部署助手修正 `01bdb04`，没有强推、没有改写已发布历史。

融合原则：保留定位/朝向/范围打卡、快速闪光散雾、v2 存档语义；同时保留账号、云端进度、游客模式；真实 GPS 只在定位 Hook 内存，不进入本地或云端存档。

## 上线前修掉的账号接管缺陷

原 PR #3 使用“昵称 + 学号”即登录：知道他人学号就能拿到其账号新令牌并读写云存档。本轮修复：

- 增加 8–128 字符访问口令，随机盐 + scrypt + 恒定时间比较；错误口令不改昵称、不改进度、不签发令牌。
- 旧 schema1 无口令账号锁定并撤销旧会话，只允许离线管理员在 TTY 迁移；没有公开领取入口。
- 客户端与服务端双向白名单重建存档：剔除 GPS、口令与未知字段；`playerUV` 仅允许起点或已发现地标固定锚点；v1 演示打卡不升级为真实记录。
- 生产必须显式 `LIYUN_PUBLIC_ORIGIN`，写请求校验 Origin；失败按账号节流，避免一个账号的错误口令拖累其他账号。
- 方向姿态不完整时不再伪造指针；Safari 原生罗盘仍可用。

验收：71 项前端 Vitest、9 项 store、8 项 HTTP、地图标定校验全部通过。

## 生产发布

- 公网：[理韵寻踪](https://liyun.studentop.cn:14355/)。
- 新 release：`liyun-20261028T163300Z-f5059312f8`，应用源 `f5059312f8fdeeedc76d477ed92dbabc08ea9877`（含上面的 merge）。
- 回滚目标保留：`/opt/projects/liyun/releases/liyun-20261028T125837Z-d42554f163`。静态 `current` 与新 `/opt/projects/liyun-api/current` 都用同目录临时链接 + `mv -Tf` 原子切换。
- 归档 undefined 字节，SHA256 `e6d5fe192d01ecbdb06e79ea51aa4838acbeb64cea1bc5110ac4bfffd0b38b3a`；复用与旧站逐字节相同的 20 个资源，只上传新主包、CSS、两张标定地图与入口。
- 新增独立 `liyun-account.service`（`User=liyun-account`，数据 `/var/lib/liyun-account` 权限 700，位于 webroot 之外），nginx 只新增 `location ^~ /api/` 反代；证书、DNS、frp 未动。
- 发布前备份 nginx 配置；事务失败会恢复旧 `current`、旧配置并停用新服务。

## 公网证据

- 服务器收据 undefined 项检查：[deployment.json](<../qa/pr2-location-release-20261028/deployment.json>)。
- 公网 HTTP 37/37：[public-http.json](<../qa/pr2-location-release-20261028/public-http.json>)，含新旧三代哈希资源、入口字节、缓存头、缺失资源 404、`/api/health`、未登录 401、路径穿越不泄露文件、邻站（主站/体素/纸境/原神/霜降）未变。
- 公网真实浏览器 19/19：[public-browser.json](<../qa/pr2-location-release-20261028/public-browser.json>)，自有隔离 Edge、正常入口、真实点击、无 DEV 接口/无注入存档：
  - 注册新号 → 继续旅程 → 底部显示昵称与 UID；刷新后会话恢复。
  - 远处定位：打卡按钮禁用，原因 `out-of-range`，进度仍为 0。
  - 范围内定位：真实点击打卡成功，探索度 0→7%。
  - 地标区域浓雾均值 alpha 196.0 → 13.6（解锁闪光结束后两次稳定采样），镜头未变。
  - 退出后错误口令被拒绝且无法进入；正确口令重新进入并恢复云存档（7%）。
  - 减少动态开关让空闲雾循环停止，关闭后恢复；品牌/正文实际使用自定义 Ma Shan Zheng 与 Noto Serif SC。
  - 844×390 可用、390×844 仍是产品原有横屏提示，往返不丢状态。
  - 唯一 401 来自故意的错误口令负向测试，其余请求均 2xx。
- 发布后只读审计：[rollback-audit.json](<../qa/pr2-location-release-20261028/rollback-audit.json>)：当前 28 项资源、回滚旧 24 项原始文件、新资源桥接、3 个 API 源文件、数据目录 700、服务 active、nginx 配置未变、四个邻站指针未变。**审计不等于真的切回过旧版**。

## 事实边界

- 打卡是“地标距离圈”判定：地图图幅内不等于校园围栏；仓库没有独立校园边界 polygon，因此不宣称防伪定位或正式考勤。
- 账号是游戏账号，不是学校实名认证；界面提示不要用真实姓名和学校密码。验收产生的 `QA-*` 合成账号只含随机标识与测试进度。
- 失败节流在进程内存，服务重启会清空；当前单实例 SQLite，未做多实例共享。
- 浏览器验收是桌面/视口模拟，不是真机 GPS、罗盘或刘海安全区验收。
- 旧版本与兼容资源暂不清理；后续团队新提交属于另一次构建、验收与授权发布。
