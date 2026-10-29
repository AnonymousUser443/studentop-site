# 三个独立前端应用

本地统一启动器包含五个服务：静态主页8899、理韵账号 API 8787，加上下面三个独立 Vite 应用。原版开场只是校园应用的另一 HTML 入口，不增加服务。

| 工程 | 本地开发 | 脚本 | 生产位置 |
| --- | --- | --- | --- |
| [理韵寻踪](liyun-explorer/README.md) | <http://127.0.0.1:5174/> | npm run dev / npm test / npm run build | <https://liyun.studentop.cn:14355/>，既有子域根 |
| [校园入场](genshin-start/README.md) | <http://127.0.0.1:8081/> | npm start（也可 npm run dev）/ npm run build | <https://studentop.cn:14355/campus-entry/>，固定构建 base |
| [体素校园](liangxiang-cloudwalk/README.md) | <http://127.0.0.1:5180/> | npm run dev / npm run build / npm run preview | <https://studentop.cn:14355/voxel-campus/>，相对 base 支持子路径 |

三个工程保留各自的 package 与锁文件，分别安装，不在根目录创建 npm workspace。推荐从根目录使用[统一启动器](../tools/dev-workspace.mjs)，端口和认证前置见[根说明](../README.md)。脚本本身不会安装依赖；团队开发与合并流程见[贡献指南](../CONTRIBUTING.md)。

理韵账号 API 是独立 Node / SQLite 进程，完整模式自动启动并纳入 health，使用 127.0.0.1:8787；前端经 `/api` 同源代理访问它，游客模式仍保留。退出完整模式后，可用 `npm --prefix apps/liyun-explorer run server` 单独调试 API，详见[服务端说明](liyun-explorer/server/README.md)。

- 全部Vite只监听127.0.0.1，端口严格固定，冲突即失败。旧5173 / 4173服务与8080 SSH转发不属于本轮环境，不得停止。
- 完整模式启动主页后，依次启动 liyun-api:8787、liyun:5174、campus:8081、voxel:5180；状态与 health 包含五项，且实际检查账号 /api/health。voxel 是 runner id；主站快捷方式 id 为 voxel-campus、名称为“体素校园”。
- --site-only只运行主页8899，不要求任何app依赖或账号后端；--check只做目录、依赖与 SQLite 能力预检，不探测/监听端口，不打开数据库。依赖不满足时完整预检明确失败，不能转而使用旧目录或外部服务。
- 理韵构建预览使用4174；体素构建预览使用4180；校园预览以其[Vite配置](genshin-start/vite.config.ts)为准。预览不由统一开发启动器额外启动。

## 原版开场与生产发布边界

本地原版仍为 <http://127.0.0.1:8081/legacy.html>，轻量校园仍在8081根；生产原版快捷方式则指向 <https://genshin.studentop.cn:14355/> 的**既有release**。保留远端原版 release，不重新发布许可待核实的新 legacy 包。轻量校园使用主域 /campus-entry/，不覆盖远端原版。

校园的本地出口仍是理韵5174，生产出口保持既有理韵子域名。三个项目不统一假定部署在域名根：轻量校园的构建 base 为 /campus-entry/；体素使用相对 base 适配 /voxel-campus/。

四服务、校园与体素的发布证据见[发布记录](../docs/RELEASE-20261028.md)，理韵后续定位与账号发布见[融合记录](../docs/PR2-LOCATION-RELEASE-20261028.md)。历史三服务报告保留原貌。历史授权不延续到后续发布，新的部署仍遵守[部署政策](../DEPLOYMENT-POLICY.md)。

## 来源与素材

- 理韵课程项目的用户音频、地图、美术来源及字体许可见[素材记录](liyun-explorer/docs/ASSETS.md)。旧QA缺失证据已标为历史，不宣称迁移后自动通过。
- 校园入场与历史上游的版权边界见[改造记录](genshin-start/DEPLOY-NOTES.md)。源码许可不自动授权游戏美术再次分发。
- 体素校园从用户指定的独立项目导入；导入者保留源码、字体、音乐及来源/权利说明，不复制依赖、构建缓存、版本库或凭据。用户音乐不因迁入本仓库而被重新声明为MIT；导入清单及原项目历史QA不充当本轮构建/浏览器通过证据。
