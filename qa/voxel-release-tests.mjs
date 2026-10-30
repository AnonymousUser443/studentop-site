import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {parseManifest, readArtifact, publishVoxel, sha256, acquireReleaseLock} from '../deploy/apply-voxel-release.mjs';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const ID = '20261030T120000Z-' + COMMIT.slice(0, 10);
const OLD = '20261028T110253Z-e2bc44a0e3';
const link = (target, destination) => fs.symlinkSync(target, destination, process.platform === 'win32' ? 'junction' : 'dir');

function fixture(t) {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'voxel-release-test-')));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  const stage = path.join(temp, 'aiden-voxel-' + ID), publicRoot = path.join(stage, 'public');
  fs.mkdirSync(publicRoot, {recursive: true});
  const sources = {
    'index.html': '<!doctype html><link href="./assets/index-abcdefgh.css"><script src="./assets/index-abcdefgh.js"></script>',
    'assets/index-abcdefgh.js': 'console.log("fixture");', 'assets/index-abcdefgh.css': 'body{color:black}',
    'assets/day-abcdefgh.opus': Buffer.alloc(40000, 1), 'assets/night-abcdefgh.opus': Buffer.alloc(40000, 2),
    'assets/dawn_dusk-abcdefgh.opus': Buffer.alloc(40000, 3),
    'fonts/OFL.txt': 'font license', 'fonts/campus-sans.woff2': 'font sans', 'fonts/campus-serif.woff2': 'font serif',
    'licenses/three-MIT.txt': 'MIT license'
  };
  const manifest = {format: 1, id: ID, commit: COMMIT, files: []};
  for (const [relative, value] of Object.entries(sources)) {
    const bytes = Buffer.from(value), file = path.join(publicRoot, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, bytes);
    manifest.files.push({path: relative, bytes: bytes.length, sha256: sha256(bytes)});
  }
  const encode = () => Buffer.from(JSON.stringify(manifest));
  const save = () => { const bytes = encode(); fs.writeFileSync(path.join(stage, 'manifest.json'), bytes); return sha256(bytes); };
  const hash = save();
  return {temp, stage, publicRoot, sources, manifest, encode, save, hash};
}

function transactionFixture(t) {
  const f = fixture(t), root = path.join(f.temp, 'voxel'), historyRoot = path.join(f.temp, 'history');
  const previous = path.join(root, 'releases', OLD);
  fs.mkdirSync(previous, {recursive: true}); fs.mkdirSync(path.join(root, 'shared-assets')); fs.mkdirSync(historyRoot);
  fs.writeFileSync(path.join(previous, 'index.html'), 'old entry');
  fs.writeFileSync(path.join(root, 'shared-assets', 'old-hash1234.js'), 'old immutable asset');
  link(previous, path.join(root, 'current'));
  const calls = [];
  async function request(host, url, headers = {}) {
    calls.push({host, url, headers});
    if (url === '/version.json') return {status: 200, headers: {}, body: Buffer.from('{"id":"76b1376dbbf99a19cb3a2308"}')};
    if (url === '/__desktop/task-manager/health') return {status: 401, headers: {'cache-control': 'no-store'}, body: Buffer.from('{}')};
    if (url === '/voxel-campus?time=day') return {status: 308, headers: {location: '/voxel-campus/?time=day'}, body: Buffer.alloc(0)};
    if (url.startsWith('/voxel-campus/')) {
      const relative = url.slice('/voxel-campus/'.length) || 'index.html';
      const file = relative.startsWith('assets/') ? path.join(root, 'shared-assets', path.posix.basename(relative)) : path.join(root, 'current', relative);
      if (!fs.existsSync(file)) return {status: 404, headers: {}, body: Buffer.alloc(0)};
      const body = fs.readFileSync(file);
      const type = {'.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.opus': 'audio/ogg'}[path.extname(file)] || 'text/html';
      const responseHeaders = {'content-type': type, 'cache-control': 'no-cache'};
      if (headers.Range) {
        const [, first, last] = headers.Range.match(/^bytes=(\d*)-(\d+)$/);
        const start = first === '' ? body.length - Number(last) : Number(first);
        const end = first === '' ? body.length - 1 : Number(last);
        return {status: 206, headers: {...responseHeaders, 'content-range': `bytes ${start}-${end}/${body.length}`}, body: body.subarray(start, end + 1)};
      }
      return {status: 200, headers: responseHeaders, body};
    }
    return {status: 200, headers: {}, body: Buffer.from('neighbor')};
  }
  // Windows cannot rename over a directory junction. Use a pointer adapter for transaction tests;
  // Linux runs the production atomic symlink replacement unchanged.
  const pointerAdapter = process.platform === 'win32' ? {replacePointer: (r, target) => {
    fs.unlinkSync(path.join(r, 'current')); link(target, path.join(r, 'current'));
  }} : {};
  const options = {artifact: readArtifact(f.stage, f.hash), expectedPreviousTarget: previous, root, historyRoot,
    request, inventory: () => ({pointers: {neighbor: 'same'}, configs: {config: 'same'}, services: {nginx: 'same'}}), ...pointerAdapter};
  return {...f, root, historyRoot, previous, request, calls, options};
}

