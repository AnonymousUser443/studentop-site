import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { AccountError, openStore, sha256, validatePassword } from './store.mjs';

const HOST = process.env.LIYUN_API_HOST ?? '127.0.0.1';
const PORT = Number(process.env.LIYUN_API_PORT ?? process.env.PORT ?? 8787);
const DATA_DIR = process.env.LIYUN_DATA_DIR ?? fileURLToPath(new URL('./data', import.meta.url));
class HttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
const sendJson = (res, status, payload, retryAfter) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) });
  res.end(body);
};
async function readJson(req, limit) {
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, '请求须使用 application/json');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= limit) chunks.push(chunk); // Bound memory while draining an oversized body.
  }
  if (size > limit) throw new HttpError(413, '请求体过大');
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, '请求体不是有效 JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, '请求体必须是 JSON 对象');
  return body;
}
const cleanText = (raw, label, max) => {
  if (typeof raw !== 'string') throw new HttpError(400, label + '必须是字符串');
  const s = raw.trim();
  if (!s || s.length > max || /[\u0000-\u001f\u007f]/.test(s)) throw new HttpError(400, label + '不能为空、过长或含控制字符');
  return s;
};
const bearer = req => /^Bearer +([A-Za-z0-9_-]{43})$/i.exec(req.headers.authorization ?? '')?.[1] ?? null;
const loopbackOrigin = value => {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && u.origin === value; }
  catch { return false; }
};
function configureOrigin(value, production) {
  if (!value) { if (production) throw new Error('LIYUN_PUBLIC_ORIGIN must be explicitly configured in production'); return null; }
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid LIYUN_PUBLIC_ORIGIN'); }
  if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' && !(loopbackOrigin(value) && !production))) throw new Error('LIYUN_PUBLIC_ORIGIN must be an exact HTTPS origin, including the public port, without a trailing slash');
  return value;
}
function guardOrigin(req, origin, method) {
  const actual = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site' || (actual !== undefined && (origin ? actual !== origin : !loopbackOrigin(actual)))) throw new HttpError(403, '仅允许同源访问');
  if (origin && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && actual !== origin) throw new HttpError(403, '修改请求须带正确 Origin');
}
// Bounded in-memory throttling. Proxy headers are not trusted; nginx peers share the IP bucket.
function loginThrottle(now) {
  const buckets = new Map();
  const get = key => {
    const at = now();
    for (const [id, b] of buckets) if (b.until <= at) buckets.delete(id);
    if (!buckets.has(key)) {
      if (buckets.size >= 1000) throw new HttpError(429, '登录请求过多，请稍后再试', 300);
      buckets.set(key, { count: 0, until: at + 300000 });
    }
    return buckets.get(key);
  };
  return {
    check(key, max) { const b = get(key); if (b.count >= max) throw new HttpError(429, '登录失败次数过多，请稍后再试', Math.max(1, Math.ceil((b.until - now()) / 1000))); },
    fail(key) { get(key).count += 1; }, clear(key) { buckets.delete(key); },
  };
}
export function createApiServer(store, { publicOrigin = process.env.LIYUN_PUBLIC_ORIGIN, production = process.env.NODE_ENV === 'production', now = Date.now } = {}) {
  const allowedOrigin = configureOrigin(publicOrigin, production);
  const throttle = loginThrottle(now);
  const server = createServer(async (req, res) => {
    try {
      const route = new URL(req.url ?? '/', 'http://localhost').pathname;
      const method = req.method ?? 'GET';
      if (method === 'GET' && route === '/api/health') return sendJson(res, 200, { ok: true });
      guardOrigin(req, allowedOrigin, method);
      if (method === 'POST' && route === '/api/auth/login') {
        const peerKey = 'peer:' + sha256(req.socket.remoteAddress ?? 'unknown');
        let accountKey;
        try {
          throttle.check(peerKey, 600);
          const body = await readJson(req, 8 * 1024);
          const nickname = cleanText(body.nickname, '昵称', 24);
          const studentId = cleanText(body.studentId, '学号 / 游戏 ID', 32);
          accountKey = 'account:' + sha256(studentId);
          // Recheck after async parsing, before the synchronous credential check.
          throttle.check(peerKey, 600); throttle.check(accountKey, 5);
          validatePassword(body.password);
          const user = store.upsertUser({ nickname, studentId, password: body.password });
          const token = store.createSession(user.id);
          throttle.clear(accountKey);
          return sendJson(res, 200, { token, user });
        } catch (error) {
          if ([400, 401, 413, 415, 423].includes(error.status)) { throttle.fail(peerKey); if (accountKey) throttle.fail(accountKey); }
          throw error;
        }
      }
      const session = store.resolveSession(bearer(req));
      if (!session) throw new HttpError(401, '未登录或登录已过期');
      if (method === 'POST' && route === '/api/auth/logout') { store.deleteSession(bearer(req)); return sendJson(res, 200, { ok: true }); }
      if (method === 'GET' && route === '/api/auth/me') return sendJson(res, 200, { user: session.user });
      if (method === 'GET' && route === '/api/progress') {
        const progress = store.getProgress(session.userId);
        return sendJson(res, 200, { state: progress ? progress.state : null, checkins: store.getCheckins(session.userId), updatedAt: progress ? progress.updatedAt : null });
      }
      if (method === 'PUT' && route === '/api/progress') {
        const body = await readJson(req, 256 * 1024);
        let updatedAt;
        try { updatedAt = store.saveProgress(session.userId, body.state); }
        catch (error) { if (error instanceof TypeError) throw new HttpError(400, 'state 必须是 version 1 或 2 的对象'); throw error; }
        return sendJson(res, 200, { updatedAt });
      }
      return sendJson(res, 404, { error: '接口不存在' });
    } catch (error) {
      if (error instanceof HttpError || error instanceof AccountError) return sendJson(res, error.status, { error: error.message }, error.retryAfter);
      console.error('[liyun-account] request failed'); // Never log bodies, tokens, credentials or DB contents.
      return sendJson(res, 500, { error: '服务内部错误' });
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxHeadersCount = 50;
  return server;
}
const isMain = (() => { try { return Boolean(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch { return false; } })();
if (isMain) {
  configureOrigin(process.env.LIYUN_PUBLIC_ORIGIN, process.env.NODE_ENV === 'production');
  const store = openStore({ dataDir: DATA_DIR });
  const server = createApiServer(store);
  server.listen(PORT, HOST, () => console.log('[liyun-account] listening on loopback port ' + PORT));
  const shutdown = () => { server.close(() => { store.close(); process.exit(0); }); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
