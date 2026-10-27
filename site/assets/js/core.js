/* =====================================================================
   内核：状态 / 偏好 / 主题 / 时钟 / 通知 / 锁屏 / 小工具
   ===================================================================== */
window.Win = (function () {
  'use strict';

  var PREFIX = 'win11home.v1.';
  var reduceMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- 事件总线 ---------------- */
  var bus = {
    map: {},
    on: function (name, fn) { (bus.map[name] = bus.map[name] || []).push(fn); return function () { bus.off(name, fn); }; },
    off: function (name, fn) { var a = bus.map[name] || []; var i = a.indexOf(fn); if (i > -1) a.splice(i, 1); },
    emit: function (name, data) { (bus.map[name] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error('[bus]', name, e); } }); }
  };

  /* ---------------- 本地存储 ---------------- */
  var store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(PREFIX + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 隐私模式忽略 */ }
    },
    del: function (key) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} }
  };

  /* ---------------- 颜色工具 ---------------- */
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join('');
  }
  function shade(hex, amount) {
    var c = hexToRgb(hex);
    var t = amount < 0 ? 0 : 255, p = Math.abs(amount);
    return rgbToHex(c.r + (t - c.r) * p, c.g + (t - c.g) * p, c.b + (t - c.b) * p);
  }
  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  /* ---------------- 偏好 ---------------- */
  var defaults = {
    themeMode: 'light',   // light | dark | auto
    wall: 'bloom',
    align: 'center',
    accent: '#0067c0',
    motion: true
  };
  var prefs = Object.assign({}, defaults, store.get('prefs', {}));

  function effectiveTheme() {
    if (prefs.themeMode === 'auto') return darkMQ.matches ? 'dark' : 'light';
    return prefs.themeMode === 'dark' ? 'dark' : 'light';
  }

  function applyAccent(hex) {
    var root = document.documentElement.style;
    root.setProperty('--accent', hex);
    root.setProperty('--accent-hover', shade(hex, 0.10));
    root.setProperty('--accent-pressed', shade(hex, 0.20));
    root.setProperty('--accent-soft', rgba(hex, 0.12));
    root.setProperty('--accent-soft-2', rgba(hex, 0.2));
  }

  function applyPrefs() {
    var html = document.documentElement;
    html.dataset.theme = effectiveTheme();
    html.dataset.wall = prefs.wall;
    html.dataset.align = prefs.align;
    applyAccent(prefs.accent);
    html.dataset.motion = prefs.motion ? 'on' : 'off';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#0b1220' : '#0a2472');
  }

  function savePrefs() { store.set('prefs', prefs); }

  function setPref(key, value) {
    if (prefs[key] === value) return;
    prefs[key] = value;
    savePrefs();
    applyPrefs();
    bus.emit('prefs', prefs);
  }

  darkMQ.addEventListener && darkMQ.addEventListener('change', function () {
    if (prefs.themeMode === 'auto') { applyPrefs(); bus.emit('prefs', prefs); }
  });

  /* ---------------- 时间格式化 ---------------- */
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtTime(d, withSeconds) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + (withSeconds ? ':' + pad(d.getSeconds()) : '');
  }
  function fmtDateTaskbar(d) { return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()); }
  function fmtDateCN(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function fmtDateShort(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }

  /* ---------------- 通知 ---------------- */
  var notifications = [];
  var notifySeq = 0;

  function renderNotificationBadge() {
    var dot = $('#notifDot');
    if (!dot) return;
    var hasUnread = notifications.some(function (n) { return n.unread; });
    dot.style.display = hasUnread ? '' : 'none';
  }

  function notify(opts) {
    var item = {
      id: 'n' + (++notifySeq),
      icon: opts.icon || 'info',
      title: opts.title || '',
      body: opts.body || '',
      time: opts.time || '刚刚',
      unread: true,
      sticky: !!opts.sticky
    };
    notifications.unshift(item);
    if (notifications.length > 24) notifications.pop();
    renderNotificationBadge();
    bus.emit('notifications', notifications);
    if (opts.toast !== false) toast(item);
    return item;
  }

  function clearNotifications() {
    notifications.forEach(function (n) { n.unread = false; });
    renderNotificationBadge();
    bus.emit('notifications', notifications);
  }

  function markAllRead() {
    notifications.forEach(function (n) { n.unread = false; });
    renderNotificationBadge();
    bus.emit('notifications', notifications);
  }

  function toast(item) {
    var host = $('#toastHost');
    if (!host) return;
    var node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.innerHTML =
      '<span class="toast-icon">' + ICONS.app(item.icon) + '</span>' +
      '<div class="toast-content" style="min-width:0;flex:1">' +
        '<div class="toast-title"></div>' +
        '<div class="toast-body"></div>' +
      '</div>' +
      '<button class="toast-dismiss" aria-label="关闭通知">' + ICONS.glyph('close') + '</button>';
    node.querySelector('.toast-title').textContent = item.title;
    node.querySelector('.toast-body').textContent = item.body;
    var timer = null;
    function dismiss() {
      if (!node.parentNode) return;
      clearTimeout(timer);
      node.classList.add('is-hiding');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 180);
    }
    node.querySelector('.toast-dismiss').addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
    node.addEventListener('click', function (e) { if (e.target.closest('.toast-dismiss')) return; dismiss(); bus.emit('toast:click', item); });
    host.appendChild(node);
    while (host.children.length > 4) host.removeChild(host.firstElementChild);
    timer = setTimeout(dismiss, item.sticky ? 12000 : 5600);
  }

  /* ---------------- 时钟 ---------------- */
  var clockTimer = null;
  function tick() {
    var now = new Date();
    bus.emit('clock', now);
    $$('[data-clock="time"]').forEach(function (n) { n.textContent = fmtTime(now); });
    $$('[data-clock="time-sec"]').forEach(function (n) { n.textContent = fmtTime(now, true); });
    $$('[data-clock="date"]').forEach(function (n) { n.textContent = fmtDateTaskbar(now); });
    $$('[data-clock="date-cn"]').forEach(function (n) { n.textContent = fmtDateCN(now); });
    $$('[data-clock="date-short"]').forEach(function (n) { n.textContent = fmtDateShort(now); });
    $$('[data-clock="weekday"]').forEach(function (n) { n.textContent = WEEK[now.getDay()]; });
  }
  function startClock() {
    if (clockTimer) return;
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ---------------- 锁屏 ---------------- */
  var lockEl, locked = false;

  function showLock() {
    if (!lockEl) lockEl = $('#lockScreen');
    if (!lockEl) return;
    locked = true;
    lockEl.hidden = false;
    lockEl.classList.remove('is-unlocking');
    updateLockClock();
    document.body.classList.add('is-locked');
    closeAllPopupsForLock();
  }

  function hideLock(instant) {
    if (!lockEl) lockEl = $('#lockScreen');
    if (!lockEl || !locked) return;
    locked = false;
    document.body.classList.remove('is-locked');
    if (instant) {
      lockEl.hidden = true;
      try { sessionStorage.setItem('win11home.unlocked', '1'); } catch (e) {}
      bus.emit('unlock', { instant: true });
      return;
    }
    lockEl.classList.add('is-unlocking');
    setTimeout(function () {
      lockEl.hidden = true;
      try { sessionStorage.setItem('win11home.unlocked', '1'); } catch (e) {}
      bus.emit('unlock', { instant: false });
    }, 460);
  }

  function updateLockClock() {
    var now = new Date();
    var t = $('#lockClock'), d = $('#lockDate'), w = $('#lockWeekday');
    if (t) t.textContent = fmtTime(now);
    if (d) d.textContent = fmtDateCN(now);
    if (w) w.textContent = WEEK[now.getDay()];
  }

  function closeAllPopupsForLock() {
    bus.emit('lock:request-close-all');
  }

  function initLock() {
    lockEl = $('#lockScreen');
    if (!lockEl) return;
    updateLockClock();
    startClock();
    setInterval(function () { if (locked) updateLockClock(); }, 1000);
    var avatar = $('#lockAvatar'), user = $('#lockUser');
    if (avatar) avatar.textContent = SITE.profile.avatarText || 'A';
    if (user) user.textContent = SITE.profile.name;
    var lockWall = $('#lockWall');
    if (lockWall) {
      var wallCss = getComputedStyle(document.documentElement).getPropertyValue('--wall-lock');
      // 用与桌面相同的壁纸
      var wallMap = {
        bloom: 'assets/img/wall-bloom.jpg',
        dusk: 'assets/img/wall-dusk.jpg',
        aurora: 'assets/img/wall-aurora.jpg',
        sakura: 'assets/img/wall-sakura.jpg',
        solid: 'assets/img/wall-solid.jpg'
      };
      var url = wallMap[prefs.wall] || wallMap.bloom;
      lockWall.style.backgroundImage = 'url("' + url + '"), ' + lockWallGradient(prefs.wall);
    }

    function unlockNow() {
      if (!locked) return;
      hideLock(false);
    }
    lockEl.addEventListener('pointerdown', unlockNow);
    lockEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key.length === 1) unlockNow();
    });
    document.addEventListener('keydown', function (e) {
      if (locked) { unlockNow(); }
    });

    var already = false;
    try { already = sessionStorage.getItem('win11home.unlocked') === '1'; } catch (e) {}
    if (already) hideLock(true); else showLock();
  }

  function lockWallGradient(id) {
    var map = {
      bloom: 'radial-gradient(120% 100% at 18% 12%, #7fc8ff 0%, rgba(127,200,255,0) 58%), radial-gradient(110% 90% at 82% 18%, #cfd6ff 0%, rgba(207,214,255,0) 60%), linear-gradient(145deg, #0a2472 0%, #1d4ed8 34%, #4f86f7 62%, #a9c6ff 100%)',
      dusk: 'radial-gradient(120% 100% at 20% 10%, #6f5cff 0%, rgba(111,92,255,0) 55%), radial-gradient(110% 90% at 85% 25%, #ff6fa5 0%, rgba(255,111,165,0) 55%), linear-gradient(150deg, #080b1f 0%, #131a45 40%, #2a2470 70%, #14204d 100%)',
      aurora: 'radial-gradient(120% 100% at 15% 85%, #0f766e 0%, rgba(15,118,110,0) 60%), radial-gradient(110% 90% at 80% 12%, #22d3ee 0%, rgba(34,211,238,0) 55%), linear-gradient(160deg, #041f2b 0%, #073b4c 40%, #0b525b 70%, #04222d 100%)',
      sakura: 'radial-gradient(120% 100% at 20% 15%, #ffd9e8 0%, rgba(255,217,232,0) 55%), radial-gradient(110% 90% at 82% 20%, #ffe6c7 0%, rgba(255,230,199,0) 55%), linear-gradient(150deg, #fbd3e3 0%, #f9c3d8 40%, #ffd9c7 100%)',
      solid: 'linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #334155 100%)'
    };
    return map[id] || map.bloom;
  }

  /* ---------------- 小工具 ---------------- */
  function el(tag, className, html) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function debounce(fn, wait) {
    var t; return function () { var args = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, wait); };
  }
  function uid(prefix) { return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8); }

  /* ---------------- 对外接口 ---------------- */
  var api = {
    $: $, $$: $$, el: el, esc: esc, clamp: clamp, debounce: debounce, uid: uid,
    bus: bus, store: store,
    prefs: prefs, defaults: defaults,
    applyPrefs: applyPrefs, setPref: setPref, savePrefs: savePrefs,
    effectiveTheme: effectiveTheme,
    fmtTime: fmtTime, fmtDateTaskbar: fmtDateTaskbar, fmtDateCN: fmtDateCN, fmtDateShort: fmtDateShort, WEEK: WEEK,
    startClock: startClock,
    notify: notify, toast: toast, notifications: notifications,
    clearNotifications: clearNotifications, markAllRead: markAllRead, renderNotificationBadge: renderNotificationBadge,
    initLock: initLock, showLock: showLock, hideLock: hideLock,
    isLocked: function () { return locked; },
    reduceMotion: function () { return !prefs.motion || reduceMotionMQ.matches; },
    shade: shade, rgba: rgba,
    isMobile: function () { return window.matchMedia('(max-width: 900px)').matches; }
  };

  return api;
})();
