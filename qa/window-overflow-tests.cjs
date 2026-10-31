/* Offline regression for the real WM/Shell modules. No browser, auth, network or server.
   Geometry assertions are pure; the deliberately small DOM stub checks event/focus state,
   not CSS layout, native Tab traversal, touch hardware or actual rendered hit areas. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function desktop(width = 1440, height = 900, { coarse = false, visualViewport = false } = {}) {
  let document;
  class Events {
    constructor() { this.listeners = Object.create(null); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
    fire(type, extra = {}) {
      const event = { type, target: this, bubbles: true, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
      let node = this;
      do {
        event.currentTarget = node;
        for (const fn of [...(node.listeners[type] || [])]) fn(event);
        node = event.bubbles && !event.stopped ? node.parentNode : null;
      } while (node);
      return event;
    }
  }
  function matches(node, selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      const space = part.lastIndexOf(' ');
      if (space !== -1) {
        if (!matches(node, part.slice(space + 1))) return false;
        for (let p = node.parentNode; p; p = p.parentNode) if (p instanceof Element && matches(p, part.slice(0, space))) return true;
        return false;
      }
      if (part.includes(':not(:disabled)') && node.disabled) return false;
      part = part.replace(':not(:disabled)', '');
      if (part.includes(':disabled')) { if (!node.disabled) return false; part = part.replace(':disabled', ''); }
      const attrs = [...part.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
      if (attrs.some(([, key, value]) => !node.hasAttribute(key) || (value !== undefined && node.getAttribute(key) !== value))) return false;
      part = part.replace(/\[[^\]]*\]/g, '');
      const id = part.match(/#([\w-]+)/); if (id && node.id !== id[1]) return false;
      for (const [, c] of part.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(c)) return false;
      const tag = part.match(/^[\w-]+/); return !tag || node.tagName === tag[0].toUpperCase();
    });
  }
  class Element extends Events {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {};
      this.dataset = {}; this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] || ''; } }; this.className = ''; this.id = ''; this._text = ''; this.hidden = false;
      this.inert = false; this.disabled = false; this.tabIndex = ['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(this.tagName) ? 0 : -1;
      this.value = '';
      this.scrollLeft = 0; this.scrollTop = 0;
      this.classList = { contains: c => this.className.split(/\s+/).includes(c),
        add: (...cs) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(cs))].join(' '); },
        remove: (...cs) => { this.className = this.className.split(/\s+/).filter(c => !cs.includes(c)).join(' '); },
        toggle: (c, force) => { const on = force === undefined ? !this.classList.contains(c) : !!force; this.classList[on ? 'add' : 'remove'](c); return on; } };
    }
    get parentElement() { return this.parentNode; }
    get firstElementChild() { return this.children[0] || null; }
    get firstChild() { return this.firstElementChild; }
    get nextElementSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(text) { this.innerHTML = ''; this._text = String(text); }
    set innerHTML(html) {
      for (const child of [...this.children]) child.remove(); this._text = '';
      const stack = [this];
      for (const match of String(html).matchAll(/<\/?[^>]+>|[^<]+/g)) {
        const token = match[0];
        if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        if (token.startsWith('<')) {
          const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
          const child = new Element(tag);
          const attributes = token.slice(tag.length + 1, -1);
          for (const [, key, a, b, c] of attributes.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) child.setAttribute(key, a ?? b ?? c ?? '');
          stack[stack.length - 1].appendChild(child);
          if (!['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tag) && !token.endsWith('/>')) stack.push(child);
        } else stack[stack.length - 1]._text += token;
      }
    }
    get innerHTML() { return this.textContent; }
    setAttribute(key, value) {
      value = String(value); this.attrs[key] = value;
      if (key === 'class') this.className = value; if (key === 'id') this.id = value;
      if (key === 'tabindex') this.tabIndex = Number(value);
      if (key === 'disabled') this.disabled = true; if (key === 'hidden') this.hidden = true;
      if (key.startsWith('data-')) this.dataset[dataKey(key)] = value;
    }
    getAttribute(key) {
      if (key === 'class') return this.className || null; if (key === 'id') return this.id || null;
      if (key === 'tabindex') return String(this.tabIndex);
      if (key === 'inert') return this.inert ? '' : null;
      if (key.startsWith('data-')) return this.dataset[dataKey(key)] ?? null;
      return this.attrs[key] ?? null;
    }
    hasAttribute(key) { return this.getAttribute(key) !== null; }
    removeAttribute(key) { delete this.attrs[key]; if (key.startsWith('data-')) delete this.dataset[dataKey(key)]; if (key === 'id') this.id = ''; }
    appendChild(child) { if (child.parentNode) child.remove(); this.children.push(child); child.parentNode = this; return child; }
    removeChild(child) { child.remove(); return child; }
    remove() { if (this.contains(document.activeElement)) document.activeElement = document.body; if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
    contains(node) { return node === this || this.children.some(n => n.contains(node)); }
    closest(selector) { for (let n = this; n; n = n.parentNode) if (matches(n, selector)) return n; return null; }
    querySelectorAll(selector) { const all = []; for (const child of this.children) { if (matches(child, selector)) all.push(child); all.push(...child.querySelectorAll(selector)); } return all; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    get offsetWidth() { return parseFloat(this.style.width) || (this.classList.contains('captions') ? 138 : this.classList.contains('tb-icon') ? 18 : this.tagName === 'BUTTON' ? 46 : 260); }
    get offsetHeight() { return parseFloat(this.style.height) || (this.id === 'taskbar' ? 52 : this.classList.contains('titlebar') ? 38 : 200); }
    getBoundingClientRect() { const x = parseFloat(this.style.left) || 0, y = parseFloat(this.style.top) || 0; return { x, y, left: x, top: y, width: this.offsetWidth, height: this.offsetHeight, right: x + this.offsetWidth, bottom: y + this.offsetHeight }; }
    getClientRects() { return this.isConnected && !this.hidden && this.style.display !== 'none' ? [this.getBoundingClientRect()] : []; }
    focus() { if (!this.isConnected || this.disabled || this.closest('[inert]')) return; const old = document.activeElement; document.activeElement = this; if (old !== this) { old?.fire('focusout', { relatedTarget: this }); this.fire('focusin'); } }
    click() { if (!this.disabled) this.fire('click', { detail: 0 }); }
    setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
    scrollIntoView() {}
  }
  document = new Events(); document.body = new Element('body'); document.documentElement = new Element('html'); document.activeElement = document.body;
  document.createElement = tag => new Element(tag);
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.querySelector = selector => document.body.querySelector(selector);
  document.getElementById = id => document.body.querySelector('#' + id);
  function add(tag, id, parent = document.body) { const el = new Element(tag); el.id = id; parent.appendChild(el); return el; }
  const desk = add('div', 'desktop'); add('div', 'desktopIcons', desk); add('div', 'windowLayer', desk); add('div', 'snapPreview', desk); add('div', 'flyoutHost', desk);
  const bar = add('div', 'taskbar', desk); bar.className = 'taskbar'; add('div', 'tbLeft', bar); add('div', 'tbCenter', bar);
  const right = add('div', 'tbRight', bar); const tray = add('button', 'trayTray', right); add('span', 'trayIcons', tray);
  const clock = add('button', 'trayClock', right); add('span', 'clockTime', clock); add('span', 'clockDate', clock);
  const notification = add('button', 'notifBtn', right); add('span', 'notifIcon', notification); add('span', 'notifDot', notification);
  const outside = add('button', 'outside');
  const window = new Events(), timers = new Map(), stored = new Map(), busEvents = new Map(); let nextTimer = 0;
  const apps = Object.fromEntries(['notes', 'files', 'about'].map(id => [id, { id, title: id, icon: id, width: 900, height: 600, minWidth: 320, minHeight: 200 }]));
  const Win = { apps, appList: () => Object.values(apps), prefs: { motion: false },
    store: { get: (key, fallback) => stored.has(key) ? stored.get(key) : fallback, set: (key, value) => { stored.set(key, value); return true; } },
    bus: { on(name, fn) { if (!busEvents.has(name)) busEvents.set(name, []); busEvents.get(name).push(fn); }, emit(name, arg) { for (const fn of busEvents.get(name) || []) fn(arg); } },
    isLocked: () => false, reduceMotion: () => true, isMobile: () => window.innerWidth <= 900,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)), debounce: fn => fn,
    esc: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtTime: () => '12:00', fmtDateTaskbar: () => '2026/10/28', fmtDateCN: () => 'date',
    avatarMarkup: () => '', notifications: [], renderNotificationBadge() {}, markAllRead() {}, clearNotifications() {}, notify() {} };
  Object.assign(window, { window, document, Win, console, URL, innerWidth: width, innerHeight: height,
    matchMedia: query => ({ matches: query.includes('900px') ? window.innerWidth <= 900 : query === '(pointer: coarse)' && coarse }),
    SITE: { taskbarPinned: ['notes', 'files'], desktop: [], startPinned: [], profile: {}, wallpapers: [] },
    ICONS: { app: () => '', glyph: () => '' }, navigator: { onLine: true },
    getComputedStyle: () => ({ getPropertyValue: name => name === '--titlebar-h' ? '38px' : '52px' }),
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id), setInterval: () => 0 });
  if (visualViewport) window.visualViewport = Object.assign(new Events(), { width, height, offsetTop: 0, scale: 1 });
  const context = vm.createContext(window);
  for (const name of ['wm', 'shell']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/assets/js/' + name + '.js'), 'utf8'), context);
  window.WM.init(); window.Shell.init();
  const flush = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  const q = selector => { const node = document.querySelector(selector); assert.ok(node, 'Missing ' + selector); return node; };
  const key = (node, name, extra = {}) => node.fire('keydown', { key: name, ...extra });
  const taskMenu = id => { const btn = q('[data-taskbar-app="' + id + '"]'); btn.focus(); btn.fire('contextmenu', { clientX: 100, clientY: 800 }); return q('[data-flyout="context"]'); };
  const menuAction = (menu, label) => { const button = menu.querySelectorAll('button').find(n => n.textContent.includes(label)); assert.ok(button, 'Missing menu action ' + label); button.click(); };
  return { window, document, WM: window.WM, Shell: window.Shell, outside, q, key, flush, taskMenu, menuAction };
}
const vp = { x: 0, y: 0, w: 1440, h: 848 };
const metrics = { titleHeight: 38, captionWidth: 138, leftInset: 44, rightInset: 4, topInset: 4, bottomInset: 2 };
function grabIntersection(r, area = vp) {
  return { w: Math.max(0, Math.min(area.x + area.w, r.x + r.w - 142) - Math.max(area.x, r.x + 44)),
    h: Math.max(0, Math.min(area.y + area.h, r.y + 36) - Math.max(area.y, r.y + 4)) };
}

test('reachable constraint preserves intentional overflow and never resizes desktop windows', () => {
  const { WM } = desktop();
  assert.equal(typeof WM.geometry?.keepReachable, 'function');
  for (const r of [{ x: -200, y: -8, w: 900, h: 600 }, { x: 1200, y: 700, w: 1900, h: 1500 }]) assert.deepEqual(plain(WM.geometry.keepReachable(r, vp, metrics)), r);
});
test('all extreme edges retain 120 by 20 draggable pixels excluding caption controls', () => {
  const { WM } = desktop();
  for (const x of [-10000, 10000]) for (const y of [-10000, 10000]) {
    const r = WM.geometry.keepReachable({ x, y, w: 900, h: 600 }, vp, metrics), visible = grabIntersection(r);
    assert.ok(visible.w >= 120 && visible.h >= 20, JSON.stringify({ r, visible })); assert.equal(r.w, 900); assert.equal(r.h, 600);
  }
});
test('snap zones reject pointers outside every edge and preserve in-bounds sides and corners', () => {
  const { WM } = desktop();
  for (const point of [{x:-1,y:0},{x:0,y:-1},{x:1441,y:100},{x:100,y:849},{x:-100,y:900}]) assert.equal(WM.geometry.snapZoneAt(point, vp, false), null);
  for (const [point, type] of [[{x:0,y:200},'left'],[{x:1440,y:200},'right'],[{x:0,y:0},'tl'],[{x:1440,y:0},'tr'],[{x:0,y:848},'bl'],[{x:1440,y:848},'br'],[{x:700,y:0},'max']]) assert.equal(WM.geometry.snapZoneAt(point, vp, false)?.type, type);
  assert.equal(WM.geometry.snapZoneAt({x:0,y:0},vp,true),null);
});
test('restore, maximize restore, snap restore and viewport resize keep a reachable offscreen rectangle', () => {
  const { WM, window, flush } = desktop(); const win = WM.open('notes'); flush();
  const r = {x:-200,y:-8,w:1600,h:1000}; win.rect = {...r}; WM.minimize(win); WM.restore(win); assert.deepEqual(plain(win.rect),r);
  WM.toggleMaximize(win); WM.toggleMaximize(win); assert.deepEqual(plain(win.rect),r);
  WM.snap(win,'left'); WM.restoreLayout(win); assert.deepEqual(plain(win.rect),r);
  window.innerWidth = 1200; window.fire('resize'); assert.deepEqual(plain(win.rect),r);
  win.rect.x = 5000; window.fire('resize'); assert.ok(win.rect.x > 1000 && win.rect.x < 1200); assert.equal(win.rect.w,1600);
});
test('pointer drag allows overflow and pointerup outside clears stale edge snapping', () => {
  const { WM, document, flush } = desktop(); const win = WM.open('notes'); flush(); win.rect = {x:100,y:100,w:900,h:600};
  const title = win.el.querySelector('.titlebar');
  title.fire('pointerdown',{button:0,pointerId:7,clientX:400,clientY:120});
  document.fire('pointermove',{pointerId:7,clientX:1,clientY:300});
  document.fire('pointerup',{pointerId:7,clientX:-30,clientY:300});
  assert.ok(win.rect.x < 0); assert.equal(win.state,'normal'); assert.equal(win.snapZone,undefined);
});
test('resizing an overflowing window does not constrain its far edge to the viewport', () => {
  const { WM, document, flush } = desktop(); const win = WM.open('notes'); flush(); win.rect = {x:1200,y:700,w:900,h:600};
  win.el.querySelector('[data-dir="e"]').fire('pointerdown',{button:0,pointerId:8,clientX:1400,clientY:720});
  document.fire('pointermove',{pointerId:8,clientX:1500,clientY:720}); document.fire('pointerup',{pointerId:8,clientX:1500,clientY:720});
  assert.equal(win.rect.x,1200); assert.equal(win.rect.w,1000); assert.equal(win.rect.y,700); assert.equal(win.rect.h,600);
});
test('explicit taskbar recovery brings a minimized overflowing window fully into view', () => {
  const { WM, taskMenu, menuAction, flush } = desktop(); const win=WM.open('notes'); flush(); win.rect={x:1200,y:700,w:1700,h:1200}; WM.minimize(win);
  menuAction(taskMenu('notes'),'移回屏幕'); assert.notEqual(win.state,'min');
  assert.ok(win.rect.x>=0 && win.rect.y>=0 && win.rect.x+win.rect.w<=vp.w && win.rect.y+win.rect.h<=vp.h);
});
test('narrow mobile layout retains the full-screen policy', () => {
  const { WM, window } = desktop(390,844); const win=WM.open('notes'); assert.equal(win.state,'max'); assert.equal(win.rect.w,390);
  window.fire('resize'); assert.equal(win.rect.w,390); assert.equal(win.rect.h,792);
  WM.minimize(win); WM.moveIntoView(win); WM.moveIntoView(win); assert.equal(win.state,'max'); assert.equal(win.rect.w,390); assert.equal(win.rect.h,792);
});
test('resize returns focus only when focus was inside a closing flyout', () => {
  const { Shell, window, document, q, outside } = desktop(); Shell.toggleCalendar(q('#trayClock')); window.fire('resize'); assert.equal(document.activeElement,q('#trayClock'));
  Shell.toggleCalendar(q('#trayClock')); outside.focus(); window.fire('resize'); assert.equal(document.activeElement,outside);
});

test('mobile Start and Search open without focusing a text input', () => {
  for (const [method, kind] of [['toggleStart', 'start'], ['toggleSearch', 'search']]) {
    const { Shell, document, q, flush } = desktop(390, 844);
    Shell[method](); flush();
    assert.equal(document.activeElement, q('[data-flyout="' + kind + '"]'));
    assert.notEqual(document.activeElement.tagName, 'INPUT');
  }
});

test('large touchscreens do not autofocus while desktop keeps immediate search focus', () => {
  const touch = desktop(1024, 768, { coarse: true });
  touch.Shell.toggleSearch(); touch.flush();
  assert.equal(touch.document.activeElement, touch.q('[data-flyout="search"]'));
  for (const method of ['toggleStart', 'toggleSearch']) {
    const mouse = desktop(); mouse.Shell[method](); mouse.flush();
    assert.equal(mouse.document.activeElement.tagName, 'INPUT');
  }
});

test('delayed opening focus never takes focus from an input the user already tapped', () => {
  const { Shell, document, q, flush } = desktop(390, 844);
  Shell.toggleStart(); const input = q('#startSearchInput'); input.focus(); flush();
  assert.equal(document.activeElement, input);
});

test('keyboard-height changes preserve mobile panels, input value and the underlying window', () => {
  for (const [method, kind, inputId] of [['toggleStart', 'start', 'startSearchInput'], ['toggleSearch', 'search', 'globalSearchInput']]) {
    const { WM, Shell, window, document, q, flush } = desktop(390, 844);
    const app = WM.open('notes'); flush(); Shell[method](); flush();
    const panel = q('[data-flyout="' + kind + '"]'); const input = q('#' + inputId);
    input.focus(); input.value = '合成搜索'; input.fire('input');
    window.innerHeight = 480; window.fire('resize'); flush();
    assert.equal(q('[data-flyout="' + kind + '"]'), panel);
    assert.equal(document.activeElement, input); assert.equal(input.value, '合成搜索');
    assert.equal(app.state, 'max'); assert.equal(WM.activeWin(), app);
    window.innerHeight = 844; window.fire('resize'); flush();
    assert.equal(q('[data-flyout="' + kind + '"]'), panel);
    assert.equal(document.activeElement, input);
  }
});

test('visual viewport keyboard resizing and panning updates panel space without closing it', () => {
  const { Shell, window, document, q, flush } = desktop(390, 844, { visualViewport: true });
  Shell.toggleSearch(); flush(); const panel = q('[data-flyout="search"]'), input = q('#globalSearchInput'); input.focus();
  window.visualViewport.height = 480; window.visualViewport.fire('resize');
  assert.equal(q('#flyoutHost').style.getPropertyValue('--flyout-viewport-height'), '480px');
  assert.equal(q('#flyoutHost').style.getPropertyValue('--flyout-inset-bottom'), '364px');
  window.visualViewport.offsetTop = 60; window.visualViewport.fire('scroll');
  assert.equal(q('#flyoutHost').style.getPropertyValue('--flyout-inset-bottom'), '304px');
  assert.equal(q('[data-flyout="search"]'), panel); assert.equal(document.activeElement, input);
});

test('returning from all Start apps on mobile does not summon the input keyboard', () => {
  const { Shell, document, q, flush } = desktop(390, 844);
  Shell.toggleStart(); flush(); q('[data-start-all]').click(); q('[data-start-back]').click();
  assert.notEqual(document.activeElement.tagName, 'INPUT');
  assert.equal(document.activeElement, q('[data-flyout="start"]'));
});

test('rotation or width changes still dismiss panels and restore the trigger', () => {
  const { Shell, window, document, q, flush } = desktop(390, 844);
  Shell.toggleStart(); flush(); q('#startSearchInput').focus();
  window.innerWidth = 844; window.innerHeight = 390; window.fire('resize'); flush();
  assert.equal(document.querySelector('[data-flyout="start"]'), null);
  assert.equal(document.activeElement, q('#startBtn'));
});
test('calendar remembers the actual notification trigger and expanded owner', () => {
  const { Shell, document, q, key } = desktop(); Shell.toggleCalendar(q('#notifBtn'));
  assert.equal(q('#notifBtn').getAttribute('aria-expanded'),'true'); assert.equal(q('#trayClock').getAttribute('aria-expanded'),'false');
  key(document.activeElement,'Escape'); assert.equal(document.activeElement,q('#notifBtn')); assert.equal(q('#notifBtn').getAttribute('aria-expanded'),'false');
  Shell.toggleCalendar(q('#trayClock')); Shell.toggleCalendar(q('#notifBtn')); assert.ok(q('[data-flyout="calendar"]')); key(document.activeElement,'Escape'); assert.equal(document.activeElement,q('#notifBtn'));
});
test('taskbar unpin preserves scroll and follows a replacement of the same running app', () => {
  const { WM, q, document, taskMenu, menuAction }=desktop(); WM.open('notes'); const host=q('#tbCenter'); host.scrollLeft=91; host.scrollTop=7; const old=q('[data-taskbar-app="notes"]');
  menuAction(taskMenu('notes'),'取消固定'); assert.equal(document.activeElement,q('[data-taskbar-app="notes"]')); assert.notEqual(document.activeElement,old); assert.equal(host.scrollLeft,91); assert.equal(host.scrollTop,7);
});
test('unpin of a closed app chooses a surviving neighbor and never steals outside focus', () => {
  const { q, document, outside, taskMenu, menuAction }=desktop(); menuAction(taskMenu('notes'),'取消固定'); assert.equal(document.activeElement,q('[data-taskbar-app="files"]'));
  const menu=taskMenu('files'); outside.focus(); menuAction(menu,'取消固定'); assert.equal(document.activeElement,outside);
});
test('Snap menu uses one roving tab stop; Tab and ShiftTab close without preventing native traversal', () => {
  const { WM, q, document, key }=desktop(); const win=WM.open('notes'); WM.openSnapLayouts(win,true); let menu=q('[data-flyout="snap"]'); let buttons=menu.querySelectorAll('button');
  assert.equal(buttons.filter(b=>b.tabIndex===0).length,1); key(document.activeElement,'ArrowRight'); assert.equal(document.activeElement,buttons[1]); assert.equal(buttons[1].tabIndex,0); assert.equal(buttons[0].tabIndex,-1);
  let event=key(document.activeElement,'Tab'); assert.equal(event.defaultPrevented,false); assert.equal(document.querySelector('[data-flyout="snap"]'),null);
  WM.openSnapLayouts(win,true); event=key(document.activeElement,'Tab',{shiftKey:true}); assert.equal(event.defaultPrevented,false); assert.equal(document.querySelector('[data-flyout="snap"]'),null);
});
test('Snap focus leaving or resize closes it without redirecting unrelated focus', () => {
  const { WM, window, document, outside }=desktop(); const win=WM.open('notes'); WM.openSnapLayouts(win,true); outside.focus(); assert.equal(document.querySelector('[data-flyout="snap"]'),null); assert.equal(document.activeElement,outside);
  WM.openSnapLayouts(win,false); outside.focus(); window.fire('resize'); assert.equal(document.activeElement,outside);
  WM.openSnapLayouts(win,true); window.innerWidth=390; window.fire('resize'); assert.ok(document.activeElement===win.el, 'Narrow resize returns to the window instead of a disabled maximize button');
});
