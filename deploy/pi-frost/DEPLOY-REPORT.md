# 北湖霜降雅集 v4.0.8 · 树莓派部署报告

- 状态：**已上线（仅本机回环）**，等待 Lead 在 nginx 增加反代
- 执行人：frost-deployer（共享任务 task-4）
- 时间：2026-10-27 14:51–14:58 CST
- 树莓派：pi · Debian 13 trixie aarch64 · 内核 6.18.50+rpt-rpi-v8
- 目标端口：**127.0.0.1:4173**（只监听回环，未监听 0.0.0.0/::）
- 服务名：**frost-atlas.service**（systemd，enabled，active）
- 数据目录：**/var/lib/frost-atlas/data**（0700 frost:frost；库文件 0600）
- 封箱状态：**sealed = true**（生产空库默认封箱，未注册账号、未写业务数据）

未触碰：nginx、DNS、证书、frpc、/opt/win11-home、studentop.cn 站点。nginx 仍为 127.0.0.1:80/443 且 active。

---

## 1. 部署包校验

本地（Windows）：

```
sha256sum 北湖霜降雅集-服务器部署包-v4.0.8.zip
01abb2e701abc10a514d2ebdc94729d4d73fa7c04c4296170dd81b8d91483253 *.../北湖霜降雅集-服务器部署包-v4.0.8.zip
stat -c %s -> 16311156
```

上传后树莓派复核（传输完整性）：

```
sha256sum /tmp/frost-v4.0.8.zip
01abb2e701abc10a514d2ebdc94729d4d73fa7c04c4296170dd81b8d91483253  /tmp/frost-v4.0.8.zip
16311156 bytes
```

期望值 `01abb2e701abc10a514d2ebdc94729d4d73fa7c04c4296170dd81b8d91483253` / 16311156 字节：**完全一致**。

包内自校验（`node scripts/deployment-preflight.mjs --mode quick`，以 frost 用户只读执行）：

```json
{"version":"4.0.8-6feec36836df","resources":91,"bytes":8776436,"runtimeLedgerVerified":true,"runtimeFiles":124,"mode":"quick","officePort":4196,"credentialsEmbedded":false,"dockerRuntimeVerified":false}
```

含义：91 个公开资源逐个按 resource-manifest.json 校验字节数与 SHA256 通过；deployment-manifest.json 的 124 个运行时文件哈希全部通过；包内无管理凭据。

## 2. Node 24 LTS 安装

- 来源：https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt → `node-v24.22.1-linux-arm64.tar.xz`
- 官方 SHASUMS 期望 sha256：`dbabf7a1cbf947e6059ffad2c27b80041db97dea1e553b62afdee7f13fca336e`
- 实际下载 sha256 一致（29.5 MB），解压到 `/opt/node24`（root:root，0755）
- 软链：
  - `/usr/local/bin/node` → `/opt/node24/bin/node`
  - `/usr/local/bin/nodejs` → `/opt/node24/bin/node`
  - `/usr/local/bin/npm` → `/opt/node24/bin/npm`
  - `/usr/local/bin/npx` → `/opt/node24/bin/npx`
- 验证：

```
$ node -v
v24.22.1
$ npm -v
11.19.1
$ node -e "const {DatabaseSync}=require('node:sqlite');console.log(typeof DatabaseSync)"
function
$ node -e "console.log(process.version, process.arch)"
v24.22.1 arm64
```

## 3. 目录布局与权限

```
/opt/node24                                   root:root 0755  (node 24.22.1)
/opt/projects/frost                           root:root 0755
/opt/projects/frost/releases                  root:root 0755
/opt/projects/frost/releases/v4.0.8           root:root 0755  (125 个文件, 19M)
/opt/projects/frost/current -> .../releases/v4.0.8
/var/lib/frost-atlas                          root:frost 0750
/var/lib/frost-atlas/data                     frost:frost 0700
/var/lib/frost-atlas/data/frost.sqlite        frost:frost 0600
/var/lib/frost-atlas/data/frost.sqlite-wal    frost:frost 0600
/etc/systemd/system/frost-atlas.service       root:root 0644
```

- 系统用户：`frost:x:997:984::/var/lib/frost-atlas:/usr/sbin/nologin`（无登录 shell，无附加组）
- release 内文件全部 root 拥有、other 可读（无 group/other 写位）；数据目录**不在** releases 内，release 内 `server-data`/`*.sqlite` 数量 = 0
- 运行用户 frost 只对数据目录有写权限；`ProtectSystem=strict` + `ReadWritePaths=/var/lib/frost-atlas`

