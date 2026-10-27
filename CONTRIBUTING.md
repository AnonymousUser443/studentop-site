# 贡献指南

欢迎提 issue / PR。这里有一条**比代码风格更重要的硬规矩**：

## ⛔ 不要部署

树莓派（studentop.cn 线上站点）的部署**只能由仓库所有者发起**。
作为贡献者，请只改代码、只提 PR：

- 不要执行 deploy/ 下的发布脚本（deploy-site.sh / install-git-hooks.sh / verify.sh …）
- 不要连接这台服务器（ssh / scp / rsync）
- 不要触发或修改 .github/workflows/publish.yml

完整约定见 DEPLOYMENT-POLICY.md。

## 提交前自检

1. **不提交密钥与隐私**：token、私钥、真实学号、内网地址、参与者数据、.env；
2. **不改 apps/genshin-start/ 的免责声明**（上游要求保留）；
3. 改 site/ 时保持零依赖：不要引入框架 / CDN / 外部字体 / 统计脚本；
4. 跑一下语法检查：node --check site/assets/js/*.js；
5. 本地起个静态服务器看效果：cd site && python -m http.server 8080。

## PR 里写清楚

- 改了什么、为什么；
- 有没有影响线上（如果有，说明需要所有者发布）；
- 相关的 issue 编号。