test('manifest rejects digest mismatch, traversal, duplicates and missing recordings', t => {
  const f = fixture(t);
  assert.throws(() => parseManifest(f.encode(), 'a'.repeat(64)), /SHA-256/);
  const mutate = fn => { const value = structuredClone(f.manifest); fn(value); const bytes = Buffer.from(JSON.stringify(value)); return () => parseManifest(bytes, sha256(bytes)); };
  assert.throws(mutate(m => { m.files[0].path = '../index.html'; }), /public path/);
  assert.throws(mutate(m => { m.files.push(m.files[0]); }), /Duplicate/);
  assert.throws(mutate(m => { m.files = m.files.filter(file => !file.path.startsWith('assets/day-')); }), /recordings/);
  assert.throws(mutate(m => { m.commit = 'a'.repeat(40); }), /does not match commit/);
});

test('upload rejects extra files, empty directories, corrupt bytes and hard links', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.publicRoot, 'private.json'), '{}');
  assert.throws(() => readArtifact(f.stage, f.hash), /Unlisted/); fs.unlinkSync(path.join(f.publicRoot, 'private.json'));
  fs.mkdirSync(path.join(f.publicRoot, 'unused'));
  assert.throws(() => readArtifact(f.stage, f.hash), /Unlisted/); fs.rmdirSync(path.join(f.publicRoot, 'unused'));
  const index = path.join(f.publicRoot, 'index.html');
  fs.writeFileSync(index, 'corrupt'); assert.throws(() => readArtifact(f.stage, f.hash), /checksum/);
  fs.writeFileSync(index, f.sources['index.html']); fs.linkSync(index, path.join(f.temp, 'hardlink'));
  assert.throws(() => readArtifact(f.stage, f.hash), /unlinked ordinary/);
});

test('upload rejects linked directories and unexpected stage members', t => {
  const f = fixture(t), fonts = path.join(f.publicRoot, 'fonts'), moved = path.join(f.temp, 'fonts');
  fs.renameSync(fonts, moved); link(moved, fonts);
  assert.throws(() => readArtifact(f.stage, f.hash), /Linked upload/);
  fs.unlinkSync(fonts); fs.renameSync(moved, fonts);
  fs.writeFileSync(path.join(f.stage, 'unlisted.txt'), 'no');
  assert.throws(() => readArtifact(f.stage, f.hash), /Unlisted upload/);
});

test('successful transaction publishes verified buffers, preserves old assets and checks all six ranges', async t => {
  const f = transactionFixture(t);
  // Changes after verification must never be copied by the privileged transaction.
  fs.writeFileSync(path.join(f.publicRoot, 'assets/index-abcdefgh.js'), 'changed after verification');
  const receipt = await publishVoxel(f.options);
  assert.equal(receipt.ok, true); assert.equal(receipt.previous, f.previous);
  assert.equal(fs.realpathSync(path.join(f.root, 'current')), path.join(f.root, 'releases', ID));
  assert.equal(fs.readFileSync(path.join(f.root, 'current/assets/index-abcdefgh.js'), 'utf8'), f.sources['assets/index-abcdefgh.js']);
  assert.equal(fs.readFileSync(path.join(f.root, 'shared-assets/old-hash1234.js'), 'utf8'), 'old immutable asset');
  assert.equal(f.calls.filter(call => call.headers.Range).length, 6);
  assert.equal(receipt.checkedPublicFiles, f.manifest.files.length);
  assert(fs.existsSync(path.join(f.historyRoot, 'voxel-' + ID, 'receipt.json')));
});

