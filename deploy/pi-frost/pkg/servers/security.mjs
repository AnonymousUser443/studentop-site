import { randomBytes, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { sha256 } from './store.mjs';
import { imageContainerValid } from './image-format.mjs';

const derive = promisify(scrypt);
const SESSION_AGE = 7 * 24 * 60 * 60;
let activeDerivations=0,reservedBodyBytes=0,activeBodies=0;
const setting=(value,fallback)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:fallback;};
function overloaded(code,message){const error=new HttpError(503,code,message);error.retryAfter=3;return error;}
export const COOKIE_NAME = 'frost_session';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function fail(status, code, message) { throw new HttpError(status, code, message); }
export const newId = () => randomBytes(18).toString('base64url');
export const publicUser = user => ({ id: user.id, name: user.name, studentId: user.student_id });

export function validateWords(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !Number.isInteger(item) || item < 1 || item > 20) || new Set(value).size !== 3) fail(400, 'INVALID_PASSPHRASE', '请按顺序选择三个不同的词牌。');
  return value.join(':');
}
export function validateStudentId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{4,32}$/.test(value.trim())) fail(400, 'INVALID_STUDENT_ID', '学号需为 4–32 位数字或英文字母。');
  return value.trim();
}
export function validateName(value) {
  if (typeof value !== 'string') fail(400, 'INVALID_NAME', '请填写姓名。');
  const name = value.trim().normalize('NFC');
  if (Array.from(name).length < 1 || Array.from(name).length > 30 || /[\p{C}<>]/u.test(name)) fail(400, 'INVALID_NAME', '姓名需为 1–30 个文字。');
  return name;
}
export async function derivePassphrase(words, salt = randomBytes(16).toString('hex')) {
  const phrase=validateWords(words);
  if(activeDerivations>=Math.min(4,setting(process.env.FROST_SCRYPT_CONCURRENCY,4)))throw overloaded('AUTH_BUSY','登录服务正在处理其他请求，请稍后重试。');
  activeDerivations++;
  try {const hash=await derive(phrase,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});return {salt,hash:hash.toString('hex')};}
  finally {activeDerivations--;}
}
export async function checkPassphrase(words, user) {
  const derived = await derivePassphrase(words, user?.pass_salt || '00000000000000000000000000000000');
  return safeEqual(derived.hash, user?.pass_hash || '0'.repeat(64));
}
export function safeEqual(left, right) {
  const a = Buffer.from(sha256(String(left)));
  const b = Buffer.from(sha256(String(right)));
  return timingSafeEqual(a, b);
}
export function createSession(store, userId, secureCookie, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  store.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  store.db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(sha256(token), userId, now, now + SESSION_AGE * 1000);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE}${secureCookie ? '; Secure' : ''}`;
}
export function sessionToken(req) {
  const raw = (req.headers.cookie || '').split(';').find(value => value.trim().startsWith(COOKIE_NAME + '='));
  const token = raw?.trim().slice(COOKIE_NAME.length + 1);
  return token && /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null;
}
export function getUser(req, store) {
  const token = sessionToken(req);
  if (!token) return null;
  return store.db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(sha256(token), Date.now()) || null;
}
export function clearCookie(secureCookie) { return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie ? '; Secure' : ''}`; }

export function makeLimiter({maxBuckets=setting(process.env.FROST_LIMIT_BUCKETS,20_000)}={}) {
  const buckets = new Map();
  let lastSweep = 0;
  return function limit(key, maximum, windowMs = 60_000) {
    const now = Date.now();
    if (now - lastSweep > 60_000) { for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id); lastSweep = now; }
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= now) {
      if(!bucket&&buckets.size>=maxBuckets){
        for(const [id,entry] of buckets)if(entry.until<=now)buckets.delete(id);
        if(buckets.size>=maxBuckets){const error=new HttpError(429,'RATE_LIMITED','请求过于集中，请稍后重试。');error.retryAfter=60;throw error;}
      }
      bucket = { until: now + windowMs, count: 0 }; buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > maximum) {
      const error = new HttpError(429, 'RATE_LIMITED', '操作过于频繁，请稍后再试。');
      error.retryAfter = Math.ceil((bucket.until - now) / 1000);
      throw error;
    }
  };
}

export async function readBody(req, maximum) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maximum) fail(413, 'PAYLOAD_TOO_LARGE', '文件超过允许大小。');
  const policy=req.frostBodyPolicy||{};
  const capacity=setting(policy.maxBytes??process.env.FROST_MAX_BODY_BYTES,24*1024*1024);
  if(reservedBodyBytes+maximum>capacity||activeBodies>=setting(policy.maxReaders??process.env.FROST_MAX_BODY_READERS,64))throw overloaded('BODY_BUSY','正在接收其他资料，请稍后重试。');
  reservedBodyBytes+=maximum;activeBodies++;
  return new Promise((resolve, reject) => {
    let chunks = [], size = 0, rejected = false,settled=false,timer;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);reservedBodyBytes-=maximum;activeBodies--;if(error){rejected=true;chunks=[];reject(error);}else resolve(value);};
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(new HttpError(408,'BODY_TIMEOUT','网络长时间没有传输新资料，请重试。')),setting(policy.idleMs??process.env.FROST_BODY_IDLE_MS,20_000));timer.unref?.();};
    arm();
    req.on('data', chunk => {
      if (rejected) return;
      if(chunk.length)arm();
      size += chunk.length;
      if (size > maximum) {
        rejected = true; chunks = [];
        // Drain rather than destroying the socket, so a chunked request receives a 413 response.
        finish(new HttpError(413, 'PAYLOAD_TOO_LARGE', '文件超过允许大小。'));
      } else chunks.push(chunk);
    });
    req.once('end', () => { if (!rejected) {const data=Buffer.concat(chunks);chunks=[];finish(null,data);} });
    req.once('error', error => { if (!rejected) finish(error); });
    req.once('aborted', () => { if (!rejected) finish(new HttpError(400, 'REQUEST_ABORTED', '请求已中断。')); });
    req.once('close',()=>{if(!settled)finish(new HttpError(400,'REQUEST_ABORTED','请求已中断。'));});
  });
}
export async function readJson(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') fail(415, 'JSON_REQUIRED', '请使用 JSON 请求。');
  let data;
  try { data = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8')); }
  catch (error) { if (error instanceof HttpError) throw error; fail(400, 'INVALID_JSON', 'JSON 格式不正确。'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'INVALID_JSON', 'JSON 请求必须是对象。');
  return data;
}
export function validateOperationId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) fail(400, 'INVALID_OPERATION_ID', '缺少有效的操作编号。');
  return value;
}
export function validIso(value, field = '时间') {
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail(400, 'INVALID_TIME', field + '格式不正确。');
  return new Date(value).toISOString();
}
export function validateImage(bytes, mime, postcard = false) {
  if (!bytes.length) fail(400, 'EMPTY_IMAGE', '图片不能为空。');
  const supported = postcard ? ['image/png', 'image/jpeg'] : ['image/avif', 'image/webp', 'image/jpeg'];
  if (!supported.includes(mime)) fail(415, 'UNSUPPORTED_IMAGE', '不支持此图片格式。');
  if (!imageContainerValid(bytes, mime)) fail(415, 'INVALID_IMAGE', '图片格式、尺寸或内容不正确。');
}
