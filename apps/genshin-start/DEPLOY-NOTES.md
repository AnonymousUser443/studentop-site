# 改造记录：原神启动 → 北理校园纸境入场

本文件记录源码与本地启动约定，不是发布成功报告。本轮未执行 SSH、push、上线或回滚操作。既有生产域名和默认出口保留，部署只能由仓库所有者明确发起。

## 本轮实际入口

| 文件 | 当前职责 |
| --- | --- |
| [index.html](index.html) | 校园标题、静态加载底图、常驻跳过、noscript；模块未加载时也保留出口 |
| [main.tsx](src/main.tsx) | skip 参数和常驻链接绑定，挂载新 App |
| [App.tsx](src/App.tsx) | 六阶段 UI、键盘、延迟导入 renderer、12 秒超时降级、开发 QA 接口 |
| [scene.ts](src/campus/scene.ts) | Three.js 渲染、真实相机推进、暂停、减少动态、质量/帧率/DPR 限制、上下文丢失和清理 |
| [geometry.ts](src/campus/geometry.ts) | 原创现代校园建筑、植栽、纸山、步道等程序几何 |
| [types.ts](src/campus/types.ts) | 状态、控制器、相机与性能快照契约 |
| [exit.ts](src/core/exit.ts) | 保留 DEFAULT_EXIT_URL / EXIT_LABEL / exitUrl / goExit，新增本地回环限制和覆盖校验 |
| [Vite 配置](vite.config.ts) | 开发/预览回环8081 strictPort；HTML 出口替换；Windows编辑临时文件忽略与轮询；关闭自动复制 public，仅构建时输出校园资产白名单 |
| [package](package.json) | 保留 npm start，新增等价 npm run dev；Three.js 0.170.0 与对应类型 |

新运行路径不引用旧 Canvas / Menu / Preloader / GameManager / xviewer。历史源码与 public/Genshin 完整保留，既没有删除，也没有因此取得新授权。当前构建关闭 build.copyPublicDir，build-only 插件只输出以下公开文件，加上正常编译的应用 HTML / JS / CSS：

~~~text
campus-fallback.svg
campus/fonts/noto-sans-sc.woff2
campus/fonts/noto-serif-sc.woff2
campus/fonts/OFL-NotoSansSC.txt
campus/fonts/OFL-NotoSerifSC.txt
LICENSE.txt（来自本应用根 LICENSE）
~~~

必需资源缺失直接使构建失败，不静默略过。旧游戏 public 资源不在发布白名单中；开发服务仍保留原 public 目录可访问性。此处根据当前配置说明产物边界，并不冒充已完成最终 build 或体积验收；实际产物与字节数由 Lead 运行构建后留证。

## 体验差异

旧版是游戏登录复刻、开始行进、点击开门、白光后进入理韵；历史无 WebGL 降级曾含 9 秒自动跳转。**这些不再描述当前入口。**

当前是 loading → welcome → journey（正常约10秒）→ arrival → entering（正常约2.8秒）→ 理韵。门庭阶段等待用户确认；降级是静态可用入口，不强制计时离开。右上角跳过常驻；整个版本静音，不请求旧游戏模型、音乐或在线字体。

场景以良乡文博中心为主景，提炼徐特立图书馆与综合教学楼的材料/窗列/体量；远山与步道为艺术化拼接。来源、可见特征和授权限制在 [建筑参考](../../docs/BUILDING-REFERENCES.md)，不称精确复原或校方官方项目。

## URL 与服务契约

- 统一开发入口：[工作区启动器](../../tools/dev-workspace.mjs)；主页8899，理韵5174，校园8081。它不是DSH服务，不安装依赖，不碰旧5173/4173/8080。
- 开发或有脚本的回环页面：默认 http://127.0.0.1:5174/。生产非回环页面：默认 https://liyun.studentop.cn:14355/（没有修改）。
- window.__EXIT_URL__ 只接受绝对 HTTP(S)、无用户名密码。本地页面额外要求回环主机；非法覆盖退回安全默认。
- ?skip=1 / #skip 直接导航，?skip=0 不跳过；goExit 防重复导航，并在 pageshow 重置以支持返回。
- HTML 链接与 noscript 在 DEV由Vite写入本地目标，在 build 写入生产目标。因此**生产 preview 完全禁用脚本时的链接仍会指向生产**；无脚本本地回归请使用开发服务。此差异不能被写成“所有模式都本地跳转”。
- 开发与 preview 都严格使用回环8081，不可同时运行。源码仍是独立 package；所有安装/构建/启动由负责人统一安排。

## 验收与未证实项目

[README](README.md) 记录开发 QA 接口及交互方式。[根 QA](../../qa/README.md) 保留旧脚本文件名但改为本地默认、精确目标与失败退出；flow 使用真实按钮和导航，不给应用注入期望出口来伪造配置正确。

本说明依据当前源码与 campus 成员确认编写，文档维护者没有运行浏览器、服务或联网部署。帧率上限、DPR、时长是实现参数，不是硬件实测结果。实际构建、四档视口、自然播放、后台暂停、上下文丢失与无脚本验收以负责人在根 QA 新证据目录保存的记录为准；旧 genshin 截图不代表本轮通过。

## 历史来源保留

上游 www-genshin（TEAM.x.y.z / gamemcu，MIT）曾修复 Menu / Preloader 未挂载和遗留 ShaderTest 路径问题，并集中加入理韵出口。这些历史修复帮助解释旧源码，但不再是新入口的依赖路径。保留原 [LICENSE](LICENSE)；第三方游戏美术与音频版权归原权利人，源码许可不授权其任意再分发或商用。
