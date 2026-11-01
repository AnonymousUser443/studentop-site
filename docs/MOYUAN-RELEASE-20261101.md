# 理韵墨苑与 Win Web 入口发布 · 2026-11-01

按所有者本次“部署并且提交PR”的明确授权，先创建并自行合并 [PR #15](https://github.com/AnonymousUser443/studentop-site/pull/15)，再从合并提交 `26c8ae3b428cb63e9c41b3cd57b6392f6a44d6f4` 重新构建并发布。远端主分支与工作分支已同步，无冲突。

生产入口：<https://studentop.cn:14355/liyun-moyuan/>。Win Web 桌面、开始菜单与[项目索引](https://studentop.cn:14355/projects/)均已加入“理韵墨苑”快捷方式。

## 实际版本与回滚依据

| 项目 | 当前值 | 发布前值 |
| --- | --- | --- |
| 墨苑 | `/opt/projects/liyun-moyuan/releases/moyuan-20261101T151147Z-26c8ae3b42` | 首次发布，无旧应用指针 |
| 主页 | `/opt/win11-home/releases/20261101T151721Z` | `/opt/win11-home/releases/20261031T074956Z` |
| 主页内容版本 | `5cb9607d0ca3b8864064b935` | `2d6f20fd4b6c2f6098f6db38` |
| nginx snippet SHA-256 | `5041cf216589f9661c398b2c37cad4eec1fd2b9fdf1210054cc815036775ada6` | `53f61ccef358eefdae628f020e497e04127ee0d28635a511c4fff410587826d9` |

墨苑成功收据时间为 **2026-11-01 23:12:00（UTC+8）**；主页目录使用打包开始时间。服务器备份与收据位于 `/var/lib/aiden-release-history/moyuan-20261101T151147Z-26c8ae3b42/`。公开副本见 [pi-receipt.json](../qa/moyuan-release-20261101/pi-receipt.json) 与 [release-manifest.json](../qa/moyuan-release-20261101/release-manifest.json)。

## 发布与验收

- 本地桌面、快捷方式及发布校验27/27；六服务隔离集成7/7。构建、语法和发布包检查通过，见 [preflight.json](../qa/moyuan-release-20261101/preflight.json)。已有场景浏览器19/19的五份渲染源码SHA256与本次发布源码一致。
- 墨苑只上传8个公开文件，共918460字节：HTML、favicon、JS、CSS、两份哈希字体和两份OFL许可。原PDF、照片、人物素材、字体覆盖报告与重复字体未进入发布包。
- 树莓派事务校验归档和全部文件SHA-256，持有共享发布锁，保留不可变哈希资源，原子切换墨苑与nginx路由；本机TLS/SNI逐文件及六个邻站检查通过。
- 首次主页13MB上传因SSH连接重置中断，尚未激活，旧主页保持可用。随后以同一源码和版本重新构建 `--retain 0`，仅打包当前44份版本资源，6.1MB上传成功；服务器既有shared资源和旧release均保留。主页HTTP/HTTPS及版本自检通过。
- 公网HTTPS24/24：应用全部公开字节、主页与项目页、四份新入口脚本、主页版本、带查询的308规范跳转、开发文件404和五个相邻应用健康。见 [public.json](../qa/moyuan-release-20261101/public.json)。
- 实际Chrome/OpenCLI17/17：WebGL、字体、五视角、日夜、精细光影、自动环顾、手记开关与Escape、布局及无控制台错误。见 [browser-production.json](../qa/moyuan-release-20261101/browser-production.json)。已检查生产截图[全景](../qa/moyuan-release-20261101/production-overview.png)、[室内](../qa/moyuan-release-20261101/production-interior.png)、[夜读](../qa/moyuan-release-20261101/production-night.png)与[移动尺寸](../qa/moyuan-release-20261101/production-mobile.png)。移动图片使用浏览器视口覆盖，不等同于物理手机、iOS Safari或微信实测。
- 生产项目索引真实点击成功，链接为同域墨苑、`target=_blank`及`noopener noreferrer`，见 [project-entry.json](../qa/moyuan-release-20261101/project-entry.json)。另只读验证生产主页公开注册表的桌面、开始菜单与项目入口，见 [desktop-entry.json](../qa/moyuan-release-20261101/desktop-entry.json)，未解锁或读取真实问答。

发布前后nginx、frpc和desktop-auth主进程分别保持854、860和784；nginx reload成功，校园网自动重连定时器保持active。体素、校园入场、理韵、原神与桌面认证版本指针未改变，见 [发布前](../qa/moyuan-release-20261101/pi-before.txt)与[发布后](../qa/moyuan-release-20261101/pi-after.txt)。本次排除校园网自动登录的本地未提交文件，未读取或修改真实门禁、校园网密码与生产数据库。

## 回滚目标

后续若由所有者明确发起回滚，先在共享发布锁下把主页current恢复为 `/opt/win11-home/releases/20261031T074956Z`；再按上述history目录中的 `win11-home-projects.conf.before` 恢复nginx snippet，使用 `/usr/sbin/nginx -t` 验证并reload。首次墨苑没有旧current，确认该指针仍是本次release后可移除；保留release与共享资源以便排查和重新发布。恢复首次发布前的路由后，墨苑入口将不再提供服务。回滚后重新验证主页、原有应用和服务状态。

此记录描述实际已完成发布，不是未来部署授权。
