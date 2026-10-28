# 理韵寻踪 · 账号 API 服务端

零 npm 依赖，只用 Node 24 内置模块（`node:sqlite`、`node:http`、`node:crypto`）。数据存本地 SQLite（`liyun.sqlite`）。

## 启动

```sh
# 在 apps/liyun-explorer 目录下
node server/server.mjs
# 或
npm run server
```

默认监听 `127.0.0.1:8787`，数据目录 `server/data/`（自动创建，0700）。前端通过同源 `/api/*` 访问：开发时由 Vite 反代（已在 `vite.config.ts` 配好），生产由 nginx 反代（见 `deploy/pi-liyun/ACCOUNT-API.md`）。

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `LIYUN_API_HOST` | `127.0.0.1` | 监听地址 |
| `LIYUN_API_PORT` | `8787` | 监听端口（也读 `PORT`） |
| `LIYUN_DATA_DIR` | `./data` | SQLite 数据目录 |

## 测试

```sh
npm run test:server
# 等价于
node server/store.test.mjs && node server/server.test.mjs
```

`store.test.mjs` 覆盖存储层（建档/会话/进度/台账对齐/schema 守卫）；`server.test.mjs` 覆盖 HTTP 接口（登录/鉴权/进度读写/入参校验/清洗）。

## 接口

见 [`docs/ACCOUNT.md`](../docs/ACCOUNT.md) 第 5 节。
