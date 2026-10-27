# 树莓派部署状态（PI-STATE）

> 最后更新：2026-10-27 13:31 CST（由 deployer 维护）
> 主机：`pi` = 192.168.1.10:1885（ssh 别名，user=pi，sudo 免密）
> 系统：Debian GNU/Linux 13 (trixie) aarch64，内核 6.18.50+rpt-rpi-v8，Pi 4B / 8GB，根分区 29G（剩余约 23G）

## 1. 已安装软件

| 组件 | 版本 | 来源 / 位置 |
|---|---|---|
| nginx | 1.26.3-3+deb13u10 | apt（清华源）`/usr/sbin/nginx` |
| frpc | 0.49.0（frp_0.49.0_linux_arm64） | 手工安装 `/opt/frpc/frpc`（用户指定版本） |
| acme.sh | v3.1.7 | `/opt/acme.sh/acme.sh`（**未签发任何证书**） |
| openssl | 系统自带 | 生成自签占位证书 |
| mtr / traceroute / dig | 系统自带 | 诊断用 |

## 2. 端口 / 监听（安全基线：站点只监听回环）

| 端口 | 进程 | 说明 |
|---|---|---|
| 127.0.0.1:80 | nginx | HTTP 站点 + ACME webroot（为「HTTP 隧道 / 节点自动 HTTPS」预留） |
| 127.0.0.1:443 | nginx (ssl) | HTTPS 站点，自签占位证书（为「HTTPS 隧道透传」预留） |
| 127.0.0.1:8765 | python (rpi-task-manager) | **既有服务，未改动** |
| 0.0.0.0:22 | sshd | 未改动 |

- 已移除 stock 站点 `/etc/nginx/sites-enabled/default`，**0.0.0.0:80/443 不再有监听**（`verify.sh` 每次会断言）。
- 公网入口链路（当前未通）：`Internet -> SakuraFrp 节点 -> frpc -> 127.0.0.1:443`。

## 3. 目录结构

```text
/opt/win11-home/
├── releases/                 # 每次发布一个 <UTC时间戳>/ 目录
│   ├── 20261027T052810Z/     # 初始占位页
│   ├── 20261027T053039Z/     # 发布流水线冒烟测试产物
│   ├── 20261027T053210Z/     # 回滚自测产物（未上线）
│   ├── 20261027T054510Z/     # 首次正式发布（SEO 修改前的 index.html，可回滚）
│   └── 20261027T054535Z/     # ★ 当前 current：正式发布（最终版）
├── current -> releases/<ts>  # 原子软链，nginx root
├── certs/
│   ├── studentop.cn.crt      # 自签占位证书（CN=studentop.cn, SAN=studentop.cn/www.studentop.cn/127.0.0.1）
│   └── studentop.cn.key      # 600 root（后续可被 acme.sh --install-cert 覆盖）
└── acme/.well-known/acme-challenge/   # ACME webroot（HTTP-01 预留）

/opt/frpc/
├── frpc                      # frpc 0.49.0 aarch64 二进制
└── frpc.ini                  # 用户给定配置原样（仅追加 log_file/log_max_days/log_level），600 root

/opt/acme.sh/                 # acme.sh v3.1.7（home=config=certs 都在这里，不进 root 家目录）
```

## 4. nginx 配置

| 文件 | 作用 |
|---|---|
| `/etc/nginx/sites-available/win11-home`（软链到 sites-enabled） | 两个 server：127.0.0.1:80 与 127.0.0.1:443(ssl) |
| `/etc/nginx/snippets/win11-home-app.conf` | 共用 root/index、gzip、缓存、try_files、ACME、dotfile 拒绝 |
| `/etc/nginx/snippets/win11-home-headers.conf` | 安全头（X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy；HSTS 已注释待正式证书） |

- root = `/opt/win11-home/current`；`autoindex off`；`try_files $uri $uri/ /index.html`（SPA 回退）。
- 静态资源 `expires 7d`；`index.html` `expires -1`（发布后立刻生效）；`server_tokens off`。
- 日志：`/var/log/nginx/win11-home.access.log`、`/var/log/nginx/win11-home.error.log`。

