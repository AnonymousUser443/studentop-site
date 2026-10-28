# 部署权限约定（Deployment Policy）

> **一句话：树莓派上的一切部署，只能由仓库所有者本人发起。**
> 其他任何人——协作者、团队成员、CI 机器人、AI Agent——都不得执行或触发部署。

适用对象：仓库所有者 **AnonymousUser443**（studentop.cn 站点的运维人）。

---

## 1. 这条约定管什么

树莓派上跑着 4 个站点（主页 / 北湖霜降雅集 / 理韵寻踪 / 原神启动）。**任何会改变线上状态的操作**都算部署，包括但不限于：

| 动作 | 举例 |
| --- | --- |
| 跑发布脚本 | deploy/deploy-site.sh、装了 pre-push 钩子后的 git push |
| 直接写服务器 | ssh / scp / rsync 到 /opt/win11-home、/opt/projects/*、/etc/nginx、证书目录 |
| 触发 CI 发布 | .github/workflows/publish.yml（仅所有者手动 workflow_dispatch） |
| 重启线上服务 | systemctl restart/reload nginx、frost-atlas、frpc |
| 改动公网链路 | DNS 记录、Let's Encrypt 证书重签、frp 隧道配置 |

**只读排查不受限制**（curl、看日志、deploy/preflight-public.sh 的只读检查），但也请不要高频刷新。

## 2. 谁能部署

| 角色 | 可以部署吗 | 说明 |
| --- | --- | --- |
| 仓库所有者（AnonymousUser443） | ✅ **唯一可以** | 本地 git push（pre-push 钩子自动发布），或在 Actions 页面手动 Run workflow |
| 协作者 / 团队成员 | ❌ 不可以 | 只提 PR / issue，由所有者合并并负责上线 |
| GitHub Actions | ⚠️ 条件性 | workflow 里有 if: github.actor == 'AnonymousUser443' 的判断，别人触发也不执行部署 |
| AI Agent / 自动化助手 | ❌ 不可以 | 除非所有者**当次明确授权**，否则只能改代码、不能碰服务器 |

## 3. 技术上是怎么保证的

2026-10-28 当前发布规则：工作流只接受所有者手动触发，main push 不再自动发布；事务发布与单主页脚本共用远端互斥锁。AI仍须每次获得明确授权，不能把本次授权当作永久发布权限。新的 [pre-push 模板](<deploy/pre-push.hook>)只做本地版本化构建与校验，不再自动连接服务器；本轮没有安装或覆盖任何人的既有钩子。历史自动部署钩子仍应按线上操作对待。工作流仍保留 owner-only 闸门，发布前必须另行完成 [私密认证服务与缓存配置](<docs/REVISION-20261028.md>)，不能只上传静态前端。

1. **钥匙只在所有者手里**：部署需要树莓派的 SSH 私钥（authorized_keys 里那把带 restrict 的 deploy key）+ 校园网可达。别人没有钥匙，技术上进不来。
2. **Actions 的 actor 闸门**：.github/workflows/publish.yml 的 job 带 if: github.actor == 'AnonymousUser443'，别人 push 也不会跑部署。
3. **pre-push 钩子只装在所有者本机**：deploy/install-git-hooks.sh 生成的钩子只对所有者这台机器生效，别人 clone 下来不会自动部署。
4. **发布脚本启动就提示**：deploy/deploy-site.sh 开头会打印这条约定。
5. **workflow 不监听 pull_request**：这是自托管 runner（所有者电脑）上的任务，fork 的 PR 永远不会在所有者机器上执行代码。

## 4. 想贡献的人怎么配合

- 只改代码：开 PR / issue，**不要**执行任何 deploy 脚本，也**不要**连接这台树莓派；
- 需要上线：由所有者 review 合并后，所有者自己 git push（本地钩子自动发布）或在 Actions 页面点 Run workflow；
- 如果你在 PR 里被要求「顺便部署一下」：请拒绝，并把这条约定贴给对方。

## 5. 违反约定的后果

所有者会撤销相关权限并**轮换部署密钥**（重新生成 deploy key、清理 authorized_keys）。
请把树莓派当成「别人的生产服务器」：可以提建议，不要动手。

## 6. 相关文件

- 发布脚本与文档：deploy/README.md、deploy/PROJECTS.md
- 本地自动发布钩子：deploy/install-git-hooks.sh、deploy/pre-push.hook
- 发布 workflow：.github/workflows/publish.yml
- 贡献指南：CONTRIBUTING.md
