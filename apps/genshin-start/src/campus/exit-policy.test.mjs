import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../core/exit.ts', import.meta.url)), 'utf8');
function load({ dev = false, host = 'example.org', override } = {}) {
  const navigations = [];
  const listeners = {};
  const window = { __EXIT_URL__: override, location: { hostname: host, assign: value => navigations.push(value) }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const exports = {};
  const js = ts.transpileModule(source.replaceAll('import.meta.env.DEV', String(dev)), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(js, { exports, window, URL, console: { info() {} } });
  return { ...exports, navigations, listeners };
}
const production = 'https://liyun.studentop.cn:14355/';
const local = 'http://127.0.0.1:5174/';
assert.equal(load().exitUrl(), production, 'production default must remain unchanged');
assert.equal(load({ dev: true, host: '127.0.0.1' }).exitUrl(), local, 'DEV uses 5174');
assert.equal(load({ host: 'localhost' }).exitUrl(), local, 'local build preview is fail-closed');
assert.equal(load({ dev: true, host: '127.0.0.1', override: production }).exitUrl(), local, 'local test cannot leave loopback');
assert.equal(load({ dev: true, host: '127.0.0.1', override: 'http://localhost:5174/test' }).exitUrl(), 'http://localhost:5174/test');
assert.equal(load({ host: '[::1]', override: 'http://[::1]:5174/' }).exitUrl(), 'http://[::1]:5174/');
assert.equal(load({ override: 'https://example.org/explore?q=1#part' }).exitUrl(), 'https://example.org/explore?q=1#part');
for (const override of ['javascript:alert(1)', 'data:text/html,unsafe', '//example.org/path', '/relative', 'ftp://example.org/', 'https://user:pass@example.org', 'http://', '<img src=x>', 123, null]) {
  assert.equal(load({ override }).exitUrl(), production, 'invalid override must use safe default: ' + String(override));
}
const navigation = load({ dev: true, host: '127.0.0.1' });
navigation.goExit('first'); navigation.goExit('duplicate');
assert.deepEqual(navigation.navigations, [local], 'duplicate exit should navigate once');
navigation.listeners.pageshow(); navigation.goExit('back-forward-return');
assert.deepEqual(navigation.navigations, [local, local], 'BFCache return resets the exit guard');
console.log('PASS: production default, DEV/local restrictions, override validation, duplicate navigation, BFCache return');
