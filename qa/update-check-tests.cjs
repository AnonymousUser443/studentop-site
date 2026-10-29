/* Offline updater tests: real update-check.js, synthetic DOM/clock/fetch only.
   No authentication data, browser sessions, network, server or storage are read. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../site/assets/js/update-check.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../site/assets/css/update.css'), 'utf8');
const A = 'a'.repeat(24), B = 'b'.repeat(24), C = 'c'.repeat(24);
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function response(data, ok = true) { return { ok, json: () => Promise.resolve(data) }; }

function harness(options = {}) {
  class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
    emit(type, extra = {}) { for (const fn of this.listeners.get(type) || []) fn({ type, target: this, ...extra }); }
  }
  let document;
  class Element extends Events {
    constructor(tag) { super(); this.tagName = tag; this.id = ''; this.className = ''; this.attrs = {}; this.dataset = {}; this.children = []; this.parentNode = null; this.hidden = false; this.inert = false; this.disabled = false; this.textContent = ''; }
    appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    contains(node) { return node === this || this.children.some(n => n.contains(node)); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    removeAttribute(key) { delete this.attrs[key]; }
    closest() { for (let node = this; node; node = node.parentNode) if (node.inert || node.hidden) return node; return null; }
    focus() { if (!this.isConnected || this.disabled || this.closest()) return; document.activeElement = this; document.emit('focusin', { target: this }); }
    click() { if (!this.disabled) this.emit('click'); }
  }
  document = new Events(); document.body = new Element('body'); document.readyState = 'complete'; document.visibilityState = 'visible'; document.activeElement = document.body;
  document.createElement = tag => new Element(tag);
  const all = root => [root, ...root.children.flatMap(all)];
  document.getElementById = id => all(document.body).find(n => n.id === id) || null;
  const meta = Object.hasOwn(options, 'meta') ? options.meta : A;
  document.querySelector = selector => selector === 'meta[name="site-version"]' && meta !== null ? { getAttribute: () => meta } : null;
  const add = (tag, id, parent = document.body) => { const node = new Element(tag); node.id = id; parent.appendChild(node); return node; };
  const desktop = add('div', 'desktop'), start = add('button', 'startBtn', desktop), editor = add('textarea', 'editor', desktop);
  editor.value = 'offline draft stays intact';
  const lock = add('div', 'lockScreen'), boot = add('div', 'gateBoot', lock);
  const model = { locked: !!options.locked, wins: [], confirm: false };
  desktop.inert = model.locked; lock.hidden = !model.locked; boot.hidden = !options.boot;
  if (model.locked) desktop.setAttribute('aria-hidden', 'true'); else editor.focus();
  const events = new Map();
  const bus = { on(name, fn) { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); }, emit(name, data) { for (const fn of events.get(name) || []) fn(data); } };
  let now = 0, seq = 0; const timers = new Map();
  const schedule = (fn, delay, repeat) => { const id = ++seq; timers.set(id, { fn, at: now + delay, repeat }); return id; };
  const advance = ms => {
    const target = now + ms;
    for (let ticks = 0; ticks < 2000; ticks++) {
      const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { now = target; return; }
      const [id, item] = next; now = item.at;
      if (item.repeat) item.at += item.repeat; else timers.delete(id);
      item.fn();
    }
    throw new Error('Timer runaway');
  };
  const replies = [...(options.replies || [response({ id: B })])], calls = [], navigations = [], confirmations = [];
  const window = new Events();
  const location = { href: options.href || 'https://desktop.example/desk/?open=notepad&tag=one&tag=two#notes', replace: url => { navigations.push(url); } };
  const navigator = { onLine: options.online !== false };
  Object.defineProperty(navigator, 'serviceWorker', { get() { throw new Error('Unexpected service-worker access'); } });
  Object.assign(window, { window, document, navigator, location, console, URL, AbortController,
    Date: { now: () => now },
    setTimeout: (fn, delay) => schedule(fn, delay, 0), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, delay), clearInterval: id => timers.delete(id),
    Win: { isLocked: () => model.locked, bus }, WM: { list: () => model.wins },
    confirm: text => { confirmations.push(text); return model.confirm; },
    fetch: (url, opts) => { calls.push({ url, opts }); const reply = replies.shift(); return reply === undefined ? Promise.reject(new Error('offline')) : reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply); }
  });
  for (const key of ['localStorage', 'sessionStorage', 'caches']) Object.defineProperty(window, key, { get() { throw new Error('Unexpected ' + key + ' access'); } });
  const context = vm.createContext(window); vm.runInContext(source, context);
  const notice = () => document.getElementById('siteUpdateNotice');
  const visible = () => !!notice() && !notice().hidden;
  const button = action => { const node = all(document.body).find(n => n.dataset.updateAction === action); assert.ok(node, 'Missing update action ' + action); return node; };
  const unlock = () => { model.locked = false; lock.hidden = true; boot.hidden = true; desktop.inert = false; desktop.removeAttribute('aria-hidden'); start.focus(); bus.emit('unlock'); };
  const lockAgain = () => { model.locked = true; desktop.inert = true; lock.hidden = false; desktop.setAttribute('aria-hidden', 'true'); document.activeElement = lock; bus.emit('lock:request-close-all'); };
  return { window, document, model, desktop, start, editor, lock, boot, api: window.SiteUpdate, calls, navigations, confirmations,
    advance, replies, context, notice, visible, button, unlock, lockAgain, intervals: () => [...timers.values()].filter(t => t.repeat).length };
}

test('validates hex ids and keeps legal duplicate query keys, hash and route', async () => {
  const h = harness(); await settle();
  for (const bad of ['', null, 3, {}, '<script>', 'ab cd', 'a'.repeat(129), 'ab\n']) assert.equal(h.api.normalizeId(bad), null);
  assert.equal(h.api.normalizeId(A.toUpperCase()), A);
  const url = new URL(h.api.buildRefreshUrl('https://desktop.example/desk/?tag=one&tag=two&__siteVersion=old&open=notepad#notes', B));
  assert.equal(url.origin, 'https://desktop.example'); assert.equal(url.pathname, '/desk/'); assert.equal(url.hash, '#notes');
  assert.deepEqual(url.searchParams.getAll('tag'), ['one', 'two']); assert.equal(url.searchParams.get('open'), 'notepad'); assert.deepEqual(url.searchParams.getAll('__siteVersion'), [B]);
  for (const bad of ['javascript:alert(1)', 'https://name:secret@desktop.example/', 'not a URL']) assert.equal(h.api.buildRefreshUrl(bad, B), null);
});
test('metadata mismatch shows an accessible opt-in notice without moving input focus', async () => {
  const h = harness({ meta: A.toUpperCase() }); await settle();
  assert.equal(h.api.getState().currentId, A); assert.equal(h.api.getState().pendingId, B); assert.ok(h.visible());
  assert.ok(h.document.activeElement === h.editor); assert.equal(h.navigations.length, 0);
  assert.equal(h.notice().getAttribute('role'), 'region');
  assert.equal(h.document.getElementById('siteUpdateDescription').getAttribute('aria-live'), 'polite');
  assert.equal(h.button('apply').textContent, '立即更新'); assert.equal(h.button('later').textContent, '稍后');
  h.advance(180000); await settle(); assert.equal(h.navigations.length, 0);
});
test('absent or invalid meta uses first successful response only as development baseline', async () => {
  for (const meta of [null, 'invalid-meta']) {
    const h = harness({ meta, replies: [response({id:A})] }); await settle(); assert.equal(h.api.getState().currentId,A); assert.ok(!h.visible());
    h.replies.push(response({id:B})); h.advance(15000); await h.api.check(); assert.ok(h.visible()); assert.equal(h.navigations.length,0);
  }
});
test('probe uses fixed same-origin no-store endpoint and never touches persistent storage', async () => {
  const h = harness(); await settle(); const call=h.calls[0];
  assert.equal(call.url,'/version.json'); assert.equal(call.opts.method,'GET'); assert.equal(call.opts.cache,'no-store'); assert.equal(call.opts.mode,'same-origin'); assert.equal(call.opts.redirect,'error'); assert.equal(call.opts.credentials,'same-origin');
  assert.equal(call.opts.headers.Accept,'application/json'); assert.equal(h.calls.length,1); assert.equal(h.navigations.length,0);
});
test('lock and boot suppress pending notices until unlock and relock hides without focus theft', async () => {
  const h=harness({locked:true,boot:true}); await settle(); assert.equal(h.api.getState().pendingId,B); assert.ok(!h.visible());
  h.unlock(); assert.ok(h.visible()); assert.ok(h.document.activeElement===h.start);
  h.lockAgain(); assert.ok(!h.visible()); assert.ok(h.document.activeElement===h.lock);
  const b=harness({boot:true}); await settle(); assert.ok(!b.visible()); b.unlock(); assert.ok(b.visible());
});
test('later defers only that version in memory and preserves editor focus and content', async () => {
  const h=harness(); await settle(); h.button('later').focus(); h.button('later').click();
  assert.ok(!h.visible()); assert.ok(h.document.activeElement===h.editor); assert.equal(h.editor.value,'offline draft stays intact');
  h.replies.push(response({id:B})); h.advance(15000); await h.api.check(); assert.ok(!h.visible());
  h.replies.push(response({id:C})); h.advance(15000); await h.api.check(); assert.ok(h.visible()); assert.ok(h.document.activeElement===h.editor); assert.equal(h.navigations.length,0);
});
test('dirty draft cancellation keeps the page and confirmation refreshes only once', async () => {
  const h=harness(); let reads=0; h.model.wins=[{isDirty(){reads++;return true;}}]; await settle();
  h.button('apply').click(); assert.equal(h.confirmations.length,1); assert.equal(h.navigations.length,0); assert.ok(h.visible()); assert.equal(h.editor.value,'offline draft stays intact');
  h.model.confirm=true; h.button('apply').click(); h.button('apply').click(); assert.equal(h.navigations.length,1); assert.equal(reads,2);
  const target=new URL(h.navigations[0]); assert.equal(target.searchParams.get('__siteVersion'),B); assert.equal(target.searchParams.get('open'),'notepad'); assert.deepEqual(target.searchParams.getAll('tag'),['one','two']); assert.equal(target.hash,'#notes');
});
test('clean documents navigate without confirmation; beforeunload cancellation can retry later', async () => {
  const h=harness(); h.model.wins=[{isDirty:()=>false},{}]; await settle(); h.button('apply').click(); assert.equal(h.navigations.length,1); assert.equal(h.confirmations.length,0);
  h.advance(2100); h.button('apply').click(); assert.equal(h.navigations.length,2); // location stub models a cancelled native navigation.
});
test('unknown draft status and thrown confirmation fail closed without altering drafts', async () => {
  const h=harness(); await settle(); h.model.wins=[{isDirty(){throw new Error('cannot inspect');}}]; h.button('apply').click(); assert.equal(h.navigations.length,0); assert.match(h.document.getElementById('siteUpdateDescription').textContent,/无法确认/);
  h.model.wins=[{isDirty:()=>true}]; h.window.confirm=()=>{throw new Error('dialog unavailable');}; h.button('apply').click(); assert.equal(h.navigations.length,0); assert.equal(h.editor.value,'offline draft stays intact');
});
test('invalid responses, HTTP failures and offline requests stay silent and retry', async () => {
  for (const reply of [response({id:'not-hex'}),response([B]),response({id:B},false),new Error('offline'),{ok:true,json:()=>Promise.reject(new Error('invalid JSON'))}]) {
    const h=harness({replies:[reply]}); await settle(); assert.ok(!h.visible()); assert.equal(h.api.getState().pendingId,null); assert.equal(h.navigations.length,0);
    h.replies.push(response({id:B})); h.advance(60000); await settle(); assert.ok(h.visible());
  }
  const offline=harness({online:false}); await settle(); assert.equal(offline.calls.length,0); offline.window.navigator.onLine=true; offline.window.emit('online'); await settle(); assert.equal(offline.calls.length,1);
});
test('60-second polling and visible/focus/pageshow wakeups are throttled and single-flight', async () => {
  const h=harness({replies:[response({id:A})]}); await settle();
  for(let i=0;i<5;i++){h.window.emit('focus');h.window.emit('pageshow');} await settle(); assert.equal(h.calls.length,1);
  h.advance(14000); h.window.emit('focus'); await settle(); assert.equal(h.calls.length,1);
  h.replies.push(response({id:A})); h.advance(1000); h.document.emit('visibilitychange'); await settle(); assert.equal(h.calls.length,2);
  h.document.visibilityState='hidden'; h.document.emit('visibilitychange'); h.advance(60000); await settle(); assert.equal(h.calls.length,2);
  h.replies.push(response({id:B})); h.document.visibilityState='visible'; h.document.emit('visibilitychange'); await settle(); assert.equal(h.calls.length,3); assert.ok(h.visible()); assert.equal(h.intervals(),1);
});
test('timeout releases single-flight and stale responses cannot replace newer candidates', async () => {
  const pending=deferred(),h=harness({replies:[pending.promise]}); await settle(); assert.equal(h.calls.length,1); assert.equal(h.api.getState().checking,true);
  await h.api.check(); assert.equal(h.calls.length,1); h.advance(12000); assert.equal(h.api.getState().checking,false); assert.equal(h.calls[0].opts.signal.aborted,true);
  h.replies.push(response({id:B})); h.advance(3000); await h.api.check(); assert.equal(h.api.getState().pendingId,B);
  pending.resolve(response({id:C})); await settle(); assert.equal(h.api.getState().pendingId,B); assert.equal(h.navigations.length,0);
});
test('pagehide suspends timers and pageshow resumes exactly one interval', async () => {
  const h=harness(); await settle(); h.window.emit('pagehide'); assert.ok(!h.visible()); assert.equal(h.intervals(),0);
  h.advance(120000); await settle(); assert.equal(h.calls.length,1);
  h.replies.push(response({id:B})); h.window.emit('pageshow'); h.window.emit('pageshow'); await settle(); assert.equal(h.calls.length,2); assert.equal(h.intervals(),1);
  h.replies.push(response({id:B})); h.advance(60000); await settle(); assert.equal(h.calls.length,3);
});
test('rollback to the current version removes the notice without disturbing outside focus', async () => {
  const h=harness(); await settle(); h.replies.push(response({id:A})); h.advance(15000); await h.api.check(); assert.ok(!h.visible()); assert.equal(h.api.getState().pendingId,null); assert.ok(h.document.activeElement===h.editor);
});
test('pagehide before the fetch microtask cancels the queued probe', async () => {
  const h=harness(); h.window.emit('pagehide'); await settle(); assert.equal(h.calls.length,0); assert.equal(h.api.getState().checking,false); assert.equal(h.intervals(),0);
});
test('duplicate script evaluation does not duplicate checks or intervals', async () => {
  const h=harness(); await settle(); vm.runInContext(source,h.context); await settle(); assert.equal(h.calls.length,1); assert.equal(h.intervals(),1);
});
test('notice styling supplies mobile dark hidden and reduced-motion states without remote assets', () => {
  assert.match(css,/z-index:\s*calc\(var\(--z-flyout,\s*1100\)\s*-\s*1\)/);
  assert.doesNotMatch(css,/--z-toast/);
  assert.match(css,/\.site-update\[hidden\]/); assert.match(css,/max-width: 520px/); assert.match(css,/data-theme="dark"/); assert.match(css,/prefers-reduced-motion/); assert.match(css,/focus-visible/); assert.doesNotMatch(css,/@import|https?:\/\//);
});
