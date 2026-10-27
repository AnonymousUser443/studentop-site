# 理韵寻踪 HUD — 构建与树莓派部署报告

- 任务：task-5（owner: liyun-deployer）
- 时间：2026-10-27 14:50–15:00 (+08:00) / release 时间戳 **20261027T0656Z**（UTC）
- 状态：✅ 全部步骤完成，冒烟全绿，临时 http.server 已停止且无残留监听

## 1. 构建

源码目录：`D:/Users/Desktop/北理的文件夹/学习相关/软件工程导论研究型课程/理韵寻踪前端HUD开发/web`
命令：`npm run build`（= `tsc -b && vite build`）

```
vite v7.3.7 building client environment for production...
✓ 47 modules transformed.
dist/index.html                     0.55 kB │ gzip:   0.41 kB
dist/assets/index-r_u_YNWD.css     37.81 kB │ gzip:   9.60 kB
dist/assets/index-BY2Dy2Ra.js   1,358.34 kB │ gzip: 363.86 kB
(!) Some chunks are larger than 500 kB after minification.  ← 唯一警告（p5+react 单 chunk），非阻塞
✓ built in 4.73s
```

- tsc -b：无 TS 报错（源码无需修改）
- Node v24.22.0 / npm 12.2.1；vite 7.3.7
- 注意：package.json 里 vite 版本 ^7.2.2 实际安装为 7.3.7（node_modules 既存）
- 构建前 dist 已存在（14:23 的旧产物，文件名哈希与新构建完全一致 → 源码未变、构建可复现）

## 2. 测试

`npm test` → **3 个测试文件 / 13 个测试全部通过**，285ms

```
✓ src/effects/timing.test.ts (3 tests)
✓ src/map/geometry.test.ts (5 tests)
✓ src/state.test.ts (5 tests)
Test Files  3 passed (3)   Tests  13 passed (13)
```

## 3. dist 统计与校验

- 文件数：**22**；总体积：**26,297,748 B（26M）**
- 按目录：assets/art 2 文件 3.3M；assets/audio 7 文件 11M；assets/fonts 5 文件 6.0M；assets/maps 5 文件 3.7M；assets 根 js+css；index.html
- sha256 清单（22 行，按路径排序）：[dist.sha256](./dist.sha256)（本目录，紧邻 tar 包）
- tar 包：[dist.tar.gz](./dist.tar.gz) 23,055,292 B，sha256 `ee178337454a755e0ba8a2450c24643812a217ff82a2ece6d3a6c761fa38d5f2`（见 [dist.tar.gz.sha256](./dist.tar.gz.sha256)）
- 远端解压后 `sha256sum -c`：**22/22 OK**；安装后再校验一次：**22/22 OK**
- 远端审计副本：`/opt/projects/liyun/releases/20261027T0656Z.sha256`（root:root 644，不进 webroot）

## 4. 部署（树莓派 pi，Debian 13 trixie aarch64）

| 项 | 值 |
|---|---|
| release 目录 | `/opt/projects/liyun/releases/20261027T0656Z` |
| current 软链 | `/opt/projects/liyun/current -> releases/20261027T0656Z`（相对目标，便于原子切换） |
| readlink -f current | `/opt/projects/liyun/releases/20261027T0656Z` |
| 权限 | 文件 22 个全部 **644 root:root**；目录 6 个全部 **755 root:root**（含 /opt/projects、liyun、releases） |
| 属主 | root:root（sudo -n 安装） |
| 体积 | 26M，磁盘剩余 23G |
| 可读性 | `sudo -n -u www-data test -r` index.html / index-*.js → OK（nginx worker 可读） |
| tar 上传 | 分 4 块（6M×3 + 4.2M）scp 到 /tmp 后 cat 重组，sha256 与本地一致 |

未触碰：nginx 配置（sites-available 仍只有 default、win11-home）、DNS、证书、frpc、/opt/win11-home。nginx 状态 active。

## 5. 冒烟测试（树莓派本机 127.0.0.1:8899，python3 -m http.server -d /opt/projects/liyun/current）

