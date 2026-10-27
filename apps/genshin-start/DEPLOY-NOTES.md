# 本部署对原项目的改动（原神启动 → 理韵寻踪 入场）

上游：`https://github.com/` 上的 `www-genshin`（原神启动，three.js + xviewer 复刻；
作者 TEAM.x.y.z，B 站视频 BV1E8411v7xy）。本项目按其 README 的免责声明仅作技术展示，
部署在 `https://genshin.studentop.cn:14355/`。

## 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/App.tsx` | **关键修复**：这份下载副本里 `Menu`（登录界面）与 `Preloader`（加载进度）**根本没有被挂载**，导致「开始」按钮永远不出现、也没有门。已接回：`<Preloader />` 常驻，`{!loading && <Menu />}` 在资源 preloaded 后挂载；同时移除 FPS 调试浮层（`FPSMonitor`） |
| `src/core/exit.ts` | **新增**。集中管理「开门之后的去向」：`DEFAULT_EXIT_URL = https://liyun.studentop.cn:14355/`，可用 `window.__EXIT_URL__` 覆盖，`goExit()` 防重复跳转 |
| `src/core/GameManager.ts` | `restart()` 原本跳作者 B 站视频 → 改成 `goExit('door-open')`（开门白光过场结束时触发） |
| `src/main.tsx` | ① 支持 `?skip=1` / `#skip` 直接跳转；② 增加 WebGL 可用性检测，无 WebGL 时渲染降级页（按钮 + 9 秒自动跳转），不再卡在「正在启动」 |
| `src/pages/Menu.tsx` | 左上角新增「跳过开场 · 进入 理韵寻踪 →」按钮 |
| `src/pages/Menu.less` | 上述按钮样式 |
| `src/index.css` | 无 WebGL 降级页样式 |
| `index.html` | 标题改「原神启动 · 理韵寻踪」、补 description / theme-color / noscript 兜底、预留 `window.__EXIT_URL__` 覆盖位 |
| `src/core/components/ShaderTest.ts` | **删除**：上游遗留的调试文件，import 路径本身就错（`../libs/xviewer`），会让 `tsc` 直接失败；全项目没有任何引用 |

其余代码、资源、素材（`public/Genshin/**`）保持上游原样。

## 开场流程（改动后）

1. 预加载 → 登录界面（免责声明 + 开始按钮）
2. 点开始 → 镜头沿路前行 → 门出现（「点击开门」提示）
3. 点击任意处 → 白光过场 + 门开 → **2 秒后跳转 `https://liyun.studentop.cn:14355/`**
4. 任何时刻都可以点左上角「跳过开场」；`?skip=1` 直接进目的地

## 构建 / 发布

```bash
npm run build          # tsc && vite build → dist/
# 发布到树莓派（见仓库 deploy/PROJECTS.md 的「更新原神启动」一节）
```
