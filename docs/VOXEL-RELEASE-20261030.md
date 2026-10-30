# 体素 BGM 修复生产发布 · 2026-10-30

所有者本次明确要求核查远端、提交请求并部署树莓派。通过现有代理fetch后确认远端main与本地同为0ecbf3b，PR #10已经合并、没有开放PR或冲突，无需rebase。新增体素独立发布工具经自审、自测及独立审查后提交并合并PR #11，发布基线为 `c6f57c8998e6be003cbca4b1055e489206a872df`。

2026-10-30 **17:22:19（北京时间）**完成发布。体素current现指向 `/opt/projects/voxel-campus/releases/20261030T092022Z-c6f57c8998`；旧目标 `/opt/projects/voxel-campus/releases/20261028T110253Z-e2bc44a0e3` 保留作为回滚点。主页、理韵及其认证代理仍是此前活动/监控版，纸境、原版、霜降和账号后端保持原release。

## 发布方式

合并后从干净提交重新构建，仅封装11个体素公开文件，共2,857,485字节。清单SHA256为 `80e98429da309f023650d136734c358471a255b9234d660339ac035cfb8cb7e0`；执行脚本上传SHA256与已审查文件一致。私有0700暂存目录内不包含门禁配置、密钥或用户数据。

事务持有既有共享发布锁，核对原current后追加哈希资源，原子切换体素current。未重启服务、未reload nginx、未更改配置或数据库。仅追加shared-assets，旧资源与旧release不清理；正式事务成功，未发生生产回滚。故障回滚在独立Linux合成夹具中验证，不能说生产实际回切过。

## 验证结果

- 本地音频回归21/21；Linux隔离事务11/11，包括实际flock、原子替换、错误Range/字节触发回滚及umask077公开权限。见[开发验收](../qa/voxel-release-20261030/QA.md)。
- 生产本机TLS/SNI检查40/40：11个公开文件逐一大小/SHA256匹配，三首Opus首尾Range返回正确206、MIME、Content-Range和字节；字体/脚本MIME、404、斜杠重定向正确。见[发布收据](../qa/voxel-release-20261030/deployment.json)。
- 公网独立Edge检查13/13：空缓存加载新 `index-sx_2Yh8w.js`，未交互前不下载音乐；真实按钮触发白昼播放、切夜、静音及恢复，原生媒体时间/playing/pause事件与UI一致，无JS、HTTP或媒体错误。见[最终浏览器结果](../qa/voxel-release-20261030/public-browser-final.json)。初次脚本把具有同名data-time-mode属性的body误认成按钮，导致等待超时；限定到菜单按钮后通过，未修改产品。初次结果保留在public-browser.json。
- 发布前后独立盘点：除体素之外8个版本指针、6项服务进程与7份nginx/systemd配置哈希均未变；主页版本仍为76b1376dbbf99a19cb3a2308；任务管理器匿名访问仍401，理韵health及邻站正常。见[状态比对](../qa/voxel-release-20261030/post-state.json)。

浏览器使用自有隔离档案和软件渲染，物理输出由测试器静音；这些结果不代表物理声卡听感、真机手机或任意网络条件下的首播性能。没有读取真实门禁答案，也没有重跑账号/云存档全流程。

回滚目标和逐文件清单位于 `/var/lib/aiden-release-history/voxel-20261030T092022Z-c6f57c8998/`。需要回滚时仍须所有者明确授权，在同一共享锁下核对当前目标后原子恢复旧current；共享资源继续保留。