## 5. systemd 服务

| 服务 | 状态 | 说明 |
|---|---|---|
| nginx.service | **enabled + active** | 改动配置后 `sudo nginx -t && sudo systemctl reload nginx` |
| frpc.service | **enabled**，因节点不可达每 30s 重启一次（预期行为） | `Restart=always`，`RestartSec=30`，`ExecStart=/opt/frpc/frpc -c /opt/frpc/frpc.ini` |
| rpi-task-manager | 未触碰 | 127.0.0.1:8765 |

日志：
- frpc 应用日志：`/var/log/frpc.log`（log_max_days=7）
- frpc systemd 日志：`journalctl -u frpc -f`

## 6. 发布 / 校验（Windows Git Bash，工作区根目录）

```bash
# 发布（默认源目录 win11-homepage/，若存在 dist/index.html 会自动取 dist/）
bash deploy/deploy-site.sh
bash deploy/deploy-site.sh path/to/build     # 指定其它源目录

# 端到端校验（HTTP/HTTPS 200、title、安全头、dotfile、ACME 路径、frpc 状态）
bash deploy/verify.sh
EXPECT_TITLE="Windows 11" bash deploy/verify.sh   # 额外断言标题包含指定文本
```

发布流程：本地 tar → scp 到 `/tmp/win11-home-<ts>.tar.gz` → 远端解包到 `releases/<ts>/` → `chown -R root:root` → `nginx -t` → **原子软链切换**（`mv -Tf` 覆盖 current）→ reload nginx → curl 自检（HTTP/HTTPS 必须 200）→ 失败自动切回上一版并 reload。旧 release 不删除，便于回滚。

## 7. 回滚

```bash
# 1) 看所有版本
ssh pi 'ls -1t /opt/win11-home/releases'

# 2) 切回指定版本（原子操作）
ssh pi 'sudo ln -sfn /opt/win11-home/releases/<TS> /opt/win11-home/.current.new \
  && sudo mv -Tf /opt/win11-home/.current.new /opt/win11-home/current \
  && sudo systemctl reload nginx'

# 或直接重跑 deploy-site.sh 发布新版本；发布脚本失败时也会自动回滚
```

注意：`reload` 在「nginx 刚被 apt 安装、master 还持有继承 socket」的极少数情况下会静默失败（systemd 仍返回 0），此时用 `sudo systemctl restart nginx`；`pi-setup.sh` 与 `verify.sh` 均已考虑此点。

## 8. 环境重建（幂等）

```bash
ssh pi 'bash -s' < deploy/pi-setup.sh
```
会安装/校正 nginx、目录、自签证书、nginx 配置、frpc 二进制、systemd unit、acme.sh；**不会**覆盖 `/opt/frpc/frpc.ini`、不会覆盖已有 `current`、不签发证书。

## 8.1 本机预览入口（公网隧道未通时也能看站点）

```powershell
# Windows 上建 SSH 本地转发 127.0.0.1:8080 -> 树莓派 127.0.0.1:80，并打开浏览器
deploy\Open-Site.cmd             # 或： pwsh -File deploy\Open-Site.ps1
deploy\Open-Site.cmd -Stop       # 关闭隧道
deploy\Open-Site.cmd -Port 8081  # 换本地端口
```

- 已运行实例会被**复用**（PID 记录在 `%LOCALAPPDATA%\win11-home-opensite\instance-<port>.json`），不会重复占用端口；端口被其它程序占用时脚本明确报错、不会乱杀进程。
- 实测：启动 → `HTTP 200` + 标题正确；再次运行 → 复用；`-Stop` → 端口关闭；重复 `-Stop` → 提示无实例（幂等）。

**当前状态（2026-10-27 13:47）：预览隧道保持运行中**，供用户随时打开 <http://127.0.0.1:8080/>（Lead 已用真实浏览器完成 29/29 项交互验收）。

