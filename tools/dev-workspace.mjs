#!/usr/bin/env node
/** Local-only runner: no install, deployment, browser, proxy or external process killing. */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createDesktopAuth, acquireAuthLease } from './desktop-auth.mjs';
import { siteRevision } from './site-release.mjs';

const SELF = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SELF), '..');
export const HOST = '127.0.0.1';
export const SITE_PORT = 8899;
export const APPS = Object.freeze([
  { id: 'liyun', root: path.join(ROOT, 'apps/liyun-explorer'), port: 5174 },
  { id: 'campus', root: path.join(ROOT, 'apps/genshin-start'), port: 8081 },
  { id: 'voxel', root: path.join(ROOT, 'apps/liangxiang-cloudwalk'), port: 5180 },
]);
const TYPES = {
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};
export function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}
/** Validate raw request BEFORE URL normalization can hide dot segments. */
export function publicPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  let pathname = raw.split('?')[0];
  try { pathname = decodeURIComponent(pathname); } catch { return null; }
  // No ambiguous/double encodings, Windows ADS/separators or hidden files.
  if (/[\\%:#\x00-\x1f\x7f]/.test(pathname)) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.some(p => p.startsWith('.') || p.endsWith('.') || p.endsWith(' '))) return null;
  if (pathname === '/') return 'index.html';
  if (pathname === '/projects' || pathname === '/projects/') return 'projects/index.html';
  if (pathname === '/index.html' || pathname === '/projects/index.html') return pathname.slice(1);
  if (['/assets/fonts/OFL-NotoSansSC.txt', '/assets/fonts/OFL-NotoSerifSC.txt'].includes(pathname)) return pathname.slice(1);
  // Public asset subtrees only: never workspace files, manifests, source maps or README.
  if (!/^\/assets\/(?:css|js|img|fonts|audio)\//.test(pathname)) return null;
  if (path.extname(pathname).toLowerCase() === '.txt' || !Object.hasOwn(TYPES, path.extname(pathname).toLowerCase())) return null;
  if (parts.some(p => /(?:^|[-_.])(secret|credentials?|private|token|password)(?:[-_.]|$)/i.test(p))) return null;
  return pathname.slice(1);
}
export function validHost(value) {
  return value === HOST + ':' + SITE_PORT || value === 'localhost:' + SITE_PORT;
}
function json(res, code, body, head = false) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(head ? undefined : JSON.stringify(body, null, 2) + '\n');
}
export async function preflight(siteOnly = false) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js >=22.12 is required.');
  const workspace = await realpath(ROOT);
  const site = await realpath(path.join(workspace, 'site'));
  if (!within(workspace, site) || !(await stat(path.join(site, 'index.html'))).isFile()) throw new Error('Invalid site root/index.');
  const apps = [];
  if (!siteOnly) for (const app of APPS) {
    const root = await realpath(app.root);
    if (!within(workspace, root)) throw new Error(app.id + ': app root escapes workspace.');
    JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const entry = path.join(root, 'node_modules/vite/dist/node/index.js');
    try { if (!(await stat(entry)).isFile()) throw new Error('not a file'); }
    catch { throw new Error(app.id + ': local Vite missing; Lead must install this app using its own lockfile.'); }
    apps.push({ ...app, root, entry });
  }
  return { workspace, site, apps };
}
function identity(workspace) {
  return { name: path.basename(workspace), id: createHash('sha256').update(workspace.toLowerCase()).digest('hex').slice(0, 16) };
}
async function viteChild(id) {
  if (!process.send) throw new Error('Internal child mode requires parent IPC.');
  const app = APPS.find(a => a.id === id);
  if (!app) throw new Error('Unknown app.');
  let server;
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try { if (server) await server.close(); } finally { process.exit(0); }
  };
  process.on('message', message => { if (message?.type === 'shutdown') void close(); });
  process.on('disconnect', () => void close());
  process.on('SIGINT', () => void close());
  process.on('SIGTERM', () => void close());
  const { createServer } = await import(pathToFileURL(path.join(app.root, 'node_modules/vite/dist/node/index.js')).href);
  process.chdir(app.root);
  server = await createServer({ root: app.root,
    server: { host: HOST, port: app.port, strictPort: true, open: false,
      fs: { strict: true, allow: [app.root] },
      // DSH atomic edits use hidden .tmpdir/.tmp paths; do not watch their transient locks.
      watch: { usePolling: true, interval: 200,
        ignored: ['**/*.tmpdir', '**/*.tmpdir/**', '**/*.tmp', /(^|[/\\])[^/\\]*\.tmpdir([/\\]|$)/, /\.tmp$/] },
    },
  });
  if (closing) { await server.close(); return; }
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string' || address.address !== HOST || address.port !== app.port) {
    await server.close();
    throw new Error(app.id + ': Vite did not bind its exact loopback port.');
  }
  process.send({ type: 'ready', id: app.id, port: app.port });
}
export async function run(argv = process.argv.slice(2)) {
  if (argv[0] === '--vite-child') return viteChild(argv[1]);
  const allowed = new Set(['--site-only', '--check', '--help']);
  if (argv.some(a => !allowed.has(a))) throw new Error('Unknown option. Use --help.');
  if (argv.includes('--help')) {
    console.log('node tools/dev-workspace.mjs [--site-only] [--check]\n--check: filesystem/dependency preflight only; no sockets, servers or install.\nPorts: site 8899, liyun 5174, campus 8081, voxel 5180 (127.0.0.1, strict).');
    return;
  }
  const siteOnly = argv.includes('--site-only');
  const checked = await preflight(siteOnly);
  const workspace = identity(checked.workspace);
  if (argv.includes('--check')) {
    console.log(JSON.stringify({ ok: true, mode: 'check', workspace, siteRoot: 'site',
      planned: [{ id: 'site', port: SITE_PORT }, ...checked.apps.map(({id, port}) => ({id, port}))],
      portsProbed: false, note: 'No service started. Port availability is enforced at listen time.' }, null, 2));
    return;
  }
  const instance = randomUUID();
  const startedAt = new Date().toISOString();
  const states = [{ id: 'site', port: SITE_PORT, status: 'starting' }, ...checked.apps.map(({id, port}) => ({id, port, status: 'starting'}))];
  const children = [];
  let stopping = false;
  const status = () => ({ ok: !stopping && states.every(s => s.status === 'ready'),
    service: 'dev-workspace', workspace, instance, startedAt,
    mode: siteOnly ? 'site-only' : 'full', siteRoot: 'site', services: states });
  const releaseAuthLease = await acquireAuthLease(ROOT);
  let auth;
  try { auth = await createDesktopAuth({ root: ROOT, origin: req => 'http://' + req.headers.host }); }
  catch (error) { await releaseAuthLease(); throw error; }
  const server = http.createServer((req, res) => {
    void (async () => {
      const head = req.method === 'HEAD';
      if (!validHost(req.headers.host)) return json(res, 403, { error: 'Invalid Host' }, head);
      if (await auth.handle(req, res)) return;
      if (req.method !== 'GET' && !head) { res.setHeader('Allow', 'GET, HEAD'); return json(res, 405, {error:'Method not allowed'}); }
      const rawPath = req.url?.split('?')[0];
      if (rawPath === '/version.json') return json(res, 200, {id:siteRevision(checked.site)}, head);
      if (rawPath === '/__workspace/status' || rawPath === '/__workspace/health') {
        const current = status();
        return json(res, rawPath.endsWith('/health') && !current.ok ? 503 : 200, current, head);
      }
      const publicName = publicPath(req.url);
      if (!publicName) return json(res, 403, {error:'Path not public'}, head);
      let filename;
      try {
        filename = await realpath(path.join(checked.site, publicName));
        if (!within(checked.site, filename) || !publicPath('/' + path.relative(checked.site, filename).split(path.sep).join('/'))) return json(res, 403, {error:'Path not public'}, head);
        if (!(await stat(filename)).isFile()) return json(res, 404, {error:'Not found'}, head);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return json(res, 404, {error:'Not found'}, head);
        throw error;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      if (head) { res.end(); return; }
      const stream = createReadStream(filename);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    })().catch(() => { if (!res.headersSent) json(res, 500, {error:'Read failed'}); else res.destroy(); });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const state of states) state.status = 'stopping';
    server.close();
    server.closeAllConnections();
    await auth.drain();
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) return resolve();
      const timer = setTimeout(() => { child.kill(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      if (child.connected) child.send({type:'shutdown'}, error => { if (error) child.kill(); });
      else child.kill();
    })));
    await releaseAuthLease();
    console.log(JSON.stringify({ event: 'stopped', workspace, instance, code }));
  };
  process.once('SIGINT', () => void shutdown(0));
  process.once('SIGTERM', () => void shutdown(0));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({host:HOST, port:SITE_PORT, exclusive:true}, resolve);
    });
    states[0].status = 'ready';
    for (const app of checked.apps) {
      if (stopping) break;
      const state = states.find(s => s.id === app.id);
      const child = spawn(process.execPath, [SELF, '--vite-child', app.id], {
        cwd: app.root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true,
      });
      children.push(child);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(app.id + ': startup timeout')), 60000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', (code, signal) => {
          clearTimeout(timer);
          state.status = 'stopped';
          if (!stopping) { reject(new Error(app.id + ': exited ' + (code ?? signal))); void shutdown(1); }
          else reject(new Error(app.id + ': startup interrupted'));
        });
        child.on('message', message => {
          if (message?.type === 'ready' && message.id === app.id && message.port === app.port) {
            clearTimeout(timer); state.status = 'ready'; resolve();
          }
        });
      });
    }
    if (!stopping) console.log(JSON.stringify({ event: 'ready', ...status(),
      health: 'http://' + HOST + ':' + SITE_PORT + '/__workspace/health' }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok:false, workspace, error:String(error.message) }));
    await shutdown(1);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  run().catch(error => { console.error(JSON.stringify({ok:false, error:String(error.message)})); if (process.send) process.exit(1); else process.exitCode = 1; });
}
