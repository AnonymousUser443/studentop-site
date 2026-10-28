# 理韵寻踪 · 账号 API 部署说明

为「理韵寻踪」新增的可选后端：账号 + 打卡/进度持久化。前端保持纯静态，仅在能连上 `/api` 时启用账号；未部署本服务时前端自动退化为游客模式（localStorage），与改动前行为一致，因此本服务**可灰度、可后装**。

设计契约见 [`apps/liyun-explorer/docs/ACCOUNT.md`](../../apps/liyun-explorer/docs/ACCOUNT.md)，服务端见 [`apps/liyun-explorer/server/`](../../apps/liyun-explorer/server/)。

## 1. 服务端程序放哪

复用既有 Node 24（`/opt/node24/bin/node`）与 liyun 目录布局。把 `server/` 目录随源码部署到树莓派（可与 dist 一起进 release，或单独放到 `/opt/projects/liyun/account/`）：

```sh
# 假设服务端源码放在 release 内（与 dist 同版本发布）
ls /opt/projects/liyun/current/server/
# store.mjs  server.mjs  README.md
```

数据目录独立于 webroot，避免误删：

```sh
sudo -n install -d -m 0700 -o liyun -g liyun /var/lib/liyun-account
```

## 2. systemd 单元（`/etc/systemd/system/liyun-account.service`）

参考 `deploy/nginx/frost-atlas.service.txt` 的加固项；最小可用版本如下：

```ini
[Unit]
Description=Liyun account API (SQLite)
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=liyun
Group=liyun
WorkingDirectory=/opt/projects/liyun/current
ExecStart=/opt/node24/bin/node server/server.mjs
Environment=NODE_ENV=production
Environment=LIYUN_API_HOST=127.0.0.1
Environment=LIYUN_API_PORT=8787
Environment=LIYUN_DATA_DIR=/var/lib/liyun-account
Restart=always
RestartSec=3
TimeoutStopSec=10
UMask=0077

NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/liyun-account
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
```

启用：

```sh
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now liyun-account
sudo -n systemctl status liyun-account
curl -s http://127.0.0.1:8787/api/health   # {"ok":true}
```

> 用户/组 `liyun` 若不存在先 `useradd -r -s /usr/sbin/nologin liyun`；`ReadWritePaths` 若导致 SQLite WAL 启动失败，先退回最小可用集合并记录原因（同 frost 部署报告的做法）。

## 3. nginx 反代（在 liyun.studentop.cn 的 server{} 内追加）

静态站点仍在 `location / { try_files $uri $uri/ =404; }`，只把 `/api/` 反代到本机 Node：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
}
```

改完 `nginx -t && systemctl reload nginx`。公网自检：

```sh
curl -s https://liyun.studentop.cn:14355/api/health   # {"ok":true}
```

## 4. 上线注意

- 数据目录与 webroot 分离，`0700`，仅服务进程可读写；**不要把 `server/data/` 提交进仓库**（已在 `.gitignore` 排除）。
- 本服务是无密码登录（学号即身份），见设计文档的取舍说明；上线前建议在 nginx 侧加简单限流（当前后端未内置限流）。
- 前端静态包无需改 `base`、无需 SPA fallback，`/api` 反代是唯一需要的 nginx 变更。
