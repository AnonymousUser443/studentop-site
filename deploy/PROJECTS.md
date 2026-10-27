# 个人站上的两个项目 —— 部署与维护手册

> 更新时间：2026-10-27 16:40 CST ｜ 全部已上线并验收通过
> 主站（仿 Windows 11 主页）：<https://studentop.cn:14355/>

---

## 0. 一览

| 项目 | 公网入口 | 树莓派上的形态 | 技术栈 |
| --- | --- | --- | --- |
| **北湖霜降雅集** v4.0.8 | <https://frost.studentop.cn:14355/> | Node 24 + systemd，反代，SQLite 私有数据 | 原生 HTML/CSS/JS + Node 24（内置 SQLite），零第三方依赖 |
| **理韵寻踪 HUD** | <https://liyun.studentop.cn:14355/> | 纯静态 nginx，26MB（Vite 产物） | React 19 + TypeScript + Vite 7 + p5.js + Web Audio |
| **原神启动**（开场 → 理韵寻踪） | <https://genshin.studentop.cn:14355/> | 纯静态 nginx，9MB；开门白光后跳转理韵寻踪 | three.js + xviewer（上游 www-genshin 开源项目，作者 TEAM.x.y.z） |
| 项目索引页 | <https://studentop.cn:14355/projects/> | 主站静态页 `projects/index.html` | 纯静态 |

主页桌面（`https://studentop.cn:14355/`）上有三个带小箭头的**快捷方式图标**（北湖霜降雅集 / 理韵寻踪 / 原神启动），双击即在新标签页打开对应站点；开始菜单里也各有一份入口，前两个还出现在「项目作品」窗口。

`原神启动` 的链路是「开场动画 → 开门 → 白光过场 → 自动跳到理韵寻踪」：它是给理韵寻踪做的一层戏剧化入口，本身不含内容。

---

## 1. 链路与分流

TCP 隧道只转端口、不看域名，所以三个站点共用同一条隧道 + 同一个 nginx 443 监听，**在树莓派本地按 TLS SNI 分流**：

```text
浏览器 https://frost.studentop.cn:14355
  → DNS(阿里云) frost CNAME → cn-bj1-kvlqs4ee.frp.cool
  → 49.232.69.222（浮居北京1号）:14355
  → frpc（树莓派 /opt/frpc/frpc.ini，[Raspiberry] type=tcp local_port=443 remote_port=14355）
  → 127.0.0.1:443 nginx（证书在 Pi 上终止）
      ├─ server_name studentop.cn / www  → root /opt/win11-home/current        （主站，静态）
      ├─ server_name frost.studentop.cn  → proxy_pass 127.0.0.1:4173           （北湖霜降雅集）
      ├─ server_name liyun.studentop.cn  → root /opt/projects/liyun/current    （理韵寻踪，静态）
      └─ server_name genshin.studentop.cn → root /opt/projects/genshin/current （原神启动开场）
```

要点：

- **为什么用子域名而不是子路径**：两个项目的资源全是根绝对路径（`/assets/...`、`/sw.js`、`/api/...`，服务端还有 CSP `default-src 'self'`），部署在子域名根目录零改动；塞进 `/xxx/` 子路径需要改源码/构建配置，收益还低。
- **为什么不用第二条隧道**：TCP 隧道不需要第二条——SNI 分流已经够用，也省得再占一个远程端口。
- nginx 依然**只监听 127.0.0.1**（80/443），公网只能经 frp 进来。

---

## 2. 树莓派上的文件布局

```text
/opt/node24/                                 Node v24.22.1（官方 tar.xz，arm64）
/opt/projects/frost/releases/v4.0.8/         北湖霜降雅集程序（125 文件 / 19M，root:root 755）
/opt/projects/frost/current -> releases/v4.0.8
/var/lib/frost-atlas/data/                   私有数据（0700 frost:frost，frost.sqlite 0600）
/opt/projects/liyun/releases/20261027T0656Z/ 理韵寻踪 dist（22 文件 / 26M，644 root:root）
/opt/projects/liyun/releases/20261027T0656Z.sha256   审计清单（不进 webroot）
/opt/projects/liyun/current -> releases/20261027T0656Z
/opt/projects/genshin/releases/20261027T0835Z/  原神启动 dist（36 文件 / 9.0M）
/opt/projects/genshin/current -> releases/20261027T0835Z
/etc/systemd/system/frost-atlas.service      北湖霜降雅集服务（enabled + active）
/etc/nginx/sites-available/projects         两个项目的 vhost（源文件 deploy/nginx-projects.conf）
/etc/nginx/sites-enabled/projects           同上软链
/opt/win11-home/certs/studentop.cn.{crt,key} 共用证书（SAN 含四个域名）
```

