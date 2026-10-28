# 三个独立前端应用

本地统一启动器包含四个服务：静态主页8899，加上下面三个独立Vite应用。原版开场只是校园应用的另一HTML入口，不是第五个服务。

| 工程 | 本地开发 | 脚本 | 生产位置 / 本轮发布契约 |
| --- | --- | --- | --- |
| [理韵寻踪](liyun-explorer/README.md) | <http://127.0.0.1:5174/> | npm run dev / npm test / npm run build | <https://liyun.studentop.cn:14355/>，既有子域根 |
| [校园入场](genshin-start/README.md) | <http://127.0.0.1:8081/> | npm start（也可 npm run dev）/ npm run build | <https://studentop.cn:14355/campus-entry/>，本轮新路径，由Lead配置base并验收 |
| 体素校园（liangxiang-cloudwalk） | <http://127.0.0.1:5180/> | npm run dev / npm run build / npm run preview | <https://studentop.cn:14355/voxel-campus/>，相对base支持子路径；待Lead发布验收 |

三个工程保留各自的package与锁文件，分别安装，不在根目录创建npm workspace。推荐从根目录使用[统一启动器](../tools/dev-workspace.mjs)，端口和认证前置见[根说明](../README.md)。负责人统一安装、构建与服务进程管理；脚本本身不会安装依赖。

- 全部Vite只监听127.0.0.1，端口严格固定，冲突即失败。旧5173 / 4173服务与8080 SSH转发不属于本轮环境，不得停止。
- 完整模式依次启动liyun:5174、campus:8081、voxel:5180，状态与health包含主页在内的四项。voxel是runner id；主站快捷方式id为voxel-campus、名称为“体素校园”。
- --site-only只运行主页8899，不要求任何app依赖已安装；--check只做文件系统预检，不探测/监听端口。尚未导入或尚未安装的app会使完整预检明确失败，不能转而使用旧目录或外部服务。
- 理韵构建预览使用4174；体素构建预览使用4180；校园预览以其[Vite配置](genshin-start/vite.config.ts)为准。预览不由统一开发启动器额外启动。

## 原版开场与生产发布边界

本地原版仍为 <http://127.0.0.1:8081/legacy.html>，轻量校园仍在8081根；生产原版快捷方式则指向 <https://genshin.studentop.cn:14355/> 的**既有release**。本轮保留远端原版release不动，不重新发布许可待核实的新legacy包。轻量校园另发布到主域/campus-entry/，不覆盖远端原版。

校园的本地出口仍是理韵5174，生产出口保持既有理韵子域名。三个项目不再统一假定部署在域名根：轻量校园的构建base由Lead接入/campus-entry/；体素使用相对base适配/voxel-campus/。这些是本轮目标，不是已上线声明。

本轮用户已授权Lead统一提交、推送与部署，本轮成员不得执行git、安装、构建、服务管理或远程发布。实际上线结果和新四服务验收以Lead本轮记录为准；历史三服务报告保留原貌。

## 来源与素材

- 理韵课程项目的用户音频、地图、美术来源及字体许可见[素材记录](liyun-explorer/docs/ASSETS.md)。旧QA缺失证据已标为历史，不宣称迁移后自动通过。
- 校园入场与历史上游的版权边界见[改造记录](genshin-start/DEPLOY-NOTES.md)。源码许可不自动授权游戏美术再次分发。
- 体素校园从用户指定的独立项目导入；导入者保留源码、字体、音乐及来源/权利说明，不复制依赖、构建缓存、版本库或凭据。用户音乐不因迁入本仓库而被重新声明为MIT；导入清单及原项目历史QA不充当本轮构建/浏览器通过证据。