| 操作 | 命令 |
|---|---|
| 打开 / 复用 | 双击 `deploy\Open-Site.cmd`（或 `pwsh -File deploy\Open-Site.ps1`） |
| 关闭 | `deploy\Open-Site.cmd -Stop` |
| 关闭后重开 | 直接再双击 `deploy\Open-Site.cmd`（PID 记录会复用/清理） |
| 看状态文件 | `%LOCALAPPDATA%\win11-home-opensite\instance-8080.json`（pid / port / url） |

说明：这是**部署者本机的 SSH 隧道**，只在当前 Windows 上可用；电脑重启或断网后隧道会断，双击 `Open-Site.cmd` 重开即可。公网访问仍需修好 SakuraFrp 节点（见 `SAKURA.md`）。

## 8.2 发布后校验工具

| 命令 | 作用 |
|---|---|
| `bash deploy/verify.sh` | 端到端健康检查（nginx/loopback/200/title/安全头/dotfile/ACME/frpc/磁盘） |
| `bash deploy/checksum-compare.sh` | 本地 `win11-homepage/` 与远端 `current` 逐文件 sha256 比对（`index.html` + `assets/**`），不一致逐条列出，退出码 1 |
| `bash deploy/post-deploy-stats.sh` | 输出远端文件数/总字节/ls -R/nginx 状态/frpc 日志，贴进本文件用 |
| `FORCE_FAIL_AFTER_SWITCH=1 bash deploy/deploy-site.sh <dir>` | 发布脚本**回滚自测钩子**：切换后强制失败，验证自动回滚（已实测：current 保持不变） |
| `bash deploy/preflight-public.sh` | **公网入口一条命令自检**：(a) frpc 登录成功 (b) 节点 TCP (c) DNS 指向 (d) 本地证书非自签 (e) 公网 200+标题；逐行 PASS/FAIL，换节点/加解析后跑 |

## 8.3 deploy/ 目录文件清单

| 文件 | 说明 |
|---|---|
| `pi-setup.sh` | Pi 环境幂等重建（nginx/证书/目录/frpc/systemd/acme.sh） |
| `deploy-site.sh` | 发布流水线（tar+scp+原子切换+自检+回滚） |
| `verify.sh` | 端到端校验 |
| `checksum-compare.sh` | 本地/远端逐文件 sha256 |
| `post-deploy-stats.sh` | 发布快照统计 |
| `preflight-public.sh` | 公网入口 5 项自检（换节点后使用） |
| `Open-Site.ps1` / `Open-Site.cmd` | 本机预览隧道 |
| `DIAGNOSIS.md` / `PI-STATE.md` / `ACME.md` / `SAKURA.md` | 诊断 / 本文件 / 证书 / 用户操作指引 |
| `diag/` | 诊断脚本与证据（diag_socket.py、frpc debug 日志、test-site 冒烟样例） |

## 9. 已知问题 / 待办

1. **SakuraFrp 节点 45.87.103.250:7000 在 IP 层不可达**（全球多点复测），frpc 每 30s 重试失败 → 公网链路未通。详见 `deploy/DIAGNOSIS.md`。
2. **studentop.cn 目前没有任何 DNS 解析记录**（阿里云 hichina 权威查询 NODATA），需用户添加 A/CNAME，见 `deploy/SAKURA.md`。
3. HTTPS 现为**自签占位证书**，浏览器会告警；正式证书流程见 `deploy/ACME.md`（未执行）。
4. frpc 配置的认证字段（user/token）与 SakuraFrp 官方文档要求存在偏差风险，待节点恢复后复核，见 `deploy/SAKURA.md`。
5. 若 SakuraFrp 隧道由节点终止 TLS（自动 HTTPS），则本地应改为 HTTP 入口（local_port=80）；用户配置为 443，届时按面板实际隧道类型决定，**不擅自改数值**。

## 10. 变更记录

