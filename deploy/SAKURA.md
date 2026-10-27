> ✅ **2026-10-27 14:31 更新：公网已打通**（改用 TCP 隧道 + 浮居北京1号节点，地址 https://studentop.cn:14355/）。本页保留为历史排查记录，最新状态见 deploy/PUBLIC-ACCESS-STATUS.md。

# SakuraFrp 修复指引（给用户操作，可照着截图做）

> ## ✅ 已确认（2026-10-27 14:00）
> - 服务商是 **浮居内网穿透（frp.cool）**，不是 natfrp.com 官方；本页提到的「面板」即浮居面板（SakuraPanel 二次开发）。
> - **「会员-建站1号」在官方状态页显示 DOWN，24 小时可用率 0%**（https://online.frp.cool/status/nodes），其余 7 个节点全部 UP。建站隧道只能用【建站】节点，因此换节点也救不了，需等服务商恢复或换服务商方案。
> - 树莓派上的 frpc 已换成浮居文档指定的 **0.29.0**（原 0.49.0 版本不匹配），并用本地 frps 闭环验证过你给的配置可用。
> - 最新、最全的现状与操作清单见 **deploy/PUBLIC-ACCESS-STATUS.md**。

> 背景：树莓派侧一切就绪（nginx + 发布目录 + frpc 已装好并设为开机自启）。
> 但目前 **公网打不开**，需要你先确认面板来源，再在面板/域名控制台完成 3 件事 + 证书 1 件事（共 4 步，见下）。
> 诊断证据：`deploy/DIAGNOSIS.md`（节点 IP 全球不可达、frpc 连不上、域名无解析）。

## 第 0 件事：先确认你用的到底是哪家面板

**为什么**：调研发现，你给的配置里「每次创建/删除映射后配置文件都会变化」这类表述**逐字来自开源项目 SakuraPanel（ZeroDream-CN/SakuraPanel，第三方面板）**，而 **natfrp.com 官方 v4** 的文档只提供 `frpc -f 访问密钥:隧道ID` 这种拉取方式，也没有「建站1号」这类套餐名。两种面板的节点、配置格式、frpc 版本可能完全不同。

**要做的**：
1. 确认你登录的面板网址是哪一个：
   - **A. 官方**：<https://www.natfrp.com/>（SakuraFrp 官方）
   - **B. 第三方**：SakuraPanel 或其它自建/第三方面板（网页样式更像通用 frp 面板，域名不是 natfrp.com）
2. 回复我们是 A 还是 B（截个面板首页/隧道列表的图即可，敏感信息打码）。

**如果是 B（第三方 SakuraPanel）**，请向面板运营方额外索取两样东西，否则可能连不上/版本不兼容：
- ① 该节点对外提供的 **域名**（用于 DNS 的 CNAME 记录）；
- ② 与面板配套的 **frpc 版本**（老面板的 frps 常见是 0.28 系列，和我们手里的 0.49.0 未必兼容；我们可以在 Pi 上换版本）。

## 第 1 件事：确认节点状态 / 换一个可用节点

**要做的**：
1. 打开 <https://www.natfrp.com/> 并登录。
2. 进入「隧道列表 / 节点列表」（左侧菜单里的「节点」或隧道详情里的「节点」字样）。
3. 找到 IP 为 `45.87.103.250`、端口 `7000` 的节点，看它的 **状态**：
   - 状态为 **在线/可用** → 进入第 2 件事；
   - 状态为 **离线/维护/满员** → 点击「更换节点」，选一个 **在线** 且支持 **HTTPS + 自定义域名** 的节点（香港/国内 BGP 均可，优先低延迟）。

**截图要点**：节点列表里该节点的「状态」列 / 节点名称与 IP 行。

## 第 2 件事：用面板重新生成 frpc 配置（不要手改现有数值）

**要做的**：
1. 面板 →「隧道」→ 选中你的隧道（名称 `Raspiberry`）。
2. 点「配置文件 / 一键配置 / 客户端配置」（不同版本叫法略不同）。
3. 选择 **Windows / 手动配置 / 复制配置**，把完整 `frpc.ini` 内容复制出来，原样发给部署者（或直接贴到会话里）。

**为什么**：我们用你给的配置实测，frpc 在 TCP 连接阶段就超时（节点死了），**没有走到认证**；且按 SakuraFrp 官方手册，连其节点时 `user` 应填「访问密钥」，你配置里的 `user=<FRP-USER-ID-已脱敏>` 更像账号/隧道 ID，`token` 的值也像占位符 —— 节点恢复后很可能还要认证一次。所以最稳妥是用面板生成的配置直接替换（**我们不会擅自改你给的数值**）。

另外：用户配置里 frpc 版本是 0.49.0，SakuraFrp 现行手册主要面向 **0.51.0-sakura 系列**；如果面板提示版本过低，请一并告诉我们换官方分发包。

**截图要点**：隧道详情页的「服务器地址 / 端口 / 访问密钥（Token）」区域（**密钥可以打码**，只要证明是从面板复制的即可）。

