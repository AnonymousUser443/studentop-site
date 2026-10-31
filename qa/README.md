# 本地 QA · 严格失败与证据边界

浏览器验收先加载 **opencli** 技能，使用隔离会话；只管理自己启动的服务与浏览器。团队日常检查与合并遵守[贡献指南](../CONTRIBUTING.md)。默认访问回环地址，旧 5173 / 4173 / 8080 不能当作当前目标。

## 当前五服务契约（账号 API 纳入统一启动器）

新增活动页与任务管理器的局部回归见[活动说明](../apps/liyun-explorer/docs/activity/QA.md)、[监控说明](../docs/TASK-MANAGER.md)和[本轮检查收据](feature-20261029/checks.json)。入口分别是左下活动一览和桌面任务管理器。新脚本只使用隔离的合成状态，不替代旧全流程或真实云端验收：

```powershell
node qa/liyun-activity-20261029/browser.cjs
node qa/liyun-activity-20261029/fallbacks.cjs
node --test qa/task-manager-proxy-tests.mjs
node qa/task-manager-20261029/browser.cjs
```

任务管理器不计入新服务：它通过桌面会话保护的同源接口读取已有回环采样器，离线时诚实提示，原五服务health不受影响。素材故障注入和初始离线恢复必须单独检查；物理手机帧率、真实Pi数据和正式部署不能用本地合成结果冒充。

| runner id | 本地地址 | 用途 |
| --- | --- | --- |
| site | <http://127.0.0.1:8899/> | 原生主站及同源门禁 |
| liyun-api | <http://127.0.0.1:8787/api/health> | Node / SQLite 账号 API，由理韵前端同源代理访问 |
| liyun | <http://127.0.0.1:5174/> | 理韵寻踪 |
| campus | <http://127.0.0.1:8081/> | 轻量校园；原版共用 /legacy.html，不另计服务 |
| voxel | <http://127.0.0.1:5180/> | 新体素校园，主站appid为voxel-campus |

所有端口严格绑定回环；--site-only只要求主页文件，不预检/启动应用或账号 API。完整模式先启动账号 API，再启动三个应用；status 与 health 实际请求账号 /api/health，非 200、非法 JSON、重定向或超时使其为 unhealthy，整体 health 返回 503；恢复后可重新变为 ready。子进程异常退出则整组退出并清理本次服务。

体素的生产路径是主域/voxel-campus/，轻量校园是主域/campus-entry/；原神原版生产链接保留既有子域根 release，本地/legacy.html 不能照搬成生产路径。部署仍需所有者当次明确发起或授权。

## 先做离线检查

从仓库根目录执行（不监听端口、不打开浏览器）：

~~~powershell
node --test qa/node-tests.cjs qa/desktop-node-tests.cjs
pwsh -NoProfile -File qa/preflight-tests.ps1
# 无需任何app依赖的主页预检
node tools/dev-workspace.mjs --site-only --check
# 完整五服务预检：不监听端口，也不打开数据库
node tools/dev-workspace.mjs --check
node apps/liyun-explorer/scripts/asset-manifest.mjs --check
~~~

启动器改动还须运行以下真实 HTTP 集成回归：

~~~powershell
node --test qa/workspace-api-tests.mjs
~~~

该回归通过程序化入口向同一启动流程传入隔离端口；日常 CLI 没有端口覆盖选项，仍固定使用上表端口。测试使用临时合成问答和临时 SQLite，覆盖五服务就绪、Vite 同源登录/存档、账号健康失败与超时、端口冲突回滚、site-only 不打开数据库、父子 IPC 断开与账号进程意外退出后的清理。既有服务不会被接管或停止。受限环境需允许测试的临时文件和本地回环操作，不能删除断言来跳过失败。

[素材负向预检](preflight-tests.ps1) 验证缺少音频源目录/源字体时明确失败，并比较现有音频、字体与字表哈希，确认没有项目文件被覆盖；不运行真实转换。

[纯 Node 测试](node-tests.cjs) 与[桌面内核 VM 测试](desktop-node-tests.cjs)覆盖路径穿越/编码/隐藏文件、Host、包含关系、固定端口配置、断言失败和目标 URL 校验；它不是 HTTP 服务实测，不证明浏览器布局/渲染已通过。

## 保留的浏览器入口

2026-10-31 手机开始菜单/搜索的自动聚焦与键盘高度变化修复使用[独立回归](mobile-shell-20261031/QA.md)，包括 `node --test qa/window-overflow-tests.cjs` 以及隔离手机视口浏览器测试；候选版本和当前发布状态见[修复记录](../docs/MOBILE-KEYBOARD-20261031.md)。

2026-10-29 的 AidenOS 开场 / 上滑 / 普通文本登录改动使用单独的局部回归，不需要重跑整站流程：

~~~powershell
node docs/boot/gate-contract-tests.cjs
node qa/boot-20261029/browser.cjs
# 可选：固定动画帧的视觉诊断，不能用作原生时序或性能结论
node qa/boot-20261029/capture-frame.cjs
~~~

浏览器回归只启动临时合成问答服务及自有无界面 Edge，覆盖原生时序的聚字、加载环、CDP 上滑、中文文本、授权离场、Esc 中止和减少动态；不启动其他应用，不读取真实答案。证据与限制见[本次记录](../docs/boot/QA.md)。Windows Edge 启动器可以交接后以 0 退出；运行器继续等待本次唯一临时 profile 的 DevToolsActivePort，不连接已有用户浏览器。