| 时间 (CST) | 变更 |
|---|---|
| 2026-10-27 13:26 | apt 安装 nginx 1.26.3 |
| 2026-10-27 13:28 | 目录/自签证书/nginx 站点/frpc 0.49.0/frpc.service/acme.sh 全部就绪 |
| 2026-10-27 13:30 | 发布流水线冒烟测试通过（deploy-site.sh + verify.sh 全绿） |
| 2026-10-27 13:31 | 重跑 pi-setup.sh 验证幂等；current 恢复为占位页 |
| 2026-10-27 13:32 | deploy-site.sh 回滚自测（FORCE_FAIL_AFTER_SWITCH=1）通过，current 保持不变 |
| 2026-10-27 13:34 | 新增 Open-Site.ps1/.cmd（本机预览）、checksum-compare.sh、post-deploy-stats.sh，均实测 |
| 2026-10-27 13:45 | 首次正式发布（前端节选版）`20261027T054510Z`；Lead 补 SEO(canonical/og:url) 后重建 |
| 2026-10-27 13:45 | **正式发布最终版 `20261027T054535Z`**：verify PASS、checksum 25/25、响应头合规 |
| 2026-10-27 13:47 | Lead 浏览器验收 29/29 PASS；本机预览隧道保持运行（§8.1） |
| 2026-10-27 13:50 | 新增 `preflight-public.sh` 公网入口 5 项自检；`SAKURA.md` 增加「第 0 件事：确认面板来源」与「第 4 件事：证书三选一」 |


## 11. 正式发布记录（2026-10-27 13:45 CST）

**发布源**：工作区 `win11-homepage/`（纯静态，26 个文件，1,255,948 字节；`index.html` 4,730 字节）
**发布版本**：`/opt/win11-home/releases/20261027T054535Z`（current 指向；上一版 `…054510Z` 为 SEO 修改前的首次发布，保留可回滚）

### 11.1 验收结果

