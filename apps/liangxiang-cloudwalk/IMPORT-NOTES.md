# 云上良乡 · 导入与权利说明

## 来源与范围

源项目为用户指定的 `liangxiang-cloudwalk`，Lead 确认来源提交为 `5c43b09`、工作区 clean，并提供精确 39 tracked 文件清单。导入成员未运行 Git，也没有更改来源目录。按该清单逐项独占新建复制，每项复制后均与源 SHA-256 一致。

[IMPORT-MANIFEST.json](./IMPORT-MANIFEST.json) 记录 source commit、39 个源文件的路径/大小/SHA-256、集成后的 hash 及 modified 标记，不记录绝对宿主路径或历史 Git。没有复制 `.git`、`node_modules`、`dist`、`.openai`、`.preview`、凭据或外部原始照片。Lead 后续安装生成的本地依赖不属于从来源复制的内容。

## 最小集成改动

源项目 39 文件中，以下八项产生集成差异：

1. [vite.config.js](./vite.config.js)：保留 `base: './'`；开发改为 127.0.0.1:5180，预览改为 127.0.0.1:4180，均 strictPort；补 Windows polling 与原子写临时文件忽略。目标公开路径为主域 `/voxel-campus/`，由 Lead 统一发布。
2. [src/main.js](./src/main.js)：原来的只读 `window.campus.stats()` 改为仅 DEV 挂载，不在生产暴露维护状态；没有新增控制、fakePhase 或出口覆盖接口。
3. [README.md](./README.md)：补导入边界、当前端口与生产子路径；明确源项目历史 QA 记录不是本仓库结果。
4–8. 五个历史 QA 脚本：[verify.mjs](./scripts/verify.mjs)、[check-bgm.mjs](./scripts/check-bgm.mjs)、[check-assets.mjs](./scripts/check-assets.mjs)、[check-portal.mjs](./scripts/check-portal.mjs)、[snapshot.mjs](./scripts/snapshot.mjs)：移除作者机器账户缓存与固定浏览器绝对路径，统一使用可选依赖探测和显式错误；没有执行这些历史浏览器用例。

另外新增本说明、导入清单、[browser-tools.mjs](./scripts/browser-tools.mjs) 与 [three-MIT.txt](./public/licenses/three-MIT.txt)。package.json、package-lock.json 及场景/交互/音乐实现保持来源字节。未改写旧原神资源、原版入口或已有校园渲染；桌面链接、统一启动器、主域部署与缓存更新由其他任务负责。

## 音乐、字体与研究来源

- 三首 Opus 音乐原样保留于 [bgm](./bgm/)，属于用户提供素材；本导入不改变权利归属，不宣称 MIT、CC0 或其他开源音乐许可，也不虚构作者与授权来源。发布授权由用户和 Lead 的统一发布流程处理。
- Noto Serif SC / Noto Sans SC 字体子集原样保留，随附 [OFL.txt](./public/fonts/OFL.txt)，不删除许可。
- 在 Lead 完成依赖安装后，只读该应用已安装 Three.js 的 LICENSE，将 MIT 全文原字节复制为 [three-MIT.txt](./public/licenses/three-MIT.txt)，随 public 正常构建进入产物。此许可仅对应 Three.js，不自动扩展到用户音乐或整份项目。
- 保留 [RESEARCH.md](./RESEARCH.md)、[REFERENCE-NOTES.md](./REFERENCE-NOTES.md) 和 [PHOTO-ASSETS.md](./PHOTO-ASSETS.md)。外观依据研究/用户提供参考作艺术化几何表达；外部原始照片并未复制进当前项目或部署资源。
- 没有为整份导入内容擅自添加 MIT LICENSE。代码、音乐、字体与参考资料应按各自实际权利状态理解。

## 验收边界

导入成员只作逐文件 hash、JavaScript 语法与配置/资源路径检查，不安装、不 build、不启动服务、不执行原浏览器测试脚本、不进行 Git 操作或远程发布。源目录会在交接前再次按原 hash 复核；实际源码清单与八项修改以 manifest 为准。

源码保留的历史验证脚本使用 `.preview/` 输出，临时服务、旧测试端口及部分未导入的原始 QA 夹具仍属于历史测试契约；它们被保留用于研究追溯，未经本轮执行。五脚本的私有机器路径已移除：`PLAYWRIGHT_MODULE` 可指定已有 Playwright 模块，否则尝试项目与仓库根依赖解析；缺失时明确抛错。`BROWSER_EXECUTABLE` 可指定已安装 Chromium/Edge 的路径，否则使用 Playwright 已有浏览器；失败会清楚说明，不自动安装包或下载浏览器。DEV 只读诊断可供开发验收；生产应断言 `window.campus` 不存在，并通过真实 UI、资源请求、四时切换和音频行为验证 `/voxel-campus/` 子路径。最终安装、构建、浏览器、commit/push 与 Pi 发布证据由 Lead 记录，不以原 README 的历史通过描述替代。
