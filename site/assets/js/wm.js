/* =====================================================================
   窗口管理器：打开 / 关闭 / 最小化 / 最大化 / 拖动 / 缩放 / 贴边分屏
   ===================================================================== */
window.WM = (function () {
  'use strict';

  var layer, snapEl;
  var wins = {};          // id -> win
  var order = [];         // 从底到顶的 id 列表
  var activeId = null;
  var zBase = 100;
  var seq = 0;

  function taskbarH() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h');
    return parseFloat(v) || 48;
  }
  function viewport() {
    var m = window.matchMedia('(max-width: 900px)').matches;
    if (m) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - taskbarH() };
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - taskbarH() };
  }
  function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

  function emit(name, data) { Win.bus.emit('wm:' + name, data); Win.bus.emit('wm:change', { name: name, data: data }); }

  function activeWin() { return activeId ? wins[activeId] : null; }

  function byApp(appId) {
    return order.map(function (id) { return wins[id]; }).filter(function (w) { return w && w.appId === appId && w.state !== 'closed'; });
  }

  /* ---------------- 定位 ---------------- */
  function clampRect(rect, opts) {
    var vp = viewport();
    var minW = (opts && opts.minWidth) || 320;
    var minH = (opts && opts.minHeight) || 200;
    var w = Math.min(Math.max(rect.w, minW), vp.w - 16);
    var h = Math.min(Math.max(rect.h, minH), vp.h - 16);
    var x = Math.min(Math.max(rect.x, 8), vp.w - w - 8);
    var y = Math.min(Math.max(rect.y, 8), vp.h - h - 8);
    return { x: x, y: y, w: w, h: h };
  }

  function defaultRect(opts) {
    var vp = viewport();
    var w = Math.min(opts.width || 900, vp.w - 48);
    var h = Math.min(opts.height || 600, vp.h - 48);
    var count = order.length;
    var offset = (count % 5) * 28;
    var x = Math.round((vp.w - w) / 2 + offset - 56);
    var y = Math.round((vp.h - h) / 2 + offset - 40);
    return clampRect({ x: x, y: y, w: w, h: h }, opts);
  }

  function css(w) {
    w.el.style.left = w.rect.x + 'px';
    w.el.style.top = w.rect.y + 'px';
    w.el.style.width = w.rect.w + 'px';
    w.el.style.height = w.rect.h + 'px';
  }

  /* ---------------- 创建窗口 ---------------- */
  function open(appId) {
    var app = (window.Win.apps || {})[appId];
    if (!app) { console.warn('[WM] 未注册的应用', appId); return null; }

    /* 快捷方式型应用（app.external）：不创建窗口，直接在新标签页打开外部项目 */
    if (app.external) {
      var opened = null;
      try { opened = window.open(app.external, '_blank', 'noopener,noreferrer'); } catch (err) { opened = null; }
      if (!opened) {
        try { window.open(app.external, '_blank'); } catch (err2) { location.href = app.external; }
      }
      if (window.Win && typeof window.Win.notify === 'function') {
        window.Win.notify({ icon: app.icon || 'globe', title: '正在打开 ' + app.title, body: app.shortcutHint || app.external });
      }
      return null;
    }

    if (app.single !== false) {
      var same = byApp(appId).filter(function (w) { return w.state !== 'closed'; })[0];
      if (same) { restore(same); focus(same); return same; }
    }

    var vp = viewport();
    seq += 1;
    var win = {
      id: 'win-' + seq,
      appId: appId,
      app: app,
      title: app.title,
      icon: app.icon,
      state: 'normal',           // normal | max | min
      rect: defaultRect(app),
      prevRect: null,
      el: null,
      bodyEl: null,
      taskbarBtn: null,
      opening: true
    };

    var el = document.createElement('div');
    el.className = 'window is-opening' + (isMobile() ? ' is-maximized' : '');
    el.dataset.id = win.id;
    el.dataset.app = appId;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', app.title);
    el.innerHTML =
      '<div class="titlebar">' +
        '<div class="tb-app">' +
          '<span class="tb-icon">' + ICONS.app(app.icon) + '</span>' +
          '<span class="tb-title"></span>' +
        '</div>' +
        '<div class="captions">' +
          '<button class="caption-btn caption-min" aria-label="最小化" title="最小化">' + ICONS.glyph('minimize') + '</button>' +
          '<button class="caption-btn caption-max" aria-label="最大化" title="最大化">' + ICONS.glyph('maximize') + '</button>' +
          '<button class="caption-btn caption-close" aria-label="关闭" title="关闭">' + ICONS.glyph('close') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="window-body"></div>' +
      ['n','s','w','e','nw','ne','sw','se'].map(function (d) {
        return '<div class="rs-handle rs-' + d + '" data-dir="' + d + '"></div>';
      }).join('');
    el.querySelector('.tb-title').textContent = app.title;
    layer.appendChild(el);
    win.el = el;
    win.bodyEl = el.querySelector('.window-body');

    if (isMobile()) { win.state = 'max'; }

    wins[win.id] = win;
    order.push(win.id);
    zBase += 1;
    el.style.zIndex = zBase;

    css(win);
    if (win.state === 'max') applyMaximized(win, true);
    if (isMobile()) css(win);

    bindWindow(win);
    focus(win);

    // 渲染内容
    if (typeof app.render === 'function') {
      try {
        app.render(win.bodyEl, {
          win: win,
          app: app,
          close: function () { close(win); },
          setTitle: function (t) { setTitle(win, t); },
          notify: Win.notify,
          prefs: Win.prefs,
          setPref: Win.setPref
        });
      } catch (err) {
        console.error('[app:' + appId + ']', err);
        win.bodyEl.innerHTML = '<div style="padding:32px;color:var(--text-secondary);font-size:13px">应用渲染失败：' +
          Win.esc(err && err.message ? err.message : String(err)) + '</div>';
      }
    }

    setTimeout(function () { el.classList.remove('is-opening'); win.opening = false; }, 240);
    emit('open', win);
    return win;
  }

  function setTitle(win, title) {
    win.title = title;
    win.el.querySelector('.tb-title').textContent = title;
    emit('title', win);
  }

  /* ---------------- 关闭 ---------------- */
  function close(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed') return;
    var app = win.app || {};
    if (typeof app.onClose === 'function') { try { app.onClose(win); } catch (e) {} }
    win.state = 'closed';
    win.el.classList.add('is-closing');
    var el = win.el;
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 150);
    delete wins[win.id];
    order = order.filter(function (id) { return id !== win.id; });
    if (activeId === win.id) {
      activeId = null;
      var next = order.slice().reverse().filter(function (id) { return wins[id] && wins[id].state !== 'min'; })[0];
      if (next) focus(wins[next]);
    }
    emit('close', win);
  }

  /* ---------------- 焦点 ---------------- */
  function focus(win) {
    if (!win || win.state === 'closed') return;
    activeId = win.id;
    zBase += 1;
    win.el.style.zIndex = zBase;
    order = order.filter(function (id) { return id !== win.id; });
    order.push(win.id);
    Object.keys(wins).forEach(function (id) {
      wins[id].el.classList.toggle('is-active', id === win.id);
    });
    emit('focus', win);
  }

  /* ---------------- 最小化 / 还原 ---------------- */
  function minimizeTarget(win) {
    var btn = win.taskbarBtn || document.querySelector('[data-taskbar-app="' + win.appId + '"]');
    var r = btn ? btn.getBoundingClientRect() : null;
    if (!r) return { dx: 0, dy: 120, scale: 0.2 };
    var vp = viewport();
    var wr = win.el.getBoundingClientRect();
    var wx = wr.left + wr.width / 2;
    var wy = wr.top + wr.height / 2;
    var bx = r.left + r.width / 2;
    var by = r.top + r.height / 2;
    return { dx: bx - wx, dy: by - wy, scale: 0.12 };
  }

  function minimize(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed' || win.state === 'min') return;
    win.prevState = win.state;
    if (win.state === 'max') win.wasMax = true;
    win.state = 'min';
    var t = minimizeTarget(win);
    win.el.style.transition = 'transform 240ms cubic-bezier(0.8,0,0.2,1), opacity 200ms linear';
    win.el.style.transformOrigin = 'center';
    win.el.style.transform = 'translate(' + t.dx + 'px,' + t.dy + 'px) scale(' + t.scale + ')';
    win.el.style.opacity = '0';
    win.el.style.pointerEvents = 'none';
    setTimeout(function () {
      if (win.state === 'min') win.el.style.display = 'none';
    }, 240);
    if (activeId === win.id) {
      activeId = null;
      var next = order.slice().reverse().filter(function (id) { return wins[id] && wins[id].state !== 'min'; })[0];
      if (next) focus(wins[next]); else Object.keys(wins).forEach(function (id) { wins[id].el.classList.remove('is-active'); });
    }
    emit('minimize', win);
  }

  function restore(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed') return;
    if (win.state !== 'min') return;
    win.state = win.wasMax ? 'max' : 'normal';
    win.el.style.display = '';
    var t = minimizeTarget(win);
    win.el.style.transition = 'none';
    win.el.style.transform = 'translate(' + t.dx + 'px,' + t.dy + 'px) scale(' + t.scale + ')';
    win.el.style.opacity = '0';
    // 强制回流后再恢复
    void win.el.offsetWidth;
    win.el.style.transition = 'transform 260ms cubic-bezier(0.1,0.9,0.2,1), opacity 200ms linear';
    win.el.style.transform = '';
    win.el.style.opacity = '1';
    win.el.style.pointerEvents = '';
    setTimeout(function () {
      win.el.style.transition = '';
      win.el.style.transform = '';
      win.el.style.opacity = '';
      win.el.style.transformOrigin = '';
    }, 300);
    focus(win);
    emit('restore', win);
  }

  /* ---------------- 最大化 ---------------- */
  function applyMaximized(win, on) {
    var vp = viewport();
    if (on) {
      win.prevRect = { x: win.rect.x, y: win.rect.y, w: win.rect.w, h: win.rect.h };
      win.rect = { x: 0, y: 0, w: vp.w, h: vp.h };
      win.el.classList.add('is-maximized');
    } else {
      win.el.classList.remove('is-maximized');
      win.rect = win.prevRect || defaultRect(win.app);
    }
    css(win);
    updateMaxButton(win);
  }

  function toggleMaximize(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed' || win.state === 'min') return;
    if (isMobile()) return;
    if (win.state === 'max') {
      win.state = 'normal';
      applyMaximized(win, false);
    } else {
      win.state = 'max';
      applyMaximized(win, true);
    }
    emit('maximize', win);
  }

  function updateMaxButton(win) {
    var btn = win.el.querySelector('.caption-max');
    if (!btn) return;
    var maxed = win.state === 'max';
    btn.innerHTML = ICONS.glyph(maxed ? 'restore' : 'maximize');
    btn.setAttribute('aria-label', maxed ? '向下还原' : '最大化');
    btn.setAttribute('title', maxed ? '向下还原' : '最大化');
  }

  /* ---------------- 拖动 / 缩放 ---------------- */
  function bindWindow(win) {
    var el = win.el;
    var titlebar = el.querySelector('.titlebar');
    var maxBtn = el.querySelector('.caption-max');

    el.addEventListener('pointerdown', function (e) {
      if (win.state === 'closed') return;
      if (!el.classList.contains('is-active')) focus(win);
      if (e.target.closest('.captions')) return;
      if (e.target.closest('.rs-handle')) return;
      if (e.target.closest('.titlebar') && !isMobile()) startDrag(e, win);
    }, true);

    titlebar.addEventListener('dblclick', function (e) {
      if (e.target.closest('.captions')) return;
      toggleMaximize(win);
    });

    el.querySelector('.caption-min').addEventListener('click', function () { minimize(win); });
    maxBtn.addEventListener('click', function () { toggleMaximize(win); });
    el.querySelector('.caption-close').addEventListener('click', function () { close(win); });

    Array.prototype.forEach.call(el.querySelectorAll('.rs-handle'), function (h) {
      h.addEventListener('pointerdown', function (e) {
        if (isMobile() || win.state === 'max') return;
        e.preventDefault();
        e.stopPropagation();
        startResize(e, win, h.dataset.dir);
      });
    });
  }

  function startDrag(e, win) {
    if (win.state === 'min') return;
    if (win.state === 'max') {
      // 从最大化状态拖出：先还原
      var vp = viewport();
      var ratio = (e.clientX - win.rect.x) / (win.rect.w || 1);
      var w = Math.min((win.prevRect || {}).w || 900, vp.w - 16);
      var x = Win.clamp(e.clientX - w * ratio, 8, vp.w - w - 8);
      var y = 16;
      win.state = 'normal';
      win.el.classList.remove('is-maximized');
      win.rect = { x: x, y: y, w: w, h: (win.prevRect || {}).h || 600 };
      css(win);
      updateMaxButton(win);
    }
    var start = { px: e.clientX, py: e.clientY, x: win.rect.x, y: win.rect.y };
    var vp = viewport();
    var moved = false;
    var snapZone = null;
    win.el.classList.add('is-dragging');
    document.body.classList.add('is-dragging');
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}

    function onMove(ev) {
      if (Math.abs(ev.clientX - start.px) + Math.abs(ev.clientY - start.py) > 2) moved = true;
      var x = start.x + (ev.clientX - start.px);
      var y = start.y + (ev.clientY - start.py);
      var maxX = vp.w - win.rect.w - 8;
      var maxY = vp.h - win.rect.h - 8;
      win.rect.x = Win.clamp(x, -win.rect.w + 120, maxX);
      win.rect.y = Win.clamp(y, 0, Math.max(0, maxY));
      css(win);
      snapZone = detectSnapZone(ev);
      showSnap(snapZone && moved ? snapZone : null);
    }
    function finish() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      document.body.classList.remove('is-dragging');
      win.el.classList.remove('is-dragging');
      if (snapZone && moved) applySnap(win, snapZone);
      hideSnap();
      snapZone = null;
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
  }

  function detectSnapZone(e) {
    if (isMobile()) return null;
    var vp = viewport();
    var edge = 12, corner = 80;
    var x = e.clientX, y = e.clientY;
    if (y <= 2) return { type: 'max' };
    if (y <= 6 && x < corner) return { type: 'tl' };
    if (y <= 6 && x > vp.w - corner) return { type: 'tr' };
    if (x <= edge) return y > vp.h - corner ? { type: 'bl' } : y < corner ? { type: 'tl' } : { type: 'left' };
    if (x >= vp.w - edge) return y > vp.h - corner ? { type: 'br' } : y < corner ? { type: 'tr' } : { type: 'right' };
    return null;
  }

  function snapRect(zone) {
    var vp = viewport();
    var halfW = Math.round(vp.w / 2);
    var halfH = Math.round(vp.h / 2);
    switch (zone.type) {
      case 'max': return { x: 0, y: 0, w: vp.w, h: vp.h };
      case 'left': return { x: 0, y: 0, w: halfW, h: vp.h };
      case 'right': return { x: halfW, y: 0, w: vp.w - halfW, h: vp.h };
      case 'tl': return { x: 0, y: 0, w: halfW, h: halfH };
      case 'tr': return { x: halfW, y: 0, w: vp.w - halfW, h: halfH };
      case 'bl': return { x: 0, y: halfH, w: halfW, h: vp.h - halfH };
      case 'br': return { x: halfW, y: halfH, w: vp.w - halfW, h: vp.h - halfH };
      default: return null;
    }
  }

  function showSnap(zone) {
    if (!snapEl) return;
    var r = zone ? snapRect(zone) : null;
    if (!r) { snapEl.classList.remove('is-visible'); return; }
    snapEl.style.left = r.x + 'px';
    snapEl.style.top = r.y + 'px';
    snapEl.style.width = r.w + 'px';
    snapEl.style.height = r.h + 'px';
    snapEl.classList.add('is-visible');
  }
  function hideSnap() { if (snapEl) snapEl.classList.remove('is-visible'); }

  function applySnap(win, zone) {
    var r = snapRect(zone);
    if (!r) return;
    if (zone.type === 'max') {
      win.state = 'max';
      applyMaximized(win, true);
    } else {
      win.state = 'normal';
      win.el.classList.remove('is-maximized');
      win.rect = { x: r.x, y: r.y, w: r.w, h: r.h };
      css(win);
      updateMaxButton(win);
    }
    emit('snap', win);
  }

  function startResize(e, win, dir) {
    var start = { px: e.clientX, py: e.clientY, r: { x: win.rect.x, y: win.rect.y, w: win.rect.w, h: win.rect.h } };
    var vp = viewport();
    var minW = win.app.minWidth || 340;
    var minH = win.app.minHeight || 220;
    win.el.classList.add('is-resizing');
    document.body.classList.add('is-resizing');
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}

    function onMove(ev) {
      var dx = ev.clientX - start.px;
      var dy = ev.clientY - start.py;
      var r = { x: start.r.x, y: start.r.y, w: start.r.w, h: start.r.h };
      if (dir.indexOf('e') > -1) r.w = Win.clamp(start.r.w + dx, minW, vp.w - r.x - 8);
      if (dir.indexOf('s') > -1) r.h = Win.clamp(start.r.h + dy, minH, vp.h - r.y - 8);
      if (dir.indexOf('w') > -1) {
        var nw = Win.clamp(start.r.w - dx, minW, start.r.x + start.r.w - 8);
        r.x = start.r.x + (start.r.w - nw);
        r.w = nw;
      }
      if (dir.indexOf('n') > -1) {
        var nh = Win.clamp(start.r.h - dy, minH, start.r.y + start.r.h - 8);
        r.y = start.r.y + (start.r.h - nh);
        r.h = nh;
      }
      win.rect = r;
      css(win);
    }
    function finish() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      win.el.classList.remove('is-resizing');
      document.body.classList.remove('is-resizing');
      emit('resize', win);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
  }

  /* ---------------- 视口变化 ---------------- */
  window.addEventListener('resize', Win.debounce(function () {
    var vp = viewport();
    Object.keys(wins).forEach(function (id) {
      var w = wins[id];
      if (!w || w.state === 'closed') return;
      if (w.state === 'max') {
        w.rect = { x: 0, y: 0, w: vp.w, h: vp.h };
        css(w);
      } else if (w.state !== 'min') {
        w.rect = clampRect(w.rect, w.app);
        css(w);
      }
    });
  }, 120));

  /* ---------------- 初始化 ---------------- */
  function init() {
    layer = document.getElementById('windowLayer');
    snapEl = document.getElementById('snapPreview');
    if (!layer) return;
    // 点击桌面空白处：取消选中 + 关闭浮层由 shell 处理
    layer.addEventListener('pointerdown', function (e) {
      if (e.target === layer) {
        Object.keys(wins).forEach(function (id) { wins[id].el.classList.remove('is-active'); });
        activeId = null;
        emit('focus', null);
      }
    });
  }

  var api = {
    init: init,
    open: open,
    launch: function (appId) { return open(appId); },
    close: close,
    focus: focus,
    minimize: minimize,
    restore: restore,
    toggleMaximize: toggleMaximize,
    activeWin: activeWin,
    byApp: byApp,
    list: function () { return order.map(function (id) { return wins[id]; }).filter(Boolean); },
    count: function () { return order.length; },
    isRunning: function (appId) { return byApp(appId).length > 0; },
    isActiveApp: function (appId) { var w = activeWin(); return !!w && w.appId === appId; },
    setTitle: setTitle,
    closeAll: function () { Object.keys(wins).slice().forEach(function (id) { close(wins[id]); }); }
  };

  window.addEventListener('DOMContentLoaded', init);
  return api;
})();
