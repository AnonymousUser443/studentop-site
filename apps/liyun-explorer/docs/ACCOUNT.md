# 理韵寻踪 · 账号与用户数据存储设计

本文梳理现有登录流程与用户身份标识，并给出账号体系、打卡记录与收集进度持久化的设计与接口契约。实现位于 `src/account.ts`（前端客户端）与 `server/`（后端，Node 内置 SQLite，零 npm 依赖）。

## 1. 现状梳理（改动前）

| 维度 | 现状 |
| --- | --- |
| 登录流程 | 无。入口只有一个「进入校园」按钮（`App.tsx` 的 `enter()`：随机 BGM、开音频、`entered=true`），不涉及任何账号。 |
| 用户身份 | 无。HUD 底部是硬编码演示值 `UID: LY06112403`（`Hud.tsx`）。 |
| 打卡记录 | 地标「发现」即打卡，但 `ExplorationState` 只存 `discoveredIds` 数组，无逐地标时间戳。 |
| 收集进度 | `discoveredIds` + `progressOf()`，只存浏览器 `localStorage` 键 `liyun.exploration.v1`。 |
| 持久化 | 仅 localStorage：换设备/浏览器/清缓存即丢；无后端、无接口（`deploy/pi-liyun/REPORT.md` 明确「没有 fetch/XHR」）。 |

## 2. 设计目标与兼容原则

- **补齐账号**：昵称 + 学号登录（无密码），学号是稳定唯一标识，首次登录自动建档。
- **持久化打卡与收集进度**：服务端保存每用户的收集进度快照 + 打卡台账（含时间戳）。
- **退出重进可恢复**：会话令牌持久化在客户端，重新进入时从服务端拉回自己的历史数据。
- **严格兼容现状**：后端是可选能力。后端不可达（纯静态部署 / 网络断开 / 开发未起服务）时，自动退化为游客模式，行为与改动前完全一致（localStorage 存档）；「游客模式」入口也始终保留，不强制登录。

## 3. 数据模型（SQLite，`server/data/liyun.sqlite`，schema version 1）

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,             -- 服务端生成的 UUID
  nickname TEXT NOT NULL,          -- 昵称（展示用，重复登录时以本次输入覆盖）
  student_id TEXT NOT NULL UNIQUE, -- 学号（登录键，唯一）
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,     -- 只存令牌的 sha256，令牌原文仅下发客户端一次
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL      -- 30 天
);

CREATE TABLE checkins (            -- 打卡台账（当前已发现地标 + 首次打卡时间）
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  landmark_id TEXT NOT NULL,
  discovered_at TEXT NOT NULL,     -- ISO 时间戳，首次持久化到服务端时记录
  PRIMARY KEY(user_id, landmark_id)
);

