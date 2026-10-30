#!/usr/bin/env node
/** Owner-authorized static voxel release. No configuration, service or private-data writes. */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import tls from 'node:tls';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = '/opt/projects/voxel-campus';
const HISTORY = '/var/lib/aiden-release-history';
const LOCK = '/run/lock/aiden-desktop-release.lock';
const ID = /^\d{8}T\d{6}Z-[a-f0-9]{10}$/;
const HASH = /^[a-f0-9]{64}$/;
const ASSET = /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|opus)$/;
const FIXED = new Set(['index.html', 'fonts/OFL.txt', 'fonts/campus-sans.woff2', 'fonts/campus-serif.woff2', 'licenses/three-MIT.txt']);
const MAX_BYTES = 64 * 1024 * 1024;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw Error(message); };
const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

function directory(dir) {
  const info = fs.lstatSync(dir);
  assert(info.isDirectory() && !info.isSymbolicLink(), 'Expected ordinary directory: ' + dir);
  assert(fs.realpathSync(dir) === path.resolve(dir), 'Directory has linked ancestor: ' + dir);
}

function regular(file) {
  const before = fs.lstatSync(file);
  assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1, 'Expected unlinked ordinary file: ' + file);
  assert(before.size <= MAX_BYTES, 'Input exceeds size limit');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd);
    assert(opened.isFile() && opened.nlink === 1 && opened.ino === before.ino && opened.dev === before.dev, 'Input changed while opening');
    const bytes = fs.readFileSync(fd);
    assert(bytes.length <= MAX_BYTES, 'Input exceeds size limit');
    return bytes;
  } finally { fs.closeSync(fd); }
}

export function parseManifest(bytes, expectedSHA) {
  assert(HASH.test(expectedSHA || '') && sha256(bytes) === expectedSHA, 'Manifest SHA-256 mismatch');
  assert(bytes.length < 1024 * 1024, 'Manifest too large');
  const manifest = JSON.parse(bytes);
  assert(manifest && Object.keys(manifest).sort().join(',') === 'commit,files,format,id', 'Unexpected manifest fields');
  assert(manifest.format === 1 && ID.test(manifest.id) && /^[a-f0-9]{40}$/.test(manifest.commit), 'Invalid manifest identity');
  assert(manifest.id.endsWith('-' + manifest.commit.slice(0, 10)), 'Release id does not match commit');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 1000, 'Invalid file list');
  const seen = new Set(); let total = 0;
  for (const file of manifest.files) {
    assert(file && Object.keys(file).sort().join(',') === 'bytes,path,sha256', 'Unexpected file fields');
    assert(typeof file.path === 'string' && (FIXED.has(file.path) || ASSET.test(file.path)), 'Unapproved public path');
    assert(!file.path.split('/').some(part => part.startsWith('.')) && !seen.has(file.path), 'Duplicate or hidden path');
    assert(Number.isSafeInteger(file.bytes) && file.bytes > 0 && HASH.test(file.sha256), 'Invalid file metadata');
    total += file.bytes; assert(total <= MAX_BYTES, 'Release exceeds size limit'); seen.add(file.path);
  }
  for (const file of FIXED) assert(seen.has(file), 'Missing required public file: ' + file);
  const audio = manifest.files.filter(file => file.path.endsWith('.opus'));
  assert(audio.length === 3 && ['dawn_dusk', 'day', 'night'].every(name => audio.some(file => file.path.startsWith('assets/' + name + '-'))), 'Expected the three original recordings');
  return manifest;
}

