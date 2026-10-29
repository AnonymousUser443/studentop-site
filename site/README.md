# 青玉纸境 · Windows 风格网页桌面

原生 HTML / CSS / JavaScript 前端，零 npm 前端依赖，开发无需打包；正式发布需先做确定性资源版本化构建；私密问答由 Node 服务同源校验，不能再以纯静态服务器绕过运行。交互与安全设计见[10月28日修订](<../docs/REVISION-20261028.md>)。这里只是网页桌面，不控制操作系统电源、网络或真实磁盘。V2 的设计和验收矩阵见[升级计划](../docs/UPGRADE-PLAN.md)，后续发布证据见[发布记录](../docs/RELEASE-20261028.md)；新改动需另行验收，旧截图不代表新版通过。

## 本地查看

当前开场为 AidenOS：四方粒子聚字后展开月环山水，加载环持续转动；时钟锁屏支持上滑、滚轮、点击与 Enter。登录使用普通文本输入以支持中文输入法，服务端确认后从四周散为粒子、进入桌面。减少动态可跳过长动画，重播开场不授予访问。[设计与素材](../docs/boot/creative-brief.md)、[本次局部验证](../docs/boot/QA.md)记录实现与边界。

从仓库根目录执行：

~~~powershell
node tools/dev-workspace.mjs --site-only --check
node tools/dev-workspace.mjs --site-only
~~~

主页为 <http://127.0.0.1:8899/>；锁屏必须经过服务端问答，旧 skipLock 参数不再授权；项目索引为 <http://127.0.0.1:8899/projects/>。完整联调去掉 --site-only，同时启动理韵账号 API 8787、理韵前端 5174、校园 8081 和体素校园 5180。--site-only 不启动这些服务，不能据此判定跨项目跳转或账号联调已可用，详见[应用说明](../apps/README.md)。

启动器仅服务本目录的公开入口和资源，不暴露仓库根；端口占用直接失败。**不要动旧 5173、4173 或 8080 SSH 转发。** 不需要 SSH、线上服务、Python 静态服务或另一套 DSH。状态入口 <http://127.0.0.1:8899/__workspace/status> 可以辨认当前工作区。

## 代码与内容

| 位置 | 维护内容 |
| --- | --- |
| [入口](index.html)、[项目页](projects/index.html) | 锁屏、桌面挂载点、项目索引 |
| [内容配置](assets/js/content.js) | 个人资料、头像、项目、通知、壁纸与固定应用 |
| [内核](assets/js/core.js) | 偏好、主题、存储、通知、锁屏与安全链接 |
| [门禁](assets/js/boot-lock.js)、[粒子呈现](assets/js/gate-effects.js) | 同源授权状态与视觉效果；粒子不读取输入或会话 |
| [窗口管理](assets/js/wm.js) | 窗口生命周期、拖动、缩放、贴靠、任务栏状态 |
| [桌面外壳](assets/js/shell.js) | 菜单、搜索、任务栏、通知和日历 |
| [系统应用](assets/js/apps-system.js)、[个人应用](assets/js/apps-about.js) | 前端应用与项目快捷方式 |
| [样式目录](assets/css/) | 颜色、字体、窗口、菜单、响应式与减少动态 |

头像使用内容配置中的 profile.avatar，图片路径相对于主页；默认沉玉谷壁纸与缩略图由负责人准备。新增文字后需由字体负责人补齐本地子集，不把任意在线字体当作默认依赖。两份 Noto 许可在字体资源目录保留。

原有应用 id 保留：about、projects、skills、contact、cv、thispc、terminal、notepad、photos、settings、recycle。快捷方式 id 为 frost-atlas、liyun-explorer、genshin-start、genshin-original、voxel-campus。回环开发时理韵、校园、体素映射 5174 / 8081 / 5180；原版开场共用 8081/legacy.html。北湖霜降没有本地副本，不能把它指向其他旧端口冒充服务。

## 操作与限制

任务管理器是原生单实例窗口，入口在桌面、开始菜单、搜索和项目作品。监控文档与桌面样式隔离，经当前桌面会话读取既有回环只读监控；最小化暂停、恢复重连，关闭及锁屏销毁。离线不生成演示曲线。接入、验证及尚未发布的范围见[任务管理器说明](../docs/TASK-MANAGER.md)。

- 桌面双击打开，触屏提供单击替代；标题栏拖动、双击最大化，任务栏切换窗口。
- 开始菜单、搜索、日历、通知与快速设置在网页内工作。网页可用快捷键及新增交互以 [验收范围](../docs/UPGRADE-PLAN.md) 和实际代码为准；操作系统通常先截获 Win 键，不能承诺它在所有浏览器可用。
- 终端是**前端模拟**，不执行 shell。电源、Wi-Fi、蓝牙、磁盘容量等不代表真实系统能力。
- 联系表单只拼接 mailto 邮件；文件浏览、照片与回收站只操作网页提供的内容。
- 偏好和记事本存储受当前浏览器来源限制。禁用存储、隐私模式、清理数据或更换端口可能丢失持久化；重要文本请下载备份。
- 深链接可组合 menu、open、theme 等参数，例如 <http://127.0.0.1:8899/?open=about&theme=dark>；所请求的窗口/面板在服务端认证成功后才打开。旧 skipLock 参数和旧 sessionStorage 授权标记失效。
- 首次设置私密答案、正式部署所需同源认证服务、三次错误/五分钟限流与安全边界见 [私密锁屏说明](<../docs/REVISION-20261028.md>)。

## 缓存与发布产物

开发仍使用本地启动器；正式发布先在仓库根运行 `node tools/build-site.mjs`，再运行 `node tools/build-site.mjs --check dist-site`。只将生成的版本化公开产物交给所有者审核发布，不直接上传原始站点目录。构建为HTML/JS/CSS/媒体创建内容版本路径，默认保留前两版资源，版本入口不长期缓存。新版本只提示更新，未保存便笺可取消刷新；不清理浏览器偏好或历史。详见 [缓存更新说明](<../docs/CACHE-UPDATES.md>)。

## 验收与发布

[QA 说明](../qa/README.md) 提供保留的交互脚本、新版回归入口与严格失败约定。浏览器操作由负责人先加载 opencli 后执行；合成事件检查不等于物理触屏或真实拖动实测。

主页地址为 <https://studentop.cn:14355/>，已记录的正式发布与验收见[发布记录](../docs/RELEASE-20261028.md)。后续修改需重新验收；发布遵守[仓库部署权限](../DEPLOYMENT-POLICY.md)，历史授权不作为后续上线许可。
