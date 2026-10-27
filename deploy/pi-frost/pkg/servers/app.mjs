import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, realpath, stat } from 'node:fs/promises';
import { mkdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ART_IDS, openStore, readDefaultPins, sha256 } from './store.mjs';
import {createStaticEncoder} from './static-encoding.mjs';
import {createRequestPolicy,productionAssets,createStorageGuard,positiveSetting} from './request-policy.mjs';
import {createPostcardDownloads} from './postcard-downloads.mjs';
import {
  HttpError, fail, newId, publicUser, validateWords, validateStudentId, validateName,
  derivePassphrase, checkPassphrase, safeEqual, createSession, clearCookie, sessionToken,
  getUser, makeLimiter, readBody, readJson, validateOperationId, validIso, validateImage
} from './security.mjs';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let activeUploads=0,reservedMediaBytes=0;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg'
};

function json(res, status, value, headers = {}) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function binary(res, req, row) {
  res.writeHead(200, { 'Content-Type': row.mime, 'Content-Length': row.byteLength??row.bytes.length, 'Cache-Control': 'no-store', 'Content-Disposition': 'inline', 'Cross-Origin-Resource-Policy': 'same-origin' });
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(row.bytes));
}
function fingerprint(...parts) {
  const hash = createHash('sha256');
  for (const part of parts) { const bytes = Buffer.isBuffer(part) ? part : Buffer.from(String(part)); hash.update(String(bytes.length) + ':'); hash.update(bytes); }
  return hash.digest('hex');
}
function cleanDetail(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const key of ['screen', 'artId', 'action', 'state', 'result', 'reason']) {
    if (typeof value[key] === 'string' && value[key].length <= 80 && !/[\u0000-\u001f]/.test(value[key])) result[key] = value[key];
  }
  return result;
}