## 4. systemd 单元与加固

单元：`/etc/systemd/system/frost-atlas.service`（完整内容见附录 A）

- `WorkingDirectory=/opt/projects/frost/current`
- `ExecStart=/opt/node24/bin/node servers/dev.mjs`
- `User=frost`/`Group=frost`，`Restart=always`，`RestartSec=3`，`TimeoutStopSec=10`，`UMask=0077`
- 环境变量：`NODE_ENV=production`、`HOST=127.0.0.1`、`PORT=4173`、`FROST_DATA_DIR=/var/lib/frost-atlas/data`、`FROST_PUBLIC_ORIGIN=https://frost.studentop.cn:14355`、`FROST_TRUST_PROXY=1`、`FROST_TRUSTED_PROXIES=127.0.0.1`、`FROST_PROXY_CLIENT_HEADER=x-forwarded-for`
- 未使用 `EnvironmentFile`（单元内变量均非机密；管理凭据不在此文件）
- 加固项：NoNewPrivileges、PrivateTmp、PrivateDevices、ProtectSystem=strict、ProtectHome、ReadWritePaths=/var/lib/frost-atlas、ProtectKernelTunables/Modules/Logs/ControlGroups/Clock/Hostname、RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6、RestrictNamespaces、RestrictRealtime、RestrictSUIDSGID、LockPersonality、SystemCallArchitectures=native、CapabilityBoundingSet=（空）、AmbientCapabilities=（空）、RemoveIPC、LimitNOFILE=65536
- **全量加固一次通过**，未出现启动失败，也没有被迫降级。
- `systemd-analyze verify` 无输出（通过）；`systemd-analyze security frost-atlas` → **Overall exposure level: 3.0 OK :-)**

## 5. 验证证据（全部使用 `-H 'Host: localhost'` 绕过公网 Host 校验）

```
--- /api/health ---
curl -s -o /dev/null -w '%{http_code}' -H 'Host: localhost' http://127.0.0.1:4173/api/health
200
body: {"ok":true,"version":"4.0.0"}

--- / ---
200  bytes=11142
<title>一笺霜信 · 六艺寻秋｜北湖雅集</title>
contains 一笺霜信 = 4

--- /sw.js ---
200  (Content-Type: text/javascript; charset=utf-8, bytes=3029)

--- /api/config ---
200
{"version":1,"sealed":true,"pins":[{"id":"poetry","x":196,"y":530},{"id":"leaves","x":205,"y":607},
{"id":"writing","x":260,"y":690},{"id":"tea","x":485,"y":429},{"id":"incense","x":503,"y":353},
{"id":"flowers","x":302,"y":754},{"id":"entry","x":421,"y":842},{"id":"ending","x":390,"y":779}]}
sealed=True version=1 pins=8

--- 监听 ---
$ sudo ss -lntp | grep 4173
LISTEN 0  511  127.0.0.1:4173  0.0.0.0:*  users:(("MainThread",pid=27089,fd=24))
local-address 仅 127.0.0.1:4173；非回环绑定数量 = 0；0.0.0.0/:: 上无 4173

--- 服务 ---
$ systemctl is-active frost-atlas        -> active
$ systemctl is-enabled frost-atlas       -> enabled
MainPID=27345  NRestarts=0  ActiveEnterTimestamp=2026-10-27 14:56 CST

--- 日志（无崩溃/错误/警告）---
journalctl -u frost-atlas：errors=0, warns=0, "Started" 共 6 次
（6 次 Started 均为本次部署期间的显式操作：初始 start + 2 次手动 restart + 1 次故意 SIGKILL 恢复测试 + 2 次调整 UMask 后 restart；
  不是崩溃循环。当前 NRestarts=0，进程已稳定运行）
典型启动日志：
  Started frost-atlas.service - Beihu Frost Atlas v4.0.8 (static site + private SQLite API).
  node[27345]: 地图及 API  http://127.0.0.1:4173/
  node[27345]: 私人数据目录：/var/lib/frost-atlas/data
  node[27345]: 管理凭据来自 FROST_ADMIN_TOKEN 或私人数据目录 admin-token.txt；不在访问日志显示。

--- 崩溃恢复测试（Restart=always 生效）---
kill -9 MainPID -> t+1s activating -> t+4s active, NRestarts=1, health=200（RestartSec=3 生效）

--- 生产静态白名单（CSP 严格模式）---
/index.html 200 · /resource-manifest.json 200 · /sw.js 200
manifest 内资源（/assets/...、/journey/...、/scene/...、/geo/frost-geo.js 等）200
非白名单：/servers/app.mjs 404 · /package.json 404 · /scene/ 404 · /calibration/ 404 · /geo/ 404 · /admin/ 404 · /api/admin/status 404
安全响应头：CSP(default-src 'self' ...)、X-Content-Type-Options: nosniff、X-Frame-Options: SAMEORIGIN、
Referrer-Policy: same-origin、Permissions-Policy: geolocation=(self), camera=(), microphone=(),
Cross-Origin-Resource-Policy: same-origin

--- 未登录 API（预期，未发生任何写操作）---
GET /api/me -> 401 {"error":{"code":"AUTH_REQUIRED","message":"请先登录。"}}
```

