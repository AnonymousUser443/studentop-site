// The registrar is a separate loopback service. Never mount it on the public server.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, realpathSync, statSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ART_IDS, openStore, readDefaultPins, loadAdminToken, sha256 } from './store.mjs';
import { HttpError, fail, safeEqual, makeLimiter, readJson, validateStudentId } from './security.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPE = /^[A-Za-z][A-Za-z0-9_.-]{0,47}$/;
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const CONTENT_TYPES = new Set(['image/avif', 'image/webp', 'image/jpeg', 'image/png']);
const FILES = new Map([
  ['/', ['servers/admin/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['servers/admin/index.html', 'text/html; charset=utf-8']],
  ['/admin.css', ['servers/admin/admin.css', 'text/css; charset=utf-8']],
  ['/admin.mjs', ['servers/admin/admin.mjs', 'text/javascript; charset=utf-8']],
  ['/fonts/NotoSerifSC.woff2', ['apps/map/assets/fonts/NotoSerifSC.woff2', 'font/woff2']],
  ['/fonts/NotoSansSC.woff2', ['apps/map/assets/fonts/NotoSansSC.woff2', 'font/woff2']]
]);
const LEDGER = `SELECT 'event:'||e.user_id||':'||e.event_id AS id,'event' AS source,
  e.type,e.at,e.recorded_at AS recordedAt,e.user_id AS userId,u.name,u.student_id AS studentId,e.detail_json
  FROM events e JOIN users u ON u.id=e.user_id
  UNION ALL SELECT 'audit:'||a.id,'audit',a.type,a.at,a.at,a.user_id,u.name,u.student_id,a.detail_json
  FROM audit a LEFT JOIN users u ON u.id=a.user_id`;

function send(res, status, value, method = 'GET', extra = {}) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, ...extra });
  res.end(method === 'HEAD' ? undefined : body);
}
function loopback(address = '') {
  return address === '::1' || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(address) || /^::ffff:127\.(?:\d{1,3}\.){2}\d{1,3}$/i.test(address);
}
function perimeter(req) {
  if (!loopback(req.socket.remoteAddress)) fail(403, 'LOOPBACK_ONLY', '机关处暂仅允许本机回环访问。');
  const keys = Object.keys(req.headers);
  if (keys.some(key => key === 'forwarded' || key.startsWith('x-forwarded-') || ['cf-connecting-ip', 'cf-connecting-ipv6', 'cf-visitor', 'true-client-ip', 'x-real-ip', 'x-original-host', 'x-original-url', 'x-rewrite-url'].includes(key))) {
    fail(403, 'PROXY_FORBIDDEN', '机关处不接受代理或公网隧道入口。');
  }
  const host = req.headers.host;
  const count = req.rawHeaders?.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'host').length;
  if (typeof host !== 'string' || count !== 1) fail(403, 'HOST_FORBIDDEN', '请求主机不匹配。');
  const match = /^(localhost|127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/i.exec(host);
  if (!match || Number(match[2]) !== req.socket.localPort) fail(403, 'HOST_FORBIDDEN', '请求主机不匹配。');
  const expectedOrigin = `${req.socket.encrypted ? 'https' : 'http'}://${host}`;
  if (req.headers.origin !== undefined && req.headers.origin !== expectedOrigin) fail(403, 'ORIGIN_MISMATCH', '请求来源不匹配。');
  if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'ORIGIN_MISMATCH', '不允许跨站访问。');
}
function detailFrom(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const key of ['screen', 'artId', 'action', 'state', 'result', 'reason']) {
    if (typeof value[key] === 'string' && value[key].length <= 80 && !/[\u0000-\u001f]/.test(value[key])) result[key] = value[key];
  }
  // Only structured server facts; credentials, GPS, and arbitrary JSON never leave this boundary.
  for (const key of ['version', 'revoked', 'characters']) if (Number.isSafeInteger(value[key]) && value[key] >= 0) result[key] = value[key];
  return result;
}
function logFrom(row) {
  return { id: row.id, source: row.source, type: row.type, at: row.at, recordedAt: row.recordedAt,
    userId: row.userId, name: row.name, studentId: row.studentId, detail: detailFrom(row.detail_json) };
}
function paging(params) {
  const positive = (name, fallback, max) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^[1-9][0-9]{0,8}$/.test(raw) || Number(raw) > max) fail(400, 'INVALID_PAGE', '分页参数不正确。');
    return Number(raw);
  };
  const page = positive('page', 1, 1_000_000), pageSize = positive('pageSize', 30, 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}
