import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openShowCatalog, publicShow } from './show-catalog.mjs';
import { createShowRuntime, endedReply } from './show-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deck = JSON.parse(await readFile(process.env.PRESENTATION_DECK_FILE || path.join(root, 'src/content/deck.json'), 'utf8'));
const pin = process.env.PRESENTATION_PIN || String(randomInt(100000, 1000000));
const publicOrigin = process.env.PRESENTATION_PUBLIC_ORIGIN;
if (publicOrigin && !process.env.PRESENTATION_PIN) throw new Error('PRESENTATION_PIN is required for public hosting');
const base = process.env.PRESENTATION_BASE || '/';
if (!/^\/(?:[a-z0-9-]+\/)*$/.test(base)) throw new Error('Invalid PRESENTATION_BASE');
const controlTtlMs = Math.max(100, Number(process.env.PRESENTATION_CONTROL_TTL_MS) || 12 * 60 * 60 * 1000);
const port = Number(process.env.PORT || 8787);
const dataDir = process.env.PRESENTATION_DATA_DIR || path.join(root, 'server/data');
const catalog = await openShowCatalog(dataDir);

const host = express();
host.disable('x-powered-by');
if (publicOrigin) host.set('trust proxy', 'loopback');
const app = express.Router();
host.use(base, app);
const http = createServer(host);
const sameOrigin = req => !publicOrigin || !req.headers.origin || req.headers.origin === publicOrigin;
const io = new Server(http, {
  path: base + 'socket.io', maxHttpBufferSize: 8192, pingTimeout: 15000, serveClient: false,
  allowRequest: (req, done) => done(null, sameOrigin(req)),
});

const hostCookie = 'zhuiguang_host';
const hosts = new Map();
const runtimeJobs = new Map();
const runtimes = new Map();
const rateBuckets = new Map();
const codePattern = /^[0-9]{6}$/;
const missingShow = { ok: false, code: 'SHOW_NOT_FOUND', error: '没有找到该场次，请核对六位场次号。' };
const hostRequired = { ok: false, code: 'HOST_AUTH_REQUIRED', error: '请先验证演讲者口令。' };

function hostAuth(header = '') {
  const key = header.split(/;\s*/).find(value => value.startsWith(hostCookie + '='))?.slice(hostCookie.length + 1);
  const session = hosts.get(key);
  return session?.expiresAt > Date.now() ? session : null;
}
function allowRate(key, max, interval) {
  const now = Date.now();
  const times = (rateBuckets.get(key) || []).filter(at => at > now - interval);
  if (times.length >= max) return false;
  times.push(now);
  rateBuckets.set(key, times);
  return true;
}
function runtimeFor(row, namespace) {
  if (!runtimeJobs.has(row.id)) {
    const show = publicShow(row);
    const job = createShowRuntime({ show, dataDir: catalog.dataPath(row), deck, pin, publicOrigin, controlTtlMs,
      io: namespace || namespaceFor(row.id), hostAuth, hostRate: allowRate,
    }).then(runtime => { runtimes.set(row.id, runtime); return runtime; })
      .catch(error => { runtimeJobs.delete(row.id); throw error; });
    runtimeJobs.set(row.id, job);
  }
  return runtimeJobs.get(row.id);
}

const namespaces = new Map();
function namespaceFor(id) {
  if (namespaces.has(id)) return namespaces.get(id);
  const namespace = io.of('/show-' + id);
  namespaces.set(id, namespace);
  namespace.use(async (socket, next) => {
    try {
      const row = catalog.get(id);
      if (!row) return next(Object.assign(new Error(missingShow.error), { data: missingShow }));
      socket.data.runtime = await runtimeFor(row, namespace);
      next();
    } catch { next(new Error('暂时无法打开场次。')); }
  });
  namespace.on('connection', socket => socket.data.runtime.attach(socket));
  return namespace;
}
for (const show of catalog.list()) namespaceFor(show.id);