## 6. 封箱（sealed）状态

`GET /api/config` 返回 `"sealed": true`（配置版本 1，8 个点位为代码默认值）。

依据（源码，仅阅读未修改）：
- `servers/app.mjs:83`：`openStore({... initialSealed: options.initialSealed ?? (production && process.env.FROST_ALLOW_PIN_EDIT !== '1')})`
- `servers/store.mjs:76`：新库首次插入 `config(id=1, version=1, sealed=?, pins_json=默认八点)`，仅 `INSERT OR IGNORE`，不会改动已有库
- 单元里 `NODE_ENV=production` 且未设 `FROST_ALLOW_PIN_EDIT` → 新库初始 sealed=1

含义：**点位编辑关闭**（即使构造请求也会返回 403 CONFIG_SEALED）；不影响照片收录、落款、明信片、下载与浏览。
封箱不影响本次部署；未调用任何 `/api/*` 写接口，未注册账号，未上传照片。
数据目录中只有系统初始化生成的 `frost.sqlite`(+WAL/SHM) 与空的 `.postcard-downloads-v1/`；
`admin-token.txt` 目前不存在（机关处 office 入口尚未运行，首次运行 office 时才会生成 0600 凭据）。

## 7. 给 Lead 的 nginx 反代要求（关键！已实测）

> 实测：`Host: frost.studentop.cn:14355` → 200；`Host: frost.studentop.cn`（不带端口）→ **400 INVALID_HOST**。
> 因为 `FROST_PUBLIC_ORIGIN` 的 `URL.host` 含端口 `:14355`，Host 必须逐字匹配（localhost/127.0.0.1/[::1] 例外放行）。

推荐 server 段要点：

```nginx
location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_http_version 1.1;
    proxy_set_header Connection "";

    # ★ 必须带端口，等价于客户端原始 Host；默认的 $host 会丢端口导致 400
    proxy_set_header Host $http_host;
    # （或直接写死：proxy_set_header Host frost.studentop.cn:14355;）

    # ★ 必须覆盖成单个真实 IP：应用只接受单个合法 IP，逗号列表会 400
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;

    client_max_body_size 6m;      # 应用内照片上限 5 MiB + 头部余量（SERVER.md 要求至少 6m）
    proxy_read_timeout 60s;       # 文档要求不少于 30s
    proxy_send_timeout 60s;

    # 不要加 CORS 头；不要开 proxy_cache（/api 必须 no-store）
    # /api/、/admin/ 不得缓存
}
```

- **整站挂在域名根路径**：前端资源全是根绝对路径（`/assets/...`、`/journey/...`、`/scene/...`、`/geo/...`、`/sw.js`），CSP 为 `default-src 'self'`。
  不要做子路径前缀映射（如 `/frost/`），会全部 404/破坏 CSP 与 Service Worker。
- `/admin/` 与 `/api/admin/*` 在本监听器上**设计为 404**（管理端是独立的 loopback office 入口，默认 4196，未启动）；nginx 不需要也不应该暴露它们。
- Service Worker 需要 `/sw.js` 同域可达（已验证 200，带 `Service-Worker-Allowed: /`）。
- 不要修改/覆盖应用返回的 CSP、X-Frame-Options 等安全头；如需 HSTS 可另加。
- WebSocket 不需要；HTTP/2 可开。
- 健康检查请用 `Host: localhost`（或 127.0.0.1），否则需要带公网 Host。

## 8. 遗留风险与注意事项