| 检查 | 结果 |
|---|---|
| `deploy-site.sh` 原子发布 + 自检 | ✅ HTTP 200 / HTTPS 200 / title 正确 |
| `verify.sh` | ✅ **RESULT: PASS**（nginx active、仅监听 127.0.0.1:80/443、title「Aiden 的个人主页 · Windows 11」、安全头、dotfile 403、ACME 200、frpc enabled） |
| `checksum-compare.sh` | ✅ **PASS：25/25 文件 sha256 完全一致**（index.html + assets/**），index.html 本地=远端=`359fd2e2…` |
| 静态响应头 | ✅ 见 11.2 |
| 公网 `https://studentop.cn/` | ⛔ 阻塞（frpc 节点 45.87.103.250 仍 i/o timeout；域名无解析），非站点问题 |

### 11.2 nginx 静态资源响应头（curl -sI，HTTPS + SNI studentop.cn）

| 路径 | content-type | content-encoding | cache-control |
|---|---|---|---|
| `/`、`/index.html` | text/html; charset=utf-8 | gzip | no-cache |
| `/assets/css/shell.css` | text/css | gzip | max-age=604800 |
| `/assets/js/main.js` | application/javascript; charset=utf-8 | gzip | max-age=604800 |
| `/assets/img/wall-bloom.jpg` | image/jpeg（205,705 B） | —（JPEG 不压缩，正确） | max-age=604800 |
| `/assets/img/thumb-solid.jpg` | image/jpeg（1,492 B） | — | max-age=604800 |
| `/assets/img/favicon.svg` | image/svg+xml（562 B） | —（小于 gzip_min_length=1024，正确） | max-age=604800 |

### 11.3 发布后远端状态（`post-deploy-stats.sh`）

- current：`/opt/win11-home/releases/20261027T054535Z`
- 文件数 26 / 目录数 5 / 总字节 1,255,948 / index.html 4,730 B
- releases 目录数：5
- 顶层：`assets/`、`index.html`、`README.md`；`assets/{css,img,js}` 结构完整
- nginx：is-active=active / is-enabled=enabled，监听仅 `127.0.0.1:80`、`127.0.0.1:443`
- frpc：is-enabled=enabled / is-active=activating（每 30s 重启，节点不可达）
- `/var/log/frpc.log` 最近 5 行：全部 `login to server failed: dial tcp 45.87.103.250:7000: i/o timeout`（13:43:20 / 13:44:00 / 13:44:41 / 13:45:21 / 13:46:01）

### 11.4 本机预览

- `deploy\Open-Site.cmd` → `http://127.0.0.1:8080/`（SSH 本地转发到 Pi 的 `127.0.0.1:80`）。
- Lead 已用真实浏览器（CDP）在线验收：**29/29 项交互全部通过、console 0 error**；发布版本验收 PASS。
- 隧道**保持运行中**，关闭/重开方法见 §8.1。

### 11.5 回滚（本次发布可直接退回）

```bash
ssh pi 'sudo ln -sfn /opt/win11-home/releases/20261027T054510Z /opt/win11-home/.current.new \
  && sudo mv -Tf /opt/win11-home/.current.new /opt/win11-home/current \
  && sudo systemctl reload nginx'
```



## §12 frpc 版本对齐（2026-10-27 14:00）

- 服务商确认为「浮居内网穿透（frp.cool）」，官方文档指定客户端 **frp 0.29.0**（原 0.49.0 版本不匹配）。
- /opt/frpc/frpc 已替换为 0.29.0 aarch64，旧版备份 /opt/frpc/frpc-0.49.0.bak。
- 用同版本 frps 在 Pi 本机做闭环自测：使用用户原始 frpc.ini（仅改 server_addr/server_port 指向 127.0.0.1）→ login success / proxy added / start proxy success / frps: https proxy listen for host [studentop.cn] → **配置有效**。
- 阻塞仍为服务商节点：官方状态页 https://online.frp.cool/status/nodes 显示「会员-建站1号」DOWN，24h 可用率 0%。详见 deploy/PUBLIC-ACCESS-STATUS.md。
- 节点恢复后：sudo systemctl restart frpc && bash deploy/preflight-public.sh。

## §13 公网接入完成（2026-10-27 14:31）

- 在线地址：https://studentop.cn:14355/ （www 同），HTTP 200，Let's Encrypt 证书有效期至 2027-01-25，acme.sh cron 自动续期。
- 链路：DNS（阿里云 CNAME @/www → cn-bj1-kvlqs4ee.frp.cool）→ 49.232.69.222（浮居北京1号）:14355 → frpc type=tcp → 127.0.0.1:443 nginx → current。
- frpc：0.29.0；配置 /opt/frpc/frpc.ini（[common] server_addr=cn-bj1-kvlqs4ee.frp.cool:7000；[Raspiberry] type=tcp local_port=443 remote_port=14355）；原 HTTPS 隧道配置备份 /opt/frpc/frpc.ini.build1-*。
- 关键坑：frpc.ini 的 dns_server=119.29.29.29 在校园网不可达，导致域名解析挂起；已移除，改用系统 DNS。
- 证书：/opt/win11-home/certs/studentop.cn.{crt,key}；acme.sh home=/opt/acme.sh，凭据在 config/account.conf（root 600），cron 每天 4 次检查续期。
- DNS 记录由 tools/aliyun_dns.py 通过阿里云 API 写入（@ CNAME、www CNAME，TTL 600）。
- 验收：bash deploy/preflight-public.sh → 5 PASS / 0 FAIL；浏览器交互 29/29；checksum 25/25。
- 回滚：把 /opt/frpc/frpc.ini 换回 frpc.ini.build1-* 并 systemctl restart frpc；nginx 证书可沿用。

## §14 两个项目上线（2026-10-27 15:05）

| 项目 | 入口 | 树莓派上的形态 |
| --- | --- | --- |
| 北湖霜降雅集 v4.0.8 | https://frost.studentop.cn:14355/ | Node **v24.22.1**（/opt/node24）+ systemd `frost-atlas.service`，只监听 127.0.0.1:4173；代码 /opt/projects/frost/{releases/v4.0.8,current}；数据 /var/lib/frost-atlas/data（0700 frost）；新库 **sealed=true**（点位编辑关闭） |
| 理韵寻踪 HUD | https://liyun.studentop.cn:14355/ | 纯静态，/opt/projects/liyun/{releases/20261027T0656Z,current}，26MB（Vite 构建产物，22 文件 sha256 已校验） |

- nginx：新增 sites-available/projects（deploy/nginx-projects.conf），按 SNI 分流；frost 走 proxy_pass，Host 必须带端口（`$http_host`），X-Forwarded-For 必须覆盖成单个 IP。
- 证书：重新签发，SAN 增加 frost / liyun（acme.sh --issue --server letsencrypt --dns dns_ali --force；注意默认 CA 已换成 ZeroSSL，必须显式 --server letsencrypt）。
- DNS：frost / liyun 两条 CNAME → cn-bj1-kvlqs4ee.frp.cool。
- 主页：桌面新增「北湖霜降雅集」「理韵寻踪」两个快捷方式（双击=新标签页打开，`apps-about.js` 的 external 字段），项目作品里也加了这两张卡片；新增 /projects/ 索引页。
- 验收：preflight-public.sh **7 PASS / 0 FAIL**；主页交互 **29/29**；快捷方式真实双击 → 新标签页打开两个项目（qa/shortcut-test.js）；两个项目浏览器 0 console error。
- 已知风险：frp TCP 未开 PROXY protocol → 应用看到的源 IP 都是 127.0.0.1，限流会合并成单桶（小流量可接受）；frost 的公网注册是开放的（封箱只锁点位），如需限制可加 nginx auth_basic 或停服务；无自动备份/监控，Node 为 tar 包安装需人工跟进安全更新。

## §15 「原神启动」开场上线（2026-10-27 16:45）

- 入口：https://genshin.studentop.cn:14355/ —— 3D 登录开场（three.js + xviewer 复刻，上游开源项目 www-genshin，作者 TEAM.x.y.z，B 站 BV1E8411v7xy，保留免责声明与署名）。
- **业务改动**：开门白光过场结束后不再跳作者 B 站视频，而是进入 https://liyun.studentop.cn:14355/ 。实现在 src/core/exit.ts（DEFAULT_EXIT_URL / goExit）+ GameManager.restart()。
- **必须修复的两处上游问题**（这份下载副本开箱是跑不通开场的）：
  1. App.tsx 里 Menu（登录界面）与 Preloader（加载进度）**没有被挂载** → 永远出不来「开始」按钮，也就没有门。已接回（Menu 在 preloaded 之后挂载）。
  2. src/core/components/ShaderTest.ts 是遗留调试文件且 import 路径错误（../libs/xviewer），让 tsc 直接失败 → 已删除（全项目无引用）。
- 兜底：?skip=1 / #skip 直接跳目的地；界面左上角「跳过开场」按钮；无 WebGL 时渲染降级页（按钮 + 9 秒自动跳转）。
- 部署：/opt/projects/genshin/{releases/20261027T0835Z,current}（36 文件 / 9,329,295 B；上传 tar sha256 双方一致，关键文件 hash 抽查一致）。
- nginx：sites-available/projects 增加 server_name genshin.studentop.cn（静态，glb/贴图/音频 30d 缓存，index.html 不缓存）。
- 证书：重签，SAN 增加 genshin.studentop.cn（仍是同一张 /opt/win11-home/certs/studentop.cn.crt）。
- 主页：桌面 + 开始菜单新增「原神启动」快捷方式（apps-about.js 的 external → wm.js 新标签页打开）；Windows 桌面同步生成 原神启动.url。
- 验收：preflight-public.sh → 8 PASS / 0 FAIL；qa/genshin-flow-test.js 公网实测：?skip=1 立即落到 liyun；完整流程开始按钮 5.2s、门 12.2s、点击开门后约 24s 落到 liyun，控制台 0 error；三个桌面快捷方式真实双击各自落到正确站点。
