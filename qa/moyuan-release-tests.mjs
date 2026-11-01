// Execute the exact validators shipped in the remote publisher with temporary
// synthetic payloads. No SSH, production data, services or real releases.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = fs.readFileSync(path.join(root, 'deploy/apply-moyuan-release.sh'), 'utf8');
const extract = name => {
  const match = script.match(new RegExp("<<'" + name + "'\\r?\\n([\\s\\S]*?)\\r?\\n" + name + '(?:\\r?\\n|$)'));
  assert.ok(match, 'Shipped validator exists: ' + name);
  return match[1];
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = 'b'.repeat(64);
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moyuan-release-test-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const content = new Map([
    ['index.html', '<title>Test</title><script src="/liyun-moyuan/assets/main-12345678.js"></script>'],
    ['favicon.svg', '<svg/>'],
    ['assets/main-12345678.js', 'console.log("synthetic");'],
    ['assets/style-12345678.css', 'body{color:tan}'],
    ['fonts/OFL-NotoSansSC.txt', 'Synthetic test license'],
    ['fonts/OFL-NotoSerifSC.txt', 'Synthetic test license']
  ]);
  for (const [name, text] of content) {
    const file = path.join(dir, 'payload', name);
    fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, text);
  }
  const nginx = '# synthetic routing';
  fs.writeFileSync(path.join(dir, 'nginx-projects.conf'), nginx);
  const manifest = {format:1, id:'moyuan-20261101T000000Z-aaaaaaaaaa', commit:'a'.repeat(40), nginxBeforeSHA256:baseline, nginxConfigSHA256:sha(nginx), files:[...content].map(([name, text]) => ({path:name, bytes:Buffer.byteLength(text), sha256:sha(text)}))};
  const save = () => fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify(manifest));
  save();
  return {dir, manifest, save};
}
function run(code, args) {
  return spawnSync(process.execPath, ['-', ...args], {input:code, encoding:'utf8', timeout:10000});
}
const verify = (f, hash = baseline) => run(extract('VERIFY'), [f.dir, hash]);

test('valid release timestamp, commit, paths and bytes pass the shipped validator', t => {
  const f = fixture(t), result = verify(f);
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).verified, true);
});
test('tampered payload and changed nginx baseline are rejected', t => {
  const f = fixture(t);
  assert.notEqual(verify(f, 'c'.repeat(64)).status, 0);
  fs.appendFileSync(path.join(f.dir, 'payload/assets/main-12345678.js'), 'tamper');
  assert.notEqual(verify(f).status, 0);
});
test('a release identity cannot claim a different commit', t => {
  const f = fixture(t); f.manifest.commit = 'd'.repeat(40); f.save();
  assert.notEqual(verify(f).status, 0);
});
test('traversal entries and unlisted files are rejected', t => {
  const f = fixture(t); f.manifest.files[1].path = 'assets/../private.txt'; f.save();
  assert.notEqual(verify(f).status, 0);
  f.manifest.files[1].path = 'favicon.svg'; f.save();
  fs.writeFileSync(path.join(f.dir, 'payload/private.txt'), 'synthetic');
  assert.notEqual(verify(f).status, 0);
});
test('development HTML cannot masquerade as a production bundle', t => {
  const f = fixture(t), text = '<script src="/src/main.js"></script>';
  fs.writeFileSync(path.join(f.dir, 'payload/index.html'), text);
  Object.assign(f.manifest.files[0], {bytes:Buffer.byteLength(text), sha256:sha(text)}); f.save();
  assert.notEqual(verify(f).status, 0);
});
test('publishing retains old immutable URLs and accepts identical bytes', t => {
  const f = fixture(t), shared = path.join(f.dir, 'shared'); fs.mkdirSync(shared);
  fs.writeFileSync(path.join(shared, 'old-87654321.js'), 'old tab');
  const args = [path.join(f.dir, 'release.json'), path.join(f.dir, 'payload'), shared];
  const first = run(extract('ASSETS'), args), again = run(extract('ASSETS'), args);
  assert.equal(first.status, 0, first.stderr); assert.equal(again.status, 0, again.stderr);
  assert.equal(fs.readFileSync(path.join(shared, 'old-87654321.js'), 'utf8'), 'old tab');
});
test('conflicting immutable bytes are never overwritten', t => {
  const f = fixture(t), shared = path.join(f.dir, 'shared'); fs.mkdirSync(shared);
  const file = path.join(shared, 'main-12345678.js'); fs.writeFileSync(file, 'existing');
  const result = run(extract('ASSETS'), [path.join(f.dir, 'release.json'), path.join(f.dir, 'payload'), shared]);
  assert.notEqual(result.status, 0); assert.equal(fs.readFileSync(file, 'utf8'), 'existing');
});
