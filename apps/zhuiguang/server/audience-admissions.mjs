import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile, truncate, writeFile } from 'node:fs/promises';
import path from 'node:path';

const maxAge = 180 * 24 * 60 * 60 * 1000;
const safeName = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .·・'’-]{0,39}$/u;
const studentNumber = /^[0-9]{6,20}$/;
const guestId = /^[a-f0-9]{32}$/;
const equal = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function audienceAdmissions(dataDir, showId) {
  const cookie = 'zhuiguang_entry_' + showId;
  const secretPath = path.join(dataDir, 'audience-secret');
  const registryPath = path.join(dataDir, 'audience-admissions.ndjson');
  let secret;
  let registry;
  let initialized;
  let serial = Promise.resolve();

  async function initialize() {
    await mkdir(dataDir, { recursive: true });
    try { secret = await readFile(secretPath); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { await writeFile(secretPath, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
      catch (createError) { if (createError.code !== 'EEXIST') throw createError; }
      secret = await readFile(secretPath);
    }
    if (secret.length !== 32) throw new Error('Invalid audience signing key');
    try {
      const bytes = await readFile(registryPath);
      const end = bytes.lastIndexOf(10) + 1;
      // Recover the incomplete tail of an interrupted append before accepting new entries.
      if (end < bytes.length) await truncate(registryPath, end);
      registry = Object.fromEntries(bytes.subarray(0, end).toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)));
    }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      registry = {};
    }
  }
  function ready() {
    initialized ||= initialize().catch(error => { initialized = undefined; throw error; });
    return initialized;
  }
  const digest = (kind, value) => createHmac('sha256', secret).update(kind + '\0' + value).digest('base64url');

  async function restore(header = '') {
    const token = header.split(/;\s*/).find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1);
    if (!token || !/^[a-f0-9]{32}\.[0-9]{13}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [id, expiry, signature] = token.split('.');
    if (Number(expiry) <= Date.now()) return null;
    try { await ready(); } catch { return null; }
    return equal(signature, digest('ticket', id + '.' + expiry)) ? id : null;
  }

  function admit(payload) {
    if (typeof payload?.guest === 'string' && guestId.test(payload.guest)) {
      return issue('guest', payload.guest, payload.guest);
    }
    const name = typeof payload?.name === 'string' ? payload.name.normalize('NFKC').trim() : '';
    const number = typeof payload?.studentNumber === 'string' ? payload.studentNumber.normalize('NFKC').trim() : '';
    if (!safeName.test(name) || !studentNumber.test(number)) {
      return Promise.resolve({ status: 400, error: '请输入姓名和有效的学号。' });
    }
    return issue('student', number, number + '\0' + name);
  }

  function issue(kind, identity, credential) {
    const request = serial.then(async () => {
      await ready();
      const key = digest(kind, identity);
      const proof = digest(kind === 'student' ? 'name' : 'guest-proof', credential);
      const previous = registry[key];
      if (previous && !equal(previous.proof, proof)) return { status: 409, error: '姓名与该学号的入场记录不一致。' };
      const id = previous?.id || randomBytes(16).toString('hex');
      if (!previous) {
        const entry = { id, proof, joinedAt: Date.now() };
        try { await appendFile(registryPath, JSON.stringify([key, entry]) + '\n', { mode: 0o600, flush: true }); }
        catch (error) { initialized = undefined; throw error; }
        registry[key] = entry;
      }
      const ticket = id + '.' + (Date.now() + maxAge);
      return { status: 200, token: ticket + '.' + digest('ticket', ticket) };
    });
    serial = request.catch(() => {});
    return request;
  }
  return { admit, restore, cookie, maxAge };
}
