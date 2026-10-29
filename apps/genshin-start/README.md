# 理韵 · 纸境入场

本目录保留历史名称 genshin-start 与桌面应用 id。当前入口已改成**北理工校园意象的原创程序化三维场景**：沿晨光步道靠近文博中心门庭，再进入理韵寻踪。不是《原神》官方产品，也不是北京理工大学官方数字孪生；建筑、纸山、植栽和路径是有参考依据的艺术化编排。

新入口使用 React + TypeScript + Three.js 0.170.0。旧 xviewer / 游戏模型和音频保留作历史材料，不进入新入口的运行依赖图；本版本**静音**，不自动播放任何声音。旧资源的保留不授予第三方美术的使用权。

## 本地启动

前端使用 Node.js 22.12+，完整工作区推荐 Node.js 24。推荐从仓库根执行[本地启动器](../../tools/dev-workspace.mjs)，同时提供主页 8899、理韵 5174、校园 8081、体素校园 5180；完整说明见[根 README](../../README.md)。

单独在本应用目录操作时：

~~~powershell
npm ci
npm start
# npm run dev 是等价的兼容别名
npm run build
# 先退出开发服务，再预览构建（同样占用8081）
npm run preview
~~~

开发与构建预览均严格监听 <http://127.0.0.1:8081/>，端口占用立即失败；不会退到 8080 或其他端口。已有依赖无需重装；单独启动前先退出自己启动的统一启动器。旧 5173 / 4173 / 8080 SSH 转发不动。

**出口约定：** 开发模式或回环页面（有 JavaScript）默认进入 <http://127.0.0.1:5174/>；生产非回环页面仍进入 <https://liyun.studentop.cn:14355/>。没有对应理韵服务时，校园本身启动不等于出口验收通过。

## 操作与状态

| 阶段 | 行为 |
| --- | --- |
| loading | 静态底图与跳过链接先显示；不伪造加载百分比 |
| welcome | 等待选择“循光入校”，开始后进入行进 |
| journey | 正常约 10 秒；可以暂停、继续或直接抵达 |
| arrival | 门庭停驻，等待再次选择“进入理韵寻踪” |
| entering | 正常约 2.8 秒过渡后真实导航 |
| fallback | 初始化失败、12 秒加载超时或图形上下文丢失时保留静态入口，不倒计时强制跳转 |

- 右上角跳过链接常驻，包括脚本尚未准备好时；地址带 ?skip=1 或 #skip 可直接进入目标。?skip=0 不请求跳过。
- 原生按钮/链接支持鼠标、触摸与键盘；Enter / 空格在页面空白区域控制开始、进入或行进暂停；Esc 跳过。输入控件内不抢占其默认操作。
- 减少动态时开始直接抵达门庭，进入过渡约 180ms。页面转后台暂停绘制，回到前台再继续；卸载移除监听、计时与 GPU 资源。
- 质量自动判档：低档帧率上限 30、DPR 上限 1.25；高档上限 60、DPR 上限 1.75。持续慢帧可降档。这些是**配置上限，不是测得帧率或流畅度保证**。

## 开发验收接口

仅 DEV + 回环地址 + ?qa=1 暴露 window.__CAMPUS_QA__；生产构建不提供测试控制。

- 观测：phase、camera、performance、snapshot()。
- 操作：start()、arrive()、enter()、advance(seconds)、resume()、loseContext()。
- advance 只接受 0–60 的有限秒数，切换到手动时钟；resume 恢复自然推进。手动推进不能充当真实播放帧率证据。
- 稳定 DOM：main[data-phase]，开始 [data-testid="campus-start"]，进入 [data-testid="campus-enter"]，常驻 #campus-skip。

由负责人先加载 opencli 再运行浏览器。保留的 [流程脚本](../../qa/genshin-flow-test.js) 默认为本地 8081 → 5174，可参数化 --url / --target / --mode；[QA 说明](../../qa/README.md) 解释错误与断言如何使进程失败。完整视觉、键盘、上下文丢失、前后台与真实时序测试以负责人保存的实际证据为准，不以 TypeScript 通过替代。

## 无脚本与覆盖出口的边界

[index.html](index.html) 中的常驻链接和 noscript 使用 Vite HTML 占位符：开发服务写入 5174，生产 build 写入原生产地址。**生产构建在本地 preview 且禁用所有 JavaScript 时，noscript 仍是生产链接**；验证本地无脚本入口应使用开发服务，不点击生产目标。开启 JavaScript 时，HTML 启动兜底和应用都会按当前回环 hostname 改用 5174。

需要预注入 window.__EXIT_URL__ 时，只接受无凭据的绝对 HTTP(S) 地址；本地页面仅接受回环目标。不合法值回退到上述默认，不能使用相对路径、javascript/data URL 或带账号密码的 URL。由 [出口模块](src/core/exit.ts) 统一验证并防重复导航；返回浏览器页面时重置防重标记。

## 来源与历史

- 建筑观察与照片使用边界见 [建筑参考](../../docs/BUILDING-REFERENCES.md)。照片只作观察，不作为发布纹理；场景比例不是测绘参数。
- [改造记录](DEPLOY-NOTES.md) 区分旧版复刻和本轮实际入口；[程序化场景素材清单](src/campus/asset-manifest.json) 记录运行资产边界。
- 原上游 www-genshin，作者 TEAM.x.y.z / gamemcu；保留 [MIT LICENSE](LICENSE) 与 [上游介绍](https://www.bilibili.com/video/BV1E8411v7xy)。游戏素材权利归原权利人，不因源码开源而允许商用。
- 旧 public/Genshin 目录与历史源码**仍完整保留**，没有删除。当前 [Vite 配置](vite.config.ts) 关闭 build.copyPublicDir，由仅 build 生效的插件精确输出校园静态 SVG、两份 Noto WOFF2、两份 OFL 许可及根 LICENSE.txt；旧游戏 public 资源不在这份发布白名单中。必需资产缺失会使构建失败。该说明描述配置边界，最终产物文件清单、体积和实际构建结果由 Lead 核验；开发服务仍可访问保留的 public 文件。
- 纸境入场已记录的发布路径为主域 /campus-entry/，详见[发布记录](../../docs/RELEASE-20261028.md)。历史记录不代表后续修改已上线；新发布遵守[仓库政策](../../DEPLOYMENT-POLICY.md)。
