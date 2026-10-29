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
  // 内存镜像保证禁用存储/配额不足时，本次访问仍能使用偏好和草稿。
  var memory = Object.create(null);
  var store = {
    get: function (key, fallback) {
      try {
        var v = Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : localStorage.getItem(PREFIX + key);
        return v === null || v === undefined ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var json;
      try { json = JSON.stringify(value); if (json === undefined) return false; } catch (e) { return false; }
      memory[key] = json;
      try { localStorage.setItem(PREFIX + key, json); return true; } catch (e) { return false; }
    },
    del: function (key) {
      memory[key] = null;
      try { localStorage.removeItem(PREFIX + key); return true; } catch (e) { return false; }
    }
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
    wall: 'chenyu',
    align: 'center',
    accent: '#28776b',
    motion: true
  };
  function validPref(key, value) {
    if (key === 'themeMode') return ['light', 'dark', 'auto'].indexOf(value) !== -1;
    if (key === 'align') return ['center', 'left'].indexOf(value) !== -1;
    if (key === 'motion') return typeof value === 'boolean';
    if (key === 'accent') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    if (key === 'wall') return typeof value === 'string' && (['chenyu', 'bloom', 'dusk', 'aurora', 'sakura', 'solid'].indexOf(value) !== -1 || ((window.SITE || {}).wallpapers || []).some(function (w) { return w.id === value; }));
    return false;
  }
  var prefs = Object.assign({}, defaults);
  var savedPrefs = store.get('prefs', {});
  if (savedPrefs && typeof savedPrefs === 'object' && !Array.isArray(savedPrefs)) {
    Object.keys(defaults).forEach(function (key) { if (validPref(key, savedPrefs[key])) prefs[key] = savedPrefs[key]; });
  }

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
    if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#152c29' : '#e8efdf');
  }

  var prefsStorageWarned = false;
  function savePrefs() {
    var ok = store.set('prefs', prefs);
    if (!ok && !prefsStorageWarned) {
      prefsStorageWarned = true;
      notify({ icon: 'info', title: '浏览器存储不可用', body: '外观设置在本次访问中仍有效，刷新后可能恢复默认。' });
    }
    return ok;
  }

  function setPref(key, value) {
    if (!validPref(key, value) || prefs[key] === value) return false;
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
    notifications.length = 0;
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

  /* ---------------- 服务端门禁桥接 ---------------- */
  // No browser storage flag or URL parameter grants authorization.
  function showLock() { return window.DesktopGate ? window.DesktopGate.lock() : Promise.resolve(false); }
  function hideLock(instant) { return window.DesktopGate ? window.DesktopGate.unlock(instant) : Promise.resolve(false); }
  function initLock() { return window.DesktopGate ? window.DesktopGate.init() : Promise.resolve(false); }

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

  function wallpaperUrl(id) {
    var item = ((window.SITE || {}).wallpapers || []).filter(function (w) { return w.id === id; })[0];
    if (item && item.src && safeUrl(item.src)) return item.src;
    var map = { chenyu: 'assets/img/wall-chenyu.webp', bloom: 'assets/img/wall-bloom.jpg', dusk: 'assets/img/wall-dusk.jpg', aurora: 'assets/img/wall-aurora.jpg', sakura: 'assets/img/wall-sakura.jpg', solid: 'assets/img/wall-solid.jpg' };
    return map[id] || map.chenyu;
  }
  function syncLockWallpaper() {
    var wall = $('#lockWall');
    if (wall) wall.style.backgroundImage = 'url(' + JSON.stringify(wallpaperUrl(prefs.wall)) + ')';
  }

  /* ---------------- 安全 URL / 统一头像 ---------------- */
  function safeUrl(raw, allowMail) {
    if (typeof raw !== 'string' || !raw.trim() || /[\u0000-\u001f\u007f]/.test(raw)) return '';
    try {
      var url = new URL(raw, window.location.href);
      if (url.username || url.password) return '';
      return url.protocol === 'https:' || url.protocol === 'http:' || (allowMail && url.protocol === 'mailto:') ? url.href : '';
    } catch (e) { return ''; }
  }
  function resolveProjectUrl(appId, productionURL, hostname) {
    var host = hostname === undefined ? window.location.hostname : hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      if (appId === 'liyun-explorer') return 'http://127.0.0.1:5174/';
      if (appId === 'genshin-start') return 'http://127.0.0.1:8081/';
      if (appId === 'genshin-original') return 'http://127.0.0.1:8081/legacy.html';
      if (appId === 'voxel-campus') return 'http://127.0.0.1:5180/';
    }
    return productionURL;
  }
  function openExternal(raw) {
    var url = safeUrl(raw);
    if (!url) { notify({ icon: 'info', title: '链接不可用', body: '仅支持有效的 HTTP 或 HTTPS 地址。' }); return false; }
    try {
      // noopener 下返回 null 并不能证明被拦截；绝不再开第二次、不回退当前页。
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } catch (e) {
      notify({ icon: 'info', title: '浏览器未能打开链接', body: '请检查浏览器的弹出窗口权限。' });
      return false;
    }
  }
  function localizeProjectLinks() {
    $$('a[data-project-link]').forEach(function (a) {
      var url = resolveProjectUrl(a.dataset.projectLink, a.getAttribute('href'));
      if (safeUrl(url)) a.href = url;
      a.rel = 'noopener noreferrer';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', localizeProjectLinks);
  else localizeProjectLinks();
  function avatarMarkup() {
    var p = (window.SITE || {}).profile || {};
    var url = safeUrl(p.avatar);
    var fallback = esc(p.avatarText || 'A');
    return url ? '<img class="profile-avatar" src="' + esc(url) + '" alt="' + esc((p.name || '用户') + ' 的头像') + '" draggable="false"><span class="avatar-fallback" hidden>' + fallback + '</span>' : fallback;
  }
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.classList && img.classList.contains('profile-avatar')) {
      img.hidden = true;
      if (img.nextElementSibling) img.nextElementSibling.hidden = false;
    }
  }, true);

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
    bus: bus, store: store, validPref: validPref,
    safeUrl: safeUrl, resolveProjectUrl: resolveProjectUrl, openExternal: openExternal,
    avatarMarkup: avatarMarkup, wallpaperUrl: wallpaperUrl,
    prefs: prefs, defaults: defaults,
    applyPrefs: applyPrefs, setPref: setPref, savePrefs: savePrefs,
    effectiveTheme: effectiveTheme,
    fmtTime: fmtTime, fmtDateTaskbar: fmtDateTaskbar, fmtDateCN: fmtDateCN, fmtDateShort: fmtDateShort, WEEK: WEEK,
    startClock: startClock,
    notify: notify, toast: toast, notifications: notifications,
    clearNotifications: clearNotifications, markAllRead: markAllRead, renderNotificationBadge: renderNotificationBadge,
    initLock: initLock, showLock: showLock, hideLock: hideLock,
    isLocked: function () { return !window.DesktopGate || window.DesktopGate.isLocked(); },
    reduceMotion: function () { return !prefs.motion || reduceMotionMQ.matches; },
    shade: shade, rgba: rgba,
    isMobile: function () { return window.matchMedia('(max-width: 900px)').matches; }
  };

  return api;
})();
