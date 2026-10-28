# 理韵寻踪 · 账号与云存档安全契约

实现：[客户端](<../src/account.ts>)、[入口表单](<../src/hud/Hud.tsx>)、[HTTP API](<../server/server.mjs>)、[SQLite 存储](<../server/store.mjs>)。这是最小课程项目账号能力，不是学校统一身份认证。

## 登录与游客

入口保留昵称、学号 / 游戏 ID 与游客。ID 仅是游戏存档键，不核验真实学籍；可使用测试标识，昵称请勿用真实姓名，访问口令请勿复用学校或其他服务的密码。

登录请求为 { nickname, studentId, password }。昵称 1–24 字、ID 1–32 字，必须为字符串；口令 8–128 字符，不自动 trim、不允许控制字符。未占用 ID 首次注册；已有新账号须先验证口令才能更新昵称并签发会话。错误口令返回 401，绝不修改昵称、进度或会话。此实现不提供自动找回；ID 首次注册不证明学校身份，请勿承载高价值或实名敏感数据。

口令只在表单内存和一次同源 HTTPS 请求中使用，提交即清空，不写 localStorage、GameState、云存档或日志。客户端拒绝公网 HTTP 登录，仅精确本机地址可用 HTTP 开发；禁止缓存、跨源或重定向转发口令。浏览器/第三方密码管理器的自主行为不由应用保证。

游客不需要服务端、权限或口令；账号接口失败不能伪造登录成功，界面保留选择游客与本机存档。

## 数据与会话

SQLite schema 2 为 users 新增可空 password_salt / password_hash：新账号分别保存随机 16 字节盐（hex）及 scrypt 64 字节摘要（hex），固定 scrypt 默认参数 N=16384、r=8、p=1。timingSafeEqual 比较定长摘要。盐不是秘密，数据库仍必须私有，不公开哈希。

对外仅返回 { id, nickname, studentId, uid }。会话令牌为随机 32 字节、base64url 编码；服务器仅存 SHA-256、30 天过期，退出撤销当前令牌。客户端沿用 liyun.session.v1 的 Bearer 持久化机制；访问口令不持久化。此方案仍有前端 XSS/本机存储被读取的风险，不能替代严格同源/CSP/HTTPS。

## 旧账号的受控迁移

schema 1 没有口令，不能根据“知道学号”判断所有权。升级时新增空口令列、撤销所有旧会话，原账号保持锁定；公开登录统一返回 423 和联系管理员提示。任何输入的首口令都不会自动领走旧账号。未部署过旧服务的空库会直接创建 schema 2，无需迁移。

只有具有私有数据目录访问权的管理员可以：

1. 停止账号服务，离线备份 SQLite/WAL，备份同样限制为私有并设置保留期限。
2. 通过管理员已持有的独立联系方式/线下方式核验原用户；ID、昵称、旧 Bearer 令牌均不能单独作为所有权证据。无法核验则保持锁定。
3. 确认内部 UUID，设置 LIYUN_DATA_DIR 指向离线私库，在本机交互 TTY 执行[迁移脚本](<../server/migrate-legacy.mjs>)：

```sh
node server/migrate-legacy.mjs --verified-owner <内部UUID>
```

脚本在关闭回显、禁用输入历史的 TTY 中要求两次新口令；不接受口令参数、环境变量、管道、日志或仓库文件。不可在录屏/终端录制环境操作。它只调用本地 migrateLegacyPassword，拒绝已有口令的账号，重新随机加盐并撤销旧会话，没有 HTTP 路由。管理员应由本人安全输入/交接该口令，不写操作日志或聊天记录。

4. 恢复服务后让已核验用户凭新口令登录。失败不清空原昵称与合法存档。此工具不提供通用重置现有口令能力。

## 严格云存档白名单

[客户端清洗](<../src/account.ts>)在传输前重新构造对象，[后端清洗](<../server/progress.mjs>)在存储前再次执行，不能依赖“前端类型里没有该字段”。允许字段只有：