## 第 3 件事：给 studentop.cn 添加 DNS 解析

**现状**：`studentop.cn` 的 NS 在阿里云（`dns27/dns28.hichina.com`），但 **当前没有任何 A / AAAA / CNAME 记录**（权威查询 NODATA，`www` 为 NXDOMAIN）。所以就算隧道通了，浏览器也解析不到服务器。

**要做的**：
1. 打开 <https://dns.console.aliyun.com/>（阿里云 DNS 控制台），选择域名 `studentop.cn`。
2. 按 SakuraFrp 面板「自定义域名」处给出的记录添加：
   - 常见做法 1：**CNAME**，主机记录 `@`（或 `www`），记录值 = 面板显示的节点域名（形如 `xxx.sakurafrp.com`）；
   - 常见做法 2：**A 记录**，主机记录 `@`，记录值 = 节点 IP（面板会给出）。
   - 具体用哪种、填什么，**以面板显示为准**（不同节点支持不同）。
3. 保存后等 1–10 分钟生效（TTL 600）。验证：可在电脑上 `nslookup studentop.cn`。

**注意**：
- 添加 A/CNAME 与后续 ACME DNS-01 证书需要的 `_acme-challenge` TXT 记录**不冲突**，可共存。
- 如果面板提示「自定义域名需要备案/需要节点支持」，按面板提示处理；备案问题请直接问 SakuraFrp 客服。

**截图要点**：阿里云 DNS 记录列表页（显示你添加的 A/CNAME 行）。

## 第 4 件事：证书（三选一，装到 Pi 本地 443）

**为什么需要**：你的隧道类型是 `type=https`，SakuraFrp 节点只按 SNI 把 TLS 流量透传/转发，**节点本身不持有 studentop.cn 的证书**；浏览器要与 Pi 上的 nginx 直接完成 TLS 握手。当前 nginx 用的是自签占位证书（浏览器会告警），需要换成受信任证书。

> ⚠️ 不要开面板里的「自动 HTTPS」：那会让节点自己终止 TLS，而本地已经是 HTTPS，形成 TLS 套 TLS，访问会报 400。

三种方案任选其一（详细命令见 `deploy/ACME.md`）：

| 方案 | 你需要做的 | 特点 |
|---|---|---|
| **A. 推荐：阿里云 RAM 子账号 AccessKey** | 创建一个 RAM 子账号，授予 **AliyunDNSFullAccess**（或仅该域名的 DNS 权限），把 AccessKey ID / Secret 临时发给我们 | 我们用 `acme.sh --dns dns_ali` 全自动签发 + 自动续期（90 天一次，自动） |
| **B. 最省事：阿里云「数字证书管理服务」免费证书** | 控制台申请免费单域名证书（选 **DNS 验证**，可一键自动添加 TXT），下载 **nginx 格式**，把 `.pem`（fullchain）和 `.key` 发给我们 | 我们装到 `/opt/win11-home/certs/` 并 reload；每年手动续一次 |
| **C. 手动 DNS-01** | 我们先跑 `acme.sh` 拿到 TXT 值，你在云解析加一条 `_acme-challenge.studentop.cn` TXT，我们续跑签发 | 不需要 AccessKey；但**每 90 天要人工重复一次** |

拿到证书后我们会：写入 `/opt/win11-home/certs/studentop.cn.{crt,key}` → `nginx -t && systemctl reload nginx` → 跑 `bash deploy/verify.sh` + `bash deploy/preflight-public.sh` 确认 (d) 项变成 PASS。

## 节点恢复后会发生什么（我们会做，无需你操作）

- 我们在 Pi 上执行：`sudo systemctl restart frpc`，然后看 `/var/log/frpc.log`：
  - 出现 `login to server success` / `start proxy success` → 隧道通了；
  - 再次超时 → 回传日志继续排查（可能是安全组/节点问题）。
- 然后从公网 `curl https://studentop.cn` 应返回 **200** 且标题为 Win11 个人主页。
- 最后跑 `bash deploy/verify.sh` 做端到端确认。

## 一句话总结

| # | 在哪做 | 做什么 |
|---|---|---|
| 0 | — | 先确认面板是 natfrp.com 官方还是第三方 SakuraPanel（第三方需额外要节点域名 + 配套 frpc 版本） |
| 1 | SakuraFrp 面板 | 确认/更换节点（当前节点 45.87.103.250 已 dead） |
| 2 | SakuraFrp 面板 | 复制「一键配置」生成的完整 frpc.ini 发给我们 |
| 3 | 阿里云 DNS | 给 studentop.cn 加面板要求的 A 或 CNAME 记录 |
| 4 | 阿里云 / 面板 | 证书三选一（推荐 RAM AccessKey 自动签发） |

全部完成后，我们会跑 `bash deploy/preflight-public.sh`：5 项（frpc 登录 / 节点 TCP / DNS / 证书 / 公网 200）全 PASS 即交付。