function query(params, allowed) {
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) fail(400, 'INVALID_QUERY', '查询参数不正确。');
}
function search(params) {
  const q = (params.get('q') || '').trim().normalize('NFC');
  if (Array.from(q).length > 80 || /[\u0000-\u001f]/.test(q)) fail(400, 'INVALID_QUERY', '检索词最多 80 个字。');
  return q ? '%' + q.replace(/[\\%_]/g, '\\$&') + '%' : null;
}
function byteSize(file) {
  try { return statSync(file).size; } catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
}
function overlap(a, b) {
  if (process.platform === 'win32') { a = a.toLowerCase(); b = b.toLowerCase(); }
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}

export function createOfficeApp(options = {}) {
  const root = path.resolve(options.root || PROJECT_ROOT);
  const dataDir = path.resolve(options.dataDir || process.env.FROST_DATA_DIR || path.join(root, 'server-data'));
  const mounts = ['servers/admin', 'apps/map', 'apps/scene', 'assets/reference', 'tools/calibration'].map(dir => path.join(root, dir));
  if (mounts.some(dir => overlap(dataDir, dir))) throw new Error('Private data must be separate from static mounts');
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const actualDataDir = realpathSync(dataDir);
  if (mounts.some(dir => overlap(actualDataDir, realpathSync(dir)))) throw new Error('Private data cannot resolve into a static mount');
  const store = openStore({ dataDir, defaultPins: readDefaultPins(root), initialSealed: options.initialSealed ?? (process.env.NODE_ENV === 'production' && process.env.FROST_ALLOW_PIN_EDIT !== '1') });
  let token;
  try { token = loadAdminToken(dataDir, options.adminToken || process.env.FROST_ADMIN_TOKEN); }
  catch (error) { store.close(); throw error; }
  const started = process.hrtime.bigint();
  const logger = options.logger ?? (entry => console.log(JSON.stringify(entry)));
  const limit = makeLimiter();
  const limits = { api: 1000, auth: 20, mutation: 60, ...options.limits };
  let closed = false;
  const count = sql => Number(store.db.prepare(sql).get().n || 0);
  const readSnapshot = fn => {
    // WAL readers can share one consistent snapshot without reserving the writer lock.
    store.db.exec('BEGIN');
    try { const value = fn(); store.db.exec('COMMIT'); return value; }
    catch (error) { store.db.exec('ROLLBACK'); throw error; }
  };
  const storage = () => {
    const pragma = name => Object.values(store.db.prepare(`PRAGMA ${name}`).get())[0];
    const sums = store.db.prepare(`SELECT (SELECT coalesce(sum(length(bytes)),0) FROM checkins) AS photos,
      (SELECT coalesce(sum(length(bytes)),0) FROM postcards) AS postcards`).get();
    const sync = Number(pragma('synchronous'));
    return { databaseBytes: byteSize(path.join(dataDir, 'frost.sqlite')), walBytes: byteSize(path.join(dataDir, 'frost.sqlite-wal')),
      shmBytes: byteSize(path.join(dataDir, 'frost.sqlite-shm')), photoBytes: Number(sums.photos), postcardBytes: Number(sums.postcards),
      journalMode: String(pragma('journal_mode')).toUpperCase(), synchronous: ['OFF', 'NORMAL', 'FULL', 'EXTRA'][sync] || String(sync),
      pageCount: Number(pragma('page_count')), freePages: Number(pragma('freelist_count')) };
  };
  function requireAdmin(req) {
    const supplied = req.headers.authorization?.match(/^Bearer ([\x21-\x7e]{32,256})$/)?.[1];
    if (!supplied || !safeEqual(supplied, token)) {
      limit('auth', limits.auth, 60_000);
      fail(401, 'ADMIN_REQUIRED', '管理凭据不正确。');
    }
    limit('api', limits.api);
    if (!['GET', 'HEAD'].includes(req.method)) limit('mutation', limits.mutation);
  }
  function logs(params, profileId = null, maximum = null) {
    const clauses = [], args = [];
    const q = search(params);
    if (q) { clauses.push('(name LIKE ? ESCAPE \'\\\' OR studentId LIKE ? ESCAPE \'\\\' OR type LIKE ? ESCAPE \'\\\')'); args.push(q, q, q); }
    const userId = profileId || params.get('userId');
    if (userId) {
      if (!ID.test(userId)) fail(400, 'INVALID_USER_ID', '参与者编号不正确。');
      clauses.push('userId=?'); args.push(userId);
    }
    const type = params.get('type');
    if (type) { if (!TYPE.test(type)) fail(400, 'INVALID_TYPE', '活动类型不正确。'); clauses.push('type=?'); args.push(type); }
    const source = params.get('source');
    if (source) { if (!['event', 'audit'].includes(source)) fail(400, 'INVALID_SOURCE', '记录来源不正确。'); clauses.push('source=?'); args.push(source); }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const pagination = maximum ? { page: 1, pageSize: maximum, offset: 0 } : paging(params);
    const total = Number(store.db.prepare(`SELECT count(*) AS n FROM (${LEDGER})${where}`).get(...args).n);
    const items = store.db.prepare(`SELECT * FROM (${LEDGER})${where} ORDER BY recordedAt DESC,source DESC,id DESC LIMIT ? OFFSET ?`)
      .all(...args, pagination.pageSize, pagination.offset).map(logFrom);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }
  function overview() {
    const now = Date.now(), cutoff = new Date(now - 24 * 60 * 60_000).toISOString();
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 13);
    const days = Array.from({ length: 14 }, (_, i) => new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10));
    const dayCounts = (table, field) => new Map(store.db.prepare(`SELECT substr(${field},1,10) AS day,count(*) AS n FROM ${table} WHERE ${field}>=? AND ${field}<=? GROUP BY day`)
      .all(start.toISOString(), new Date(now).toISOString()).map(row => [row.day, Number(row.n)]));
    const eventDays = dayCounts('events', 'recorded_at'), checkinDays = dayCounts('checkins', 'created_at'), registrations = dayCounts('users', 'created_at');
    const arts = new Map(store.db.prepare('SELECT art_id,count(*) AS n FROM checkins GROUP BY art_id').all().map(row => [row.art_id, Number(row.n)]));
    return {
      generatedAt: new Date(now).toISOString(),
      totals: { users: count('SELECT count(*) AS n FROM users'), checkins: count('SELECT count(*) AS n FROM checkins'),
        postcards: count('SELECT count(*) AS n FROM postcards'), events: count('SELECT count(*) AS n FROM events'), audit: count('SELECT count(*) AS n FROM audit'),
        activeSessions: Number(store.db.prepare('SELECT count(*) AS n FROM sessions WHERE expires_at>?').get(now).n),
        activeUsers24h: Number(store.db.prepare(`SELECT count(*) AS n FROM (SELECT user_id FROM events WHERE recorded_at>=? UNION SELECT user_id FROM audit WHERE at>=? AND user_id IS NOT NULL UNION SELECT id FROM users WHERE created_at>=?)`).get(cutoff, cutoff, cutoff).n) },
      arts: ART_IDS.map(artId => ({ artId, count: arts.get(artId) || 0 })),
      daily: days.map(day => ({ day, events: eventDays.get(day) || 0, checkins: checkinDays.get(day) || 0, registrations: registrations.get(day) || 0 })),
      config: store.config(), recent: logs(new URLSearchParams(), null, 15).items, storage: storage(),
      runtime: { uptimeSeconds: Math.floor(Number(process.hrtime.bigint() - started) / 1e9), nodeVersion: process.version, officeVersion: '0.1.0', access: 'loopback-only', refreshSeconds: 5 }
    };
  }
  const userRow = id => store.db.prepare('SELECT id,name,student_id AS studentId,created_at AS createdAt,inscription FROM users WHERE id=?').get(id) || fail(404, 'USER_NOT_FOUND', '参与者档案不存在。');
  async function api(req, res, url) {
    requireAdmin(req);
    const { pathname, searchParams: params } = url, method = req.method;
    if (pathname === '/api/admin/overview' && method === 'GET') { query(params, []); return send(res, 200, readSnapshot(overview)); }
    if (pathname === '/api/admin/status' && method === 'GET') { query(params, []); return send(res, 200, store.config()); }
    if (pathname === '/api/admin/storage' && method === 'GET') {
      query(params, []);
      const integrityCheck = store.db.prepare('PRAGMA quick_check').all().map(row => String(Object.values(row)[0]));
      return send(res, 200, { ...storage(), integrityCheck, checkedAt: new Date().toISOString() });
    }
    if (pathname === '/api/admin/users' && method === 'GET') {
      query(params, ['q', 'page', 'pageSize']);
      const { page, pageSize, offset } = paging(params), q = search(params);
      const clause = q ? ' WHERE (u.name LIKE ? ESCAPE \'\\\' OR u.student_id LIKE ? ESCAPE \'\\\')' : '', args = q ? [q, q] : [];
      const total = Number(store.db.prepare(`SELECT count(*) AS n FROM users u${clause}`).get(...args).n);
      const items = store.db.prepare(`SELECT u.id,u.name,u.student_id AS studentId,u.created_at AS createdAt,
        (SELECT count(*) FROM checkins c WHERE c.user_id=u.id) AS checkinCount,
        EXISTS(SELECT 1 FROM postcards p WHERE p.user_id=u.id) AS postcard,
        (SELECT count(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>?) AS sessionCount,
        max(u.created_at,coalesce((SELECT max(e.recorded_at) FROM events e WHERE e.user_id=u.id),u.created_at),
          coalesce((SELECT max(a.at) FROM audit a WHERE a.user_id=u.id),u.created_at)) AS lastActivity
        FROM users u${clause} ORDER BY lastActivity DESC,u.id LIMIT ? OFFSET ?`).all(Date.now(), ...args, pageSize, offset)
        .map(row => ({ ...row, postcard: Boolean(row.postcard) }));
      return send(res, 200, { items, total, page, pageSize });
    }
    if (pathname === '/api/admin/logs' && method === 'GET') {
      query(params, ['q', 'userId', 'type', 'source', 'page', 'pageSize']);
      return send(res, 200, logs(params));
    }
    const profile = /^\/api\/admin\/users\/([A-Za-z0-9_-]{1,100})$/.exec(pathname);
    if (profile && method === 'GET') {
      query(params, []); const user = userRow(profile[1]);
      const checkins = store.db.prepare('SELECT art_id AS artId,photo_id AS photoId,mime,length(bytes) AS bytes,captured_at AS capturedAt,created_at AS createdAt FROM checkins WHERE user_id=? ORDER BY created_at,art_id').all(user.id);
      const postcard = store.db.prepare('SELECT id,mime,length(bytes) AS bytes,created_at AS createdAt FROM postcards WHERE user_id=?').get(user.id) || null;
      const sessionCount = Number(store.db.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=? AND expires_at>?').get(user.id, Date.now()).n);
      return send(res, 200, { user, checkins, postcard, sessionCount, events: logs(new URLSearchParams(), user.id, 50).items });
    }
    const media = /^\/api\/admin\/media\/(photos|postcards)\/([A-Za-z0-9_-]{1,100})$/.exec(pathname);
    if (media && ['GET', 'HEAD'].includes(method)) {
      query(params, []);
      const row = media[1] === 'photos'
        ? store.db.prepare('SELECT mime,bytes FROM checkins WHERE photo_id=?').get(media[2])
        : store.db.prepare('SELECT mime,bytes FROM postcards WHERE id=?').get(media[2]);
      if (!row || !CONTENT_TYPES.has(row.mime)) fail(404, 'NOT_FOUND', '影像不存在。');
      res.writeHead(200, { 'Content-Type': row.mime, 'Content-Length': row.bytes.length, 'Content-Disposition': 'inline' });
      return res.end(method === 'HEAD' ? undefined : Buffer.from(row.bytes));
    }
    if (pathname === '/api/admin/seal' && method === 'POST') {
      query(params, []); const body = await readJson(req);
      const config = store.transaction(() => {
        const current = store.config();
        if (!Number.isInteger(body.baseVersion) || body.baseVersion !== current.version) fail(409, 'CONFIG_CONFLICT', '点位版本已变更，请刷新后再封箱。');
        if (!current.sealed) {
          store.db.prepare('UPDATE config SET sealed=1,version=version+1 WHERE id=1').run();
          store.audit(null, 'admin.seal', { version: current.version + 1 });
        }
        return store.config();
      });
      return send(res, 200, config);
    }
    if (pathname === '/api/admin/reset' && method === 'POST') {
      query(params, []); const body = await readJson(req), studentId = validateStudentId(body.studentId);
      const user = store.db.prepare('SELECT id FROM users WHERE student_id=?').get(studentId);
      if (!user) fail(404, 'USER_NOT_FOUND', '这个学号尚未登记。');
      const resetToken = randomBytes(24).toString('base64url'), expires = Date.now() + 30 * 60_000;
      store.transaction(() => {
        store.db.prepare('UPDATE users SET reset_hash=?,reset_expires=? WHERE id=?').run(sha256(resetToken), expires, user.id);
        store.audit(user.id, 'admin.reset.issue');
      });
      return send(res, 200, { studentId, resetToken, expiresAt: new Date(expires).toISOString() });
    }
    const revoke = /^\/api\/admin\/users\/([A-Za-z0-9_-]{1,100})\/revoke-sessions$/.exec(pathname);
    if (revoke && method === 'POST') {
      query(params, []); await readJson(req); const user = userRow(revoke[1]);
      const revoked = store.transaction(() => {
        const result = store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        const changed = Number(result.changes); store.audit(user.id, 'admin.sessions.revoke', { revoked: changed }); return changed;
      });
      return send(res, 200, { ok: true, revoked });
    }
    const inscription = /^\/api\/admin\/users\/([A-Za-z0-9_-]{1,100})\/inscription$/.exec(pathname);
    if (inscription && method === 'PUT') {
      query(params, []); const body = await readJson(req), user = userRow(inscription[1]);
      if (typeof body.text !== 'string' || Array.from(body.text).length > 60 || /[\u0000-\u001f]/.test(body.text)) fail(400, 'INVALID_INSCRIPTION', '落款最多 60 个字。');
      const text = body.text.trim().normalize('NFC');
      store.transaction(() => { store.db.prepare('UPDATE users SET inscription=? WHERE id=?').run(text, user.id); store.audit(user.id, 'admin.inscription.save', { characters: Array.from(text).length }); });
      return send(res, 200, { text });
    }
    fail(404, 'NOT_FOUND', '机关处接口不存在。');
  }
  async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'");
    try {
      perimeter(req);
      const rawPath = (req.url || '/').split('?')[0];
      let decoded;
      try { decoded = decodeURIComponent(rawPath); } catch { fail(404, 'NOT_FOUND', '页面不存在。'); }
      if (!rawPath.startsWith('/') || rawPath.startsWith('//') || /[\\\u0000]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) fail(404, 'NOT_FOUND', '页面不存在。');
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'METHOD_NOT_ALLOWED', '不支持此请求方法。');
      if (url.search) fail(404, 'NOT_FOUND', '页面不存在。');
      const entry = FILES.get(url.pathname);
      if (!entry) fail(404, 'NOT_FOUND', '页面不存在。');
      const file = path.resolve(root, entry[0]);
      let body;
      try {
        const actual = realpathSync(file), allowed = realpathSync(path.dirname(file));
        if (!actual.startsWith(allowed + path.sep) || !statSync(actual).isFile()) fail(404, 'NOT_FOUND', '页面不存在。');
        body = readFileSync(actual);
      } catch (error) { if (error instanceof HttpError) throw error; fail(404, 'NOT_FOUND', '页面不存在。'); }
      res.writeHead(200, { 'Content-Type': entry[1], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      req.resume();
      if (res.headersSent) return res.end();
      const status = error instanceof HttpError ? error.status : 500;
      // No identities, paths, query strings, request bodies, headers, tokens, or GPS in console logs.
      if (status === 500) logger({ at: new Date().toISOString(), type: 'office.error', code: 'INTERNAL_ERROR' });
      send(res, status, { error: { code: error instanceof HttpError ? error.code : 'INTERNAL_ERROR', message: error instanceof HttpError ? error.message : '机关处暂未能完成请求，请稍后重试。' } }, req.method,
        error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
    }
  }
  handler.store = store;
  handler.dataDir = dataDir;
  handler.close = () => { if (!closed) { closed = true; store.close(); token = null; } };
  return handler;
}

export function createOfficeServer(options = {}) {
  const app = createOfficeApp(options);
  const server = http.createServer({ requestTimeout: 30_000, headersTimeout: 15_000, maxHeaderSize: 16_384 }, app);
  server.app = app;
  server.on('close', app.close);
  return server;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.FROST_OFFICE_PORT || 4196);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FROST_OFFICE_PORT must be an integer between 1 and 65535');
  const server = createOfficeServer({ root: process.env.FROST_RELEASE_ROOT || undefined });
  server.listen(port, '127.0.0.1', () => {
    console.log(`户部机关处 · 总览／秋事总簿  http://127.0.0.1:${server.address().port}/`);
    console.log('仅本机回环访问；管理凭据沿用私人数据目录 admin-token.txt，不在链接与日志中显示。');
  });
  server.on('error', error => { console.error('Office service could not start: ' + (error.code || 'START_FAILED')); server.app.close(); process.exitCode = 1; });
  const stop = () => { server.close(); server.closeIdleConnections(); const timer = setTimeout(() => server.closeAllConnections(), 5000); timer.unref(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