- version：输出 v2；只有输入严格 v2 的打卡集合才被保留。
- discoveredIds：已知八个地标 ID 去重；所有未知 ID 丢弃。
- unlockedRegionIds：按已发现地标重建，不信任外部数组。
- playerUV：只允许 START_UV，或当前已发现地标的完全相同固定 UV；其他任何 UV（包括合法 0–1 范围内的 GPS 派生值）回落 START_UV。其附带未知字段也丢弃。
- settings：仅 music 布尔、volume 0–1 有限数、quality low/high、reducedMotion 布尔、track 整数 0–2，非法值回落默认。

真实 GPS、精度、时间戳、方向始终只属于定位 Hook 内存，不写该快照。密码、token、rawGPS、经纬度、其他嵌套敏感字段全部剔除。客户端收到旧/异常云快照也先清洗再恢复。

v1 演示存档只迁移合法设置，清空旧发现/区域/位置，输出 v2 空打卡；服务端相应清除旧台账，绝不将旧演示点击改标为 v2。合法 v2 地标及原有首次打卡时间保留，重置删除当前集合外台账。台账时间是首次服务端保存时间，并非 GPS 证明；此轻量 API 不验证定位真实性、不做防作弊证明。

启动时服务端重写旧快照的未知字段，并对齐台账；不保证历史备份、数据库空闲页/WAL或存储设备上的物理擦除。原始私有备份由管理员按保留策略处置，切勿发布。

固定公共锚点来自[地图数据](<../src/data.ts>)，新增地标需同步后端锚点与回归；不要引用运行时坐标来“自动扩展”白名单。

## HTTP 与生产保护

| 方法 | 路径 | 请求/响应 |
| --- | --- | --- |
| GET | /api/health | 无身份，只返回 { ok: true } |
| POST | /api/auth/login | { nickname, studentId, password } → { token, user } |
| POST | /api/auth/logout | Bearer → { ok: true } |
| GET | /api/auth/me | Bearer → { user } |
| GET | /api/progress | Bearer → { state, checkins, updatedAt } |
| PUT | /api/progress | Bearer + { state } → { updatedAt } |

所有携带 JSON 的接口要求 application/json 和非空对象，拒绝 null/数组/标量及错误字段类型。登录 ≤8KB，进度 ≤256KB。响应 no-store；错误仅返回固定提示，日志不记录请求体/口令/token/数据库内容。

NODE_ENV=production 时必须显式设置 LIYUN_PUBLIC_ORIGIN 为精确公开 HTTPS origin（含端口、无尾斜杠）。所有非 health 请求如带 Origin 必须匹配；所有修改请求必须带匹配 Origin，拒绝 cross-site Fetch Metadata，不开启 CORS。GET 身份/进度允许同源浏览器无 Origin，但仍需要 Bearer。不能信任随请求传来的 Host/Forwarded 来构造白名单。

登录失败按 ID 哈希计数：5 次 / 5 分钟；429 带 Retry-After。共享代理 socket 仅用 600 次 / 5 分钟的高阈值防滥用；单一账号到达上限后的请求不再累计全局。节流有界、进程内、重启会清空；nginx/frp 下不要按共享回环 IP 配低阈值造成跨用户串锁。管理员仍需边缘层防滥用。

## 验证与运行

[服务端说明](<../server/README.md>)列出负责人应执行的回归命令；新增用例包括正确/错误口令、同 ID 接管拒绝、schema1 锁定/受控迁移、敏感字段不落盘、v1不升级、v2正常恢复、HTTPS/Origin/JSON/节流边界。本成员仅编写并静态阅读，未执行测试或服务；最终结果由 Lead 记录。

生产私库、反代、独立服务见[部署说明](<../../../deploy/pi-liyun/ACCOUNT-API.md>)。
