import https from 'node:https';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Read-only production verification. No login, cookies, or private configuration.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const build = path.resolve(process.argv[2] || path.join(root, '.release-local/mobile-shell-20261031/site'));
const output = path.resolve(process.argv[3] || path.join(here, 'public-results.json'));
try { await fs.access(output); throw new Error('Existing evidence cannot be overwritten.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const expectedVersion = '2d6f20fd4b6c2f6098f6db38';
const origin = 'https://studentop.cn:14355';
const manifest = JSON.parse(await fs.readFile(path.join(build, 'assets/releases', expectedVersion, 'manifest.json'), 'utf8'));
if (manifest.id !== expectedVersion || manifest.files.length !== 44) throw new Error('Unexpected candidate manifest.');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const agent = new https.Agent({ keepAlive: true, maxSockets: 3 });
const checks = [];
const record = (name, pass, details = {}) => checks.push({ name, pass: !!pass, ...details });
function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { agent, family: 4, headers, signal: AbortSignal.timeout(15000) }, response => {
      const tlsAuthorized = response.socket.authorized;
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        tlsAuthorized, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}
async function check(name, fn) {
  try { await fn(); }
  catch (error) { record(name, false, { error: String(error.message || error) }); }
}
async function htmlFiles(dir, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await htmlFiles(path.join(dir, entry.name), relative + '/'));
    else if (entry.name.endsWith('.html')) files.push(relative);
  }
  return files.sort();
}
try {
  for (const file of await htmlFiles(build)) await check('entry:' + file, async () => {
    const response = await get(origin + (file === 'index.html' ? '/' : '/' + file));
    const local = await fs.readFile(path.join(build, file));
    const html = response.body.toString('utf8');
    record('entry:' + file, response.status === 200 && response.tlsAuthorized && sha256(response.body) === sha256(local),
      { status: response.status, bytes: response.body.length, sha256: sha256(response.body), tlsAuthorized: response.tlsAuthorized });
    if (file === 'index.html') {
      record('home:new-runtime-references', ['js/shell.js', 'css/shell.css', 'css/paper.css'].every(asset =>
        html.includes('/assets/releases/' + expectedVersion + '/' + asset)) && html.includes('content="' + expectedVersion + '"'));
    }
  });
  // Small batches bound load on the Pi and the campus tunnel.
  for (let offset = 0; offset < manifest.files.length; offset += 3) {
    await Promise.all(manifest.files.slice(offset, offset + 3).map(file => check('asset:' + file.path, async () => {
      const response = await get(origin + '/assets/releases/' + expectedVersion + '/' + file.path);
      const hash = sha256(response.body);
      const mime = response.headers['content-type'] || '';
      const mimeOK = file.path.endsWith('.js') ? /javascript/.test(mime) : !file.path.endsWith('.css') || /text\/css/.test(mime);
      record('asset:' + file.path, response.status === 200 && response.tlsAuthorized && response.body.length === file.bytes && hash === file.sha256 && mimeOK,
        { status: response.status, bytes: response.body.length, sha256: hash, contentType: mime });
    })));
  }
  await check('home:version', async () => {
    const response = await get(origin + '/version.json');
    record('home:version', response.status === 200 && JSON.parse(response.body).id === expectedVersion, { status: response.status });
  });
  for (const [name, url] of [
    ['voxel', origin + '/voxel-campus/'], ['campus-entry', origin + '/campus-entry/'],
    ['liyun', 'https://liyun.studentop.cn:14355/'], ['frost', 'https://frost.studentop.cn:14355/'],
    ['genshin', 'https://genshin.studentop.cn:14355/']
  ]) await check(name, async () => {
    const response = await get(url);
    const html = response.body.toString('utf8');
    record(name, response.status === 200 && response.tlsAuthorized && /<html[\s>]/i.test(html), { status: response.status });
    const script = html.match(/<script\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    if (!script) { record(name + ':entry-script', false, { error: 'No entry script found' }); return; }
    const asset = await get(new URL(script, url));
    record(name + ':entry-script', asset.status === 200 && /javascript/.test(asset.headers['content-type'] || ''), { status: asset.status });
  });
  for (const name of ['liyun', 'frost']) await check(name + ':api-health', async () => {
    const response = await get('https://' + name + '.studentop.cn:14355/api/health');
    record(name + ':api-health', response.status === 200 && JSON.parse(response.body).ok === true, { status: response.status });
  });
  await check('desktop:auth-configured', async () => {
    const response = await get(origin + '/__desktop/auth');
    record('desktop:auth-configured', response.status === 200 && JSON.parse(response.body).configured === true, { status: response.status });
  });
  await check('monitor:anonymous-denied', async () => {
    const response = await get(origin + '/__desktop/task-manager/health');
    record('monitor:anonymous-denied', response.status === 401, { status: response.status });
  });
  await check('home:build-index-not-public', async () => {
    const response = await get(origin + '/site-build.json');
    record('home:build-index-not-public', response.status === 403, { status: response.status });
  });
  for (const asset of ['js/shell.js', 'css/shell.css', 'css/paper.css']) await check('previous-release:' + asset, async () => {
    const response = await get(origin + '/assets/releases/76b1376dbbf99a19cb3a2308/' + asset);
    record('previous-release:' + asset, response.status === 200, { status: response.status });
  });
} catch (error) {
  record('verification:incomplete', false, { error: String(error.message || error) });
} finally {
  agent.destroy();
  const passed = checks.filter(item => item.pass).length;
  const report = { checkedAt: new Date().toISOString(), source: 'Windows direct native HTTPS, certificate verification enabled',
    expectedVersion, assetCount: manifest.files.length, passed, total: checks.length, ok: passed === checks.length, checks };
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ok: report.ok, passed, total: checks.length, output }));
  if (!report.ok) process.exitCode = 1;
}
