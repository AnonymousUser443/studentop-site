/** Private server-side desktop gate. Never bundle this module or its state into public files. */
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import {existsSync, realpathSync} from 'node:fs';
import os from 'node:os';
import { isIP, createServer } from 'node:net';
import { createHash, createHmac, randomBytes, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(rawScrypt);
export const LIMIT = 3;
export const COOLDOWN = 300_000;
const COOKIE = 'aiden_desktop';
const ANON_TTL = 60 * 60_000;
const AUTH_TTL = 8 * 60 * 60_000;
export function privatePaths(root) {
  const id = createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 16);
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');
  const config = process.env.DESKTOP_AUTH_CONFIG || path.join(base, 'AidenDesktop', id, 'auth.json');
  const canonical = value => {
    let parent = path.resolve(value); const rest = [];
    while (!existsSync(parent)) { rest.unshift(path.basename(parent)); const next = path.dirname(parent); if (next === parent) throw new Error('Private path has no accessible ancestor.'); parent = next; }
    return path.resolve(realpathSync(parent), ...rest);
  };
  const resolved = canonical(config);
  const state = canonical(path.join(path.dirname(resolved), 'rate-state.json'));
  const actualRoot = realpathSync(root);
  for (const file of [resolved, state]) {
    const relative = path.relative(actualRoot, file);
    if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) throw new Error('Private configuration and state must be outside the repository (including symlinks).');
  }
  return { config: resolved, state };
}
export function normalizeAnswer(value) {
  return typeof value === 'string' && value.length <= 128 && !/[\x00-\x1f\x7f]/.test(value) ? value.normalize('NFKC').trim() : '';
}
export async function makeConfig(answer) {
  const normalized = normalizeAnswer(answer);
  if (!normalized) throw new Error('An answer of 1-128 characters is required.');
  const salt = randomBytes(32).toString('hex');
  const hash = Buffer.from(await scrypt(normalized, salt, 64)).toString('hex');
  return { version: 1, algorithm: 'scrypt-v1', salt, hash, rateKey: randomBytes(32).toString('hex') };
}
export async function savePrivate(file, data) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
  await writeFile(temp, JSON.stringify(data) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, file);
}
function validConfig(c) {
  return c?.version === 1 && c.algorithm === 'scrypt-v1' && /^[a-f0-9]{64}$/.test(c.salt) && /^[a-f0-9]{128}$/.test(c.hash) && /^[a-f0-9]{64}$/.test(c.rateKey);
}
function normalizedIP(value) { return value?.startsWith('::ffff:') ? value.slice(7) : value; }
export function clientAddress(req, trustedProxies = []) {
  const peer = normalizedIP(req.socket.remoteAddress) || 'unknown';
  if (trustedProxies.includes(peer)) {
    const forwarded = req.headers['x-real-ip'];
    if (typeof forwarded !== 'string' || !isIP(forwarded)) throw new Error('Trusted proxy must set one valid X-Real-IP.');
    return normalizedIP(forwarded);
  }
  return peer;
}
function send(res, code, data, cookies, retry) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Cookie' };
  if (cookies) headers['Set-Cookie'] = cookies;
  if (retry) headers['Retry-After'] = String(retry);
  res.writeHead(code, headers); res.end(JSON.stringify(data));
}
async function readAnswer(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('Content type'), { status: 415 });
  if (Number(req.headers['content-length']) > 1024) throw Object.assign(new Error('Too large'), { status: 413 });
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024) throw Object.assign(new Error('Too large'), { status: 413 });
    chunks.push(chunk);
  }
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks))); } catch { throw Object.assign(new Error('Bad JSON'), { status: 400 }); }
  if (!parsed || Array.isArray(parsed) || Object.keys(parsed).some(k => k !== 'answer') || !normalizeAnswer(parsed.answer)) throw Object.assign(new Error('Invalid answer'), { status: 400 });
  return normalizeAnswer(parsed.answer);
}
/** Inject clock/config/state only for isolated tests; live code always reads private on-disk configuration. */
export async function createDesktopAuth({root, configFile, stateFile, origin, secure = false, trustedProxies = [], now = Date.now} = {}) {
  const paths = privatePaths(root);
  const configPath = configFile || paths.config;
  const diskState = stateFile || paths.state;
  let config = null, healthy = true;
  try {
    const text = await readFile(configPath, 'utf8');
    if (text.length > 8192 || !validConfig(JSON.parse(text))) throw new Error('Invalid private configuration');
    config = JSON.parse(text);
  } catch (e) { if (e.code !== 'ENOENT') healthy = false; }
  const rates = new Map(), sessions = new Map(), creationBudgets = new Map();
  try {
    const text = await readFile(diskState, 'utf8');
    if (text.length > 4_000_000) throw new Error('State too large');
    const saved = JSON.parse(text);
    if (saved.version !== 1 || !saved.rates || typeof saved.rates !== 'object') throw new Error('Invalid state');
    for (const [key, value] of Object.entries(saved.rates)) {
      if (!/^[a-f0-9]{64}$/.test(key) || !Number.isInteger(value.failures) || value.failures < 0 || value.failures > LIMIT || !Number.isFinite(value.lockedUntil) || !Number.isFinite(value.updated)) throw new Error('Invalid rate state');
      if (value.lockedUntil > now() || value.updated + AUTH_TTL > now()) rates.set(key, value);
    }
  } catch (e) { if (e.code !== 'ENOENT') healthy = false; }
  let queue = Promise.resolve();
  const persist = async () => {
    try { await savePrivate(diskState, {version:1, rates:Object.fromEntries(rates)}); }
    catch { healthy = false; throw new Error('Private state cannot be persisted'); }
  };
  function addressKey(req) {
    return createHmac('sha256', config.rateKey).update(clientAddress(req, trustedProxies)).digest('hex');
  }
  function rateFor(req) {
    const key = addressKey(req);
    let rate = rates.get(key);
    if (!rate) {
      if (rates.size >= 10000) throw Object.assign(new Error('Capacity'), {status:503});
      rate = {failures:0, lockedUntil:0, updated:now()}; rates.set(key, rate);
    }
    if (rate.lockedUntil && rate.lockedUntil <= now()) { rate.failures = 0; rate.lockedUntil = 0; rate.updated = now(); }
    return rate;
  }
  function sessionFor(req, create = false) {
    const cookies = String(req.headers.cookie || '').split(';').map(x => x.trim().split('='));
    const id = cookies.find(([key]) => key === COOKIE)?.[1];
    const previous = id && /^[a-f0-9]{64}$/.test(id) ? sessions.get(id) : null;
    if (previous && previous.expires > now()) return {id, value:previous};
    if (!create) return null;
    const next = randomBytes(32).toString('hex');
    const value = {id:next, revoked:false, authenticated:false, csrf:randomBytes(32).toString('hex'), expires:now() + ANON_TTL};
    sessions.set(next, value); return {id:next, value};
  }
  function payload(session, rate, error) {
    return {configured:!!config && healthy, authenticated:!!session?.value.authenticated,
      csrfToken:session?.value.csrf || '', attemptsRemaining:Math.max(0, LIMIT - (rate?.failures || 0)),
      retryAfterSeconds:Math.max(0, Math.ceil(((rate?.lockedUntil || 0) - now()) / 1000)),
      lockedUntil:rate?.lockedUntil || 0, serverTime:now(), ...(error ? {error} : {})};
  }
  const cookieFor = id => COOKIE + '=' + id + '; Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '');
  function allowedOrigin(req) {
    const expected = typeof origin === 'function' ? origin(req) : origin;
    return !!expected && req.headers.origin === expected && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin');
  }
  function collect() {
    for (const [id, s] of sessions) if (s.expires <= now()) sessions.delete(id);
    for (const [id, r] of rates) if (r.lockedUntil <= now() && r.updated + AUTH_TTL < now()) rates.delete(id);
    for (const [id, b] of creationBudgets) if (b.start + 60_000 <= now()) creationBudgets.delete(id);
  }
  async function handle(req, res) {
    if (req.url?.split('?')[0] !== '/__desktop/auth') return false;
    if (!['GET','POST','DELETE'].includes(req.method)) { res.setHeader('Allow','GET, POST, DELETE'); send(res,405,{error:'method_not_allowed'}); return true; }
    if (!config || !healthy) { send(res,503,payload(null,null,'auth_unavailable')); return true; }
    collect();
    // Foreign writes cannot allocate a session, and capacity never denies a valid existing session.
    if (req.method !== 'GET' && !allowedOrigin(req)) { send(res,403,payload(null,null,'request_rejected')); return true; }
    let rate;
    try { rate = rateFor(req); } catch (e) { send(res,e.status || 400,{error:e.status ? 'capacity' : 'proxy_configuration'}); return true; }
    let session = sessionFor(req);
    if (!session) {
      if (req.method !== 'GET') { send(res,403,payload(null,rate,'request_rejected')); return true; }
      const key = addressKey(req);
      const budget = creationBudgets.get(key) || {start:now(), count:0};
      if (sessions.size >= 10000 || budget.count >= 60) { send(res,503,payload(null,rate,'session_capacity'),undefined,60); return true; }
      budget.count++; creationBudgets.set(key,budget);
      session = sessionFor(req,true);
    }
    if (req.method === 'GET') { send(res,200,payload(session,rate),cookieFor(session.id)); return true; }
    if (!allowedOrigin(req) || req.headers['x-desktop-csrf'] !== session.value.csrf) { send(res,403,payload(session,rate,'request_rejected')); return true; }
    let answer;
    if (req.method === 'POST') {
      try { answer = await readAnswer(req); } catch (e) { send(res,e.status || 400,payload(session,rate,'invalid_request')); return true; }
    }
    // Serializes persistence and expensive verification: concurrent submissions cannot bypass the third failure.
    const work = queue.then(async () => {
      if (!healthy) { send(res,503,payload(null,null,'auth_unavailable')); return; }
      rate = rateFor(req);
      const current = () => !session.value.revoked && sessions.get(session.value.id) === session.value && session.value.expires > now();
      if (req.method === 'DELETE') {
        // An already accepted logout follows an in-flight session rotation, but can never resurrect it.
        if (!current()) { send(res,403,payload(null,rate,'session_changed')); return; }
        session.value.revoked = true; session.value.authenticated = false;
        sessions.delete(session.value.id);
        const anonymous = sessionFor({headers:{}},true);
        send(res,200,payload(anonymous,rate),cookieFor(anonymous.id)); return;
      }
      if (!current() || session.id !== session.value.id) { send(res,403,payload(null,rate,'session_changed')); return; }
      if (rate.lockedUntil > now()) { send(res,429,payload(session,rate,'cooldown'),undefined,Math.ceil((rate.lockedUntil-now())/1000)); return; }
      const result = Buffer.from(await scrypt(answer, config.salt, 64));
      answer = undefined;
      if (timingSafeEqual(result, Buffer.from(config.hash,'hex'))) {
        rate.failures = 0; rate.lockedUntil = 0; rate.updated = now();
        await persist();
        if (!current() || session.id !== session.value.id) { send(res,403,payload(null,rate,'session_changed')); return; }
        // Rotate session on authentication to prevent fixation; retain no answer in the session.
        sessions.delete(session.id);
        session.id = randomBytes(32).toString('hex'); session.value.id = session.id;
        session.value.csrf = randomBytes(32).toString('hex'); session.value.authenticated = true;
        session.value.expires = now() + AUTH_TTL; sessions.set(session.id, session.value);
        send(res,200,payload(session,rate),cookieFor(session.id));
      } else {
        rate.failures++; rate.updated = now();
        if (rate.failures >= LIMIT) rate.lockedUntil = now() + COOLDOWN;
        await persist();
        send(res,rate.lockedUntil ? 429 : 401,payload(session,rate,rate.lockedUntil ? 'cooldown' : 'incorrect'),undefined,rate.lockedUntil ? 300 : 0);
      }
    });
    queue = work.catch(() => {});
    try { await work; } catch { if (!res.headersSent) send(res,503,payload(null,null,'auth_unavailable')); else res.destroy(); }
    return true;
  }
  const inflight=new Set(); let closing=false;
  function guardedHandle(req,res) {
    if(req.url?.split('?')[0] !== '/__desktop/auth')return Promise.resolve(false);
    if(closing){send(res,503,payload(null,null,'shutting_down'));return Promise.resolve(true);}
    const request=handle(req,res);inflight.add(request);
    const done=()=>inflight.delete(request);request.then(done,done);return request;
  }
  /** Read-only consumers share the current desktop lease; they cannot create or refresh it.
   * The HTTP host must already have been checked by the calling server.
   */
  function authorizeRead(req) {
    if (closing || !config || !healthy) return {ok:false,status:503,error:'auth_unavailable'};
    if (!['GET','HEAD'].includes(req.method)) return {ok:false,status:405,error:'read_only'};
    const expected = typeof origin === 'function' ? origin(req) : origin;
    const supplied = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    if (!expected || (supplied !== undefined && supplied !== expected)
      || (fetchSite !== undefined && !['same-origin','none'].includes(fetchSite))) {
      return {ok:false,status:403,error:'request_rejected'};
    }
    // Ambiguous cookies are not accepted by the read-only bridge.
    const matching = String(req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(COOKIE + '='));
    if (matching.length !== 1) return {ok:false,status:401,error:'authentication_required'};
    const session = sessionFor(req);
    if (!session || !session.value.authenticated || session.value.revoked) return {ok:false,status:401,error:'authentication_required'};
    const id = session.id, value = session.value;
    const isValid = () => !closing && !!config && healthy && !value.revoked && value.authenticated
      && value.expires > now() && value.id === id && sessions.get(id) === value;
    if (!isValid()) return {ok:false,status:401,error:'authentication_required'};
    return Object.freeze({ok:true,sessionId:id,isValid});
  }
  return {handle:guardedHandle, authorizeRead, configured:!!config && healthy, async drain(){closing=true;await Promise.allSettled([...inflight]);await queue;}};
}
/** OS-owned loopback listener is an exclusive lease, released automatically on process death.
 * A deterministic port collision fails closed; never kills or attaches to another listener.
 */
export async function acquireAuthLease(root, explicitIdentity) {
 const identity=explicitIdentity || privatePaths(root).state;
 const port=45000 + createHash('sha256').update(identity.toLowerCase()).digest().readUInt32BE(0) % 4000;
 const lease=createServer(socket=>socket.destroy());
 await new Promise((resolve,reject)=>{lease.once('error',()=>reject(new Error('Another auth service or listener owns the private-state lease port '+port+'. Stop only your owned service first.')));lease.listen({host:'127.0.0.1',port,exclusive:true},resolve);});
 let released;
 return ()=>released || (released=new Promise(resolve=>lease.close(resolve)));
}
