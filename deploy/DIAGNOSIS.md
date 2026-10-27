# FRP / SakuraFrp 可达性诊断报告

- 时间：2026-10-27 13:19–13:30 (Asia/Shanghai)
- 执行人：deployer（树莓派 pi，Debian 13 trixie aarch64，校园网出口 36.110.14.252）
- 对象：用户给定 frpc 配置中的主节点 `server_addr=45.87.103.250:7000`（AS53808 MoeDove，香港）
- 目标域名：`studentop.cn`（DNS 托管在阿里云 hichina / dns27,dns28.hichina.com）

## 0. 结论（一句话）

**该节点在 IP 层不可达（节点宕机/该 IP 未被路由），不属于校园网过滤，也不是 token 认证失败。**
证据：从树莓派看，ICMP 路径能走完全程到香港最后一跳 `43.255.191.58`，该跳回 **Destination Host Unreachable**（网关 ARP 不到目标主机）；同时从 **4 个不同国家的独立网络**（伊朗/日本/荷兰/俄罗斯，check-host.net）复测 TCP 7000 全部失败（No route to host / 连接超时），而同方法测 Cloudflare 443 全部成功。frpc 的 debug 日志停在 `dial tcp ... i/o timeout`，从未进入认证阶段。

## 1. 本机/树莓派直连测试（python3 socket，精确 errno 区分）

脚本：`deploy/diag/diag_socket.py`（每目标 8s 超时，含已知可达的对照组以验证方法本身）

```text
# label                  host               port   role   result             secs  detail
frp-node-7000            45.87.103.250      7000   target  ETIMEDOUT          8.02  no TCP reply within 8.0s (packets dropped/filtered or host down)
frp-node-443             45.87.103.250      443    target  ETIMEDOUT         8.009  no TCP reply within 8.0s (packets dropped/filtered or host down)
frp-node-80              45.87.103.250      80     target  ETIMEDOUT         8.009  no TCP reply within 8.0s (packets dropped/filtered or host down)
control-cloudflare-443   104.16.132.229     443    control CONNECT_OK        2.265  TCP handshake completed
control-1.1.1.1-443      1.1.1.1            443    control ETIMEDOUT         8.008  no TCP reply within 8.0s   <-- 校园网对 1.1.1.1 亦不通（参考项）
control-baidu-443        www.baidu.com      443    control CONNECT_OK        2.008  TCP handshake completed
```

- 结论：7000/443/80 三个端口行为完全一致 = **SYN 无任何回应（ETIMEDOUT）**，不是 ECONNREFUSED（RST）、不是 EHOSTUNREACH（本机路由不可达）。说明数据包能离开校园网，但在目标侧被丢弃/无主机应答。
- 对照组 Cloudflare/百度 TCP 正常 → 方法有效、校园网对 443 正常。
- 本机 Windows 侧此前 Test-NetConnection 443/7000 均 False，与树莓派一致。

## 2. 路径追踪（mtr）

### 2.1 ICMP 到目标（关键证据）

```text
$ sudo mtr -n -c 10 -r 45.87.103.250
HOST: pi               Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 192.168.1.1                0.0%    10    0.2   0.2   0.2   0.3   0.0
  2.|-- 10.179.128.1               0.0%    10    4.1   6.7   2.0  12.8   3.6
  3.|-- ???                       100.0    10    0.0   0.0   0.0   0.0   0.0
  4.|-- 192.168.2.2               80.0%    10    1.3   1.3   1.3   1.4   0.0
  5.|-- 219.143.33.41             90.0%    10    2.3   2.3   2.3   2.3   0.0
  6.|-- ???                       100.0    10    0.0   0.0   0.0   0.0   0.0
  7.|-- 202.97.61.166             60.0%    10    3.9   3.9   3.9   4.0   0.1
  8.|-- 202.97.54.54              70.0%    10    4.4   4.4   4.3   4.5   0.1
  9.|-- 203.215.237.138           40.0%    10  106.8 112.2 106.8 116.4   4.4
 10.|-- 129.250.7.55              60.0%    10  104.8 109.9 104.8 111.9   3.4
 11.|-- 129.250.2.51              80.0%    10  114.8 118.0 114.8 121.2   4.5
 12.|-- 129.250.2.255             60.0%    10  169.1 171.9 169.1 174.6   2.9
 13.|-- 203.131.245.98            40.0%    10  171.8 175.6 171.6 180.6   3.7
 14.|-- 66.90.115.194             60.0%    10  172.8 169.3 164.0 172.8   3.8
 15.|-- 43.255.191.58             30.0%    10  160.1 163.7 159.8 167.6   2.9
 16.|-- 43.255.191.58             90.0%    10  3221. 3221. 3221. 3221.   0.0
```

