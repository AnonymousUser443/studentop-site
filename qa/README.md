# 本地 QA · 严格失败与证据边界

本轮主浏览器验收必须先加载 **opencli** 技能，由 Lead 统一启动服务并运行浏览器。成员只编写/静态检查脚本，不自行起浏览器或服务。不会默认访问线上地址；旧 5173 / 4173 / 8080 不能当作本轮目标。

## 当前四服务契约（体素校园接入轮）

| runner id | 本地地址 | 用途 |
| --- | --- | --- |
| site | <http://127.0.0.1:8899/> | 原生主站及同源门禁 |
| liyun | <http://127.0.0.1:5174/> | 理韵寻踪 |
| campus | <http://127.0.0.1:8081/> | 轻量校园；原版共用 /legacy.html，不另计服务 |
| voxel | <http://127.0.0.1:5180/> | 新体素校园，主站appid为voxel-campus |

所有端口严格绑定回环；--site-only只要求主页文件，不预检/启动三个app的依赖。体素的生产目标是主域/voxel-campus/，轻量校园是主域/campus-entry/；原神原版生产链接保留现有子域根release，本地/legacy.html不能照搬成生产路径。安装、构建、服务与新授权的提交/推送/部署均由Lead独占；本成员不执行。

## 先做离线检查

从仓库根目录执行（不监听端口、不打开浏览器）：

~~~powershell
node --test qa/node-tests.cjs qa/desktop-node-tests.cjs
pwsh -NoProfile -File qa/preflight-tests.ps1
# 无需任何app依赖的主页预检
node tools/dev-workspace.mjs --site-only --check
# 三个应用均已导入且由Lead安装后，再做完整四服务预检（仍不监听）
node tools/dev-workspace.mjs --check
node apps/liyun-explorer/scripts/asset-manifest.mjs --check
~~~

[素材负向预检](preflight-tests.ps1) 验证缺少音频源目录/源字体时明确失败，并比较现有音频、字体与字表哈希，确认没有项目文件被覆盖；不运行真实转换。

[纯 Node 测试](node-tests.cjs) 与[桌面内核 VM 测试](desktop-node-tests.cjs)覆盖路径穿越/编码/隐藏文件、Host、包含关系、固定端口配置、断言失败和目标 URL 校验；它不是 HTTP 服务实测，不证明浏览器布局/渲染已通过。

## 保留的浏览器入口

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
# 当前门禁、启动与多尺寸交互：负责人使用隔离浏览器执行
node qa/revision-20261028/desktop-browser.cjs
# 校园流程仍独立适用，无需桌面问答
node qa/genshin-flow-test.js --mode both --url "http://127.0.0.1:8081/" --target "http://127.0.0.1:5174/"
~~~

[历史HTTP检查](revision-20261028/live-http.cjs)保存了当时三服务断言，不能直接当作当前四服务验收。该目录原脚本、JSON、截图均不改写，不把“3”替换为“4”伪造历史通过；Lead另建本轮current测试与证据。旧快捷方式脚本默认也不包含体素校园，不能据其通过宣称新入口已验收。

以上门禁测试只监听回环临时端口；所有时间边界使用可控测试时钟，生产冷却仍为300秒。OpenCLI若扩展未连接，不安装或更改用户登录设施，改用项目自有隔离Edge/CDP测试并明确此验证边界。原版开场另做独立真实资源/流程验收，不能拿校园QA接口充当原版结果。

## 成功/失败契约

- 顶层 ok 与进程退出码一致：成功为 ok:true / 0；捕获异常、浏览器 console.error/assert、未取消的请求失败、HTTP 4xx/5xx、导航超时、Runtime.evaluate 异常、失败断言为 ok:false / 1。
- eval 直接返回 false、null、undefined 视为失败；JSON 字符串会解析成对象，checks/results 中每项必须明确 pass/passed/ok 为 true，空列表、总数不匹配也失败。
- --require-checks 要求非空断言列表。没有 eval 的截图命令是**诊断**，assertions:0 不能写成“功能通过”；普通指标对象也不自动变成断言。
- flow 按 origin + pathname 匹配目标，拒绝前缀域名伪装；测试目标有 query/hash 时也匹配。所有浏览器异常保留，不截断成“无错误”。
- 只有明确取消的网络请求被忽略，正常导航打断加载不算业务失败。失败需要调查，不能删断言来让报告变绿。

## 证据目录与历史资料

根目录已有 final-desktop、live-desktop、genshin-1-login 等 PNG 都是**历史截图**，不能表示 V2 已通过。理韵 app 内原 qa 目录没有迁入；缺失情况见 [历史 QA 标记](../apps/liyun-explorer/docs/QA.md)。

[首轮证据](upgrade-20261027/)及[体素接入前的修订证据](revision-20261028/)保留原貌；脚本维护者不覆盖或改写。当前体素导入、四服务启动、主站跳转与生产发布由Lead新建记录，成员仅报告自己实际完成的离线检查。不编造测试时间、设备、帧率或通过数量。实际验收还要覆盖升级计划中的四档视口、键盘、触摸、减少动态、暗色、存储受限、返回/刷新与失败降级；合成 DOM 事件不能替代真实触屏证据。
