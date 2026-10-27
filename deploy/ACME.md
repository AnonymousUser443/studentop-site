# ACME / 正式 HTTPS 证书方案（尚未执行）

> 当前状态：nginx 使用 **openssl 自签占位证书** `/opt/win11-home/certs/studentop.cn.{crt,key}`（CN/SAN=studentop.cn）。
> `acme.sh v3.1.7` 已装在 `/opt/acme.sh`，**没有签发任何证书**，也没有安装 cron。
> 本文只准备命令，等用户提供 DNS 操作能力后再执行。

## 0. 为什么现在不能直接签发

1. 公网入口（SakuraFrp 隧道）当前不通 → **HTTP-01 不可用**（外部 CA 无法访问 `http://studentop.cn/.well-known/acme-challenge/`）。nginx 的 webroot 已预留：`/opt/win11-home/acme`。
2. `studentop.cn` 目前**没有任何 DNS 记录**（阿里云 hichina 权威查询 NODATA）→ 即便签发成功，公网也无法解析到节点。
3. 因此当前唯一可行路径是 **DNS-01**（需要能改阿里云 DNS）；或等隧道修好后走 HTTP-01 / SakuraFrp 面板的「自动 HTTPS」。

## 1. 约定

- CA：Let's Encrypt（`--server letsencrypt`），避免 ZeroSSL 在国内的账号/网络问题。
- acme.sh 工作目录（**不要用 root 家目录**）：
  - home: `/opt/acme.sh`
  - config: `/opt/acme.sh/config`
  - certs: `/opt/acme.sh/certs`
- 证书输出（nginx 直接读取，覆盖自签占位）：
  - `/opt/win11-home/certs/studentop.cn.key`
  - `/opt/win11-home/certs/studentop.cn.crt`（fullchain）
- 域名：`studentop.cn` + `www.studentop.cn`。
- 所有命令都用 `sudo -n`，且显式带 `--home/--config-home/--cert-home`。

## 2. 方案 A（推荐）：阿里云 RAM AccessKey + dns_ali 自动签发/续期

前置：用户创建一个 RAM 子账号，只授予 **AliyunDNSFullAccess**（或最小化到该域名的 DNS 权限），把 AccessKey ID/Secret 临时提供给部署者。**不要把 AK 写进仓库或提交到 git。**

```bash
# 2.1 签发（AK 用环境变量临时传入，不落盘）
ssh pi 'sudo -n env Ali_Key="<RAM_AK_ID>" Ali_Secret="<RAM_AK_SECRET>" \
  /opt/acme.sh/acme.sh --issue --server letsencrypt --dns dns_ali \
    --home /opt/acme.sh --config-home /opt/acme.sh/config --cert-home /opt/acme.sh/certs \
    -d studentop.cn -d www.studentop.cn --keylength ec-256'

# 2.2 安装证书到 nginx 并热加载（以后续期会自动执行同一条 reloadcmd）
ssh pi 'sudo -n /opt/acme.sh/acme.sh --install-cert -d studentop.cn \
  --home /opt/acme.sh --config-home /opt/acme.sh/config --cert-home /opt/acme.sh/certs \
  --key-file /opt/win11-home/certs/studentop.cn.key \
  --fullchain-file /opt/win11-home/certs/studentop.cn.crt \
  --reloadcmd "systemctl reload nginx"'

# 2.3 安装续期 cron（dns_ali 全自动续期，每 60 天）
ssh pi 'sudo -n /opt/acme.sh/acme.sh --install-cronjob \
  --home /opt/acme.sh --config-home /opt/acme.sh/config --cert-home /opt/acme.sh/certs'
```

验证：`bash deploy/verify.sh`，并检查证书主题/有效期（verify.sh 会打印）。

## 3. 方案 B：手动 DNS TXT（没有 AK 时）

```bash
# 3.1 第一次：acme.sh 会打印一条 _acme-challenge.studentop.cn 的 TXT 记录
ssh pi 'sudo -n /opt/acme.sh/acme.sh --issue --server letsencrypt --dns \
  --home /opt/acme.sh --config-home /opt/acme.sh/config --cert-home /opt/acme.sh/certs \
  -d studentop.cn -d www.studentop.cn --keylength ec-256 \
  --yes-I-know-dns-manual-mode-enough-go-ahead-please'

# 3.2 用户去阿里云 DNS 控制台添加该 TXT（TTL 600），等待生效后执行：
ssh pi 'sudo -n /opt/acme.sh/acme.sh --renew \
  --home /opt/acme.sh --config-home /opt/acme.sh/config --cert-home /opt/acme.sh/certs \
  -d studentop.cn --yes-I-know-dns-manual-mode-enough-go-ahead-please'

# 3.3 安装证书（同方案 A 的 2.2）
```

注意：手动模式**不会自动续期**（90 天有效期，需在到期前重复 3.1–3.2 或改走方案 A）。

## 4. 与 SakuraFrp 隧道类型的关系（重要）

| SakuraFrp 隧道类型 | TLS 终止点 | 本地 nginx 证书是否用得上 |
|---|---|---|
| HTTPS 隧道（节点自动 HTTPS / 节点终止 TLS） | SakuraFrp 节点 | **用不上**：节点用面板自动申请的证书，本地收 HTTP 即可（此时 frpc 的 `local_port` 应为 80，用户配置现为 443） |
| HTTPS 隧道（透传 / 按 SNI 转发） | 本地 nginx | **需要**：本地必须有浏览器信任的证书 → 本文方案 |
| HTTP 隧道 + 节点自动 HTTPS | SakuraFrp 节点 | 用不上 |

→ 先等 SakuraFrp 面板确认隧道模式，再决定是否执行本文证书方案；若为「节点自动 HTTPS」，则**不需要**在 Pi 上签发证书（这也解释了为什么当前先用自签占位）。

## 5. 安全注意

- RAM AK 只临时用环境变量传入，别写进 `frpc.ini`、脚本或 git。
- 续期成功后 HSTS 再考虑启用（`/etc/nginx/snippets/win11-home-headers.conf` 内已注释，取消注释即可）。
- 证书私钥权限 600 root；nginx master 以 root 读取即可。