/** Read every input once into verified buffers; later publication never rereads mutable upload files. */
export function readArtifact(stage, expectedSHA, {production = false} = {}) {
  directory(stage);
  if (production) {
    assert(/^\/var\/tmp\/aiden-voxel-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(stage), 'Invalid upload directory');
    assert((fs.statSync(stage).mode & 0o777) === 0o700, 'Upload directory must be 0700');
  }
  const top = fs.readdirSync(stage);
  assert(top.every(name => ['manifest.json', 'public', 'apply-voxel-release.mjs'].includes(name)), 'Unlisted upload member');
  if (top.includes('apply-voxel-release.mjs')) regular(path.join(stage, 'apply-voxel-release.mjs'));
  const manifestBytes = regular(path.join(stage, 'manifest.json'));
  const manifest = parseManifest(manifestBytes, expectedSHA);
  assert(path.basename(stage) === 'aiden-voxel-' + manifest.id, 'Stage and release id differ');
  const publicRoot = path.join(stage, 'public'); directory(publicRoot);
  const permittedDirs = new Set(['']);
  for (const file of manifest.files) permittedDirs.add(path.posix.dirname(file.path) === '.' ? '' : path.posix.dirname(file.path));
  const listed = new Map(manifest.files.map(file => [file.path, file]));
  const buffers = new Map();
  function walk(dir, prefix = '') {
    directory(dir);
    for (const name of fs.readdirSync(dir)) {
      const relative = prefix + name, absolute = path.join(dir, name), stat = fs.lstatSync(absolute);
      assert(!stat.isSymbolicLink(), 'Linked upload member');
      if (stat.isDirectory()) { assert(permittedDirs.has(relative), 'Unlisted public directory'); walk(absolute, relative + '/'); }
      else {
        const entry = listed.get(relative); assert(entry, 'Unlisted public file');
        const bytes = regular(absolute);
        assert(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, 'Artifact checksum mismatch: ' + relative);
        buffers.set(relative, bytes);
      }
    }
  }
  walk(publicRoot);
  assert(buffers.size === listed.size, 'Missing public file');
  const html = buffers.get('index.html').toString('utf8');
  assert(/<!doctype html>/i.test(html) && html.includes('./assets/'), 'Wrong application production base');
  const refs = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map(match => match[1]);
  assert(refs.length >= 2 && refs.every(ref => ref.startsWith('./assets/') && listed.has(ref.slice(2))), 'Invalid entry asset references');
  return {manifest, manifestBytes, manifestSHA256: expectedSHA, buffers};
}

function currentTarget(root) {
  assert(fs.lstatSync(path.join(root, 'current')).isSymbolicLink(), 'Current must be a symlink');
  return fs.realpathSync(path.join(root, 'current'));
}

function switchCurrent(root, target, id, kind) {
  directory(target);
  const temporary = path.join(root, '.' + kind + '-' + id);
  assert(!exists(temporary), 'Temporary release pointer already exists');
  fs.symlinkSync(target, temporary, 'dir');
  try { fs.renameSync(temporary, path.join(root, 'current')); }
  catch (error) { fs.unlinkSync(temporary); throw error; }
}

