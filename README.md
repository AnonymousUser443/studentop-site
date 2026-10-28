# studentop.cn · 集中开发工作区

个人主页是原生 Windows 风格网页桌面，锁屏由同源私密 Node 服务校验；理韵寻踪、校园入场与体素校园是三个独立 Vite 应用，另在校园应用中保留原版开场独立入口。最新交互、安全与部署条件见 [10月28日修订](<docs/REVISION-20261028.md>)。本轮新增体素校园入口；用户已授权由 Lead 统一提交、推送与部署，其他成员不得执行。**授权与本地验收不等于已上线**，发布结果以 Lead 的本轮记录为准。升级范围与分工见 [本地升级计划](docs/UPGRADE-PLAN.md)。

## 本地启动（推荐入口）

需要 Node.js **22.12+**。以下命令从仓库根目录执行。三个应用有各自的依赖和锁文件，不是 npm workspace，也不是另一个 DeepSeek Harness 服务。

依赖由负责人统一安装；已有依赖无需重装。体素源码导入完成后再安装该应用并检查完整四服务模式；导入期间可以使用 --site-only：

~~~powershell
npm --prefix apps/liyun-explorer ci
npm --prefix apps/genshin-start ci
npm --prefix apps/liangxiang-cloudwalk ci
~~~

~~~powershell
# 只检查目录、Node 版本和各应用本地 Vite；不安装、不监听、不探测端口
node tools/dev-workspace.mjs --check
# 同时启动静态主页和三个独立 Vite 应用（共4个服务）
node tools/dev-workspace.mjs
# 只看主页时不要求任何Vite应用依赖已安装
node tools/dev-workspace.mjs --site-only
~~~

| 服务 | 固定本地地址 | 内容 |
| --- | --- | --- |
| 个人主页 | <http://127.0.0.1:8899/> | 仅 [site](site/) 的公开 HTML 与静态资源 |
| 理韵寻踪 | <http://127.0.0.1:5174/> | React / TypeScript / Vite / p5.js |
| 校园入场（保留 genshin-start 目录与应用 id） | <http://127.0.0.1:8081/> | 北理工主题轻量 3D 入场，进入理韵 |
| 体素校园 | <http://127.0.0.1:5180/> | 独立体素校园应用；runner id 为 voxel，桌面 id 为 voxel-campus |
| 原神启动（原版独立入口） | <http://127.0.0.1:8081/legacy.html> | 原版天空/柱路/门模型，本地同源解码；未公开部署 |

- 四个服务（主页及三个 Vite）只绑定 **127.0.0.1**，端口占用直接失败，不自动换端口，不复用未知服务。**旧 5173、4173 服务与 8080 SSH 转发不可停止、复用或改写。**
- <http://127.0.0.1:8899/__workspace/status> 返回工作区名称、路径指纹、启动实例与各服务状态；<http://127.0.0.1:8899/__workspace/health> 在本次创建的服务全部就绪时返回 200，否则为 503。同名目录用指纹区分。
- 启动器不提供目录列表，不暴露仓库根、点文件、配置、源码映射或秘密文件；拒绝路径穿越及越界链接。三个 Vite 开发入口限定各自 app 根，不是公网服务器。
- 在启动它的终端按 Ctrl+C，关闭**本次创建**的 Vite 子进程与主页 HTTP 服务；不会按端口或进程名清理外部服务。强制终止整个终端后的状态应由负责人检查。
- 本地桌面中的理韵 / 校园 / 体素校园快捷方式分别使用 5174 / 8081 / 5180；原版开场复用 8081 的 legacy.html，不增加服务。校园本地出口仍为 5174。北湖霜降雅集不在这个工作区中运行，不映射到旧服务。理韵出口与原版既有子域不变；轻量校园/体素的生产路径见下表。
- 不要从仓库根运行通用静态服务器；不要为本仓库另起 DSH Web。正常运行不需要重建已有地图、音乐或字体。

单独启动仍由 Lead 统一管理：理韵执行 **npm run dev**；校园执行 **npm start**（**npm run dev** 是兼容别名）；体素校园执行 **npm run dev**。先退出统一启动器，避免占用相同端口。理韵构建预览固定回环 4174，体素预览固定回环 4180，而非旧 4173。**--site-only 只启动8899，不预检或启动任何app依赖**；--check不创建服务。

## 目录

~~~text
site/                       静态主页发布源：HTML / CSS / JS / 本地资源
apps/liyun-explorer/         理韵源码与自己的 package-lock
apps/genshin-start/          校园入场源码与自己的 package-lock
apps/liangxiang-cloudwalk/   体素校园源码与自己的 package-lock
qa/                         验收脚本；根目录已有 PNG 均为历史截图
qa/upgrade-20261027/         第一轮历史日志、截图与结果
qa/revision-20261028/        体素接入前历史证据（服务数量为3，不改写）
tools/dev-workspace.mjs      安全本地启动器
deploy/                     部署脚本与配置；仅由获授权的Lead执行
docs/UPGRADE-PLAN.md         V2 范围与验收矩阵
~~~

