# 2026-11-03 生产发布简检

最终版本 `0a068ea850ed2b2b33c325f1`，入口 https://liyun.studentop.cn:14355/。

- [最终事务](deployment.json)：前端62文件经 TLS 校验；账号运行文件相同，最终切换不重启账号或写数据库。
- [公网体检](preflight.txt)：8 PASS / 0 FAIL。
- [浏览器](browser.json)：普通游客→地图→左抽屉→八类设置，5项通过、错误0；空临时profile已关闭，不登录、不定位、不打卡。
- [菜单截图](menu-production.png)、[设置截图](settings-production.png)：均已目视确认。
- [包装依赖检查](wrapper.json)：26处 JS / CSS / 字体映射存在且使用当前版本路径；不把历史冻结地图 metadata 的图片标签当作运行依赖。

完整开发验收沿用 `../ui-implementation-20261103/`，未从头重跑。实体设备验收继续交给队员。

`deployment-first.json` 是被最终版本取代的首次事务，页面懒加载错误记录于 `browser-path-failure.json`；已恢复旧前端后修正包装再上线。`browser-initial.json` / `cold-download-initial.png` 保留首次短超时，`preflight-initial.txt` 保留空 frpc 日志导致的旧脚本误报。最终结论只依据本目录上述最终结果。
