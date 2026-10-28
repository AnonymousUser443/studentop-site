import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';

// 理韵寻踪账号 API。零依赖，默认只监听 127.0.0.1（由 nginx 或 Vite 同源反代 /api）。
// 环境变量：LIYUN_API_HOST（默认 127.0.0.1）、LIYUN_API_PORT（默认 8787）、LIYUN_DATA_DIR（默认 ./data）。

const HOST = process.env.LIYUN_API_HOST ?? '127.0.0.1';
const PORT = Number(process.env.LIYUN_API_PORT ?? process.env.PORT ?? 8787);
const DATA_DIR = process.env.LIYUN_DATA_DIR ?? fileURLToPath(new URL('./data', import.meta.url));

const MAX_LOGIN_BODY = 8 * 1024;
const MAX_PROGRESS_BODY = 256 * 1024;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
};

async function readJson(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, '请求体过大');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, '请求体不是有效 JSON'); }
}

const cleanText = (raw, label, max) => {
  const s = String(raw ?? '').trim();
  if (!s) throw new HttpError(400, `${label}不能为空`);
  if (s.length > max) throw new HttpError(400, `${label}过长（最多 ${max} 字）`);
  if (/[\u0000-\u001f\u007f]/.test(s)) throw new HttpError(400, `${label}含非法字符`);
  return s;
};

const bearer = req => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  return m ? m[1] : null;
};

// 轻量清洗：只保证是能安全序列化的对象并限制体积，语义校验交由前端 restoreState。
function sanitizeState(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'state 必须是对象');
  const out = { ...raw };
  if (typeof out.version !== 'number') out.version = 1;
  const ids = Array.isArray(out.discoveredIds) ? out.discoveredIds : [];
  out.discoveredIds = [...new Set(ids.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 64))].slice(0, 200);
  const regions = Array.isArray(out.unlockedRegionIds) ? out.unlockedRegionIds : [];
  out.unlockedRegionIds = [...new Set(regions.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 64))].slice(0, 200);
  const p = out.playerUV;
  out.playerUV = p && [p.u, p.v].every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) ? { u: p.u, v: p.v } : { u: 0.5, v: 0.5 };
  if (!out.settings || typeof out.settings !== 'object') out.settings = {};
  return out;
}

export function createApiServer(store) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET';
      const path = url.pathname;

      if (method === 'GET' && path === '/api/health') return sendJson(res, 200, { ok: true });

      if (method === 'POST' && path === '/api/auth/login') {
        const body = await readJson(req, MAX_LOGIN_BODY);
        const nickname = cleanText(body.nickname, '昵称', 24);
        const studentId = cleanText(body.studentId, '学号', 32);
        const user = store.upsertUser({ nickname, studentId });
        const token = store.createSession(user.id);
        return sendJson(res, 200, { token, user });
      }

      // 以下接口都需要登录态。
      const session = store.resolveSession(bearer(req));
      if (!session) throw new HttpError(401, '未登录或登录已过期');

      if (method === 'POST' && path === '/api/auth/logout') {
        store.deleteSession(bearer(req));
        return sendJson(res, 200, { ok: true });
      }

      if (method === 'GET' && path === '/api/auth/me') {
        return sendJson(res, 200, { user: session.user });
      }

      if (method === 'GET' && path === '/api/progress') {
        const progress = store.getProgress(session.userId);
        return sendJson(res, 200, {
          state: progress ? progress.state : null,
          checkins: store.getCheckins(session.userId),
          updatedAt: progress ? progress.updatedAt : null,
        });
      }

      if (method === 'PUT' && path === '/api/progress') {
        const body = await readJson(req, MAX_PROGRESS_BODY);
        const updatedAt = store.saveProgress(session.userId, sanitizeState(body.state));
        return sendJson(res, 200, { updatedAt });
      }

      return sendJson(res, 404, { error: '接口不存在' });
    }
    catch (error) {
      if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
      console.error(error);
      return sendJson(res, 500, { error: '服务内部错误' });
    }
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const store = openStore({ dataDir: DATA_DIR });
  const server = createApiServer(store);
  server.listen(PORT, HOST, () => console.log(`[liyun-account] listening on http://${HOST}:${PORT} (data: ${DATA_DIR})`));
  const shutdown = () => { server.close(() => { store.close(); process.exit(0); }); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