CREATE TABLE progress (            -- 收集进度快照（每用户一行）
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,        -- 完整 ExplorationState JSON
  updated_at TEXT NOT NULL
);
```

- `users`：账号主体；对外返回 `{ id, nickname, studentId, uid }`，其中 `uid = 'LY' + 用户 UUID 前 8 位十六进制大写`（对应 HUD 原演示值 `LY06112403` 的形态）。
- `sessions`：登录态。服务端不存明文令牌，避免数据库泄漏即可伪造会话。
- `checkins`：打卡台账。与 `discoveredIds` 对齐——仍在集合里的保留首次打卡时间，被移除（如「重置进度」）的删除，重新发现时记新时间。
- `progress`：收集进度快照。`discoveredIds` 之外的 `unlockedRegionIds`、`playerUV`、`settings` 一并随快照持久化。

## 4. 登录与身份

- **登录**：`POST /api/auth/login`，入参 `{ nickname, studentId }`。按 `student_id` 查找；不存在则建档，存在则更新昵称与 `last_login_at`。签发 30 天会话令牌。
- **登录态**：客户端把令牌存 `localStorage`（`liyun.session.v1`），后续请求带 `Authorization: Bearer <token>`。服务端按哈希校验并检查过期。
- **退出**：`POST /api/auth/logout` 删除当前会话；客户端同时清除本地令牌并回到登录/游客入口。
- **无密码的取舍**：与北湖霜降雅集一致，学号即身份、无密码，适合当前低流量、轻量个人站。任何知道某学号的人都能以该学号登录，因此**只适合课程演示/轻量场景**；若面向真实敏感数据，需升级为密码或统一身份认证，并补充限流（见 §7）。

## 5. API 契约（同源 `/api/*`，JSON）

| 方法 | 路径 | 鉴权 | 请求 | 响应 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 无 | — | `{ ok: true }` |
| POST | `/api/auth/login` | 无 | `{ nickname, studentId }` | `{ token, user }` |
| POST | `/api/auth/logout` | 是 | — | `{ ok: true }` |
| GET | `/api/auth/me` | 是 | — | `{ user }` |
| GET | `/api/progress` | 是 | — | `{ state, checkins, updatedAt }` |
| PUT | `/api/progress` | 是 | `{ state }` | `{ updatedAt }` |

- `state`：`ExplorationState`（`version/discoveredIds/unlockedRegionIds/playerUV/settings`）。服务端做轻量清洗（去重、限长、坐标回落默认、限制体积 ≤256KB），语义校验交由前端 `restoreState` 对 `LANDMARKS` 过滤，避免前后端重复维护地标清单。
- `checkins`：`[{ landmarkId, discoveredAt }]`，按时间升序。
- 错误统一 `{ error: string }`，未登录/过期返回 `401`，参数非法 `400`，体积超限 `413`。

## 6. 前端集成与降级（`src/account.ts` + `App.tsx` + `Hud.tsx`）

- **入口**：未登录时入口卡片显示「昵称 / 学号」表单 +「登录并进入」+「游客模式」；登录成功后显示「欢迎回来，{昵称} · 继续旅程」。游客模式与改动前行为一致。
- **会话恢复**：加载时若本地有令牌，`GET /api/auth/me` + `GET /api/progress` 拉回身份与进度（服务端有存档则以其为准；否则把本机进度首次上传）。令牌失效（401）则清除并回到游客；网络失败则保持本机存档，下次再试。
- **进度同步**：登录后，`ExplorationState` 变化（发现地标/改设置/重置）去抖 700ms 后 `PUT /api/progress`，同时仍写 localStorage 作离线镜像。
- **账号入口**：设置面板显示当前账号或「游客模式」，提供「退出登录」/「登录账号」；HUD 底部的 `UID` 改为真实 `昵称 · UID`（游客显示「游客 · 本机存档」）。
- **降级原则**：所有网络异常都不阻塞游玩；后端不可达时 `fetch` 抛错被捕获，界面提示可改游客，localStorage 存档不受影响。

## 7. 安全与已知局限

- 无密码登录：见 §4 取舍。
- 会话 30 天；服务端只存令牌哈希；`sessions.expires_at` 过期即失效。
- 未实现限流 / 封禁 / 审计（北湖霜降雅集有，本服务为最小实现）。上线前建议在 nginx 或本服务加简单限流。
- 学号与昵称会落库到私有目录（建议目录 `0700`，仅服务进程可读写）；请勿提交真实学号到仓库（本仓库对外脱敏）。

## 8. 运行与验证

见 [`server/README.md`](../server/README.md)（起服务、环境变量、测试）与 [`deploy/pi-liyun/ACCOUNT-API.md`](../../deploy/pi-liyun/ACCOUNT-API.md)（nginx 反代、systemd）。

## 9. 后续成员接入与修改指引

**代码地图**（账号能力相关，改动前先看这一节）：

| 关注点 | 位置 | 职责 |
| --- | --- | --- |
| 前端客户端 | `src/account.ts` | `fetch` 封装、令牌存取、`login/logout/me/progress` |
| 前端状态与类型 | `src/types.ts`（`AccountUser`）、`src/App.tsx` | 账号态、会话恢复、进度同步、退出 |
| 前端界面 | `src/hud/Hud.tsx`、`src/hud/hud.css` | 登录/入口、账号展示、设置页退出 |
| 后端存储 | `server/store.mjs` | SQLite 四表 + 查询/事务 |
| 后端接口 | `server/server.mjs` | 路由、鉴权、入参清洗 |
| 测试 | `server/*.test.mjs`、`src/account.test.ts` | 后端存储/接口、前端客户端 |

**接入一个新前端**：只需依赖 `src/account.ts` 的 5 个函数（`login/logout/fetchMe/fetchProgress/saveProgress`），令牌用 `readToken/writeToken` 管理，所有请求走同源 `/api/*`。不接后端也能跑（游客模式）。

**常见改动 → 改哪里**：

1. **加用户字段**（如头像、学院）：`src/types.ts` 的 `AccountUser` → `server/store.mjs`（表结构 + `PRAGMA user_version` 升版迁移 + 查询/返回）→ `server/server.mjs`（login/me 返回）→ `src/account.ts` 类型 → `Hud.tsx` 展示。旧库升级用 `user_version` 做迁移，别直接改既有列。
2. **加接口**：`server/store.mjs` 加方法 → `server/server.mjs` 加路由（鉴权沿用 `resolveSession`）→ `src/account.ts` 加函数 → 两端各补一条测试。
3. **改打卡/进度语义**：先改 `src/state.ts`/`src/types.ts`，并保持 `restoreState` 对旧存档向后兼容（新增可选字段、不删旧字段、不换 `SAVE_KEY` 键名）。

**兼容红线（改动必须遵守）**：

1. **后端永远是可选能力**：前端任何 `fetch` 失败都必须降级为游客 + localStorage，绝不能因后端不可达而白屏或抛错。`src/account.ts` 已把网络错误与业务错误分开，改动别破坏这一点。
2. **别动既有存档结构**：`SAVE_KEY = 'liyun.exploration.v1'`、`ExplorationState.version` 与 `restoreState` 的校验规则是历史存档的契约；只能向后兼容地扩展。
3. **别动既有路由语义**：`/api/auth/*`、`/api/progress` 已上线；新增能力用新路径，别改已有接口的字段含义。
4. **登录语义**：学号唯一、昵称可覆盖、无密码；令牌只在服务端存哈希。
5. **数据脱敏**：`server/data/` 已 gitignore；真实学号/昵称只进私有数据目录，**不进仓库**。