1. **frp TCP 隧道下的真实客户端 IP**：frpc→nginx 的连接源是 127.0.0.1，若 frp 未启用 PROXY protocol，nginx 的 `$remote_addr` 对所有公网用户都是 127.0.0.1 → 应用限流（每 IP API 1200/min、认证 120/10min、静态 60000/min）会**合并成单一桶**。小规模雅集可接受；人多时建议 frp 开 PROXY protocol + nginx `real_ip`/proxy_protocol 还原真实 IP，或调高 `FROST_API_IP_LIMIT` 等（需重启服务）。
2. **单实例 SQLite**：只允许一份写入进程；不要同时再起第二个 `servers/dev.mjs` 或用 office 入口连同一数据目录的写操作，避免 WAL 争用。数据目录 **不要**放进 release 目录，也不要被 nginx 静态根指向。
3. **备份**：尚未配置。数据含个人照片/姓名/学号，需按 SERVER-DEPLOYMENT.md 用 SQLite 在线备份（`scripts/deployment-backup.mjs`）或停机复制整个 `/var/lib/frost-atlas/data`；备份加密、非公开、制定保留期。
4. **升级**：新版本解包到 `/opt/projects/frost/releases/vX.Y.Z`，改 `current` 软链后 `systemctl restart frost-atlas`；保留旧 release 便于回滚；不要覆盖 current 指向的目录。
5. **Node 来源**：官方 tar.xz + SHASUMS 校验安装，不在 apt 管理范围内，Node 24 安全更新需人工跟进（必要时重装到 `/opt/node24` 并重启服务）。
6. **Restart=always + StartLimitIntervalSec=0**：若数据库损坏会持续重启（每 3s 一次）。建议 Lead 侧加一条监控（health 200 + journal 错误计数）；本报告时间窗内 NRestarts=0、无错误。
7. **管理入口未启用**：如需管理/封箱操作，需另行以 frost 用户运行 `node servers/office.mjs`（默认 127.0.0.1:4196，同环境变量），再 SSH 本地转发；首次运行会在数据目录生成 `admin-token.txt`（0600），不要打印/粘贴。当前生产库已是封箱态，**无需**操作。
8. **磁盘**：根分区 29G，已用 4.6G，剩 23G；应用默认库预算 8 GiB、最低余量 256 MiB（达到上限会拒绝写入而非删数据）。
9. 进程 RSS 约 63 MiB（启动后）；8GB 内存完全够用。
10. 服务可随开机自启（enabled）；本次未重启整机（避免影响线上 site）。

## 附录 A：systemd 单元全文

```ini
[Unit]
Description=Beihu Frost Atlas v4.0.8 (static site + private SQLite API)
Documentation=file:///opt/projects/frost/current/docs/SERVER.md
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=frost
Group=frost
WorkingDirectory=/opt/projects/frost/current
ExecStart=/opt/node24/bin/node servers/dev.mjs
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=4173
Environment=FROST_DATA_DIR=/var/lib/frost-atlas/data
Environment=FROST_PUBLIC_ORIGIN=https://frost.studentop.cn:14355
Environment=FROST_TRUST_PROXY=1
Environment=FROST_TRUSTED_PROXIES=127.0.0.1
Environment=FROST_PROXY_CLIENT_HEADER=x-forwarded-for
Restart=always
RestartSec=3
TimeoutStopSec=10
LimitNOFILE=65536
UMask=0077

NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/frost-atlas
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
SystemCallArchitectures=native
CapabilityBoundingSet=
AmbientCapabilities=
RemoveIPC=true

[Install]
WantedBy=multi-user.target
```

## 附录 B：本次落地的脚本（本目录）

| 文件 | 作用 |
| --- | --- |
| `01-install-node24.sh` | 下载/校验/解压 Node 24 到 /opt/node24，建软链，验证 node:sqlite |
| `02-setup-layout.sh` | frost 用户、release 目录、解包、current 软链、私有数据目录 700 |
| `frost-atlas.service` | systemd 单元（已安装到 /etc/systemd/system/） |
| `03-install-service.sh` | 安装单元、daemon-reload、enable --now、初检 |
| `04-verify.sh` | health/root/sw.js/config/监听/日志/数据目录验证 |
| `05-proxy-host-tests.sh` | Host/代理头行为、白名单、重启健壮性测试 |
| `06-preflight-crash.sh` | 包内 preflight 自校验 + SIGKILL 恢复测试 |
| `07-final-verify.sh` | 最终全量验收（Node/布局/权限/各项 curl/journal） |
