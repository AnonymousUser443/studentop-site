# 追光者

169 页横屏 Web 演讲。提词器授权后创建六位场次号。大屏与观众凭场次号加入，舞台按 Q 投影当场的观众二维码。提词器二次确认结束，留言、私信、投票与抽奖按场次存档。

## 本地运行

需要 Node.js 24。

```sh
npm ci
npm run build
npm start
```

打开 http://localhost:8787/ 进入大屏。查询参数 `role=presenter` 打开提词器，`role=audience` 打开观众端，`rehearsal=1` 进行本地彩排。直接预览使用 `?preview=P2-13`，动效默认开启。视频按 V 播放或暂停。HTTPS 或 localhost 支持持久离线缓存。

## 树莓派构建与验证

设置 `PRESENTATION_BASE=/zhuiguang/` 与 `PRESENTATION_DIST=dist-pi` 后运行 `npm run build`，再运行 `node scripts/package-pi.mjs <新暂存目录>`。使用仓库 `deploy/deploy-zhuiguang.ps1` 原子发布。正式环境以私有配置注入主持口令，数据放在独立目录。数据库由备份定时器维护。

`npm run test:backend` 验证会话、SQLite、互动权限与缓存。浏览器验收可以指定 `REVIEW_CHROMIUM`、`REVIEW_URL` 和隔离验收服务的 `REVIEW_PIN`，运行 `node scripts/render-production.mjs --browser-compat --review-flow --offline --extras`。用 `--aac` 复验 BGM 兼容音轨。

## 交付媒体

资源清单只包含上屏派生素材。插画保留原构图、分辨率和透明通道；舞台视频使用 faststart H.264/AAC MP4；BGM 优先 Opus，AAC 一同预载。Te 使用最新版 Te，Fi 前半段使用最新版 Fi_1，点灯后延续 Fi_2。构建时生成 SHA-256 指纹，缓存更新可复用内容相同的文件。
