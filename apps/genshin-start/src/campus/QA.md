# 校园入场 · 验收交接

## 已执行的本地检查
- `node node_modules/typescript/bin/tsc --noEmit`：完整入口、场景与几何均落盘后执行，退出码 0。
- `node src/campus/exit-policy.test.mjs`：生产默认、DEV 与本地预览回环限制、http(s) 覆盖校验、重复导航防护、BFCache 返回导航重置，实际断言通过。
- `git diff --check -- apps/genshin-start`：退出码 0；仅 LF/CRLF 提示。
- Vite 配置另用 `tsc --noEmit --incremental false --composite false -p tsconfig.node.json` 检查：退出码 0。
- Vite4 类型已核实支持 `copyPublicDir:false`；生产插件白名单仅发出原创 fallback、两字体、两 OFL 与原 LICENSE.txt。旧 Genshin 源资源不删除且不复制到新产物；产物文件清单仍需 Lead 最终 build 检查。
- 未由 campus 执行安装、构建、服务启动、部署、推送或浏览器操作。依赖安装与锁文件由 Lead 负责；浏览器验收与最终构建由 Lead 统一负责。

## 两轮实际验收记录
当前状态：**两轮视觉评审、完整入场/跳过与韧性检查已完成。最终字体、生产构建与 preview 由 Lead 统一完成，以其最终报告为准。**

### 首轮截图与修订
Lead 提供四张首轮截图，campus 实际 read_image 四张并确认：文博柱廊/圆鼓/镂空梁形成真实空间，但欢迎帧在 1.1 秒淡入时与 fallback SVG 叠影，桌面门庭文案压在深玻璃上不可读，欢迎右端主景贴边。之后 Lead 在同一文件路径覆盖写入第二轮图片；文件名中的 first 不代表当前仍是失败帧。
修订：ready 同次 DOM 提交移除 fallback，取消 canvas 跨淡入；journey/arrival/entering 文案和 header 采用不透明暖纸底；欢迎镜头从 z38 改 z52，桌面 FOV45→48，视线对中，侧翼各内移4单位但留在主体外侧。字体与相机静态参数修订后 tsc/diff-check 再次通过。

### 第二轮复拍与实际流程
- Lead 已目视认可第二轮。campus 又实际 read_image 复核 [欢迎稳态图](<../../../../qa/upgrade-20261027/campus-welcome-first.png>) 与 [门庭稳态图](<../../../../qa/upgrade-20261027/campus-arrival-first.png>)：单场景、单太阳；欢迎白色横框有留边且左右校园楼可见；门庭文案和页眉具稳定纸色底，玻璃幕墙不再吞没文字。
- 读取时欢迎图 SHA-256：`ec0a7a249169124affeefd1ec506dd32f25a5a749da142ca4c6212007f2fa798`；门庭图：`bc15450f04c44748eed286ecf8b9ea0509b144e3b8d0281169a6b641eaa8186e`。Lead 将另存不含 first 的最终稳定图；这里记录实际读到的覆盖版本。
- [完整入场报告](<../../../../qa/upgrade-20261027/campus-flow.json>) 已读取：`ok:true`，skip 与 flow 均通过，正常到达 arrival 并真实导航至本地 5174，记录 errors 为空。
- [韧性报告](<../../../../qa/upgrade-20261027/campus-resilience.json>) 已读取：16 项检查通过，覆盖 ready 无 fallback 层、暂停/恢复、隐藏标签停止帧、contextloss 静态入口、WebGL 不可用故障注入、390×844 减少动态与 DPR 上限、连续两次实际 Fast Refresh 及源文件内容 hash 不变。验证方法为隔离 Edge CDP，不代表物理移动设备实测性能。
- WebGL 不可用用例包含预期的故障注入诊断，单列在 `expectedFaultDiagnostics`，不与普通运行错误混淆。QA 关闭时 pending RPC 的噪声已通过 closing 状态保护修复；Lead 重新运行完整韧性测试，16 项通过，所有用例的非预期 errors 均为空。
- Fast Refresh 修复：dispose 不再强制 forceContextLoss，仍释放几何、材质、纹理、实例、阴影与 renderer，并清理事件/RAF；显式 QA loseContext 保留。修复后两次真实源码 utimes 触发均通过。

第一轮：桌面欢迎静帧看见文博中心整体横向白框与细方柱；前景植栽不可挡住中部主入口；门庭静帧看见白色圆鼓与真正镂空的方格梁；390×844 检查竖屏文字、整幅安全区和 CTA。
第二轮：点击/键盘从 welcome→journey→arrival→entering；自然播放、暂停/恢复、跳过、前后台、resize、减少动态、WebGL 不可用/上下文丢失、加载期跳过。检查控制台无 WebGL shader 错误；运行时无 Genshin 资源请求。

## 稳定自动化契约
- 仅开发构建、回环页面且 `?qa=1`：`window.__CAMPUS_QA__`。生产没有该全局控制。
- 只读：`phase`、`camera`、`performance`；完整快照：`snapshot()`。
- 动作：`start()`、`arrive()`、`enter()`、`advance(seconds)`、`resume()`、`loseContext()`。
- `advance(0..60)`进入手动时钟并前进相应秒数，停在确定帧；`resume()`恢复自然播放。进入门庭后必须调用 `enter()` 或点击按钮，不自动进入站点。
- `performance`含 frames/drawCalls/triangles/geometries/textures/fps/dpr/fpsLimit/backgroundPaused/manualClock/contextLost/viewport。
- DOM：`main[data-phase]`；`[data-testid="campus-start"]`、`[data-testid="campus-enter"]`；全程 `#campus-skip`，包括 React/Three 尚未加载。
- `?skip`、`?skip=1`、`#skip`直接跳过；`?skip=0`不跳过。

## 生命周期约束
高档 60fps、DPR≤1.75、1024 阴影；低档 30fps、DPR≤1.25、无阴影/光尘。触摸粗指针、≤4GB 内存、≤4核、减少动态选择低档，持续慢帧可从高档降档。隐藏标签取消 RAF，不推进镜头，恢复不会补播后台时间。资源统一去重释放，事件/ResizeObserver/RAF 在卸载时移除。

## 出口与降级
DEV 默认 `http://127.0.0.1:5174/`；生产公网默认保持原 `https://liyun.studentop.cn:14355/`。页面处于 localhost/127.0.0.1/[::1] 时，即使 production preview 有 JS，也只接受回环目标并默认为 5174。预注入只接受绝对 http(s) URL，拒绝用户凭据、相对地址和危险协议。
HTML 的常驻 skip 在应用模块前校验；Vite serve 的 noscript 链接为 5174，build 产物的 noscript 保留生产原目标。**无 JS 的 production preview 无法做运行时地址检测，因此仍是生产 noscript 链接，不应点击作本地跳转测试。**
初始化错误、12秒加载超时、contextlost 显示原创矢量静态入口；无倒计时强迫跳转。未实现音轨，本版本刻意静音。所有旧资源与原许可证保留，但不被新运行路径引用。