```text
$ ping -c 4 -W 2 45.87.103.250
From 43.255.191.58 icmp_seq=1 Destination Host Unreachable
From 43.255.191.58 icmp_seq=2 Destination Host Unreachable
4 packets transmitted, 0 received, +2 errors, 100% packet loss

$ ping -c 3 -W 2 43.255.191.58      # 该网关本身可达
3 packets transmitted, 2 received, 33% packet loss, rtt avg 169 ms
```

解读：ICMP 能一路走到 AS53808（MoeDove 香港）最后一跳 `43.255.191.58`（169ms，可 ping 通），该跳对 `45.87.103.250` 回 **Destination Host Unreachable** = 最后一跳路由器 ARP/邻居发现不到目标主机 → **目标主机不在线（或该 IP 已不被宣告到该设备）**。这不是“校园网把包丢了”，而是包已经到达目标机房、被目标侧判死。

### 2.2 TCP 7000 的 mtr（-T，需要 root）

```text
$ sudo mtr -T -P 7000 -n -c 20 -r 45.87.103.250
  1.|-- 192.168.1.1                0.0%    20    0.3   0.4   0.3   0.5   0.1
  2.|-- 10.179.128.1               0.0%    20    5.3   3.6   1.5   8.7   2.4
  3.|-- ???                       100.0    20    0.0   0.0   0.0   0.0   0.0
  4.|-- 192.168.2.2                0.0%    20    1.4 154.2   1.3 3054. 682.8
  5.|-- ???                       100.0    20    0.0   0.0   0.0   0.0   0.0
```

（TCP 探测的后续跳不回应 ICMP TTL，属常见中间设备过滤；ICMP 版本已证明路径可达目标机房。）

## 3. 远端独立网络复测（排除“只有校园网连不上”）

使用 check-host.net 公共探测节点（外部第三方数据，仅作参考），对 TCP `45.87.103.250:7000`：

```json
{"ir3.node.check-host.net":[{"error":"No route to host"}],
 "jp1.node.check-host.net":[{"error":"No route to host"}],
 "nl2.node.check-host.net":[{"error":"Connection timed out"}],
 "ru2.node.check-host.net":[{"error":"Connection timed out"}]}
```

同方法对照组 `104.16.132.229:443`（Cloudflare）：

```json
{"de2.node.check-host.net":[{"address":"104.16.132.229","time":0.00118}],
 "ir4.node.check-host.net":[{"address":"104.16.132.229","time":0.100737}],
 "uk1.node.check-host.net":[{"address":"104.16.132.229","time":0.002471}]}
```

→ 4 个互不相关的境外网络均连不上该节点，而方法本身有效。**排除校园网单点过滤。**

## 4. frpc 0.49.0 实测（配置原样，仅加日志级别）

- 已安装：`/opt/frpc/frpc` = `frp_0.49.0_linux_arm64`（ELF 64-bit ARM aarch64，静态链接），`frpc -v` → `0.49.0`。
- `/opt/frpc/frpc.ini` **与用户给定配置逐项一致**，仅追加日志项：`log_file=/var/log/frpc.log`、`log_max_days=7`、`log_level=info`（不改变任何网络/认证取值）。
- 诊断用副本 `/tmp/frpc-debug.ini`：`log_level=debug`、`log_file=console`，前台跑 60s（`sudo timeout 60 /opt/frpc/frpc -c /tmp/frpc-debug.ini`）：

```text
2026/10/27 13:22:49 [W] [service.go:131] login to server failed: dial tcp 45.87.103.250:7000: i/o timeout
dial tcp 45.87.103.250:7000: i/o timeout
```

（原始日志副本：`deploy/diag/frpc-foreground-debug.log`；EXIT=1，frpc v0.49 INI 模式 `login_fail_exit` 默认 true，登录失败即退出，故 60s 内早退。）

判读：**故障发生在 TCP 连接建立阶段，HTTP/TLS 登录请求从未发出 → 不可能是 token 认证失败**（认证失败会表现为 `auth failed` / `invalid token`，日志里完全没有）。与第 1 节 socket 结果一致。

## 5. 节点域名入口 / 配置有效性检查（未改配置）