| 组件 | 值 |
| --- | --- |
| 服务名 | `frost-atlas.service`（systemctl status/restart/logs） |
| 应用监听 | 127.0.0.1:**4173**（只看回环） |
| 应用关键 env | `HOST/PORT/NODE_ENV=production/FROST_DATA_DIR/FROST_PUBLIC_ORIGIN=https://frost.studentop.cn:14355/FROST_TRUST_PROXY=1/FROST_TRUSTED_PROXIES=127.0.0.1` |
| 日志 | `journalctl -u frost-atlas`；nginx：`/var/log/nginx/projects-frost.*.log`、`projects-liyun.*.log` |
| 磁盘 | 根分区 29G，已用 ~4.6G（三个站合计 < 60MB） |

---

## 3. 证书与 DNS

- **证书**：一张 Let's Encrypt ECC 证书覆盖 `studentop.cn / www / frost / liyun / genshin`，有效期到 **2027-01-25**，acme.sh（`/opt/acme.sh`，DNS-01 `dns_ali`）自动续期并 reload nginx。
- 重新签发（例如再加子域名）：

```bash
sudo -n /opt/acme.sh/acme.sh --issue --server letsencrypt --dns dns_ali \
  --home /opt/acme.sh --config-home /opt/acme.sh/config \
  -d studentop.cn -d www.studentop.cn -d frost.studentop.cn -d liyun.studentop.cn -d genshin.studentop.cn \
  --keylength ec-256 --force
sudo -n /opt/acme.sh/acme.sh --install-cert -d studentop.cn --ecc \
  --home /opt/acme.sh --config-home /opt/acme.sh/config \
  --key-file /opt/win11-home/certs/studentop.cn.key \
  --fullchain-file /opt/win11-home/certs/studentop.cn.crt \
  --reloadcmd "systemctl reload nginx"
```

> ⚠️ acme.sh 默认 CA 已变成 ZeroSSL，**必须显式 `--server letsencrypt`**，否则会报 EAB/email 错误。

- **DNS**（阿里云云解析，TTL 600）：`@`、`www`、`frost`、`liyun`、`genshin` 五条 CNAME → `cn-bj1-kvlqs4ee.frp.cool`。
  工具：`tools/aliyun_dns_pi.py`（跑在 Pi 上，凭据直接读 acme.sh 的 `config/account.conf`，不落地明文）：

```bash
scp tools/aliyun_dns_pi.py pi:/tmp/dns_pi.py
ssh pi 'sudo -n python3 /tmp/dns_pi.py list'
ssh pi 'sudo -n python3 /tmp/dns_pi.py set dev CNAME cn-bj1-kvlqs4ee.frp.cool 600'
```

---

## 4. 日常操作

### 4.1 更新主页（含 /projects/ 索引页）

```bash
bash deploy/deploy-site.sh          # 打包 → 上传 → 原子切换 → 自检，失败自动回滚
bash deploy/checksum-compare.sh     # 本地与线上逐文件 sha256 对比
```

### 4.2 更新「理韵寻踪」

```bash
cd "D:/Users/Desktop/北理的文件夹/学习相关/软件工程导论研究型课程/理韵寻踪前端HUD开发/web"
npm run build                       # base 保持默认 "/"，不要改成子路径
tar czf /tmp/liyun-dist.tar.gz -C dist .
scp /tmp/liyun-dist.tar.gz pi:/tmp/
ssh pi 'TS=$(date -u +%Y%m%dT%H%MZ);
  sudo -n mkdir -p /opt/projects/liyun/releases/$TS &&
  sudo -n tar xzf /tmp/liyun-dist.tar.gz -C /opt/projects/liyun/releases/$TS &&
  sudo -n chown -R root:root /opt/projects/liyun/releases/$TS &&
  sudo -n ln -sfn releases/$TS /opt/projects/liyun/current &&
  sudo -n systemctl reload nginx && echo "$TS"'
```

