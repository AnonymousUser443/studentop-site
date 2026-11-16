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