test('changed baseline is rejected before creating a release or history', async t => {
  const f = transactionFixture(t), other = path.join(f.root, 'releases', '20261029T110253Z-e2bc44a0e3');
  fs.mkdirSync(other);
  await assert.rejects(publishVoxel({...f.options, expectedPreviousTarget: other}), /baseline changed/);
  assert.equal(fs.existsSync(path.join(f.root, 'releases', ID)), false);
  assert.deepEqual(fs.readdirSync(f.historyRoot), []);
});

test('immutable shared asset conflict keeps old pointer and existing bytes', async t => {
  const f = transactionFixture(t), shared = path.join(f.root, 'shared-assets/index-abcdefgh.js');
  fs.writeFileSync(shared, 'different bytes');
  await assert.rejects(publishVoxel(f.options), /Immutable asset conflict/);
  assert.equal(fs.realpathSync(path.join(f.root, 'current')), f.previous);
  assert.equal(fs.readFileSync(shared, 'utf8'), 'different bytes');
});

test('public byte mismatch rolls back only voxel and keeps newly issued assets readable', async t => {
  const f = transactionFixture(t);
  const request = async (...args) => { const response = await f.request(...args); return args[1] === '/voxel-campus/index.html' ? {...response, body: Buffer.from('wrong deployment')} : response; };
  await assert.rejects(publishVoxel({...f.options, request}), /previous voxel release restored/);
  assert.equal(fs.realpathSync(path.join(f.root, 'current')), f.previous);
  assert(fs.existsSync(path.join(f.root, 'shared-assets/index-abcdefgh.js')));
  const failure = JSON.parse(fs.readFileSync(path.join(f.historyRoot, 'voxel-' + ID, 'failure.json')));
  assert.equal(failure.rolledBack, true); assert.equal(failure.activated, true);
});

test('incorrect Range response rolls back even when full files are correct', async t => {
  const f = transactionFixture(t);
  const request = async (...args) => { const response = await f.request(...args); return args[2]?.Range ? {...response, status: 200} : response; };
  await assert.rejects(publishVoxel({...f.options, request}), /range_first.*previous voxel release restored/);
  assert.equal(fs.realpathSync(path.join(f.root, 'current')), f.previous);
});

test('unrelated state changes before activation stop publication', async t => {
  const f = transactionFixture(t); let snapshots = 0;
  const inventory = () => ({neighbor: ++snapshots >= 4 ? 'changed' : 'same'});
  await assert.rejects(publishVoxel({...f.options, inventory}), /Unrelated production state changed/);
  assert.equal(fs.realpathSync(path.join(f.root, 'current')), f.previous);
});

test('Linux flock remains held by Node until explicit close', {skip: process.platform !== 'linux'}, t => {
  const f = fixture(t), file = path.join(f.temp, 'release.lock');
  const unlock = acquireReleaseLock(file);
  try { assert.equal(spawnSync('flock', ['--nonblock', file, 'true']).status, 1); }
  finally { unlock(); }
  assert.equal(spawnSync('flock', ['--nonblock', file, 'true']).status, 0);
});

test('new public files remain nginx-readable under a restrictive umask', {skip: process.platform === 'win32'}, async t => {
  const f = transactionFixture(t), oldMask = process.umask(0o077);
  try {
    await publishVoxel(f.options);
    const current = path.join(f.root, 'current');
    assert.equal(fs.statSync(current).mode & 0o777, 0o755);
    assert.equal(fs.statSync(path.join(current, 'assets')).mode & 0o777, 0o755);
    assert.equal(fs.statSync(path.join(current, 'index.html')).mode & 0o777, 0o644);
    assert.equal(fs.statSync(path.join(f.root, 'shared-assets/index-abcdefgh.js')).mode & 0o777, 0o644);
  } finally { process.umask(oldMask); }
});