- `dig +short -x 45.87.103.250` → 无 PTR 记录。
- 反查同 IP 域名（hackertarget）：`66eb88b3225e2c0367ddf9cc.openbmclapi.933.moe`, `drive.eintyto.com`, `fn.iouo.top`, `fucezh.top`, `sfeel.xyz`, `www.cyl0411.cn` 等 —— 该 IP 是共享主机，非 SakuraFrp 独占节点 IP。
- `api.natfrp.com` 公开节点 API 探测：`/v4/node/list` 等均 404/500（节点列表需登录面板，无法从公网无损获取）。因此**无法确认该 IP 是否有对应的 SakuraFrp 域名形式入口**；不做任何猜测性改动。
- 重要配置风险（依 SakuraFrp 官方文档，仅提示、不改）：
  - 官方手册明确：“连接 Sakura Frp 节点时 `user` 应填写访问密钥（Token）”。当前 `user=<FRP-USER-ID-已脱敏>` 更像用户/隧道 ID，`token` 值形态也像占位符，**待节点恢复后必须复核**；建议直接在面板用“一键配置/获取配置文件”重新生成再替换。
  - 手册中 frpc 建议版本为 0.51.0-sakura 系列（*0.51.0-sakura-7 等）；用户指定 0.49.0 较旧，若节点恢复后仍登录失败，优先怀疑版本/认证字段不匹配。

## 6. 域名 DNS 现状（新增发现，影响最终公网访问）

```text
# 权威查询（阿里 DNS DoH，绕过校园网 53 端口限制）
studentop.cn   A  -> NOERROR / ANSWER: 0（只有 SOA，无任何 A 记录 = NODATA）
studentop.cn  NS  -> dns27.hichina.com. / dns28.hichina.com.
www.studentop.cn A -> NXDOMAIN（不存在）
# 树莓派本地 resolver（10.0.32.33）同一个结果：NOERROR + 0 answer
```

→ **studentop.cn 当前没有任何 A/AAAA/CNAME 解析记录**。SakuraFrp 的 `custom_domains=studentop.cn`（HTTPS）要求该域名解析到节点；即便隧道恢复，没有 DNS 记录公网也打不开 `https://studentop.cn`。需用户在阿里云 DNS 控制台按 SakuraFrp 面板给出的目标添加 CNAME（或 A）记录。

另：校园网限制对外 53 端口（直连 223.5.5.5 / 119.29.29.29 均超时），普通解析只能走内网 DNS `10.0.32.33/32`；配置里的 `dns_server=119.29.29.29` 因此在 Pi 上不可用。当前 `server_addr` 是 IP，暂不受影响；若日后换用域名节点，应删除 `dns_server` 或改为系统 DNS。

## 7. 需要用户做什么（按优先级）

1. **登录 SakuraFrp 面板确认节点 45.87.103.250 状态**；该节点目前 IP 层不可达（全球多网络复现），请在面板“节点列表”换一个可用节点，或等节点恢复。
2. **重新生成/获取 frpc 配置**：用面板“一键配置”生成对应节点的配置（`server_addr` 可能是域名、`user` 应为访问密钥），把完整配置发我们替换；**不要**直接改现有数值。
3. **给 studentop.cn 添加 DNS 解析**：按面板“自定义域名”提示，在阿里云 DNS 加 CNAME（通常指向 `xxx.sakurafrp.com`）或 A 记录；否则 HTTPS 域名永远打不开。
4. 若面板显示节点要求 frpc 版本 ≥0.51.0-sakura，请告知，我们换 SakuraFrp 官方分发包（当前按用户指定用 0.49.0）。

## 8. 复现命令

```bash
# 1) socket 精确诊断（树莓派）
scp deploy/diag/diag_socket.py pi:/tmp/ && ssh pi 'python3 /tmp/diag_socket.py'
# 2) 路径
ssh pi 'sudo -n mtr -T -P 7000 -n -c 20 -r 45.87.103.250'
ssh pi 'sudo -n mtr -n -c 10 -r 45.87.103.250; ping -c 4 -W 2 45.87.103.250'
# 3) frpc 前台 debug 60s
ssh pi 'sudo -n timeout 60 /opt/frpc/frpc -c /tmp/frpc-debug.ini'
# 4) 域名解析（绕过校园网 53 限制）
ssh pi 'curl -s "https://dns.alidns.com/resolve?name=studentop.cn&type=A"'
```