| 路径 | 状态码 | 字节 | Content-Type |
|---|---|---|---|
| `/` | 200 | 548 | text/html |
| `/assets/index-BY2Dy2Ra.js` | 200 | 1,358,341（Content-Length: 1358341 > 1000 ✓） | text/javascript |
| `/assets/index-r_u_YNWD.css` | 200 | 37,809（Content-Length: 37809 > 1000 ✓） | text/css |
| `/assets/maps/campus-enhanced.webp` | 200 | 573,342 | image/webp |
| `/assets/maps/campus-enhanced-mobile.webp` | 200 | 218,434 | image/webp |
| `/assets/maps/campus.webp` | 200 | 1,070,594 | image/webp |
| `/assets/fonts/MaShanZheng-UI.woff2` | 200 | 187,600 | font/woff2 |
| `/assets/fonts/NotoSerifSC-UI.woff2` | 200 | 222,552 | font/woff2 |
| `/assets/fonts/MaShanZheng-Regular.ttf` | 200 | 5,857,936 | font/ttf |
| `/assets/audio/bgm1.opus` | 200 | 1,474,749 | audio/ogg |
| `/assets/audio/bgm1.mp3` | 200 | 4,162,484 | audio/mpeg |
| `/assets/audio/manifest.json` | 200 | 653 | application/json |
| `/assets/art/pine-left.png` | 200 | 2,097,170 | image/png |
| `/assets/art/mountain-right.png` | 200 | 1,283,128 | image/png |

- HTML 中可检出 `/assets/index-BY2Dy2Ra.js` 与 `/assets/index-r_u_YNWD.css`（grep 计数 2）
- 临时服务已 `sudo -n kill`：`ss -lntp | grep 8899` → **NO_LISTENER_8899**，`pgrep -af 'http.server 8899'` → 无进程
- 远端 /tmp 已清理：liyun-dist.tar.gz / liyun-dist.sha256 / 分块 / staging 目录全部删除（仅剩 Lead 的 aliyun_dns.py）

## 6. 资源路径 / 集成风险

1. **base 保持默认 `/` 是正确的**：站点部署在 liyun.studentop.cn 的**根目录**，构建产物内所有引用均为根绝对路径：
   - index.html：`<script src="/assets/index-BY2Dy2Ra.js">`、`<link href="/assets/index-r_u_YNWD.css">`
   - CSS：`url(/assets/fonts/*.woff2)`（2 个 @font-face）
   - 源码：img/audio 全部 `/assets/...`（App.tsx、useAudio.ts、MapScene.tsx）
   - 源码中**没有** `import.meta.env.BASE_URL`、没有写死 http(s) 源站、没有 fetch/XHR
   → **不需要改 base，也不需要改源码**。若以后改到子路径（如 /liyun/），才需要 `base:'/liyun/'` 并同步改这些绝对路径，当前不适用。
2. **无客户端路由**：全仓库无 react-router / pushState / location.pathname / serviceWorker → nginx **不需要 SPA fallback**（`try_files $uri =404` 即可）。
3. **`.opus` MIME（建议 Lead 在 nginx 侧处理，低风险）**：Debian nginx 自带 mime.types 只映射 `audio/ogg ogg`，**没有 opus 扩展名** → `.opus` 会以 `application/octet-stream` 提供。前端有降级：`canPlayType('audio/ogg; codecs="opus"')` 失败或 error/NotSupportedError 时自动切 `bgm*.mp3`，因此不阻塞；建议在 `/etc/nginx/mime.types` 的 `audio/ogg` 行补 `opus`（如 `audio/ogg ogg opus;`）避免多余降级请求。⚠️ 不要用 server 级 `types {...}` 覆盖（会丢掉全量 MIME 表）。
4. **建议 nginx（Lead 参考，root 指向软链即可）**：
   ```nginx
   root /opt/projects/liyun/current;
   index index.html;
   location / { try_files $uri $uri/ =404; }
   # 可选：JS 1.36MB，开 gzip 可降到 ~364KB
   gzip on; gzip_types text/css application/javascript application/json image/svg+xml;
   # 可选：hashed 主包长缓存；art/audio/fonts/maps 文件名不含哈希，建议 7d 内
   location /assets/ { expires 7d; }
   location = /index.html { add_header Cache-Control "no-cache"; }
   ```
5. **体积提示**：单 chunk 1.36MB（p5 + react，gzip 364KB），首次加载偏重但可接受；如后续优化可 manualChunks 拆 p5。
6. **音频/大图**：bgm 为 4MB mp3 / 1.5MB opus，`preload='none'` 按需加载；nginx 静态支持 Range（python http.server 不支持，冒烟不影响判定）。
7. **字体**：`MaShanZheng-Regular.ttf` 5.8MB 在 dist 中但 CSS 只用 woff2；保留原样（未裁剪 dist）。