回滚：`sudo -n ln -sfn releases/<旧时间戳> /opt/projects/liyun/current`（静态站不用 reload）。

### 4.3 更新「北湖霜降雅集」

用项目自带的服务器部署包（`delivery/北湖霜降雅集-服务器部署包-vX.Y.Z.zip`，包里不含真实账户/照片/令牌）：

```bash
scp "…/北湖霜降雅集-服务器部署包-vX.Y.Z.zip" pi:/tmp/frost.zip
ssh pi 'sha256sum /tmp/frost.zip
  sudo -n mkdir -p /opt/projects/frost/releases/vX.Y.Z &&
  sudo -n unzip -q /tmp/frost.zip -d /opt/projects/frost/releases/vX.Y.Z &&
  sudo -n chown -R root:root /opt/projects/frost/releases/vX.Y.Z &&
  sudo -n ln -sfn releases/vX.Y.Z /opt/projects/frost/current &&
  sudo -n systemctl restart frost-atlas && systemctl is-active frost-atlas'
```

- **数据不随发布包走**：数据库始终在 `/var/lib/frost-atlas/data`，换 release 不动它。
- 回滚：切回旧 release 软链 + `systemctl restart frost-atlas`。
- 管理端（户部机关处）**不对外**：需要时在本地开 SSH 隧道再起 `node servers/office.mjs`，只监听 127.0.0.1:4196。

### 4.4 更新「原神启动」（开场动画）

源码在仓库 `genshin-entry/`（已包含本部署的改动，见 `genshin-entry/DEPLOY-NOTES.md`）：

```bash
cd genshin-entry
npm run build                        # tsc && vite build → dist/（约 9MB）
tar czf /tmp/genshin-dist.tar.gz -C dist .
scp /tmp/genshin-dist.tar.gz pi:/tmp/
ssh pi 'TS=$(date -u +%Y%m%dT%H%MZ);
  sudo -n mkdir -p /opt/projects/genshin/releases/$TS &&
  sudo -n tar xzf /tmp/genshin-dist.tar.gz -C /opt/projects/genshin/releases/$TS &&
  sudo -n chown -R root:root /opt/projects/genshin/releases/$TS &&
  sudo -n chmod -R u=rwX,go=rX /opt/projects/genshin/releases/$TS &&
  sudo -n ln -sfn releases/$TS /opt/projects/genshin/current && echo $TS'
```

- **开场结束去哪**：`genshin-entry/src/core/exit.ts` 的 `DEFAULT_EXIT_URL`（当前 = 理韵寻踪）；也可以在 `index.html` 里加 `<script>window.__EXIT_URL__='…'</script>` 覆盖，无需改逻辑。
- **兜底入口**：`?skip=1`（或 `#skip`）直接跳目的地；界面左上角有「跳过开场」按钮；浏览器没开 WebGL 时自动渲染降级页（按钮 + 9 秒自动跳转）。
- 回滚：`sudo -n ln -sfn releases/<旧时间戳> /opt/projects/genshin/current`。
- 上游是开源项目（www-genshin，作者 TEAM.x.y.z，B 站 BV1E8411v7xy），**保留免责声明与署名**；这份下载副本本身缺了 Menu/Preloader 的挂载（见 DEPLOY-NOTES），已在 `App.tsx` 接回。

### 4.5 常用自检

```bash
bash deploy/preflight-public.sh      # 8 项：frpc / TCP / DNS / 证书 / 主站 / frost / liyun / genshin
ssh pi 'systemctl is-active frost-atlas nginx frpc; ss -lntp | grep -E ":(80|443|4173)"'
cd qa && node shortcut-test.js       # 真实双击桌面快捷方式 → 新标签页打开三个站点
cd qa && node genshin-flow-test.js --url "https://genshin.studentop.cn:14355/" --mode both
                                     # 开场端到端：?skip=1 直跳 + 点开始→等门→点击开门→落到理韵寻踪
```

---

## 5. 排查手册