export function localTLS(host, url, headers = {}, signal) {
  return new Promise((resolve, reject) => {
    const request = https.get({hostname: '127.0.0.1', port: 443, servername: host,
      checkServerIdentity: (_, cert) => tls.checkServerIdentity(host, cert), path: url, signal,
      headers: {Host: host + ':14355', 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache', ...headers}}, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > MAX_BYTES) request.destroy(Error('HTTP body too large')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => { clearTimeout(deadline); resolve({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks)}); });
    });
    const deadline = setTimeout(() => request.destroy(Error('TLS check deadline exceeded')), 20000);
    request.on('error', error => { clearTimeout(deadline); reject(error); });
  });
}

function invariantState() {
  const roots = ['/opt/win11-home', '/opt/projects/liyun', '/opt/projects/desktop-auth', '/opt/projects/liyun-api',
    '/opt/projects/campus-entry', '/opt/projects/frost', '/opt/projects/genshin', '/opt/rpi-task-manager'];
  const configs = ['/etc/nginx/snippets/win11-home-app.conf', '/etc/nginx/snippets/win11-home-headers.conf',
    '/etc/nginx/snippets/win11-home-projects.conf', '/etc/nginx/sites-available/projects',
    '/etc/systemd/system/desktop-auth.service', '/etc/systemd/system/liyun-account.service', '/etc/systemd/system/rpi-task-manager.service'];
  const services = ['nginx', 'desktop-auth', 'liyun-account', 'rpi-task-manager', 'frpc', 'frost-atlas'];
  return {
    pointers: Object.fromEntries(roots.map(root => [root, currentTarget(root)])),
    configs: Object.fromEntries(configs.map(file => [file, sha256(regular(file))])),
    services: Object.fromEntries(services.map(name => {
      const result = execFileSync('systemctl', ['show', name, '-p', 'ActiveState', '-p', 'MainPID', '-p', 'ExecMainStartTimestampMonotonic'], {encoding: 'utf8'}).trim();
      assert(result.split('\n').includes('ActiveState=active'), 'Existing service is not active: ' + name);
      return [name, result];
    }))
  };
}

/** Dependency injection is for local transaction tests; the CLI always uses fixed production paths. */
export async function publishVoxel({artifact, expectedPreviousTarget, root = ROOT, historyRoot = HISTORY,
  request = localTLS, inventory = invariantState, replacePointer = switchCurrent, signal}) {
  const {manifest: manifest, buffers} = artifact;
  directory(root); directory(path.join(root, 'releases')); directory(path.join(root, 'shared-assets')); directory(historyRoot);
  const previous = path.resolve(expectedPreviousTarget || '');
  assert(path.dirname(previous) === path.join(root, 'releases') && ID.test(path.basename(previous)), 'Invalid expected previous target');
  directory(previous);
  const baseline = inventory();
  const unchanged = () => {
    assert(currentTarget(root) === previous, 'Release baseline changed');
    assert(JSON.stringify(inventory()) === JSON.stringify(baseline), 'Unrelated production state changed');
    signal?.throwIfAborted();
  };
  unchanged();
  const release = path.join(root, 'releases', manifest.id), history = path.join(historyRoot, 'voxel-' + manifest.id);
  assert(!exists(release) && !exists(history), 'Release or history already exists');
  const home = await request('studentop.cn', '/version.json', {}, signal);
  assert(home.status === 200 && /^[a-f0-9]{24}$/.test(JSON.parse(home.body).id), 'Current home version unavailable');
  const checks = []; let activated = false, rolledBack = false;
  const check = (name, pass) => { checks.push({name, pass: !!pass}); assert(pass, name); };
  unchanged();
  fs.mkdirSync(history, {mode: 0o700});
  fs.writeFileSync(path.join(history, 'baseline.json'), JSON.stringify({previous, baseline, manifestSHA256: artifact.manifestSHA256}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  fs.writeFileSync(path.join(history, 'manifest.json'), artifact.manifestBytes, {flag: 'wx', mode: 0o600});
  try {
    fs.mkdirSync(release, {mode: 0o755});
    fs.chmodSync(release, 0o755);
    for (const file of manifest.files) {
      signal?.throwIfAborted();
      const destination = path.join(release, file.path);
      fs.mkdirSync(path.dirname(destination), {recursive: true, mode: 0o755}); directory(path.dirname(destination));
      fs.chmodSync(path.dirname(destination), 0o755);
      fs.writeFileSync(destination, buffers.get(file.path), {flag: 'wx', mode: 0o644});
      fs.chmodSync(destination, 0o644);
      if (file.path.startsWith('assets/')) {
        const shared = path.join(root, 'shared-assets', path.posix.basename(file.path));
        if (exists(shared)) assert(sha256(regular(shared)) === file.sha256, 'Immutable asset conflict: ' + file.path);
        else { fs.writeFileSync(shared, buffers.get(file.path), {flag: 'wx', mode: 0o644}); fs.chmodSync(shared, 0o644); }
      }
    }
    unchanged();
    replacePointer(root, release, manifest.id, 'current'); activated = true;
    for (const file of manifest.files) {
      const response = await request('studentop.cn', '/voxel-campus/' + file.path, {}, signal);
      check('public_bytes:' + file.path, response.status === 200 && response.body.length === file.bytes && sha256(response.body) === file.sha256);
      if (file.path.endsWith('.js')) check('mime:' + file.path, /javascript/.test(response.headers['content-type'] || ''));
      if (file.path.endsWith('.css')) check('mime:' + file.path, /text\/css/.test(response.headers['content-type'] || ''));
      if (file.path.endsWith('.woff2')) check('mime:' + file.path, /font\/woff2/.test(response.headers['content-type'] || ''));
      if (file.path === 'index.html') check('html_revalidates', /no-cache|no-store|max-age=0/.test(response.headers['cache-control'] || ''));
      if (file.path.endsWith('.opus')) {
        check('mime:' + file.path, /^audio\/ogg(?:;|$)/.test(response.headers['content-type'] || ''));
        const length = Math.min(32768, file.bytes);
        for (const [kind, range, start] of [['first', 'bytes=0-' + (length - 1), 0], ['tail', 'bytes=-' + length, file.bytes - length]]) {
          const partial = await request('studentop.cn', '/voxel-campus/' + file.path, {Range: range}, signal);
          check('range_' + kind + ':' + file.path, partial.status === 206 && /^audio\/ogg(?:;|$)/.test(partial.headers['content-type'] || '') &&
            partial.headers['content-range'] === `bytes ${start}-${start + length - 1}/${file.bytes}` && partial.body.equals(buffers.get(file.path).subarray(start, start + length)));
        }
      }
    }
    const entry = await request('studentop.cn', '/voxel-campus/', {}, signal);
    check('directory_entry_matches', entry.status === 200 && entry.body.equals(buffers.get('index.html')));
    const redirect = await request('studentop.cn', '/voxel-campus?time=day', {}, signal);
    check('slash_redirect', redirect.status === 308 && redirect.headers.location === '/voxel-campus/?time=day');
    check('missing_file_404', (await request('studentop.cn', '/voxel-campus/not-a-real-file.js', {}, signal)).status === 404);
    const denied = await request('studentop.cn', '/__desktop/task-manager/health', {}, signal);
    check('monitor_still_requires_session', denied.status === 401 && /no-store/.test(denied.headers['cache-control'] || ''));
    const homeAfter = await request('studentop.cn', '/version.json', {}, signal);
    check('home_version_unchanged', homeAfter.status === 200 && homeAfter.body.equals(home.body));
    for (const [host, url] of [['studentop.cn', '/'], ['studentop.cn', '/task-manager/'], ['studentop.cn', '/campus-entry/'],
      ['liyun.studentop.cn', '/'], ['liyun.studentop.cn', '/api/health'], ['frost.studentop.cn', '/'], ['genshin.studentop.cn', '/']]) {
      check('neighbor:' + host + url, (await request(host, url, {}, signal)).status === 200);
    }
    check('unrelated_state_unchanged', JSON.stringify(inventory()) === JSON.stringify(baseline));
    check('voxel_pointer_matches', currentTarget(root) === release);
    signal?.throwIfAborted();
    const receipt = {ok: true, id: manifest.id, commit: manifest.commit, manifestSHA256: artifact.manifestSHA256,
      previous, current: release, homeVersion: JSON.parse(home.body).id, checkedPublicFiles: manifest.files.length,
      checks, configurationChanged: false, servicesRestarted: false, privateConfigurationRead: false,
      backup: history, completedAt: new Date().toISOString()};
    fs.writeFileSync(path.join(history, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    return receipt;
  } catch (error) {
    let rollbackError;
    if (activated) {
      try {
        assert(currentTarget(root) === release, 'Current changed outside transaction; refusing to overwrite it');
        replacePointer(root, previous, manifest.id, 'rollback');
        rolledBack = currentTarget(root) === previous;
        assert(rolledBack, 'Rollback pointer mismatch');
      } catch (failure) { rollbackError = failure.message; }
    }
    fs.writeFileSync(path.join(history, 'failure.json'), JSON.stringify({ok: false, id: manifest.id, previous,
      activated, rolledBack, error: error.message, rollbackError, checks, completedAt: new Date().toISOString()}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    throw Error(error.message + (activated ? rolledBack ? '; previous voxel release restored' : '; rollback failed: ' + rollbackError : '; current was not changed'));
  }
}

export function acquireReleaseLock(file = LOCK) {
  const lock = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o600);
  try {
    assert(fs.fstatSync(lock).isFile(), 'Invalid shared lock');
    // flock operates on the inherited open file description, retained by this Node process until close.
    const locked = spawnSync('flock', ['--nonblock', '3'], {stdio: ['ignore', 'pipe', 'pipe', lock]});
    assert(!locked.error && locked.status === 0, 'Another desktop release is active, or shared flock unavailable');
    return () => fs.closeSync(lock);
  } catch (error) { fs.closeSync(lock); throw error; }
}

async function main() {
  const [stage, expectedManifestSHA, expectedPreviousTarget, ...extra] = process.argv.slice(2);
  assert(process.platform === 'linux' && process.getuid?.() === 0 && extra.length === 0 && expectedPreviousTarget, 'Usage (root): node apply-voxel-release.mjs <stage> <manifestSHA256> <previousTarget>');
  const unlock = acquireReleaseLock();
  const controller = new AbortController(), interrupt = () => controller.abort(Error('Release interrupted'));
  try {
    process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    const artifact = readArtifact(stage, expectedManifestSHA, {production: true});
    const receipt = await publishVoxel({artifact, expectedPreviousTarget, signal: controller.signal});
    console.log(JSON.stringify(receipt));
  } finally {
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); unlock();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ok: false, error: error.message})); process.exitCode = 1; });
}
