# 理韵寻踪 · 账号 API

Node 24 内置 HTTP、SQLite 与 crypto，零 npm 依赖。游客入口独立于账号服务。

## 运行配置

从仓库根执行 `node tools/dev-workspace.mjs`，完整模式自动托管本 API、主页和三个前端，统一启动、健康检查与退出清理。API 固定监听 127.0.0.1:8787，前端仍通过同源 `/api` 访问；无需额外终端。启动失败或子进程异常退出会清理本次服务，保留外部服务。

单独调试 API 时，可在退出自己启动的完整模式后运行 `npm --prefix apps/liyun-explorer run server`。下表的 Host、Port 和生产 Origin 设置用于独立运行；统一开发启动器固定使用回环开发契约，不受这些独立服务的网络覆盖值影响，仍遵循 `LIYUN_DATA_DIR`。生产变更须遵守[部署政策](../../../DEPLOYMENT-POLICY.md)。

| 变量 | 说明 |
| --- | --- |
| LIYUN_API_HOST | 默认 127.0.0.1；生产必须只监听回环 |
| LIYUN_API_PORT | 默认 8787，也兼容 PORT |
| LIYUN_DATA_DIR | 默认本模块旁的 data 目录；生产必须在 webroot/仓库外，例如 /var/lib/liyun-account |
| NODE_ENV | 生产设置 production |
| LIYUN_PUBLIC_ORIGIN | 生产必填精确 HTTPS origin，含公开端口，无尾斜杠；缺失/非法拒绝启动 |

开发命令（仅由负责人执行）：

```sh
node server/server.mjs
```

前端请求走同源 /api，开发由 Vite 反代，生产由 HTTPS nginx 反代。生产 POST/PUT 必须带匹配 Origin；不启用 CORS。入口按 realpath 判断，支持 current 软链。

## 认证与迁移

- 首次未占用的学号 / 游戏 ID 注册需昵称及 8–128 字符访问口令；不作学校实名核验，可使用测试 ID，请勿用真实姓名或复用学校密码。
- 新口令用随机 16 字节盐、scrypt 64 字节摘要；校验 timingSafeEqual。错误口令不会更新昵称/登录时间/进度或签发会话。
- 数据库 schema 2。schema 1 升级后原无口令账号锁定，旧令牌全部撤销；不能从公开登录接口设置其首口令。
- 管理员迁移只对已线下核验的旧账号开放，见[迁移步骤](<../docs/ACCOUNT.md#旧账号的受控迁移>)。无账号恢复/迁移 HTTP API。
- 会话仍为随机 32 字节 Bearer token、30 天有效期，服务端仅存 SHA-256。
- 账号 5 次失败 / 5 分钟；共享 socket 600 次失败 / 5 分钟仅作高阈值防滥用。429 带 Retry-After，窗口内不继续哈希；不信任客户端伪造的 X-Forwarded-For。节流为有界进程内状态，重启会重置，不能代替边缘防护。

## 云存档边界

[进度清洗](<progress.mjs>)仅允许 version、合法 discoveredIds、由地标重建的 unlockedRegionIds、公共锚点 playerUV 及五项设置 music/volume/quality/reducedMotion/track；不传播 raw GPS、朝向、未知字段、访问口令或令牌。

playerUV 只允许起点或已发现地标的固定 UV，任意坐标回落起点。v1 演示仅保留合法设置，转为 v2 空打卡，不把旧点击升级成 GPS 打卡。启动时清洗旧快照并删除不再有效的旧台账；旧备份/WAL历史需管理员按保留策略安全清理，不宣称物理擦除。

## 回归交接

在应用目录执行以下回归；具体通过结果应记录对应提交和测试环境：

```sh
node --test server/store.test.mjs server/server.test.mjs
npm test -- --run src/account.test.ts
```

[存储回归](<store.test.mjs>)覆盖口令校验/接管拒绝、随机盐、过期、真实 schema1 锁定及受控迁移、敏感字段不落盘。[HTTP 回归](<server.test.mjs>)覆盖完整流程、JSON 类型/长度、同源、失败节流与云清洗。[客户端回归](<../src/account.test.ts>)覆盖仅一次口令请求、禁缓存/跳转、HTTPS 以及 GPS/未知字段传输拦截。

完整[账号契约](<../docs/ACCOUNT.md>)与[部署说明](<../../../deploy/pi-liyun/ACCOUNT-API.md>)。
