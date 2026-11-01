// Read-only public HTTPS verification, using the exact local release bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || path.join(root, 'qa/moyuan-release-20261101/public.json'));
if (fs.existsSync(out)) throw Error('Use a new report filename; historical evidence is retained.');
const origin = 'https://studentop.cn:14355';
const app = path.join(root, 'apps/liyun-moyuan/dist');
const home = path.join(root, 'dist-site');
const version = JSON.parse(fs.readFileSync(path.join(home, 'version.json'), 'utf8')).id;
const report = {ok:false, checkedAt:new Date().toISOString(), commit:execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'}).trim(), origin, homeVersion:version, checks:[]};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function read(url) {
  const response = await fetch(url, {redirect:'manual', cache:'no-store', signal:AbortSignal.timeout(30000)});
  return {response, bytes:Buffer.from(await response.arrayBuffer())};
}
async function exact(url, file) {
  const {response, bytes} = await read(url), expected = fs.readFileSync(file);
  const check = {name:'public-exact-bytes', url, status:response.status, contentType:response.headers.get('content-type'), bytes:bytes.length, sha256:sha(bytes), expectedSHA256:sha(expected)};
  check.pass = response.status === 200 && bytes.equals(expected);
  report.checks.push(check); if (!check.pass) throw Error('Public bytes differ: ' + url);
}
try {
  const assets = fs.readdirSync(path.join(app, 'assets')).map(name => 'assets/' + name);
  const files = ['index.html', 'favicon.svg', ...assets, 'fonts/OFL-NotoSansSC.txt', 'fonts/OFL-NotoSerifSC.txt'];
  if (files.length !== 8) throw Error('Expected the reviewed eight-file app bundle.');
  for (const name of files) await exact(origin + '/liyun-moyuan/' + name, path.join(app, name));
  await exact(origin + '/liyun-moyuan/', path.join(app, 'index.html'));
  await exact(origin + '/', path.join(home, 'index.html'));
  await exact(origin + '/projects/', path.join(home, 'projects/index.html'));
  for (const name of ['apps', 'content', 'core', 'icons']) {
    const relative = 'assets/releases/' + version + '/js/' + name + '.js';
    await exact(origin + '/' + relative, path.join(home, relative));
  }
  const liveVersion = await read(origin + '/version.json');
  const versionCheck = {name:'home-version', status:liveVersion.response.status, pass:liveVersion.response.status === 200 && JSON.parse(liveVersion.bytes.toString('utf8')).id === version};
  report.checks.push(versionCheck); if (!versionCheck.pass) throw Error('Home version differs.');
  const redirect = await read(origin + '/liyun-moyuan?from=qa');
  const redirectCheck = {name:'trailing-slash-preserves-query', status:redirect.response.status, location:redirect.response.headers.get('location'), pass:false};
  redirectCheck.pass = redirectCheck.status === 308 && new URL(redirectCheck.location, origin).pathname === '/liyun-moyuan/' && new URL(redirectCheck.location, origin).search === '?from=qa';
  report.checks.push(redirectCheck); if (!redirectCheck.pass) throw Error('Wrong canonical redirect.');
  for (const url of [origin + '/liyun-moyuan/.env', origin + '/liyun-moyuan/fonts/coverage-final3.json']) {
    const {response} = await read(url), check = {name:'development-files-not-public', url, status:response.status, pass:response.status === 404};
    report.checks.push(check); if (!check.pass) throw Error('Unexpected public development path.');
  }
  for (const url of [origin + '/voxel-campus/', origin + '/campus-entry/', 'https://liyun.studentop.cn:14355/', 'https://frost.studentop.cn:14355/', 'https://genshin.studentop.cn:14355/']) {
    const {response} = await read(url), check = {name:'neighbor-healthy', url, status:response.status, pass:response.status === 200};
    report.checks.push(check); if (!check.pass) throw Error('Neighbor unavailable: ' + url);
  }
  report.ok = true;
} catch (error) {
  report.error = String(error.stack || error); process.exitCode = 1;
} finally {
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
  console.log(JSON.stringify({ok:report.ok, checks:report.checks.length, passed:report.checks.filter(c=>c.pass).length, report:path.relative(root, out), error:report.error}));
}
