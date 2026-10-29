/* Offline integration of the actual desktop registry, content, icons and URL resolver.
   All navigation is stubbed: no browser, server, production request or auth data. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PRODUCTION = 'https://studentop.cn:14355/voxel-campus/';
const LOCAL = 'http://127.0.0.1:5180/';
const jsRoot = path.join(__dirname, '../site/assets/js');
function desktop(hostname = '127.0.0.1') {
  const opened = [], stored = new Map();
  const window = {
    location: { hostname, href: hostname === 'studentop.cn' ? 'https://studentop.cn:14355/' : 'http://' + hostname + ':8899/' },
    document: { readyState: 'loading', addEventListener() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {},
    open: (...args) => { opened.push(args); return null; },
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    URL, console, setTimeout, clearTimeout
  };
  window.window = window;
  const context = vm.createContext(window);
  const load = name => vm.runInContext(fs.readFileSync(path.join(jsRoot, name + '.js'), 'utf8'), context, { filename: name + '.js' });
  for (const name of ['content', 'icons', 'core', 'apps-about', 'apps-system', 'apps', 'wm']) load(name);
  return { window, SITE: window.SITE, Win: window.Win, WM: window.WM, ICONS: window.ICONS, opened, load };
}

test('voxel shortcut uses the exact public id, title, label and production URL', () => {
  const { Win } = desktop();
  const app = Win.apps['voxel-campus']; assert.ok(app, 'voxel-campus is registered');
  assert.equal(app.id, 'voxel-campus'); assert.equal(app.title, '体素校园'); assert.equal(app.desktopLabel, '体素校园');
  assert.equal(app.icon, 'voxel-campus'); assert.equal(app.external, PRODUCTION); assert.match(app.keywords, /voxel/); assert.match(app.keywords, /体素/);
  assert.equal(new URL(app.external).pathname, '/voxel-campus/');
});
test('desktop, Start and project entry include voxel exactly once while both existing openings remain', () => {
  const { SITE, Win } = desktop();
  for (const id of ['voxel-campus', 'genshin-start', 'genshin-original']) {
    for (const list of [SITE.desktop, SITE.startPinned]) assert.equal(list.filter(item => item === id).length, 1, id + ' is listed once');
    assert.equal(Win.appList().filter(app => app.id === id).length, 1);
    assert.equal(SITE.projects.filter(item => item.id === id).length, 1);
  }
  const project = SITE.projects.find(item => item.id === 'voxel-campus'); assert.equal(project.title, '体素校园'); assert.equal(project.link, PRODUCTION); assert.equal(project.icon, 'voxel-campus');
  assert.equal(Win.apps['genshin-start'].external, 'https://studentop.cn:14355/campus-entry/');
  assert.equal(Win.apps['genshin-original'].external, 'https://genshin.studentop.cn:14355/');
  for (const id of ['voxel-campus','genshin-start','genshin-original']) assert.equal(Win.apps[id].external,SITE.projects.find(item=>item.id===id).link);
  assert.equal(SITE.taskbarPinned.includes('voxel-campus'), false);
});
test('only exact localhost and 127.0.0.1 map voxel to 5180; other hosts stay production', () => {
  const { Win } = desktop();
  for (const host of ['localhost', '127.0.0.1']) assert.equal(Win.resolveProjectUrl('voxel-campus', PRODUCTION, host), LOCAL);
  for (const host of ['studentop.cn', 'www.studentop.cn', 'localhost.evil', '127.0.0.1.evil', '127.0.0.2', '0.0.0.0', '[::1]', '192.168.0.10', 'localhost.', 'LOCALHOST', '']) assert.equal(Win.resolveProjectUrl('voxel-campus', PRODUCTION, host), PRODUCTION, host);
  assert.equal(Win.resolveProjectUrl('voxel-campus', PRODUCTION), LOCAL);
  assert.equal(desktop('studentop.cn').Win.resolveProjectUrl('voxel-campus', PRODUCTION), PRODUCTION);
});
test('existing local routes and frost production-only behavior stay unchanged', () => {
  const { Win } = desktop();
  for (const host of ['localhost', '127.0.0.1']) {
    assert.equal(Win.resolveProjectUrl('liyun-explorer', 'https://liyun.studentop.cn:14355/', host), 'http://127.0.0.1:5174/');
    assert.equal(Win.resolveProjectUrl('genshin-start', 'https://genshin.studentop.cn:14355/', host), 'http://127.0.0.1:8081/');
    assert.equal(Win.resolveProjectUrl('genshin-original', 'https://genshin.studentop.cn:14355/legacy.html', host), 'http://127.0.0.1:8081/legacy.html');
    assert.equal(Win.resolveProjectUrl('frost-atlas', 'https://frost.studentop.cn:14355/', host), 'https://frost.studentop.cn:14355/');
  }
});
test('all three opening shortcuts and project hrefs share the frozen local and production routes', () => {
  const routes = [
    ['voxel-campus', PRODUCTION, LOCAL],
    ['genshin-start', 'https://studentop.cn:14355/campus-entry/', 'http://127.0.0.1:8081/'],
    ['genshin-original', 'https://genshin.studentop.cn:14355/', 'http://127.0.0.1:8081/legacy.html']
  ];
  for (const host of ['localhost', '127.0.0.1', 'studentop.cn']) {
    const { SITE, Win, WM, opened } = desktop(host);
    for (const [id, production, local] of routes) {
      const expected = host === 'studentop.cn' ? production : local;
      assert.equal(Win.apps[id].external, production);
      assert.equal(SITE.projects.find(item => item.id === id).link, production);
      assert.equal(Win.resolveProjectUrl(id, SITE.projects.find(item => item.id === id).link), expected);
      const before = opened.length;
      WM.launch(id);
      assert.equal(opened.length, before + 1);
      assert.deepEqual(opened[before], [expected, '_blank', 'noopener,noreferrer']);
    }
  }
});
test('the voxel icon is a distinct self-contained decorative SVG, not a fallback or external image', () => {
  const { ICONS } = desktop(); assert.ok(ICONS.appNames.includes('voxel-campus'));
  const icon = ICONS.app('voxel-campus'); assert.match(icon, /viewBox="0 0 48 48"/); assert.match(icon, /aria-hidden="true"/); assert.match(icon, /<polygon/);
  for (const other of ['genshin', 'genshin-original', 'notepad', 'liyun']) assert.notEqual(icon, ICONS.app(other));
  assert.doesNotMatch(icon, /<script|<foreignObject|<image|\b(?:href|src|on\w+)\s*=/i);
  const stack = [];
  for (const token of icon.match(/<[^>]+>/g)) {
    const tag = token.match(/^<\/?([a-z][\w:-]*)/i)[1];
    if (token.startsWith('</')) assert.equal(stack.pop(), tag);
    else if (!token.endsWith('/>')) stack.push(tag);
  }
  assert.equal(stack.length, 0);
});
test('launch opens once with noopener even when window.open returns null, without a desktop window', () => {
  for (const [host, target] of [['localhost', LOCAL], ['127.0.0.1', LOCAL], ['studentop.cn', PRODUCTION]]) {
    const { WM, opened } = desktop(host); assert.equal(WM.launch('voxel-campus'), null);
    assert.equal(opened.length, 1); assert.deepEqual(opened[0], [target, '_blank', 'noopener,noreferrer']); assert.equal(WM.count(), 0);
  }
});
test('registry re-evaluation does not duplicate voxel or either existing opening', () => {
  const { window, load, Win } = desktop(); load('apps'); load('apps');
  for (const id of ['voxel-campus', 'genshin-start', 'genshin-original']) {
    assert.equal(window.__APP_DEFS.filter(app => app.id === id).length, 1); assert.equal(Win.appList().filter(app => app.id === id).length, 1);
  }
});
