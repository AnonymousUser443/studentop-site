# 公网接入现状 —— 已打通（2026-10-27 15:05 CST）

## 在线地址

- **https://studentop.cn:14355/**  ← 仿 Windows 11 个人主页
- **https://www.studentop.cn:14355/**
- **https://frost.studentop.cn:14355/**  ← 项目：北湖霜降雅集（Node 24 + SQLite，systemd `frost-atlas.service`）
- **https://liyun.studentop.cn:14355/**  ← 项目：理韵寻踪 HUD（Vite 静态站，`/opt/projects/liyun/current`）
- **https://genshin.studentop.cn:14355/**  ← 开场：原神启动（3D 登录开场，`/opt/projects/genshin/current`；**开门白光过场后自动跳转理韵寻踪**）
- **https://studentop.cn:14355/projects/**  ← 两个项目的索引入口（主页桌面也有两个快捷方式图标）
- HTTP 200 · Let’s Encrypt 证书（CN=studentop.cn，SAN 含 www）· 有效期至 **2027-01-25** · acme.sh 自动续期（cron 每天 4 次检查）
- 浏览器实测：**29/29 交互检查通过、控制台 0 错误、window.isSecureContext = true**
- 线上发布版本：/opt/win11-home/releases/20261027T063043Z，与本地 25/25 文件 sha256 一致

## 链路

    浏览器 https://studentop.cn:14355
      → DNS（阿里云）：studentop.cn CNAME → cn-bj1-kvlqs4ee.frp.cool
      → 49.232.69.222（浮居「北京1号」节点）:14355
      → frpc（树莓派，type=tcp 隧道 [Raspiberry]）→ 127.0.0.1:443
      → nginx（Let’s Encrypt 证书，SNI studentop.cn）→ /opt/win11-home/current

## 两个项目怎么接进来的（子域名 + 一张证书）

TCP 隧道不区分域名，只转发端口，所以三个站共用同一条隧道和同一个 nginx 443 监听；**在树莓派本地按 TLS SNI 分流**：

    浏览器 https://frost.studentop.cn:14355  → DNS CNAME → 节点 :14355 → frpc → Pi 127.0.0.1:443
      → nginx server_name=frost.studentop.cn → 反代 127.0.0.1:4173（frost-atlas.service）
    浏览器 https://liyun.studentop.cn:14355  → 同一链路 → nginx server_name=liyun.studentop.cn
      → 静态 root /opt/projects/liyun/current
    浏览器 https://genshin.studentop.cn:14355 → 同一链路 → nginx server_name=genshin.studentop.cn
      → 静态 root /opt/projects/genshin/current（开场播完 → 跳 liyun）

- DNS：阿里云新增 `frost`、`liyun`、`genshin` 三条 CNAME → `cn-bj1-kvlqs4ee.frp.cool`，TTL 600（脚本 tools/aliyun_dns_pi.py，凭据复用 acme.sh 的 Ali Key）
- 证书：同一张 Let's Encrypt 证书重新签发，SAN = `studentop.cn, www, frost, liyun, genshin`（均 .studentop.cn），acme.sh 自动续期覆盖
- nginx：/etc/nginx/sites-available/projects（源文件 deploy/nginx-projects.conf），仍然只监听 127.0.0.1:443
- 详细维护手册：deploy/PROJECTS.md

## 为什么地址带 :14355

浮居的「建站隧道」（免端口 443）**只能**用香港【建站1号】节点，而该节点官方状态页显示 DOWN、24h 可用率 0%（见文末历史）。所以改用 **普通 TCP 隧道**跑在可用的「北京1号」上：

- TCP 隧道远程端口范围限定 **10000–19999**，因此公网地址必须带端口（14355）。
- 如果以后建站1号恢复（或让浮居开一个香港/海外建站节点），可以切回 type=https + 443 **免端口**访问；原来的 HTTPS 隧道配置备份在树莓派 /opt/frpc/frpc.ini.build1-*。

## 已完成的自动化项

| # | 项目 | 状态 |
|---|---|---|
| 1 | frpc **0.29.0**（浮居官方版本）+ TCP 隧道 [Raspiberry] type=tcp / local 443 / remote 14355 | 完成 |
| 2 | DNS（阿里云 API 自动写入）：@ CNAME → 节点域名、www CNAME → 节点域名，TTL 600 | 完成 |
| 3 | Let’s Encrypt 证书（DNS-01 / acme.sh dns_ali），安装到 /opt/win11-home/certs/ 并 reload nginx | 完成 |
| 4 | 续期 cron：acme.sh --cron，每日 4 次检查，到期前自动续期并 reload | 完成 |
| 5 | bash deploy/preflight-public.sh → 5 PASS / 0 FAIL | 完成 |

## 凭据与安全

- 阿里云 RAM AccessKey **只用于 dns_ali**，acme.sh 保存在 /opt/acme.sh/config/account.conf（root 600）。树莓派上的临时明文副本已删除。
- 你发的凭据原始文件是明文（D:\Users\Downloads\1793081583003.txt），建议：**删除该文件或收进密码管理器**；确认该 RAM 子账号只有 AliyunDNSFullAccess；需要轮换时告诉我，我同步更新 acme.sh 里的凭据（否则自动续期会失败）。

## 可选下一步

- **免端口** https://studentop.cn：①等建站1号恢复/让浮居开香港建站节点；②自建香港 VPS frps；③Cloudflare Tunnel（需把 NS 迁到 Cloudflare）。
- **80 → 443 跳转**：再建一条 TCP 隧道映射本地 80 端口（需要你在面板再加一条）。
- **内容**：win11-homepage/assets/js/content.js 里的占位资料（Aiden / 邮箱 / GitHub / 项目列表）。

## 历史记录（2026-10-27 上午）

- 原配置指向浮居「建站1号」45.87.103.250:7000，该节点官方状态页显示 DOWN、24h 可用率 0%；其余 7 个节点全部 UP。诊断详情见 DIAGNOSIS.md。
- 原客户端 0.49.0 与浮居 0.29 体系不匹配，已更换为 0.29.0 并用同版本 frps 闭环验证配置有效。
- frpc.ini 里的 dns_server=119.29.29.29 在校园网不可达，曾导致域名解析挂起；已移除，改用系统 DNS。
