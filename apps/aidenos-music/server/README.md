# 听潮音乐服务

Node 24 / ARM64 可用，入口 `index.mjs`，仅监听 `127.0.0.1:8901`。直接调用固定版本 `@neteasecloudmusicapienhanced/api` SDK，不启动上游通用 HTTP 服务。所有调用显式传入本会话的 Cookie、时间戳和 `unblock: false`。

## 私有配置

| 变量 | 含义 |
| --- | --- |
| `MUSIC_PORT` | 回环端口，默认 8901 |
| `MUSIC_DATA_DIR` | 专用私有目录；保存加密会话 SQLite 数据库 |
| `MUSIC_COOKIE_KEY` | 32 字节随机密钥的 64 字符十六进制编码 |
| `MUSIC_GATEWAY_KEY` | 至少 32 字节的随机内部网关密钥 |
| `MUSIC_PUBLIC_ORIGIN` | 精确主站来源，含协议和生产端口 |
| `MUSIC_SECURE_COOKIES` | HTTPS 默认启用；只在回环开发／测试中使用 `false` |

密钥由本地启动器或树莓派私有环境文件注入，不写入公开文件或日志。服务用户只需访问自己的数据目录和系统临时目录。节点加载 SDK 时可能在私有临时目录维护匿名令牌或协议公钥文件。

## 网关契约

主站认证服务转发 `/__desktop/music/v1/`，必须提供 `X-Music-Gateway` 以及 `X-Music-Access: desktop` 或 `playback`。`desktop` 只由网关完成桌面授权与写入 CSRF 校验后签发；`playback` 只能访问 `POST playback/resolve`。客户端不得自行指定内部访问上下文。

两种 HttpOnly Cookie：`AidenMusicSession`、`AidenMusicPlayback`，均使用 `Path=/__desktop/music/v1/; SameSite=Strict`。播放租约再要求匹配的 `X-Music-Playback-CSRF`，有效 12 小时，绑定音乐会话。登录切换、退出和上游登录失效会撤销旧租约。原始网易云 Cookie 仅在 AES-GCM 加密后的服务器存储内保存。

响应格式：成功 `{ok:true,data}`，失败 `{ok:false,error:{code,message,retryable}}`。上游嵌套的 HTTP-200 业务失败统一归一化，错误消息不转发上游 Cookie 或原始对象。SDK 自带失败日志可能包含 Cookie，因此仅在 SDK 的异步调用上下文中屏蔽其 console 输出，服务自身启动日志不受影响。

上游新版歌曲解析在某些环境无法初始化 xeapi 公钥。服务先尝试新版，再使用同账号的官方 `song_url` 接口回退；返回的试听区间、实际码率和格式决定可播放范围与音质。两种接口都不启用解锁或第三方音源。

## 检查

```powershell
node --test apps/aidenos-music/server/app.test.mjs
node apps/aidenos-music/server/guest-smoke.mjs
```

隔离 HTTP 测试使用假 SDK、临时端口和临时 SQLite；不读取真实账号。游客联调仅向官方服务发出只读请求，不登录或修改账号。`diagnose-sdk.mjs` 对比官方歌曲解析路径，只输出状态与是否存在地址，不输出地址、Cookie 或原始响应。

2026-11-16：隔离测试 10 项及 Service Adapter 7 项通过；真实游客首页、搜索、歌词和播放解析通过。扫码实际授权与真实个人歌单写入仍需由用户在听潮中操作验收。

服务在 IPC 模式下发出 `{type:'ready',id:'music',port}`，接受 `{type:'shutdown'}` 并在父进程断开时清理自身；独立 systemd 模式使用 SIGTERM 停止。

## 云盘、评论与心动模式

本轮核验固定官方标签 `v4.41.1`（提交 `2db6684453297ee86dec0492842f2320b08182d9`）的模块源码及随包 `public/docs/home.md`，没有升级 SDK。

| 同源接口 | 固定 SDK 能力 | 边界 |
| --- | --- | --- |
| `GET cloud?offset=` | `user_cloud` | 音乐账号登录后读取，每页 50 首，归一化为 `Track` |
| `GET comments/:trackId?offset=&before=` | `comment_music` | 每页 20 条；首屏附热评，5000 条后改用上一页时间游标 |
| `POST comments/:trackId/like` | `comment_like` | 只允许歌曲资源 `type:0`，白名单字段为 `commentId`、`liked` |
| `POST comments/:trackId` | `comment` | 只允许发送或回复，白名单字段为 `content`、可选 `replyTo`，1–500 字 |
| `GET heart-mode?trackId=&playlistId=` | `playmode_intelligence_list` | 仅使用官方种子／歌单上下文获取最多 30 首歌曲 |
| `GET library` | `user_playlist`、`user_playlist_create`、`likelist` | 只向 SDK 传会话所属账号 uid，合并本人创建列表中公开列表缺失的私密歌单 |

上述接口仍由桌面网关验证解锁状态，写入还必须通过桌面 CSRF；锁屏播放租约不能读取或修改这些内容。评论写入只会在 UI 显式调用方法时发出，服务和 Adapter 不自动重试。评论正文按文本返回，不透传上游账号字段。点赞刷新读缓存并保留分页游标；发送评论和账号变化清除游标。时间游标仅驻留浏览器内存，直接跳入深页或刷新后需从前一页继续。

云盘上传条目缺少匹配信息时回退上传歌曲 ID 与有限元数据，播放继续走既有官方地址解析；`unknown` 状态不代表保证可播。心动模式不推断官方未公开的推荐算法。音乐库最多读取每个来源 20 页，每页 100 项，无法完整读取时返回错误，避免静默丢失或重复私密歌单。

核验来源：官方标签下的 [云盘](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/v4.41.1/module/user_cloud.js)、[创建歌单列表](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/v4.41.1/module/user_playlist_create.js)、[歌曲评论](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/v4.41.1/module/comment_music.js)、[评论点赞](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/v4.41.1/module/comment_like.js)、[发送与回复](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/v4.41.1/module/comment.js)、[心动模式](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/v4.41.1/module/playmode_intelligence_list.js)。`sdk-contract.test.mjs` 实际加载这些固定模块并以录制 transport 校验请求，不连接上游。

本轮隔离测试覆盖云盘和账号边界、评论读写白名单及深分页、私密歌单合并／分页、心动上下文、业务失败以及禁止自动重发。真实云盘可播性、真实账号的私密歌单返回与评论权限仍由用户在 UI 中操作验收；本轮不执行真实账号写入。