旧文件名和主要命令行参数保留，共用 [隔离运行器](lib.js)。当前版本使用 Node 22.12+ 原生 WebSocket/CDP，无需安装 chrome-remote-interface；已有全局包也不影响运行。默认 Edge 路径可通过 EDGE_PATH 环境变量指定。每次创建唯一临时 profile，调试端口默认由浏览器分配（0），结束只关闭本次浏览器。显式 --port 仍支持，但被占用时失败，不连接已有调试服务。

| 入口 | 当前范围 |
| --- | --- |
| [cdp.js](cdp.js) | 兼容 --url / --out / --wait / --eval / --eval-file / --size / --port；默认主页 8899 |
| [interact.js](interact.js) | 保留旧交互回归，断言失败直接抛异常；作为 eval-file 或 OpenCLI eval 输入 |
| [locktest.js](locktest.js) | 历史点击式锁屏回归；不适用当前私密问答，不应直接在真实认证服务运行 |
| [desktop-upgrade.js](desktop-upgrade.js) | 新版桌面补充回归：记事本、偏好、窗口竞态、贴靠、显示桌面、日历与通知；合成 DOM/API 输入 |
| [shortcut-test.js](shortcut-test.js) | 保留位置 URL 参数；真实双击后必须恰好产生一个正确新标签。默认仅理韵 5174、校园 8081 |
| [genshin-flow-test.js](genshin-flow-test.js) | 保留 skip / flow / both，默认校园 8081 → 理韵 5174；目标、选择器和端口可参数化 |

快捷方式测试只证明打开目标正确，不替代目标应用的功能验收。默认不测试北湖霜降公网链接，因为当前工作区没有该应用本地副本。页面 JS 中调用 window.open 时先拦截非预期目标，避免错误映射意外访问公网。

## 体素接入前的修订回归（历史三服务快照）

私密锁屏接入后，skipLock 不再授权。上表的旧桌面/锁屏/快捷方式脚本是历史兼容资料，**不能再直接对真实问答服务自动解锁**。不要把实际答案补进旧脚本、命令行、截图或日志。当前桌面浏览器回归通过 [合成问答临时服务](<revision-20261028/fixture.cjs>) 运行仓库真实前端，不读取真实配置。

~~~powershell
# 使用临时合成配置，不修改真人答案或其限流记录
node --test qa/revision-20261028/auth-tests.mjs
# 10月28日历史交互脚本：保留原貌，旧密码框断言不适用于10月29日的普通文本输入
node qa/revision-20261028/desktop-browser.cjs
# 校园流程仍独立适用，无需桌面问答
node qa/genshin-flow-test.js --mode both --url "http://127.0.0.1:8081/" --target "http://127.0.0.1:5174/"
~~~

[历史HTTP检查](revision-20261028/live-http.cjs)保存了当时三服务断言；体素发布目录保存其后的四服务记录。历史脚本、JSON、截图均不改写，不能用旧数量冒充当前五服务验收。旧快捷方式脚本默认也不包含体素校园，不能据其通过宣称新入口已验收；本次启动器契约由上述新集成回归验证。

以上门禁测试只监听回环临时端口；所有时间边界使用可控测试时钟，生产冷却仍为300秒。OpenCLI若扩展未连接，不安装或更改用户登录设施，改用项目自有隔离Edge/CDP测试并明确此验证边界。原版开场另做独立真实资源/流程验收，不能拿校园QA接口充当原版结果。

## 成功/失败契约

- 顶层 ok 与进程退出码一致：成功为 ok:true / 0；捕获异常、浏览器 console.error/assert、未取消的请求失败、HTTP 4xx/5xx、导航超时、Runtime.evaluate 异常、失败断言为 ok:false / 1。
- eval 直接返回 false、null、undefined 视为失败；JSON 字符串会解析成对象，checks/results 中每项必须明确 pass/passed/ok 为 true，空列表、总数不匹配也失败。
- --require-checks 要求非空断言列表。没有 eval 的截图命令是**诊断**，assertions:0 不能写成“功能通过”；普通指标对象也不自动变成断言。
- flow 按 origin + pathname 匹配目标，拒绝前缀域名伪装；测试目标有 query/hash 时也匹配。所有浏览器异常保留，不截断成“无错误”。
- 只有明确取消的网络请求被忽略，正常导航打断加载不算业务失败。失败需要调查，不能删断言来让报告变绿。

## 证据目录与历史资料

根目录已有 final-desktop、live-desktop、genshin-1-login 等 PNG 都是**历史截图**，不能表示 V2 已通过。理韵 app 内原 qa 目录没有迁入；缺失情况见 [历史 QA 标记](../apps/liyun-explorer/docs/QA.md)。

[首轮证据](upgrade-20261027/)及[体素接入前的修订证据](revision-20261028/)保留原貌；脚本维护者不覆盖或改写。四服务、体素与后续发布的已有证据见[发布记录](../docs/RELEASE-20261028.md)。后续提交由提交者在自己的版本上重新检查，并另存实际完成的测试及浏览器结果。不编造测试时间、设备、帧率或通过数量。实际验收还要覆盖升级计划中的四档视口、键盘、触摸、减少动态、暗色、存储受限、返回/刷新与失败降级；合成 DOM 事件不能替代真实触屏证据。
