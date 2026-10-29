# 贡献指南

欢迎提 issue / PR。三个应用分别维护自己的依赖与锁文件，主页保持原生静态前端。当前启动方式以根 README 和 `tools/dev-workspace.mjs` 为准；带日期的升级、验收和发布文档记录当时的状态。本次已排查的问题与预防约定见[协作维护记录](docs/COLLABORATION.md)，提交和合并统一遵循本文。

## ⛔ 不要部署

树莓派（studentop.cn 线上站点）的部署**只能由仓库所有者发起**。
作为贡献者，请只改代码、只提 PR：

- 不要执行 deploy/ 下的发布脚本（deploy-site.sh / install-git-hooks.sh / verify.sh …）
- 不要连接这台服务器（ssh / scp / rsync）
- 不要触发或修改 .github/workflows/publish.yml

完整约定见 DEPLOYMENT-POLICY.md。

## 提交前自检

1. **不提交密钥与隐私**：token、私钥、真实学号、内网地址、参与者数据、.env；
2. **不改 apps/genshin-start/ 的免责声明**（上游要求保留）；
3. 改 site/ 时保持零依赖：不要引入框架 / CDN / 外部字体 / 统计脚本；
4. 检查 `git status --short` 与 `git diff --check`，只提交自己的改动，避免夹带无关的锁文件或生成文件；
5. 按下面的本地流程检查受影响模块，保存实际结果，不覆盖历史 QA 证据。

## 本地开发

推荐使用 Node.js 24；前端最低要求为 22.12。每个应用在依赖缺失或锁文件变动时分别执行 `npm --prefix apps/<应用目录> ci`，不在根目录创建 npm workspace。

从仓库根执行：

```powershell
node tools/dev-workspace.mjs --check
node tools/dev-workspace.mjs
# 只查看主页时使用 --site-only，不要求三个应用依赖已安装
```

完整模式管理五项服务：主页 8899、理韵账号 API 8787、理韵前端 5174、纸境入场 8081、体素校园 5180；都只监听回环，端口冲突直接失败。不要停止或复用旧 5173 / 4173 服务、8080 SSH 转发或其他人启动的服务。退出自己启动的统一启动器后，才单独启动应用。

主页锁屏依赖启动器提供的同源认证接口，通用 Python 静态服务器无法代替它。完整模式自动启动理韵账号 API，前端仍请求同源 `/api`；账号服务必须通过实际健康请求，整组才会报告就绪。`--site-only` 只运行主页。单独调试 API 时可使用 `npm --prefix apps/liyun-explorer run server`，避免与完整模式重复启动。首次私密门禁配置见[修订说明](docs/REVISION-20261028.md)，不在命令行或日志里保存真实答案。

## 检查与构建

主页 JS 语法检查需逐个文件执行，避免将通配符作为一个文件名传给 Node：

```powershell
Get-ChildItem -LiteralPath site/assets/js -Filter *.js -File | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw ('Syntax check failed: ' + $_.Name) }
}
node --test qa/node-tests.cjs qa/desktop-node-tests.cjs
node --test qa/workspace-api-tests.mjs
```

第二条回归用隔离端口和临时数据验证五服务启动、同源账号流程、端口冲突与退出清理；只运行本次拥有的服务，不测试真实私密问答或生产数据库。理韵改动按范围执行：

```powershell
npm --prefix apps/liyun-explorer test
npm --prefix apps/liyun-explorer run test:server
node apps/liyun-explorer/scripts/verify-calibrated-map.mjs
node apps/liyun-explorer/scripts/asset-manifest.mjs --check
```

许可文本也参与素材哈希；其 LF 换行由 `.gitattributes` 固定。素材有意变更后先审查差异，再运行 `asset-manifest.mjs`（不带 `--check`）更新清单；不要为消除报错而跳过核对。

对受影响的应用执行对应构建：

```powershell
npm --prefix apps/liyun-explorer run build
npm --prefix apps/genshin-start run build
npm --prefix apps/liangxiang-cloudwalk run build
node tools/build-site.mjs
node tools/build-site.mjs --check dist-site
```

这些命令只做本地构建，不发布。浏览器交互、门禁、缓存与多尺寸回归见 [QA 说明](qa/README.md)，浏览器操作先加载 opencli。当前结果另存新的 QA 目录；构建或截图成功不能代替业务断言通过。

## 提交约定

- 每个提交围绕一个完整改动，标题使用 `类型(模块): 具体变化`，例如 `fix(assets): 固定许可文本换行`。常用类型为 feat、fix、docs、test、chore；模块可用 site、liyun、campus、voxel、tooling。
- 提交前检查 `git diff`、`git diff --cached` 与 `git diff --check`，审核源码、文档、锁文件和有意更新的素材清单；不使用无关格式化或生成文件掩盖业务差异。
- 修改当前行为时同步维护入口文档；历史报告保留当时事实。新增验收结果注明提交或工作区基线、命令、环境与实际结果。
- 改地标数据时同时核对前端坐标、后端云存档锚点和相关测试；GPS、朝向、口令不能混入存档结构。

## PR 前同步、自审与自行合并

仓库所有者已明确采用**提交者自审、自测并自行合并**的协作方式。满足下列条件后，提交者直接合并 PR，无需等待所有者手动审核或点击 Merge。

1. **在 PR 之前检查最新云端代码。** 在自己的工作分支、已提交或妥善保存本地改动后，执行 `git fetch origin`，再执行 `git merge origin/main`，将最新远端主分支整合进工作分支。云端内容指最新 `origin/main`，不使用生产站点文件作为合并基线。
2. **审核合并兼容性。** 解决全部冲突，逐项检查相关模块的业务语义、接口、配置、存档格式、资源路径和锁文件。通过 `git diff origin/main...HEAD` 自审本次改动，并用 `git merge-base --is-ancestor origin/main HEAD` 确认已包含刚拉取的远端主分支。冲突处理保留双方有效改动。
3. **在合并后的版本上完成检查。** 执行上文受影响模块的语法检查、单测、素材校验与构建；涉及交互时补浏览器验收。失败项修复后重跑，结果填写在 PR 模板中。
4. **创建 PR 后直接合并。** 推送工作分支并创建 PR；确认平台允许合并、必需检查通过且没有未解决冲突，即由提交者执行 Merge。平台正在计算状态或检查尚未完成时，等待明确结果。遵守实际分支保护规则。
5. **合并时再次核对最新状态。** 如果检查期间远端 main 又有新提交，重复同步、兼容性审核和受影响测试，再合并。使用保留提交历史的 merge commit，避免覆盖团队提交或强推共享 main。

提交者对自审和合并结果负责；正常且检查通过的 PR 不需要把合并操作转交所有者。遇到无法独立判断的业务冲突或平台阻塞时，在 PR 中写明具体原因和已完成的检查。

普通 push 和 PR Merge 都只更新代码，不触发本站发布；仓库 pre-push 模板只做本地主页构建校验，部署仍由所有者当次明确发起或授权。

## PR 里写清楚

- 改了什么、为什么；
- 有没有影响线上（如果有，说明需要所有者发布）；
- 相关的 issue 编号。
