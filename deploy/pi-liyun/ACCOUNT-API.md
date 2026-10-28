# 理韵寻踪 · 账号 API 部署说明

[账号契约](<../../apps/liyun-explorer/docs/ACCOUNT.md>)与[服务端说明](<../../apps/liyun-explorer/server/README.md>)为实现依据。部署/SSH/服务/测试仅由 Lead 执行；本文不是已部署或测试通过的证据。

## 独立服务与私库

Node 24 内置 SQLite，无 npm 服务端依赖。独立服务用户 liyun-account，私有目录 /var/lib/liyun-account，0700、umask 0077；数据、WAL、备份均不得进入仓库或静态 webroot。

生产程序至少包含[入口](<../../apps/liyun-explorer/server/server.mjs>)、[存储](<../../apps/liyun-explorer/server/store.mjs>)、[进度白名单](<../../apps/liyun-explorer/server/progress.mjs>)；离线[旧账号迁移工具](<../../apps/liyun-explorer/server/migrate-legacy.mjs>)只供管理员按需使用，不挂 HTTP。服务器不要使用静态站点目录提供这些源码。

独立 release 的 current 软链可用于 WorkingDirectory/绝对入口；入口用 canonical realpath 判断，不会因软链跳过 listen。

## systemd 关键配置示例

由 Lead 合入部署脚本并检查既有环境，不直接覆盖不相关服务：

```ini
[Unit]
Description=Liyun account API
After=network.target

[Service]
Type=simple
User=liyun-account
Group=liyun-account
WorkingDirectory=/opt/projects/liyun-api/current
ExecStart=/opt/node24/bin/node server.mjs
Environment=NODE_ENV=production
Environment=LIYUN_API_HOST=127.0.0.1
Environment=LIYUN_API_PORT=8787
Environment=LIYUN_DATA_DIR=/var/lib/liyun-account
Environment=LIYUN_PUBLIC_ORIGIN=https://liyun.studentop.cn:14355
Restart=on-failure
RestartSec=3
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

LIYUN_PUBLIC_ORIGIN 必须是浏览器实际使用的精确 HTTPS origin，包含 14355，不含路径/尾斜杠；缺失、HTTP 或非法值会启动失败，不能为了“修通”删除该保护。

## nginx 同源反代

只在理韵 HTTPS 虚拟主机中追加 /api/ 反代，保留现有静态缓存、安全头及其他站点。不要把主站 desktop-auth 或其他应用 API 混用，也不要启用通配 CORS：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Origin $http_origin;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    client_max_body_size 256k;
    proxy_cache off;
}
```

应用不信任 X-Forwarded-For 作为身份/限流键；主要按 ID 哈希限制 5 次失败/5分钟。代理 socket 600次失败/5分钟只作高阈值防滥用，frp/nginx 回环来源共享，不能设置30次/IP这样的低阈值串锁正常用户。

修改请求须有匹配的 Origin。运维合成请求若要 POST/PUT，显式加该 Origin；不要因此豁免公网请求的 Origin 校验。health 可从回环 GET 检查且不读取私密配置。

## 上线与回滚门禁

1. 负责人先在隔离临时库运行存储/HTTP/客户端回归及构建，再验证真实浏览器正常注册/错误口令不改档/游客/位置隐私。只用合成账号、合成位置，不输出真实口令或原始坐标。
2. 先创建独立私有目录/服务，检查回环 health、同源正确 Origin 与错误 Origin 行为，再切前端。不要借机重启其他服务。
3. 若检测到旧 schema1 库，升级自动锁定旧账号并撤销旧令牌；无密码账户不可公开首登认领。按[受控迁移](<../../apps/liyun-explorer/docs/ACCOUNT.md#旧账号的受控迁移>)停服备份、线下核验并用本机隐藏输入工具迁移。无旧库时直接 schema2。
4. v1旧演示进度只迁移设置，不补发 GPS 打卡；v2进度保留白名单。旧快照清洗不等于历史备份/WAL物理擦除，备份依私有保留策略处理。
5. 不允许回滚到无口令后端，或把 schema2 降级成 schema1。回滚需保留新安全后端与私库，或先关闭账号能力让用户用游客；静态前端不能绕过后端身份校验。

会话仍为随机高熵 Bearer、服务端哈希与30天到期。昵称/ID/地标记录属于私有用户数据，数据库不能上传公开 QA 或仓库。此轻量方案不提供学校身份认证、密码找回或防作弊证明。
