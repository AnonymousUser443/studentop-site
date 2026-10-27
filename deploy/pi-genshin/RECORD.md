# 「原神启动」开场上线记录（2026-10-27）

## 结论

| 项 | 值 |
| --- | --- |
| 公网入口 | https://genshin.studentop.cn:14355/ |
| 开门后去向 | https://liyun.studentop.cn:14355/ （理韵寻踪） |
| 形态 | 纯静态（Vite 构建产物），nginx 直出 |
| 树莓派路径 | `/opt/projects/genshin/{releases/20261027T0835Z,current}` |
| 体积 / 文件数 | 9,329,295 B / 36 文件 |
| 校验 | 上传 tar sha256 双方一致（08e35b8f…58a）；index.html / JS bundle / 含空格文件名的 mp3 抽查一致 |
| 证书 | Let's Encrypt，SAN 含 genshin.studentop.cn（与主站共用一张） |
| DNS | `genshin` CNAME → cn-bj1-kvlqs4ee.frp.cool，TTL 600 |
| nginx | `/etc/nginx/sites-available/projects` 内新增 genshin server 块（源文件 `deploy/nginx-projects.conf`） |

## 改动（相对上游 www-genshin）

见 `genshin-entry/DEPLOY-NOTES.md`。要点：

1. **这份下载副本本身是跑不通开场的**：`App.tsx` 没有挂载 `Menu` / `Preloader`，所以永远不出现「开始」按钮；已接回（Menu 在 preloaded 后挂载），并去掉 FPS 调试浮层。
2. 删除 `src/core/components/ShaderTest.ts`（上游遗留调试文件，import 路径错误导致 `tsc` 失败，全项目无引用）。
3. 新增 `src/core/exit.ts`，`GameManager.restart()` 从「跳作者 B 站视频」改为 `goExit()` → 理韵寻踪。
4. 兜底：`?skip=1` / `#skip` 直跳；左上角「跳过开场」按钮；无 WebGL 时降级页（按钮 + 9 秒自动跳转）；`index.html` 的 `window.__EXIT_URL__` 可覆盖去向。

## 验收（全部实测）

- `bash deploy/preflight-public.sh` → **8 PASS / 0 FAIL**
- `node qa/genshin-flow-test.js --url https://genshin.studentop.cn:14355/ --mode both`
  - `?skip=1` → 立即落到 `https://liyun.studentop.cn:14355/`
  - 完整流程：开始按钮 5.2s → 门 12.2s → 点击开门 → 约 24.1s 落到 liyun；控制台 **0 error**
- 主页 `qa/interact.js` → **29/29**；桌面三个快捷方式真实双击各自落到正确站点（`qa/shortcut-test.js`）

## 回滚

```bash
ssh pi 'sudo -n ln -sfn releases/<上一个时间戳> /opt/projects/genshin/current'
# 或整个下线：把 sites-available/projects 里的 genshin server 块删掉 + nginx -t && reload
```