| 现象 | 先看什么 |
| --- | --- |
| frost 返回 **502** | `systemctl status frost-atlas`；`journalctl -u frost-atlas -n 50`；`ss -lntp \| grep 4173` |
| frost 返回 **400 INVALID_HOST** | nginx 里 `Host` 必须带端口：`proxy_set_header Host $http_host;`（用 `$host` 会丢 :14355） |
| frost 返回 **400 INVALID_PROXY_METADATA** | `X-Forwarded-For` 必须是单个 IP：`proxy_set_header X-Forwarded-For $remote_addr;`（不要 `$proxy_add_x_forwarded_for`） |
| frost 上传图片 **413** | nginx `client_max_body_size 8m` 与应用内 5MiB 上限；不要盲目放大 |
| liyun **404** | `readlink -f /opt/projects/liyun/current`；`ls` 是否有 index.html；权限 644/755 |
| 两个子域 **SSL 报错** | `openssl x509 -in /opt/win11-home/certs/studentop.cn.crt -noout -text \| grep -A2 'Subject Alternative Name'`，确认 SAN 含 frost/liyun |
| genshin **404 / 白屏** | `readlink -f /opt/projects/genshin/current`；`ls` 有没有 index.html / assets / Genshin；日志 `/var/log/nginx/projects-genshin.error.log` |
| genshin **卡在加载 / 没门** | 浏览器控制台看 WebGL 与 `Genshin/Login/*.glb` 请求；无 WebGL 会走降级页；也可先 `?skip=1` 验证跳转链路 |
| 全站 **连不上** | `systemctl is-active frpc` + `journalctl -u frpc -n 30`；节点状态 <https://online.frp.cool> |
| 限流误伤 | frp TCP 未开 PROXY protocol → 应用看到的源 IP 全是 127.0.0.1；人多时调 `FROST_API_IP_LIMIT` 或改用带回源头的方案 |

---

## 6. 安全与已知风险

1. **frost 的公网注册是开放的**：`sealed=true` 只锁「点位编辑」，不挡注册/收录/上传。任何人可写姓名+学号+3 个词牌并上传照片（单张 5MiB）。需要限制时：加 nginx `auth_basic`、限制来源 IP、或 `systemctl stop frost-atlas`。
2. **没有自动备份**：`/var/lib/frost-atlas/data` 含真实参与者数据，建议定期 `scp` 或加 cron 备份。
3. **没有监控/告警**：进程崩了 systemd 会拉起，但公网链路断（节点/隧道）没人会收到通知。
4. **Node 是 tar 包安装**（/opt/node24），安全更新需要人工跟进；升级 Node 后重启 frost-atlas 即可。
5. **SQLite 单实例**：不要再起第二个写进程/容器，数据目录也绝不能被 nginx 当静态目录暴露。
6. **SD 卡**：数据库与照片都写在 SD 卡上，长期高频写入有损耗风险，重要数据请外备份。

---

## 7. 首次部署记录（2026-10-27）

| 项 | 值 |
| --- | --- |
| 北湖霜降雅集包 | `北湖霜降雅集-服务器部署包-v4.0.8.zip`，sha256 `01abb2e7…3253`，16,311,156 B |
| 包预检 | 91 资源 / 8,776,436 B / 124 文件 runtime ledger 全过，无内嵌凭据 |
| Node | v24.22.1（官方 latest-v24.x，SHASUMS 校验），npm 11.19.1 |
| frost 服务 | systemd `ProtectSystem=strict` + `ReadWritePaths=/var/lib/frost-atlas`，SIGKILL 后 4s 自愈，`systemd-analyze security` = 3.0 OK |
| 理韵寻踪构建 | vite 7.3.7，47 modules，4.73s，`npm test` 13/13 通过；dist 22 文件 26,297,748 B |
| 理韵寻踪 tar | `ee178337…38d5f2`，23,055,292 B；远端 `sha256sum -c` 22/22 |
| 证书 | Let's Encrypt，SAN=studentop.cn/www/frost/liyun，到期 2027-01-25 |
| 原神启动 | 上游 www-genshin；本部署补挂 Menu/Preloader、删坏掉的 ShaderTest.ts、开门后改跳理韵寻踪；dist 36 文件 / 9,329,295 B，上传 tar sha256 一致 |
| 最终验收 | preflight **8 PASS / 0 FAIL**；主页交互 **29/29**；三个桌面快捷方式真实双击各自落到正确站点；原神启动开场端到端（开始 5.2s → 门 12.2s → 点击开门 → 约 24s 落到理韵寻踪），两项目 + 开场控制台 0 error |

更细的过程记录：`deploy/pi-frost/DEPLOY-REPORT.md`、`deploy/pi-liyun/REPORT.md`。