详见 [应用目录说明](apps/README.md)、[主页说明](site/README.md)、[理韵说明](apps/liyun-explorer/README.md)、[校园入场说明](apps/genshin-start/README.md)。迁移前的工作副本不作为当前源码或服务的依据。

## 内容版本发布与浏览器缓存

正式主页产物不再直接上传原始静态目录：先运行 `node tools/build-site.mjs`，再运行 `node tools/build-site.mjs --check dist-site`。内容指纹资源绕开旧同名长缓存，HTML和版本元数据再验证；已打开的桌面只提示升级、不自动刷新，未保存便笺可取消更新。见 [缓存修复与迁移](<docs/CACHE-UPDATES.md>) 与 [本轮完整验收](<docs/REVISION-20261028.md>)。正式上线仍须先配置私密同源认证服务并审核nginx模板；本轮部署操作与发布证据由获授权的 Lead 独占，不能根据本地运行推断上线完成。

## 检查与证据

~~~powershell
node --test qa/node-tests.cjs qa/desktop-node-tests.cjs
node apps/liyun-explorer/scripts/asset-manifest.mjs --check
npm --prefix apps/liyun-explorer test
npm --prefix apps/liyun-explorer run build
npm --prefix apps/genshin-start run build
~~~

前两条不打开浏览器、不启动服务；素材清单检查可从任意工作目录运行。浏览器验收由负责人先加载 **opencli** 技能后执行，详见 [QA 说明](qa/README.md)。兼容旧 CDP 文件名与主要参数，但默认改为回环；错误、异常、失败断言或空目标必须返回非零退出码，不能用“截图生成了”代替业务通过。

体素接入前的 [10月28日修订记录](docs/REVISION-20261028.md) 及其 QA 脚本/JSON保留当时三服务快照；不把历史数量改成4来伪造新验收。当前四服务与体素入口由 Lead 新建验收记录。

[理韵旧 QA 记录](apps/liyun-explorer/docs/QA.md) 引用的 app 内截图与 JSON **没有迁入本仓库**，历史数字不充当本轮证据。根 QA 目录的示例截图也属于旧版，不是当前青玉纸境和校园场景的最终效果：

| 历史主页 | 历史项目窗口 |
| --- | --- |
| ![历史桌面](qa/live-desktop-3.png) | ![历史项目窗口](qa/final-projects-window.png) |

## 线上地址（既有记录与本轮发布目标，非完成声明）

| 站点 | 已有地址 |
| --- | --- |
| 主页 / 项目索引 | <https://studentop.cn:14355/> / <https://studentop.cn:14355/projects/> |
| 北湖霜降雅集 | <https://frost.studentop.cn:14355/> |
| 理韵寻踪 | <https://liyun.studentop.cn:14355/> |
| 轻量校园 · 纸境入场（本轮拟发布新路径） | <https://studentop.cn:14355/campus-entry/> |
| 原神启动原版（保留现有子域根release，不重新分发新legacy包） | <https://genshin.studentop.cn:14355/> |
| 体素校园（本轮拟发布新路径） | <https://studentop.cn:14355/voxel-campus/> |

轻量校园本轮改为主域的 /campus-entry/，由 Lead 配置构建 base 与部署路由；体素校园使用相对 base 支持 /voxel-campus/。远端原神子域根目前承载原版，本轮保留其现有 release，不因本地恢复入口而重新分发许可待核实的新 legacy 包。本地8081根路径仍是轻量校园，/legacy.html 仍是原版，两者与生产路由不能混为一谈。

既有架构为 Raspberry Pi 上 nginx + frp TCP 隧道、TLS SNI 分流；带端口原因见 [公网访问记录](deploy/PUBLIC-ACCESS-STATUS.md)。这些地址不是脚本的默认测试目标，也不表示本轮检查过其在线状态。

## 部署权限

**树莓派的一切部署只能由仓库所有者 AnonymousUser443 本人明确发起。** 本轮用户已明确授权 Lead 统一提交、推送与部署；该权限不下放给其他成员。成员不得自行连接服务器、运行部署脚本、触发 workflow 或通过 push 间接发布。实际服务变更、发布命令及验收由 Lead 记录，不将“已授权”写成“已部署成功”。

- [部署权限约定](DEPLOYMENT-POLICY.md)
- [贡献说明](CONTRIBUTING.md)
- [项目维护手册](deploy/PROJECTS.md)

历史脚本与记录继续保留，不能将本地启动等同于上线；本地日志不得写入令牌、SSH 凭据、用户隐私或完整环境变量。

## 版权与素材

- 本站原创部分遵循根 [LICENSE](LICENSE)。
- 校园入场保留上游 www-genshin（TEAM.x.y.z / gamemcu）的 [MIT 许可](apps/genshin-start/LICENSE)。旧《原神》素材权利归原权利人；程序化校园造型并非官方数字孪生。差异见 [入场改造说明](apps/genshin-start/DEPLOY-NOTES.md)。
- 理韵课程源码与用户地图 / 音频 / 美术素材应分别核对授权；字体许可及重建条件见 [素材说明](apps/liyun-explorer/docs/ASSETS.md)。
