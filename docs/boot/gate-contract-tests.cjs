/* Isolated frontend contract tests. All input values are synthetic fixtures.
   No private configuration, network service, browser, or real answer is accessed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'site/assets/js/boot-lock.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise(setImmediate); };
const tick = async () => { await flush(); await new Promise(resolve => setTimeout(resolve, 6)); await flush(); };
const snap = (patch = {}) => Object.assign({ configured: true, authenticated: false, csrfToken: 'fixture-csrf', attemptsRemaining: 3, retryAfterSeconds: 0, lockedUntil: null, serverTime: 1800000000000 }, patch);
function harness(responder, options = {}) {
  const handlers = {}, windowHandlers = {}, elements = {}, calls = [], events = [], store = new Map(options.first ? [] : [['aiden.desktop.bootSeen.v2', '1']]);
  const history = options.history || { state: null, replaceState(value) { this.state = value; } };
  const clock = { mono: 0 };
  const document = { visibilityState: 'visible', activeElement: null, body: null, getElementById: id => elements[id] || null, addEventListener(name, fn) { (handlers[name] ||= []).push(fn); } };
  class Element {
    constructor(id, tag) { this.id = id; this.tagName = tag.toUpperCase(); this.hidden = false; this.disabled = false; this.inert = false; this.value = ''; this.type = id === 'gateAnswer' ? 'text' : ''; this.textContent = ''; this.dataset = {}; this.style = { setProperty(key, value) { this[key] = value; } }; this.attrs = {}; this.handlers = {}; this.parent = null; this.isConnected = true; this.classes = new Set(); this.classList = { add: (...names) => names.forEach(n => this.classes.add(n)), remove: (...names) => names.forEach(n => this.classes.delete(n)), contains: n => this.classes.has(n) }; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    removeAttribute(key) { delete this.attrs[key]; }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    dispatch(name, data = {}) { const e = Object.assign({ type: name, target: this, key: '', preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }, data); for (const fn of this.handlers[name] || []) fn(e); return e; }
    focus() { document.activeElement = this; for (const fn of handlers.focusin || []) fn({ target: this }); }
    contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
    closest(selector) { for (let n = this; n; n = n.parent) { if (['button','input','a'].includes(selector) && n.tagName === selector.toUpperCase()) return n; if (selector === '[hidden]' && n.hidden) return n; if (selector === '[inert]' && n.inert) return n; } return null; }
    querySelectorAll(selector) { if (selector === '.profile-avatar') return []; return Object.values(elements).filter(n => n !== this && this.contains(n) && (n.tagName === 'BUTTON' || n.tagName === 'INPUT')); }
    getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
  }
  for (const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"/gi)) elements[match[2]] = new Element(match[2], match[1]);
  document.body = new Element('body', 'body');
  elements.startBtn = new Element('startBtn', 'button'); elements.startBtn.parent = elements.desktop;
  for (const el of Object.values(elements)) if (el.id !== 'lockScreen' && el.id !== 'desktop' && el.id !== 'startBtn') el.parent = elements.lockScreen;
  const formIds = ['gateForm','gateFormAvatar','gateAnswer','gateReveal','gateSubmit','gateStatus','gateAttempts','gateCountdown','gateBack','gateRetry'];
  formIds.forEach(id => { elements[id].parent = elements.gateQuestionView; });
  ['gateLogin','gateReplay','gateClockRetry','gateClockStatus'].forEach(id => { elements[id].parent = elements.gateClockView; });
  ['gateBios','gateLogoStage','gateSkip'].forEach(id => { elements[id].parent = elements.gateBoot; });
  document.activeElement = document.body;
  const bus = { map: {}, on(name, fn) { (this.map[name] ||= []).push(fn); return () => {}; }, emit(name, data) { events.push(name); (this.map[name] || []).forEach(fn => fn(data)); } };
  const Win = { bus, reduceMotion: () => options.motion !== true, fmtTime: () => '12:34', fmtDateCN: () => '2026年10月28日', WEEK: ['日','一','二','三','四','五','六'], prefs: { wall: 'chenyu' }, avatarMarkup: () => 'A', wallpaperUrl: () => 'assets/img/wall-chenyu.webp', safeUrl: url => url, startClock() { bus.emit('clock', new Date()); } };
  const context = { console, Promise, Date, Math, String, Number, Object, Array, JSON, Error, AbortController, performance: { now: () => clock.mono }, history, location: { href: 'https://fixture.invalid/' }, document, Win,
    localStorage: { getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, value) },
    sessionStorage: new Proxy({}, { get() { throw new Error('Session storage is not an authorization source'); } }),
    setTimeout: (fn, delay) => setTimeout(fn, delay >= 12000 ? delay : Math.min(delay, 3)), clearTimeout,
    fetch: async (url, request) => { const captured = { url, method: request.method, token: request.headers['X-Desktop-CSRF'], credentials: request.credentials, answer: request.body ? JSON.parse(request.body).answer : undefined }; calls.push(captured); const reply = await responder(captured, calls); return { status: reply.status ?? 200, headers: { get: () => reply.contentType || 'application/json' }, text: async () => reply.raw ?? JSON.stringify(reply.data || snap()) }; }
  };
  context.window = { matchMedia: () => ({ addEventListener() {} }), addEventListener: (name, fn) => (windowHandlers[name] ||= []).push(fn) };
  if (options.motionController) context.window.AidenGateMotion = { create: () => options.motionController };
  vm.createContext(context); vm.runInContext(source, context);
  return { gate: context.window.DesktopGate, elements, calls, events, history, store, clock, bus, document,
    submit(value) { elements.gateAnswer.value = value; elements.gateForm.dispatch('submit'); },
    visibility(value) { document.visibilityState = value; (handlers.visibilitychange || []).forEach(fn => fn()); },
    key(key, data = {}) { return elements.lockScreen.dispatch('keydown', Object.assign({ key, target: document.activeElement || elements.lockScreen }, data)); }
  };
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
test('missing API and public unlock fail closed', async () => {
  const h = harness(async () => { throw new Error('offline'); }); await h.gate.init();
  assert.equal(h.gate.isLocked(), true); assert.equal(h.elements.desktop.inert, true); assert.equal(h.elements.lockScreen.dataset.gateStatus, 'unavailable');
  assert.equal(await h.gate.unlock(true), false); assert.equal(h.events.includes('unlock'), false);
});
test('unconfigured service cannot unlock', async () => {
  const h = harness(() => ({ status: 503, data: snap({ configured: false, csrfToken: null }) })); await h.gate.init(); assert.equal(h.elements.lockScreen.dataset.gateStatus, 'unconfigured'); assert(h.gate.isLocked());
});
test('malformed authenticated response and HTML fail closed', async () => {
  for (const reply of [{ data: { configured: true, authenticated: true } }, { contentType: 'text/html', raw: '<html>not an API</html>' }]) {
    const h = harness(() => reply); await h.gate.init(); assert(h.gate.isLocked()); assert(!h.events.includes('unlock'));
  }
});
test('background click is inert; explicit login and Escape only change views', async () => {
  const h = harness(() => ({ data: snap() })); await h.gate.init(); h.elements.lockScreen.dispatch('click'); assert.equal(h.elements.lockScreen.dataset.gateView, 'clock');
  h.elements.gateLogin.dispatch('click'); assert.equal(h.elements.lockScreen.dataset.gateView, 'question'); h.elements.gateAnswer.value = 'fixture-input'; h.key('Escape'); assert.equal(h.elements.lockScreen.dataset.gateView, 'clock'); assert.equal(h.elements.gateAnswer.value, ''); assert(h.gate.isLocked());
});
test('wrong answer clears input, updates attempts, and is never reflected', async () => {
  const h = harness(c => ({ status: c.method === 'POST' ? 401 : 200, data: snap({ attemptsRemaining: c.method === 'POST' ? 2 : 3 }) })); await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-wrong'); await tick();
  assert(h.gate.isLocked()); assert.equal(h.elements.gateAnswer.value, ''); assert.equal(h.elements.lockScreen.dataset.gateStatus, 'denied'); assert(h.elements.gateAttempts.textContent.includes('2'));
  assert(!Object.values(h.elements).some(e => e.textContent.includes('fixture-wrong'))); assert.deepEqual([...h.store.keys()], ['aiden.desktop.bootSeen.v2']); assert.equal(h.calls[1].credentials, 'same-origin'); assert.equal(h.calls[1].token, 'fixture-csrf');
});
test('server cooldown cannot be cleared by local timer expiry', async () => {
  const h = harness(c => c.method === 'POST' ? { status: 429, data: snap({ attemptsRemaining: 0, retryAfterSeconds: 300, lockedUntil: 1800000300000 }) } : { data: snap() }); await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-wrong'); await tick();
  assert.equal(h.elements.lockScreen.dataset.gateStatus, 'cooldown'); assert(h.elements.gateSubmit.disabled); h.clock.mono = 301000; h.bus.emit('clock', new Date()); assert(h.elements.gateSubmit.disabled); assert(h.gate.isLocked());
  h.elements.gateRetry.dispatch('click'); await tick(); assert.equal(h.elements.lockScreen.dataset.gateStatus, 'ready'); assert(h.gate.isLocked());
});
test('success authorizes, manual lock adopts rotated DELETE token', async () => {
  let active = false;
  const h = harness(c => { if (c.method === 'POST') { active = true; return { data: snap({ authenticated: true, csrfToken: 'fixture-post-rotated' }) }; } if (c.method === 'DELETE') { active = false; return { data: snap({ csrfToken: 'fixture-delete-rotated' }) }; } return { data: snap({ authenticated: active, csrfToken: 'fixture-fresh' }) }; });
  await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-ok'); await tick(); assert(!h.gate.isLocked()); assert.equal(h.elements.desktop.inert, false);
  const revoke = h.gate.lock(); assert(h.gate.isLocked()); assert(h.elements.desktop.inert); await revoke; assert(h.gate.isLocked()); assert.equal(h.history.state.__desktopGateRevokePending, undefined);
  h.elements.gateLogin.dispatch('click'); h.submit('fixture-ok'); await tick(); assert.equal(h.calls.at(-1).token, 'fixture-delete-rotated');
});
test('POST/lock race serializes revocation and ignores stale success', async () => {
  let settle;
  const h = harness(c => c.method === 'POST' ? new Promise(resolve => { settle = resolve; }) : { data: snap({ csrfToken: c.method === 'DELETE' ? 'fixture-deleted' : 'fixture-fresh' }) });
  await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-ok'); await flush(); const revoked = h.gate.lock(); assert(h.gate.isLocked()); assert(h.elements.desktop.inert); assert.deepEqual(h.calls.map(c => c.method), ['GET', 'POST']);
  settle({ data: snap({ authenticated: true }) }); await revoked; assert.deepEqual(h.calls.map(c => c.method), ['GET', 'POST', 'GET', 'DELETE']); assert(!h.events.includes('unlock')); assert(h.gate.isLocked());
});
test('Escape during POST cancels entry and revokes possible session', async () => {
  let settle; const h = harness(c => c.method === 'POST' ? new Promise(resolve => { settle = resolve; }) : { data: snap() }); await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-ok'); await flush(); h.key('Escape'); settle({ data: snap({ authenticated: true }) }); await tick();
  assert(h.gate.isLocked()); assert(!h.events.includes('unlock')); assert.equal(h.elements.lockScreen.dataset.gateView, 'clock'); assert(h.calls.some(c => c.method === 'DELETE'));
});
test('failed logout survives refresh as denial-only history state', async () => {
  const h = harness(c => { if (c.method === 'DELETE') throw new Error('offline'); return { data: snap({ authenticated: true }) }; }); await h.gate.init(); assert(!h.gate.isLocked()); await h.gate.lock(); assert(h.gate.isLocked()); assert.equal(h.history.state.__desktopGateRevokePending, true);
  const next = harness(c => ({ data: snap({ authenticated: c.method === 'GET', csrfToken: 'fixture-new' }) }), { history: h.history }); await next.gate.init(); assert.deepEqual(next.calls.map(c => c.method), ['GET', 'DELETE']); assert(next.gate.isLocked()); assert(!next.events.includes('unlock')); assert.equal(next.history.state.__desktopGateRevokePending, undefined);
});
test('visibility return revalidates expired sessions without replay', async () => {
  let active = true; const h = harness(() => ({ data: snap({ authenticated: active }) })); await h.gate.init(); assert(!h.gate.isLocked()); h.visibility('hidden'); assert(h.gate.isLocked()); active = false; h.visibility('visible'); await tick(); assert(h.gate.isLocked()); assert.equal(h.elements.lockScreen.dataset.gateView, 'clock'); assert.equal(h.calls.length, 2);
});
test('403 never automatically resends an answer', async () => {
  const h = harness(c => c.method === 'POST' ? { status: 403, data: snap({ csrfToken: 'fixture-conflict' }) } : { data: snap({ csrfToken: 'fixture-refreshed' }) }); await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-input'); await tick(); assert.equal(h.elements.lockScreen.dataset.gateStatus, 'unavailable'); assert.equal(h.elements.gateAnswer.value, ''); h.elements.gateRetry.dispatch('click'); await tick(); assert.equal(h.calls.filter(c => c.method === 'POST').length, 1); assert(h.gate.isLocked());
});
test('IME composition cannot submit or unlock', async () => {
  const h = harness(() => ({ data: snap() })); await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.elements.gateAnswer.dispatch('compositionstart'); h.submit('fixture-input'); h.key('Enter', { isComposing: true }); await tick(); assert.equal(h.calls.length, 1); assert(h.gate.isLocked()); h.elements.gateAnswer.dispatch('compositionend');
});
test('Chinese text survives IME confirmation and remains readable', async () => {
  const h = harness(c => ({ status: c.method === 'POST' ? 401 : 200, data: snap({ attemptsRemaining: c.method === 'POST' ? 2 : 3 }) }));
  await h.gate.init(); h.elements.gateLogin.dispatch('click');
  const input = h.elements.gateAnswer;
  assert.equal(input.type, 'text');
  input.dispatch('compositionstart'); input.value = '合成测试答案';
  h.key('Enter', { keyCode: 229 }); h.elements.gateReveal.dispatch('click');
  assert.equal(input.value, '合成测试答案'); assert.equal(h.calls.length, 1);
  input.dispatch('compositionend'); h.elements.gateForm.dispatch('submit'); await tick();
  assert.equal(h.calls[1].answer, '合成测试答案'); assert.equal(input.type, 'text'); assert.equal(input.value, '');
  input.value = '仅用于测试'; h.elements.gateReveal.dispatch('click');
  assert.equal(input.type, 'text'); assert.equal(input.value, ''); assert.equal(h.document.activeElement, input);
});

test('swipe needs a deliberate upward gesture and changes only the view', async () => {
  const h = harness(() => ({ data: snap() }), { motion: true }); await h.gate.init();
  const surface = h.elements.gateClockView;
  function swipe(x, y, cancel = false) {
    surface.dispatch('pointerdown', { pointerId: 1, clientX: 200, clientY: 500, button: 0 });
    surface.dispatch('pointermove', { pointerId: 1, clientX: x, clientY: y });
    surface.dispatch(cancel ? 'pointercancel' : 'pointerup', { pointerId: 1 });
  }
  swipe(200, 470); swipe(450, 390); swipe(200, 360, true);
  assert.equal(h.elements.lockScreen.dataset.gateView, 'clock');
  swipe(200, 360);
  assert.equal(h.elements.lockScreen.dataset.gateView, 'question'); assert(surface.inert);
  assert(h.elements.desktop.inert); assert(h.gate.isLocked()); assert.equal(h.calls.length, 1);
  await tick(); assert(surface.hidden);
  h.key('Escape'); assert.equal(surface.inert, false); assert.equal(surface.hidden, false);
});

test('wheel and loading button cannot authorize the desktop', async () => {
  const h = harness(() => ({ data: snap() }), { first: true, motion: true });
  const initializing = h.gate.init(); h.elements.gateLoader.dispatch('click'); await initializing;
  h.elements.lockScreen.dispatch('wheel', { deltaY: 18 }); assert.equal(h.elements.lockScreen.dataset.gateView, 'clock');
  h.elements.lockScreen.dispatch('wheel', { deltaY: -40 });
  h.elements.lockScreen.dispatch('wheel', { deltaY: 50 }); assert.equal(h.elements.lockScreen.dataset.gateView, 'question');
  assert(h.gate.isLocked()); assert(h.elements.desktop.inert); assert.equal(h.calls.length, 1);
});

function deferredMotion() {
  let complete;
  const controller = { playBoot() {}, stopBoot() {}, setWallpaper() {},
    reveal(guard) { controller.guard = guard; return new Promise(resolve => { complete = resolve; }); },
    cancelReveal() { if (complete) { const resolve = complete; complete = null; resolve(false); } },
    finish() { const resolve = complete; complete = null; resolve(true); }
  };
  return controller;
}
test('authorized desktop stays inert until the particle exit completes', async () => {
  const controller = deferredMotion();
  const h = harness(c => ({ data: snap({ authenticated: c.method === 'POST' }) }), { motion: true, motionController: controller });
  await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-ok'); await flush();
  assert.equal(controller.guard(), true); assert(h.gate.isLocked()); assert(h.elements.desktop.inert);
  assert(h.elements.gateAnswer.disabled); assert.equal(h.elements.gateAnswer.value, ''); assert(!h.events.includes('unlock'));
  assert.equal(h.document.activeElement, h.elements.lockScreen);
  controller.finish(); await tick(); assert(!h.gate.isLocked()); assert.equal(h.elements.desktop.inert, false);
});
test('Escape during particle exit revokes and prevents stale animation completion', async () => {
  const controller = deferredMotion();
  const h = harness(c => ({ data: snap({ authenticated: c.method === 'POST' }) }), { motion: true, motionController: controller });
  await h.gate.init(); h.elements.gateLogin.dispatch('click'); h.submit('fixture-ok'); await flush();
  h.key('Escape'); await tick();
  assert.equal(controller.guard(), false); assert(h.gate.isLocked()); assert(h.elements.desktop.inert);
  assert(!h.events.includes('unlock')); assert.equal(h.elements.lockScreen.dataset.gateView, 'clock');
  assert.equal(h.calls.at(-1).method, 'DELETE');
});

test('boot skip and replay never grant access; init is idempotent', async () => {
  const h = harness(() => ({ data: snap() }), { first: true, motion: true }); const first = h.gate.init(); assert.equal(h.gate.init(), first); assert.equal(h.elements.lockScreen.dataset.gatePhase, 'bios'); h.elements.gateSkip.dispatch('click'); await first; assert(h.gate.isLocked()); assert.equal(h.store.get('aiden.desktop.bootSeen.v2'), '1');
  const count = h.calls.length; h.elements.gateReplay.dispatch('click'); assert.equal(h.elements.lockScreen.dataset.gatePhase, 'bios'); h.elements.gateSkip.dispatch('click'); await tick(); assert.equal(h.calls.length, count); assert(h.gate.isLocked());
});
test('bootstrap has no legacy authorization bypass and retains DOM ids', async () => {
  const main = fs.readFileSync(path.join(root, 'site/assets/js/main.js'), 'utf8'); assert(!/skipLock|sessionStorage/.test(main)); assert(main.indexOf('WM.init()') < main.indexOf('await Win.initLock()')); assert(main.indexOf("Win.bus.on('unlock'") < main.indexOf('await Win.initLock()'));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length); for (const id of ['lockScreen','lockWall','lockClock','lockDate','lockWeekday','lockAvatar','lockUser','lockTip','desktop','taskbar']) assert(ids.includes(id));
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); } console.log('PASS ' + tests.length + ' isolated gate contracts'); })().catch(error => { console.error('FAIL ' + error.message); process.exitCode = 1; });