app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const json = express.json({ limit: '1kb' });
function onlyHost(req, res, next) {
  if (!sameOrigin(req)) return res.sendStatus(403);
  if (!hostAuth(req.headers.cookie)) return res.status(401).json(hostRequired);
  next();
}
function withShow(req, res, next) {
  const code = req.params.code;
  const row = codePattern.test(code) ? catalog.get(code) : null;
  if (!row) return res.status(404).json(missingShow);
  req.showRow = row;
  next();
}
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
app.get('/api/health', (_req, res) => {
  const ok = [...runtimes.values()].every(runtime => runtime.healthy());
  res.json({ ok, pages: deck.length, mode: 'rooms', persistence: { ok, database: ok } });
});
app.get('/api/host', (req, res) => res.json({ ok: true, authorized: Boolean(hostAuth(req.headers.cookie)) }));
app.post('/api/host', json, (req, res) => {
  if (!sameOrigin(req)) return res.sendStatus(403);
  if (!allowRate('auth:' + req.ip, 10, 60000)) return res.status(429).json({ ok: false, error: '尝试过于频繁，请稍后再试。' });
  const requested = req.body?.pin;
  if (typeof requested !== 'string' || requested.length < 1 || requested.length > 128) return res.status(400).json(hostRequired);
  const actual = Buffer.from(requested), expected = Buffer.from(pin);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(401).json({ ...hostRequired, error: '演讲口令不正确。' });
  }
  const key = randomBytes(24).toString('hex');
  hosts.set(key, { expiresAt: Date.now() + controlTtlMs });
  res.cookie(hostCookie, key, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: controlTtlMs, path: base });
  res.json({ ok: true });
});
app.get('/api/rooms', onlyHost, (_req, res) => res.json({ ok: true, shows: catalog.list() }));
app.post('/api/rooms', onlyHost, json, (req, res) => {
  const raw = typeof req.body?.name === 'string' ? req.body.name.normalize('NFKC').trim().replace(/[\u0000-\u001f\u007f]/g, '') : '';
  const name = Array.from(raw).slice(0, 60).join('');
  if (!name) return res.status(400).json({ ok: false, error: '请输入场次名称。' });
  const row = catalog.create(name);
  namespaceFor(row.id);
  res.status(201).json({ ok: true, show: publicShow(row) });
});
app.get('/api/rooms/:code', withShow, (req, res) => res.json({ ok: true, show: publicShow(req.showRow) }));
app.get('/api/rooms/:code/state', withShow, asyncRoute(async (req, res) => res.json((await runtimeFor(req.showRow)).publicState())));
app.get('/api/rooms/:code/archive', onlyHost, withShow, asyncRoute(async (req, res) => {
  const runtime = await runtimeFor(req.showRow);
  res.json({ ok: true, show: publicShow(catalog.get(req.showRow.id)), ...runtime.archive() });
}));
app.post('/api/rooms/:code/end', onlyHost, withShow, json, asyncRoute(async (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ ok: false, error: '请二次确认结束本场。' });
  const runtime = await runtimeFor(req.showRow);
  if (runtime.revealInProgress()) return res.status(409).json({ ok: false, error: '抽奖正在揭晓，请稍候。' });
  const previous = catalog.get(req.showRow.id);
  const show = publicShow(previous.endedAt ? previous : catalog.end(previous.id));
  if (!previous.endedAt && !await runtime.end(show)) return res.status(503).json({ ok: false, show, error: '本场已关闭，最后一帧状态未能保存。' });
  res.json({ ok: true, show });
}));
app.post('/api/rooms/:code/entry', withShow, json, asyncRoute(async (req, res) => {
  if (!sameOrigin(req)) return res.sendStatus(403);
  const id = req.showRow.id;
  if (!allowRate('entry:' + id + ':' + req.ip, 650, 60000)) return res.status(429).json({ ok: false, error: '入场请求过于频繁，请稍后再试。' });
  if (req.showRow.endedAt) return res.status(410).json(endedReply);
  const { admissions } = await runtimeFor(req.showRow);
  if (catalog.get(id).endedAt) return res.status(410).json(endedReply);
  const result = await admissions.admit(req.body);
  if (catalog.get(id).endedAt) return res.status(410).json(endedReply);
  if (!result.token) return res.status(result.status).json({ ok: false, error: result.error });
  // Each code has its own cookie name and signing key. Both admission and socket traffic are scoped to this app.
  res.cookie(admissions.cookie, result.token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: admissions.maxAge, path: base });
  res.json({ ok: true });
}));
app.get('/api/deck', (_req, res) => res.json({ initialPageId: 'P0-02', pages: deck.map(({ id, chapter, type, layer, dur, title, content, interaction }) => ({ id, chapter, type, layer, dur, title, content, ...(interaction ? { interaction } : {}) })) }));
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: '接口不存在。' }));
app.use('/api', (error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return res.status(error.status || 400).json({ ok: false, error: '请求格式不正确。' });
  console.error('[show-api]', error.code || error.name);
  res.status(503).json({ ok: false, error: '场次服务暂时无法保存或读取数据。' });
});
const dist = process.env.PRESENTATION_DIST ? path.resolve(process.env.PRESENTATION_DIST) : path.join(root, 'dist');
if (existsSync(dist)) {

  const manifestFile = path.join(dist, 'assets/manifest.json');
  const manifestText = await readFile(manifestFile, 'utf8');
  let releaseHash = 2166136261;
  for (let i = 0; i < manifestText.length; i++) releaseHash = Math.imul(releaseHash ^ manifestText.charCodeAt(i), 16777619);
  app.use((_req, res, next) => { res.setHeader('X-Presentation-Release', (releaseHash >>> 0).toString(16)); next(); });
  app.use(express.static(dist, { maxAge: 0, setHeaders(res, file) {
    res.setHeader('Cache-Control', 'no-cache');
    if (file.endsWith('.opus')) res.type('audio/ogg');
  } }));
  app.use('/assets', (_req, res) => res.status(404).type('text/plain').send('Asset not found'));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const maintenanceTimer = setInterval(() => {
  const now = Date.now();
  for (const runtime of runtimes.values()) runtime.maintenance();
  for (const [key, session] of hosts) if (session.expiresAt <= now) hosts.delete(key);
  for (const [key, times] of rateBuckets) if (!times.some(at => at > now - 60000)) rateBuckets.delete(key);
}, 1000);
maintenanceTimer.unref();
http.listen(port, process.env.PRESENTATION_HOST || '0.0.0.0', () => {
  console.log('追光者 · 场次服务 http://localhost:' + port + base);
  if (!publicOrigin && !process.env.PRESENTATION_PIN) console.log('本地演讲口令：' + pin);
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(maintenanceTimer);
  await new Promise(resolve => io.close(resolve));
  await Promise.all([...runtimeJobs.values()].map(job => job.then(runtime => runtime.close()).catch(() => {})));
  catalog.close();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
