# deploy/ · 部署与运维

> ⛔ **部署权限**：本目录的脚本会改动线上服务器，**只能由仓库所有者执行**。
> 其他协作者、团队成员、AI Agent 请勿运行，也不要连接这台树莓派。详见 [../DEPLOYMENT-POLICY.md](../DEPLOYMENT-POLICY.md)。

这台树莓派上跑着 4 个站点，全部由本目录的脚本与配置管理。

## 文件地图

| 文件 | 作用 |
| --- | --- |
| `deploy-site.sh` | **主页发布**：本地打包 → scp → 解到 `releases/<UTC时间戳>` → `nginx -t` → 原子切 `current` 软链 → 自检失败自动回滚 |
| `checksum-compare.sh` | 本地 vs 线上逐文件 sha256 对比（发布后确认一致） |
| `verify.sh` | 站点可用性/响应头/关键文件检查 |
| `preflight-public.sh` | **公网 8 项体检**：frpc 状态 / Pi→节点 TCP / 公网 DNS / 本地证书 / 主页 / frost / liyun / genshin |
| `post-deploy-stats.sh` | 发布后远端统计（体积、release 列表、磁盘） |
| `Open-Site.ps1` / `Open-Site.cmd` | 本地 8080 → 树莓派 80 的 SSH 隧道，用来「本地预览线上站点」 |
| `nginx/` | 树莓派上**实际**的 nginx 配置：`win11-home.conf`（主页，含 80/443 两个 server）、两个 snippet、以及 `nginx-projects.conf` 的四个项目 server 块来源 |
| `pi-frost/` | 北湖霜降雅集部署记录：systemd unit、安装/验证脚本、服务端源码片段、DEPLOY-REPORT.md |
| `pi-liyun/` | 理韵寻踪部署记录：REPORT.md、dist sha256 清单、nginx snippet |
| `pi-genshin/` | 原神启动部署记录：RECORD.md |
| `PROJECTS.md` | **维护手册**：三个项目怎么更新、怎么回滚、怎么排查（502 / 404 / 400 INVALID_HOST / 413 / 证书 / 限流） |
| `PI-STATE.md` | 树莓派当前状态全记录（软件版本、目录、已装的 systemd 服务、变更历史） |
| `PUBLIC-ACCESS-STATUS.md` | 公网接入现状：链路、为什么带 :14355、子域名 + 一张证书的分流方案 |
| `ACME.md` / `SAKURA.md` / `DIAGNOSIS.md` / `TCP-FALLBACK.md` | 证书签发、frp 面板操作、故障诊断、TCP 兜底方案的历史记录 |

## 已脱敏

公开仓库里的这些值是占位符，替换成你自己的即可：

| 占位符 | 含义 |
| --- | --- |
| `<FRP-TOKEN-已脱敏>` | frp 节点 token |
| `<FRP-USER-ID-已脱敏>` | frp 用户标识 |
| `<管理员学号-已脱敏>` | 北湖霜降雅集里拥有「点位编辑」权限的账号 |
| `pi` / `192.168.1.10` | 树莓派 SSH 别名与内网地址（脚本用 `PI_HOST` 环境变量覆盖） |
| `C:/Users/yours` | 本机路径 |

真实凭据从未进入仓库：frp 配置读自 `/opt/frpc/frpc.ini`（root 600），Let's Encrypt 的阿里云 RAM 凭据存在 `/opt/acme.sh/config/account.conf`（root 600），北湖霜降雅集的管理令牌在树莓派私有数据目录（0600）。

## 一条龙自检

```bash
bash deploy/deploy-site.sh      # 发布主页
bash deploy/preflight-public.sh # 8 项公网体检
cd qa && node interact.js       # 浏览器交互验收（见 qa/README.md）
```