export function createApp(options = {}) {
  const root = path.resolve(options.root || PROJECT_ROOT);
  const dataDir = path.resolve(options.dataDir || process.env.FROST_DATA_DIR || path.join(root, 'server-data'));
  const publicOrigin = options.publicOrigin || process.env.FROST_PUBLIC_ORIGIN || null;
  if (publicOrigin) {
    let parsed;
    try { parsed = new URL(publicOrigin); } catch { throw new Error('FROST_PUBLIC_ORIGIN must be a valid HTTP or HTTPS origin'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== publicOrigin) throw new Error('FROST_PUBLIC_ORIGIN must be an exact HTTP or HTTPS origin without a trailing slash');
  }
  const production=options.production??process.env.NODE_ENV==='production';
  const productionStatic=options.productionStatic??production;
  const approvedAssets=productionStatic?productionAssets(root):null;
  const trustProxy=options.trustProxy??process.env.FROST_TRUST_PROXY==='1';
  const requestPolicy=createRequestPolicy({trustProxy,trustedProxies:options.trustedProxies??process.env.FROST_TRUSTED_PROXIES,publicOrigin,proxyClientHeader:options.proxyClientHeader??process.env.FROST_PROXY_CLIENT_HEADER??'x-forwarded-for'});
  const bodyPolicy={idleMs:positiveSetting(options.bodyIdleMs??process.env.FROST_BODY_IDLE_MS,20_000,'FROST_BODY_IDLE_MS'),maxBytes:positiveSetting(options.maxBodyBytes??process.env.FROST_MAX_BODY_BYTES,24*1024*1024,'FROST_MAX_BODY_BYTES'),maxReaders:positiveSetting(options.maxBodyReaders??process.env.FROST_MAX_BODY_READERS,64,'FROST_MAX_BODY_READERS')};
  const maximumUploads=positiveSetting(options.maxUploads??process.env.FROST_MAX_UPLOADS,4,'FROST_MAX_UPLOADS');
  const minFreeBytes=positiveSetting(options.minFreeBytes??process.env.FROST_MIN_FREE_BYTES,268435456,'FROST_MIN_FREE_BYTES');
  const maxDbBytes=positiveSetting(options.maxDbBytes??process.env.FROST_MAX_DB_BYTES,8589934592,'FROST_MAX_DB_BYTES');
  const maxMediaBytes=positiveSetting(options.maxMediaBytes??process.env.FROST_MAX_MEDIA_BYTES,64*1024*1024,'FROST_MAX_MEDIA_BYTES');
  const limits = { api:positiveSetting(process.env.FROST_API_IP_LIMIT,24000,'FROST_API_IP_LIMIT'), auth:20,authIp:positiveSetting(process.env.FROST_AUTH_IP_LIMIT,1200,'FROST_AUTH_IP_LIMIT'),upload:40,events:90,write:60,static:positiveSetting(process.env.FROST_STATIC_IP_LIMIT,60000,'FROST_STATIC_IP_LIMIT'),...options.limits };
  const publicDirs = ['apps/map', 'apps/scene', 'tools/calibration', 'servers/admin', 'assets/reference'].map(dir => path.join(root, dir));
  const overlaps = (left, right) => {
    const a = process.platform === 'win32' ? left.toLowerCase() : left;
    const b = process.platform === 'win32' ? right.toLowerCase() : right;
    return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
  };
  if (publicDirs.some(dir => overlaps(dataDir, dir))) throw new Error('FROST_DATA_DIR must be separate from all public static mounts');
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const actualDataDir = realpathSync(dataDir);
  if (publicDirs.some(dir => overlaps(actualDataDir, realpathSync(dir)))) throw new Error('FROST_DATA_DIR cannot resolve into a public static mount');
  const defaults = readDefaultPins(root);
  const store = openStore({ dataDir, defaultPins: defaults,initialSealed:options.initialSealed??(production&&process.env.FROST_ALLOW_PIN_EDIT!=='1') });
  const secureCookie = options.secureCookie ?? (process.env.FROST_SECURE_COOKIE === '1' || production);
  const storageGuard=createStorageGuard({dataDir,minFreeBytes,maxDbBytes});
  const postcardDownloads=createPostcardDownloads({dataDir,storageGuard,...options.postcardDownloads,isSessionValid:(owner,tokenHash)=>!!store.db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?').get(tokenHash,owner,Date.now())});
  const logger = options.logger ?? (entry => console.log(JSON.stringify(entry)));
  const limit = makeLimiter();
  const mounts = [
    { exact: '/scene/frost-frame-ref_Waifu2x_3x.png', dir: path.join(root, 'assets/reference'), file: 'frost-frame-ref_Waifu2x_3x.png' },
    { prefix: '/scene/', dir: path.join(root, 'apps/scene') },
    { prefix: '/calibration/', dir: path.join(root, 'tools/calibration'), index: 'map-calibration.html' },
    { prefix: '/geo/', dir: path.join(root, 'tools/calibration/out'), noIndex: true },
    { prefix: '/', dir: path.join(root, 'apps/map') }
  ];
  let closed = false;
  const staticEncoder=createStaticEncoder();
  const userFor = req => getUser(req, store) || fail(401, 'AUTH_REQUIRED', '请先登录。');
  const requireExpected = (req, user) => {
    if (req.headers['x-expected-user-id'] !== user.id) fail(409, 'account_mismatch', '账号已在其他页面切换，请刷新后继续。');
  };
  function requireCurrent(req,user){const fresh=getUser(req,store);if(!fresh||fresh.id!==user.id)fail(401,'AUTH_REQUIRED','登录已失效，资料仍保留在本机，请重新登录后同步。');return fresh;}
  function requirePinEditor(user){if(user.student_id!=='<管理员学号-已脱敏>')fail(403,'PIN_EDIT_FORBIDDEN','此账号不能调整点位。');}
  function reserveMedia(res,byteLength){
    const reservation=Number(byteLength)*2;
    if(!Number.isSafeInteger(reservation)||reservation<0||reservedMediaBytes+reservation>maxMediaBytes){const error=new HttpError(503,'MEDIA_BUSY','正在读取其他影像，请稍后重试。');error.retryAfter=3;throw error;}
    reservedMediaBytes+=reservation;
    let released=false;
    const release=()=>{if(released)return;released=true;reservedMediaBytes-=reservation;res.removeListener('finish',release);res.removeListener('close',release);res.removeListener('error',release);};
    res.once('finish',release);res.once('close',release);res.once('error',release);
    return release;
  }
  async function receiveImage(req,consume=bytes=>bytes){
    if(activeUploads>=maximumUploads){const error=new HttpError(503,'UPLOAD_BUSY','正在接收其他照片，请稍后重试。');error.retryAfter=3;throw error;}
    activeUploads++;
    try{storageGuard(5*1024*1024);return await consume(await readBody(req,5*1024*1024));}finally{activeUploads--;}
  }
  function operate(user, operationId, contentHash, operation,additionalBytes=0) {
    return store.transaction(() => {
      const existing = store.db.prepare('SELECT * FROM operations WHERE user_id=? AND operation_id=?').get(user.id, operationId);
      if (existing) {
        if (existing.fingerprint !== contentHash) fail(409, 'OPERATION_CONFLICT', '相同操作编号不能提交不同内容。');
        return JSON.parse(existing.response_json);
      }
      storageGuard(additionalBytes);
      const response = operation();
      store.db.prepare('INSERT INTO operations(user_id,operation_id,fingerprint,response_json,created_at) VALUES(?,?,?,?,?)').run(user.id, operationId, contentHash, JSON.stringify(response), new Date().toISOString());
      return response;
    });
  }
  const checkinFrom = row => ({ artId: row.art_id, photoId: row.photo_id, photoUrl: '/api/photos/' + row.photo_id, capturedAt: row.captured_at, createdAt: row.created_at, operationId: row.operation_id });
  const postcardFrom = row => ({ url: '/api/postcards/' + row.id, createdAt: row.created_at, operationId: row.operation_id });

  async function api(req, res, pathname) {
    const method = req.method;
    const address = req.frostRequestPolicy.address;
    const logout=pathname==='/api/auth/logout'&&method==='POST';
    if(!logout)limit('api:' + address, limits.api);
    if (!['GET', 'HEAD'].includes(method)) {
      if (req.headers.origin && req.headers.origin !== req.frostRequestPolicy.origin) fail(403, 'ORIGIN_MISMATCH', '请求来源不匹配。');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'ORIGIN_MISMATCH', '不允许跨站提交。');
    }
    if (pathname === '/api/health' && method === 'GET') return json(res, 200, { ok: true, version: '4.0.0' });
    if (pathname === '/api/config' && method === 'GET') return json(res, 200, store.config());
    if (pathname === '/api/config/pins' && method === 'PUT') {
      const user = userFor(req);
      requirePinEditor(user);requireExpected(req,user);
      limit('write:'+user.id,limits.write);
      const body = await readJson(req);
      requirePinEditor(requireCurrent(req,user));requireExpected(req,user);
      const response = store.transaction(() => {
        const config = store.config();
        if (config.sealed) fail(403, 'CONFIG_SEALED', '点位已封箱，无法修改。');
        if (!Number.isInteger(body.baseVersion) || body.baseVersion !== config.version) fail(409, 'CONFIG_CONFLICT', '点位已被其他测试者更新，请刷新后再保存。');
        if (!Array.isArray(body.pins) || body.pins.length !== defaults.length) fail(400, 'INVALID_PINS', '需一次提交全部八个点位。');
        const byId = new Map();
        for (const pin of body.pins) {
          if (!pin || !defaults.some(item => item.id === pin.id) || byId.has(pin.id) || typeof pin.x !== 'number' || typeof pin.y !== 'number' || !Number.isFinite(pin.x) || !Number.isFinite(pin.y) || pin.x < 0 || pin.x > 846 || pin.y < 0 || pin.y > 1074) fail(400, 'INVALID_PINS', '点位编号或坐标不正确。');
          byId.set(pin.id, { id: pin.id, x: Math.round(pin.x * 1000) / 1000, y: Math.round(pin.y * 1000) / 1000 });
        }
        const pins = defaults.map(pin => byId.get(pin.id));
        storageGuard();
        store.db.prepare('UPDATE config SET version=version+1,pins_json=? WHERE id=1').run(JSON.stringify(pins));
        store.audit(user.id, 'config.pins.save', { version: config.version + 1 });
        return store.config();
      });
      return json(res, 200, response);
    }
    if (pathname.startsWith('/api/auth/') && method === 'POST') {
      if(!logout)limit('auth:' + address, limits.authIp, 600_000);
      const body = await readJson(req);
      if (pathname === '/api/auth/logout') {
        const token = sessionToken(req);
        const user = getUser(req, store);
        if (token) store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token));
        if (user) store.audit(user.id, 'auth.logout');
        return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(secureCookie) });
      }
      if (!['/api/auth/register', '/api/auth/login', '/api/auth/reset'].includes(pathname)) fail(404, 'NOT_FOUND', '接口不存在。');
      const studentId = validateStudentId(body.studentId);
      validateWords(body.passphrase);
      limit('student:' + sha256(studentId), limits.auth, 600_000);
      let user = store.db.prepare('SELECT * FROM users WHERE student_id=?').get(studentId);
      if (pathname === '/api/auth/register') {
        const name = validateName(body.name);
        storageGuard();
        const derived = await derivePassphrase(body.passphrase);
        if (user) fail(409, 'STUDENT_EXISTS', '这个学号已经登记，请登录或联系管理员重置词牌。');
        const id = newId();
        try {
          store.transaction(() => {
            storageGuard();
            store.db.prepare('INSERT INTO users(id,name,student_id,pass_salt,pass_hash,created_at) VALUES(?,?,?,?,?,?)').run(id, name, studentId, derived.salt, derived.hash, new Date().toISOString());
            store.audit(id, 'auth.register');
          });
        } catch (error) { if (String(error.message).includes('UNIQUE')) fail(409, 'STUDENT_EXISTS', '这个学号已经登记，请登录。'); throw error; }
        user = store.db.prepare('SELECT * FROM users WHERE id=?').get(id);
      } else if (pathname === '/api/auth/login') {
        if (!(await checkPassphrase(body.passphrase, user)) || !user) fail(401, 'LOGIN_FAILED', '学号或词牌顺序不正确。');
        if (store.db.prepare('SELECT pass_hash FROM users WHERE id=?').get(user.id)?.pass_hash !== user.pass_hash) fail(401, 'LOGIN_FAILED', '词牌已更新，请重新登录。');
        storageGuard();
        store.audit(user.id, 'auth.login');
      } else {
        if (!user || typeof body.resetToken !== 'string' || !user.reset_hash || user.reset_expires <= Date.now() || !safeEqual(sha256(body.resetToken), user.reset_hash)) fail(401, 'RESET_FAILED', '重置凭据无效或已过期。');
        const resetHash = user.reset_hash;
        const derived = await derivePassphrase(body.passphrase);
        store.transaction(() => {
          const fresh = store.db.prepare('SELECT reset_hash,reset_expires FROM users WHERE id=?').get(user.id);
          if (fresh.reset_hash !== resetHash || fresh.reset_expires <= Date.now()) fail(401, 'RESET_FAILED', '重置凭据已使用或已过期。');
          storageGuard();
          store.db.prepare('UPDATE users SET pass_salt=?,pass_hash=?,reset_hash=NULL,reset_expires=NULL WHERE id=?').run(derived.salt, derived.hash, user.id);
          store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
          store.audit(user.id, 'auth.reset');
        });
      }
      storageGuard();
      return json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': createSession(store, user.id, secureCookie) });
    }
    if (pathname === '/api/me' && method === 'GET') {
      const user = userFor(req);
      const checkins = store.db.prepare('SELECT art_id,photo_id,captured_at,created_at,operation_id FROM checkins WHERE user_id=? ORDER BY created_at,art_id').all(user.id).map(checkinFrom);
      const postcard = store.db.prepare('SELECT id,created_at,operation_id FROM postcards WHERE user_id=?').get(user.id);
      return json(res, 200, { user: publicUser(user), checkins, inscription: user.inscription, postcard: postcard ? postcardFrom(postcard) : null });
    }
    const photoMatch = pathname.match(/^\/api\/photos\/([A-Za-z0-9_-]+)$/);
    const postcardMatch = pathname.match(/^\/api\/postcards\/([A-Za-z0-9_-]+)$/);
    if ((photoMatch || postcardMatch) && ['GET', 'HEAD'].includes(method)) {
      const user = userFor(req);
      const metadata = photoMatch
        ? store.db.prepare('SELECT mime,length(bytes) AS byteLength FROM checkins WHERE photo_id=? AND user_id=?').get(photoMatch[1], user.id)
        : store.db.prepare('SELECT mime,length(bytes) AS byteLength FROM postcards WHERE id=? AND user_id=?').get(postcardMatch[1], user.id);
      if(!metadata)fail(404,'NOT_FOUND','图片不存在。');
      if(method==='HEAD')return binary(res,req,metadata);
      // SQLite returns an owned Uint8Array and Buffer.from makes a second copy.
      // Reserve both before selecting the BLOB; hold until transport finishes or closes.
      reserveMedia(res,metadata.byteLength);
      const row = photoMatch
        ? store.db.prepare('SELECT mime,bytes FROM checkins WHERE photo_id=? AND user_id=?').get(photoMatch[1], user.id)
        : store.db.prepare('SELECT mime,bytes FROM postcards WHERE id=? AND user_id=?').get(postcardMatch[1], user.id);
      if (!row) fail(404, 'NOT_FOUND', '图片不存在。');
      return binary(res, req, row);
    }
    if(pathname==='/api/postcard-downloads'&&method==='POST'){
      const user=userFor(req);requireExpected(req,user);limit('upload:'+user.id,limits.upload);
      const mime=(req.headers['content-type']||'').split(';')[0].trim(),side=req.headers['x-postcard-side'];
      if(mime!=='image/png')fail(415,'UNSUPPORTED_IMAGE','临时下载仅支持 PNG 图片。');
      if(!['front','back','both'].includes(side))fail(400,'INVALID_POSTCARD_SIDE','请选择霜信下载版式。');
      const result=await receiveImage(req,async bytes=>{
        requireCurrent(req,user);requireExpected(req,user);validateImage(bytes,mime,true);
        return postcardDownloads.issue({owner:user.id,sessionHash:sha256(sessionToken(req)),side,bytes});
      });
      return json(res,201,result);
    }
    const downloadMatch=pathname.match(/^\/api\/postcard-downloads\/([A-Za-z0-9_-]{43})$/);
    if(downloadMatch&&['GET','HEAD'].includes(method)){
      res.setHeader('Referrer-Policy','no-referrer');
      const entry=postcardDownloads.lookup(downloadMatch[1]);if(!entry)fail(404,'NOT_FOUND','下载链接无效或已过期。');
      let bytes;
      if(method==='GET'){const release=reserveMedia(res,entry.bytes);try{bytes=await postcardDownloads.read(entry);}catch(error){release();throw error;}}
      const label={front:'正面',back:'背面',both:'双面'}[entry.side];
      res.writeHead(200,{'Content-Type':'image/png','Content-Length':entry.bytes,'Cache-Control':'no-store','Content-Disposition':`attachment; filename="frost-postcard-${entry.side}.png"; filename*=UTF-8''${encodeURIComponent('霜信明信片-'+label+'.png')}`,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
      res.end(bytes);return;
    }
    const checkinMatch = pathname.match(/^\/api\/checkins\/([a-z]+)$/);
    if (checkinMatch && method === 'PUT') {
      const user = userFor(req); requireExpected(req, user);
      const artId = checkinMatch[1];
      if (!ART_IDS.includes(artId)) fail(404, 'ART_NOT_FOUND', '这个艺点不存在。');
      limit('upload:' + user.id, limits.upload);
      const operationId = validateOperationId(req.headers['x-operation-id']);
      const capturedAt = validIso(req.headers['x-captured-at'], '拍摄时间');
      const collectedAt = req.headers['x-collected-at'] === undefined ? null : validIso(req.headers['x-collected-at'], '首次收录时间');
      const mime = (req.headers['content-type'] || '').split(';')[0].trim();
      const bytes = await receiveImage(req);
      requireCurrent(req,user);
      validateImage(bytes, mime);
      // Keep the legacy no-header fingerprint stable; explicit collection time participates in deduplication.
      const contentHash = collectedAt === null
        ? fingerprint('checkin', artId, mime, capturedAt, bytes)
        : fingerprint('checkin', artId, mime, capturedAt, collectedAt, bytes);
      const response = operate(user, operationId, contentHash, () => {
        const existing = store.db.prepare('SELECT created_at FROM checkins WHERE user_id=? AND art_id=?').get(user.id, artId);
        const row = { art_id: artId, photo_id: newId(), captured_at: capturedAt, created_at: existing?.created_at || collectedAt || capturedAt || new Date().toISOString(), operation_id: operationId };
        store.db.prepare(`INSERT INTO checkins(user_id,art_id,photo_id,mime,bytes,captured_at,created_at,operation_id) VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id,art_id) DO UPDATE SET photo_id=excluded.photo_id,mime=excluded.mime,bytes=excluded.bytes,captured_at=excluded.captured_at,operation_id=excluded.operation_id`).run(user.id, artId, row.photo_id, mime, bytes, capturedAt, row.created_at, operationId);
        store.audit(user.id, existing ? 'checkin.replace' : 'checkin.collect', { artId });
        return { checkin: checkinFrom(row) };
      },bytes.length);
      return json(res, 200, response);
    }
    if (pathname === '/api/inscription' && method === 'PUT') {
      const user = userFor(req); requireExpected(req, user);
      limit('write:'+user.id,limits.write);
      const body = await readJson(req);
      requireCurrent(req,user);
      const operationId = validateOperationId(body.operationId);
      if (typeof body.text !== 'string' || Array.from(body.text).length > 60 || /[\u0000-\u001f]/.test(body.text)) fail(400, 'INVALID_INSCRIPTION', '落款最多 60 个字。');
      const text = body.text.trim().normalize('NFC');
      const response = operate(user, operationId, fingerprint('inscription', text), () => {
        store.db.prepare('UPDATE users SET inscription=? WHERE id=?').run(text, user.id);
        store.audit(user.id, 'inscription.save');
        return { text };
      });
      return json(res, 200, response);
    }
    if (pathname === '/api/events' && method === 'POST') {
      const user = userFor(req); requireExpected(req, user);
      limit('events:' + user.id, limits.events);
      const body = await readJson(req);
      requireCurrent(req,user);
      if (!Array.isArray(body.events) || body.events.length > 50) fail(400, 'INVALID_EVENTS', '每次最多提交 50 条事件。');
      const events = body.events.map(event => {
        if (!event || typeof event.type !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,47}$/.test(event.type)) fail(400, 'INVALID_EVENT', '事件类型不正确。');
        return { id: validateOperationId(event.id), type: event.type, at: validIso(event.at), detail: cleanDetail(event.detail) };
      });
      const accepted = store.transaction(() => events.map(event => {
        const detail = JSON.stringify(event.detail);
        const existing = store.db.prepare('SELECT type,at,detail_json FROM events WHERE user_id=? AND event_id=?').get(user.id, event.id);
        if (existing) {
          if (existing.type !== event.type || existing.at !== event.at || existing.detail_json !== detail) fail(409, 'OPERATION_CONFLICT', '相同事件编号不能提交不同内容。');
        } else {storageGuard(Buffer.byteLength(detail));store.db.prepare('INSERT INTO events(user_id,event_id,type,at,detail_json,recorded_at) VALUES(?,?,?,?,?,?)').run(user.id, event.id, event.type, event.at, detail, new Date().toISOString());}
        return event.id;
      }));
      return json(res, 200, { accepted });
    }
    if (pathname === '/api/postcard' && method === 'PUT') {
      const user = userFor(req); requireExpected(req, user);
      limit('upload:' + user.id, limits.upload);
      const operationId = validateOperationId(req.headers['x-operation-id']);
      const representative = req.headers['x-representative-art'] || null;
      if (representative && !ART_IDS.includes(representative)) fail(400, 'INVALID_ART', '代表照片艺点不正确。');
      if (store.db.prepare('SELECT count(*) AS count FROM checkins WHERE user_id=?').get(user.id).count !== 6) fail(409, 'COLLECTION_INCOMPLETE', '六艺照片均同步后，才能领取专属终印。');
      const mime = (req.headers['content-type'] || '').split(';')[0].trim();
      const bytes = await receiveImage(req);
      requireCurrent(req,user);
      validateImage(bytes, mime, true);
      const response = operate(user, operationId, fingerprint('postcard', mime, representative || '', bytes), () => {
        const row = { id: newId(), created_at: new Date().toISOString(), operation_id: operationId };
        store.db.prepare(`INSERT INTO postcards(id,user_id,mime,bytes,created_at,operation_id,representative_art) VALUES(?,?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,mime=excluded.mime,bytes=excluded.bytes,created_at=excluded.created_at,operation_id=excluded.operation_id,representative_art=excluded.representative_art`).run(row.id, user.id, mime, bytes, row.created_at, operationId, representative);
        store.audit(user.id, 'postcard.save', representative ? { artId: representative } : {});
        return { postcard: postcardFrom(row), officialSeal: true };
      },bytes.length);
      return json(res, 200, response);
    }
    fail(404, 'NOT_FOUND', '接口不存在。');
  }

  async function serveStatic(req, res, pathname) {
    if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'METHOD_NOT_ALLOWED', '不支持此请求方法。');
    limit('static:'+req.frostRequestPolicy.address,limits.static);
    if(approvedAssets&&!approvedAssets.has(pathname))fail(404,'NOT_FOUND','Not found');
    if (['/scene', '/calibration'].includes(pathname)) { res.writeHead(308, { Location: pathname + '/', 'Cache-Control': 'no-store' }); res.end(); return; }
    const mount = mounts.find(candidate => candidate.exact ? pathname === candidate.exact : candidate.prefix === '/' || pathname.startsWith(candidate.prefix));
    let rest = mount.exact ? mount.file : mount.prefix === '/' ? pathname.slice(1) : pathname.slice(mount.prefix.length);
    if ((!rest || rest.endsWith('/')) && mount.noIndex) fail(404, 'NOT_FOUND', 'Not found');
    if (!rest || rest.endsWith('/')) rest += mount.index || 'index.html';
    if (rest.split('/').some(segment => segment.startsWith('.')) || /[\\\u0000:]/.test(rest)) fail(404, 'NOT_FOUND', 'Not found');
    const full = path.resolve(mount.dir, rest);
    if (!full.startsWith(mount.dir + path.sep)) fail(404, 'NOT_FOUND', 'Not found');
    if (!TYPES[path.extname(full).toLowerCase()]) fail(404, 'NOT_FOUND', 'Not found');
    let bytes, info;
    try {
      const actual = await realpath(full);
      const mountReal = await realpath(mount.dir);
      if (!actual.startsWith(mountReal + path.sep)) fail(404, 'NOT_FOUND', 'Not found');
      info = await stat(actual);
      if (!info.isFile()) fail(404, 'NOT_FOUND', 'Not found');
      bytes = await readFile(actual);
    } catch (error) { if (error instanceof HttpError) throw error; fail(404, 'NOT_FOUND', 'Not found'); }
    const contentType=TYPES[path.extname(full).toLowerCase()];
    const etag='W/"'+info.size.toString(16)+'-'+Math.trunc(info.mtimeMs*1000).toString(16)+'"';
    const headers={'Content-Type':contentType,'Cache-Control':pathname.startsWith('/admin/')?'no-store':'no-cache','Vary':'Accept-Encoding',...(pathname.startsWith('/admin/')?{}:{ETag:etag,'Last-Modified':info.mtime.toUTCString()}),...(pathname==='/sw.js'?{'Service-Worker-Allowed':'/'}:{})};
    if(!pathname.startsWith('/admin/')&&String(req.headers['if-none-match']||'').split(',').map(value=>value.trim()).some(value=>value===etag||value==='*')){res.writeHead(304,headers);res.end();return;}
    const representation=await staticEncoder.encode(bytes,{file:full,mtimeMs:info.mtimeMs,contentType},req.headers['accept-encoding']);
    if(representation.encoding)headers['Content-Encoding']=representation.encoding;
    headers['Content-Length']=representation.bytes.length;
    res.writeHead(200,headers);
    res.end(req.method==='HEAD'?null:representation.bytes);
  }
  async function handler(req, res) {
    const started = Date.now();
    let pathname = '/';
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if(productionStatic)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:; media-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
    res.on('finish', () => {
      const safePath = pathname.startsWith('/api/')
        ? (/^\/api\/(?:health|config(?:\/pins)?|auth\/(?:register|login|logout|reset)|me|checkins\/(?:poetry|leaves|writing|tea|incense|flowers)|inscription|events|postcard|postcard-downloads|admin\/(?:status|seal|reset))$/.test(pathname) ? pathname : (/^\/api\/(?:photos|postcards)\/[A-Za-z0-9_-]+$/.test(pathname) ? pathname.replace(/\/[^/]+$/, '/:id') : (pathname.startsWith('/api/postcard-downloads/')?'/api/postcard-downloads/:token':'/api/:unknown')))
        : (res.statusCode === 404 ? '/:not-found' : pathname);
      logger({ at: new Date().toISOString(), method: req.method, path: safePath, status: res.statusCode, ms: Date.now() - started });
    });
    try {
      req.frostBodyPolicy=bodyPolicy;
      req.frostRequestPolicy=requestPolicy(req);
      if(['GET','HEAD'].includes(req.method)&&(Number(req.headers['content-length']||0)>0||req.headers['transfer-encoding']))fail(400,'UNEXPECTED_BODY','此请求不接受请求体。');
      const rawPath = (req.url || '/').split('?')[0];
      try { pathname = decodeURIComponent(rawPath); } catch { fail(404, 'NOT_FOUND', 'Not found'); }
      if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\u0000]/.test(pathname) || pathname.split('/').some(segment => segment === '.' || segment === '..')) fail(404, 'NOT_FOUND', 'Not found');
      // Administration is served only by the separate loopback office listener.
      if (/^\/(?:admin|api\/admin)(?:\/|$)/i.test(pathname)) fail(404, 'NOT_FOUND', 'Not found');
      if (pathname.startsWith('/api/') || pathname === '/api') { res.setHeader('Cache-Control', 'no-store'); await api(req, res, pathname); }
      else await serveStatic(req, res, pathname);
    } catch (error) {
      if(!req.complete){
        // Send an early error while draining a bounded amount, so a legitimate
        // oversized upload receives its 413 instead of a TCP reset mid-send.
        let drained=0,timer;
        const cleanup=()=>{clearTimeout(timer);req.removeListener('data',onData);};
        const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{cleanup();req.destroy();},bodyPolicy.idleMs);timer.unref?.();};
        const onData=chunk=>{drained+=chunk.length;if(drained>6*1024*1024){cleanup();res.once('finish',()=>req.destroy());if(res.writableFinished)req.destroy();}else arm();};
        req.on('data',onData);req.once('end',cleanup);req.once('close',cleanup);req.once('error',cleanup);arm();
      }
      req.resume();
      if (res.headersSent) { res.end(); return; }
      const status = error instanceof HttpError ? error.status : 500;
      if(status===408)res.setHeader('Connection','close');
      if (status === 500) logger({ at: new Date().toISOString(), type: 'server.error', code: error.code || 'INTERNAL_ERROR' });
      json(res, status, { error: { code: error instanceof HttpError ? error.code : 'INTERNAL_ERROR', message: error instanceof HttpError ? error.message : '服务暂时未能完成请求，请稍后重试。' } }, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
    }
  }
  handler.store = store;
  handler.dataDir = dataDir;
  handler.close = () => { if (!closed) { closed = true; postcardDownloads.close();staticEncoder.clear(); store.close(); } };
  return handler;
}

export function createServer(options = {}) {
  const app = createApp(options);
  const server = http.createServer({ requestTimeout: 0, headersTimeout: 15_000, maxHeaderSize: 16_384 }, app);
  server.maxConnections=256;
  server.app = app;
  server.on('close', app.close);
  return server;
}
