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
  var initialized = false, desktopSnapshot = null, snapMenu = null, snapTimer = null;

  function taskbarH() {
    var bar = document.getElementById('taskbar');
    var height = bar ? bar.getBoundingClientRect().height : 0;
    var v = getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h');
    return height || parseFloat(v) || 52;
  }
  function viewport() {
    var vv = window.visualViewport;
    return { x: 0, y: 0, w: Math.max(1, Math.min(window.innerWidth, vv ? vv.width : window.innerWidth)), h: Math.max(1, Math.min(window.innerHeight, vv ? vv.height : window.innerHeight) - taskbarH()) };
  }
  function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

  function emit(name, data) { Win.bus.emit('wm:' + name, data); Win.bus.emit('wm:change', { name: name, data: data }); }

  function activeWin() { return activeId ? wins[activeId] : null; }

  function byApp(appId) {
    return order.map(function (id) { return wins[id]; }).filter(function (w) { return w && w.appId === appId && w.state !== 'closed'; });
  }

  /* ---------------- 定位 ---------------- */
  // 普通桌面窗口可越界；约束的是标题栏的可拖动子区，不是窗口的外包围盒。
  // caption 按钮、左侧图标和边缘缩放条都不计入至少 120×20 的可抓区域。
  function keepReachable(rect, vp, metrics) {
    var m = metrics || {};
    var left = Math.min(Math.max(0, m.leftInset === undefined ? 44 : m.leftInset), Math.max(0, rect.w - 1));
    var right = Math.min(rect.w, Math.max(left + 1, rect.w - (m.captionWidth === undefined ? 138 : m.captionWidth) - (m.rightInset === undefined ? 4 : m.rightInset)));
    var titleHeight = Math.min(rect.h, m.titleHeight || 38);
    var top = Math.min(m.topInset === undefined ? 4 : m.topInset, Math.max(0, titleHeight - 1));
    var bottom = Math.min(titleHeight, Math.max(top + 1, titleHeight - (m.bottomInset === undefined ? 2 : m.bottomInset)));
    var visibleW = Math.min(120, right - left, Math.max(1, vp.w));
    var visibleH = Math.min(20, bottom - top, Math.max(1, vp.h));
    var vx = vp.x || 0, vy = vp.y || 0;
    return {
      x: Math.max(vx + visibleW - right, Math.min(vx + vp.w - visibleW - left, rect.x)),
      y: Math.max(vy + visibleH - bottom, Math.min(vy + vp.h - visibleH - top, rect.y)),
      w: rect.w, h: rect.h
    };
  }

  function titleMetrics(win) {
    var old = win.dragMetrics || {}, title = win.el.querySelector('.titlebar');
    var captions = win.el.querySelector('.captions'), app = win.el.querySelector('.tb-app'), icon = win.el.querySelector('.tb-icon');
    var style = app ? getComputedStyle(app) : {};
    var height = title && title.offsetHeight;
    var captionWidth = captions && captions.offsetWidth;
    var leftInset = (parseFloat(style.paddingLeft) || 12) + (icon && icon.offsetWidth || 18) + (parseFloat(style.columnGap) || 8) + 4;
    win.dragMetrics = { titleHeight: height || old.titleHeight || 38, captionWidth: captionWidth || old.captionWidth || 138,
      leftInset: Math.max(44, leftInset), rightInset: 4, topInset: 4, bottomInset: 2 };
    return win.dragMetrics;
  }

  function reachableRect(rect, win) {
    return isMobile() ? clampRect(rect, win.app) : keepReachable(rect, viewport(), titleMetrics(win));
  }

  function snapZoneAt(point, vp, mobile) {
    if (mobile || !point || !isFinite(point.x) || !isFinite(point.y)) return null;
    var x = point.x - (vp.x || 0), y = point.y - (vp.y || 0);
    // 指针被捕获后可继续发出视区外坐标；这些坐标不属于任何贴靠区。
    if (x < 0 || y < 0 || x > vp.w || y > vp.h) return null;
    var edge = 12, corner = 80;
    if (y <= edge && x < corner) return { type: 'tl' };
    if (y <= edge && x > vp.w - corner) return { type: 'tr' };
    if (y <= 6) return { type: 'max' };
    if (x <= edge) return { type: y > vp.h - corner ? 'bl' : y < corner ? 'tl' : 'left' };
    if (x >= vp.w - edge) return { type: y > vp.h - corner ? 'br' : y < corner ? 'tr' : 'right' };
    return null;
  }

  // 只有新开窗口和显式“移回屏幕”使用全入屏约束。
  function clampRect(rect, opts) {
    var vp = viewport();
    var minW = Math.min((opts && opts.minWidth) || 320, Math.max(1, vp.w - 16));
    var minH = Math.min((opts && opts.minHeight) || 200, Math.max(1, vp.h - 16));
    var w = Math.min(Math.max(rect.w, minW), Math.max(1, vp.w - 16));
    var h = Math.min(Math.max(rect.h, minH), Math.max(1, vp.h - 16));
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
      Win.openExternal(Win.resolveProjectUrl(appId, app.external));
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
    win.returnFocus = document.activeElement;
    el.tabIndex = -1;
    el.className = 'window is-opening' + (isMobile() ? ' is-maximized' : '');
    el.dataset.id = win.id;
    el.dataset.app = appId;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', app.title);
    el.setAttribute('aria-modal', 'false');
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

    win.openTimer = setTimeout(function () { el.classList.remove('is-opening'); win.opening = false; }, Win.reduceMotion() ? 0 : 220);
    emit('open', win);
    return win;
  }

  function setTitle(win, title) {
    win.title = title;
    win.el.querySelector('.tb-title').textContent = title;
    win.el.setAttribute('aria-label', title);
    emit('title', win);
  }

  /* ---------------- 关闭 ---------------- */
  function clearTransition(win) {
    clearTimeout(win.transitionTimer);
    clearTimeout(win.openTimer);
    win.el.classList.remove('is-opening');
    win.opening = false;
    win.el.style.transition = '';
    win.el.style.transform = '';
    win.el.style.opacity = '';
    win.el.style.transformOrigin = '';
  }

  function close(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed') return false;
    if (typeof win.beforeClose === 'function' && win.beforeClose() === false) return false;
    var app = win.app || {};
    if (typeof app.onClose === 'function') { try { if (app.onClose(win) === false) return false; } catch (e) { console.error(e); } }
    if (win.cancelGesture) win.cancelGesture();
    if (typeof win.dispose === 'function') win.dispose();
    clearTransition(win);
    closeSnapLayouts();
    win.state = 'closed';
    win.el.inert = true;
    win.el.querySelectorAll('[id]').forEach(function (node) { node.removeAttribute('id'); });
    win.el.classList.add('is-closing');
    var el = win.el;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, Win.reduceMotion() ? 0 : 200);
    delete wins[win.id];
    order = order.filter(function (id) { return id !== win.id; });
    if (activeId === win.id) {
      activeId = null;
      focusNext(win.returnFocus);
    }
    emit('close', win);
    return true;
  }

  function focusNext(fallback) {
    var next = order.slice().reverse().filter(function (id) { return wins[id] && wins[id].state !== 'min'; })[0];
    if (next) focus(wins[next]);
    else {
      Object.keys(wins).forEach(function (id) { wins[id].el.classList.remove('is-active'); });
      var target = fallback && fallback.isConnected && !fallback.closest('.window,[inert]') ? fallback : document.getElementById('startBtn');
      if (target && !Win.isLocked()) target.focus({ preventScroll: true });
    }
  }

  /* ---------------- 焦点 ---------------- */
  function focus(win, moveFocus) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed' || win.state === 'min') return;
    activeId = win.id;
    order = order.filter(function (id) { return id !== win.id; });
    order.push(win.id);
    // 保持相对叠放，避免长期使用后越过任务栏/浮层的 z-index。
    order.forEach(function (id, i) {
      wins[id].el.style.zIndex = 100 + i;
      wins[id].el.classList.toggle('is-active', id === win.id);
    });
    if (moveFocus !== false && !Win.isLocked() && !win.el.contains(document.activeElement)) {
      var target = win.lastFocus && win.lastFocus.isConnected ? win.lastFocus : win.el;
      target.focus({ preventScroll: true });
    }
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
    if (win.cancelGesture) win.cancelGesture();
    closeSnapLayouts();
    clearTransition(win);
    win.prevState = win.state;
    win.state = 'min';
    win.el.inert = true;
    win.el.setAttribute('aria-hidden', 'true');
    if (!Win.reduceMotion()) {
      var t = minimizeTarget(win);
      win.el.style.transition = 'transform 240ms cubic-bezier(0.8,0,0.2,1), opacity 220ms linear';
      win.el.style.transformOrigin = 'center';
      win.el.style.transform = 'translate(' + t.dx + 'px,' + t.dy + 'px) scale(' + t.scale + ')';
      win.el.style.opacity = '0';
    }
    win.el.style.pointerEvents = 'none';
    win.transitionTimer = setTimeout(function () { if (win.state === 'min') win.el.style.display = 'none'; }, Win.reduceMotion() ? 0 : 240);
    if (activeId === win.id) { activeId = null; focusNext(win.taskbarBtn); }
    emit('minimize', win);
  }

  function restore(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed' || win.state !== 'min') return;
    clearTransition(win);
    win.state = win.prevState === 'max' ? 'max' : 'normal';
    win.el.style.display = '';
    win.el.style.pointerEvents = '';
    win.el.inert = false;
    win.el.removeAttribute('aria-hidden');
    fitWindow(win);
    if (!Win.reduceMotion()) {
      var t = minimizeTarget(win);
      win.el.style.transition = 'none';
      win.el.style.transform = 'translate(' + t.dx + 'px,' + t.dy + 'px) scale(' + t.scale + ')';
      win.el.style.opacity = '0';
      void win.el.offsetWidth;
      win.el.style.transition = 'transform 260ms cubic-bezier(0.1,0.9,0.2,1), opacity 220ms linear';
      win.el.style.transform = '';
      win.el.style.opacity = '1';
      win.transitionTimer = setTimeout(function () { clearTransition(win); }, 260);
    }
    updateMaxButton(win);
    focus(win);
    emit('restore', win);
  }

  function showDesktop() {
    if (desktopSnapshot) {
      var saved = desktopSnapshot;
      desktopSnapshot = null;
      saved.ids.forEach(function (id) { if (wins[id] && wins[id].state === 'min') restore(wins[id]); });
      if (wins[saved.active] && wins[saved.active].state !== 'min') focus(wins[saved.active]);
    } else {
      var visible = order.filter(function (id) { return wins[id].state !== 'min'; });
      if (!visible.length) return;
      desktopSnapshot = { ids: visible.slice(), active: activeId };
      visible.forEach(function (id) { minimize(wins[id]); });
      var target = document.getElementById('showDesktopBtn');
      if (target) target.focus({ preventScroll: true });
    }
    emit('desktop', !!desktopSnapshot);
  }

  /* ---------------- 最大化 ---------------- */
  function applyMaximized(win, on) {
    var vp = viewport();
    if (on) {
      if (!win.snapZone) win.prevRect = { x: win.rect.x, y: win.rect.y, w: win.rect.w, h: win.rect.h };
      win.snapZone = null;
      win.rect = { x: 0, y: 0, w: vp.w, h: vp.h };
      win.el.classList.add('is-maximized');
    } else {
      win.el.classList.remove('is-maximized');
      win.rect = reachableRect(win.prevRect || defaultRect(win.app), win);
      win.snapZone = null;
    }
    css(win);
    updateMaxButton(win);
  }

  function toggleMaximize(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed' || win.state === 'min') return;
    if (win.cancelGesture) win.cancelGesture();
    clearTransition(win);
    closeSnapLayouts();
    if (win.state === 'max') {
      win.state = 'normal';
      applyMaximized(win, false);
    } else {
      win.state = 'max';
      applyMaximized(win, true);
    }
    emit('maximize', win);
  }

  function restoreLayout(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed') return;
    if (win.state === 'min') restore(win);
    if (win.state === 'max') { toggleMaximize(win); return; }
    if (!win.snapZone) return;
    win.snapZone = null;
    win.rect = reachableRect(win.prevRect || defaultRect(win.app), win);
    css(win); focus(win); emit('snap', win);
  }

  function updateMaxButton(win) {
    var btn = win.el.querySelector('.caption-max');
    if (!btn) return;
    var maxed = win.state === 'max';
    btn.disabled = isMobile();
    btn.innerHTML = ICONS.glyph(maxed ? 'restore' : 'maximize');
    btn.setAttribute('aria-label', maxed ? '向下还原' : '最大化');
    btn.setAttribute('title', isMobile() ? '小屏已自动适配窗口大小' : maxed ? '向下还原；悬停或按↓选择布局' : '最大化；悬停或按↓选择布局');
    if (isMobile()) btn.setAttribute('aria-label', '小屏已自动适配窗口大小');
  }

  /* ---------------- 拖动 / 缩放 ---------------- */
  function bindWindow(win) {
    var el = win.el;
    var titlebar = el.querySelector('.titlebar');
    var maxBtn = el.querySelector('.caption-max');

    el.addEventListener('pointerdown', function (e) {
      if (win.state === 'closed') return;
      if (!el.classList.contains('is-active')) focus(win, false);
      if (e.target.closest('.captions')) return;
      if (e.target.closest('.rs-handle')) return;
      if (e.target.closest('.titlebar') && !isMobile() && e.button === 0 && e.isPrimary !== false) startDrag(e, win);
    }, true);

    titlebar.addEventListener('dblclick', function (e) {
      if (e.target.closest('.captions')) return;
      toggleMaximize(win);
    });

    el.querySelector('.caption-min').addEventListener('click', function () { minimize(win); });
    var maxPointer = 'mouse';
    maxBtn.setAttribute('aria-haspopup', 'menu');
    maxBtn.addEventListener('pointerdown', function (e) { maxPointer = e.pointerType; });
    maxBtn.addEventListener('click', function () {
      if (maxPointer === 'touch' && !isMobile()) openSnapLayouts(win, true);
      else toggleMaximize(win);
    });
    maxBtn.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || isMobile()) return;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(function () { openSnapLayouts(win, false); }, 450);
    });
    maxBtn.addEventListener('pointerleave', function () { clearTimeout(snapTimer); });
    maxBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); openSnapLayouts(win, true); });
    maxBtn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); openSnapLayouts(win, true); }
    });
    el.addEventListener('focusin', function (e) {
      win.lastFocus = e.target;
      if (activeId !== win.id) focus(win, false);
    });
    el.querySelector('.caption-close').addEventListener('click', function () { close(win); });

    Array.prototype.forEach.call(el.querySelectorAll('.rs-handle'), function (h) {
      h.addEventListener('pointerdown', function (e) {
        if (isMobile() || win.state === 'max' || e.button !== 0 || e.isPrimary === false) return;
        e.preventDefault();
        e.stopPropagation();
        startResize(e, win, h.dataset.dir);
      });
    });
  }

  // 所有拖动都绑定 pointerId；取消、失焦、关闭窗口时清理监听与捕获。
  function trackPointer(e, win, move, finish) {
    var target = e.target, id = e.pointerId, ended = false;
    function onMove(ev) { if (ev.pointerId === id) move(ev); }
    function end(ev) {
      if (ev && ev.pointerId !== undefined && ev.pointerId !== id) return;
      if (ended) return;
      ended = true;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', cancel);
      target.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cancel);
      win.cancelGesture = null;
      try { if (target.hasPointerCapture(id)) target.releasePointerCapture(id); } catch (err) {}
      finish(!!ev && ev.type === 'pointerup', ev);
    }
    function cancel(ev) { if (ev && ev.pointerId !== undefined && ev.pointerId !== id) return; end(); }
    if (win.cancelGesture) win.cancelGesture();
    win.cancelGesture = cancel;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancel);
    target.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', cancel);
    try { target.setPointerCapture(id); } catch (err) {}
  }

  function startDrag(e, win) {
    if (win.state === 'min' || win.state === 'closed') return;
    var start = { px: e.clientX, py: e.clientY, x: win.rect.x, y: win.rect.y };
    var moved = false, snapZone = null;
    trackPointer(e, win, function (ev) {
      if (!moved && Math.abs(ev.clientX - start.px) + Math.abs(ev.clientY - start.py) < 5) return;
      var vp = viewport();
      if (!moved) {
        moved = true;
        clearTransition(win);
        closeSnapLayouts();
        // 等真正移动后才还原：仅点击/双击最大化标题栏不应误触拖回。
        if (win.state === 'max' || win.snapZone) {
          var ratio = Win.clamp((start.px - win.rect.x) / win.rect.w, 0, 1);
          var restored = reachableRect(win.prevRect || defaultRect(win.app), win);
          win.state = 'normal';
          win.snapZone = null;
          win.el.classList.remove('is-maximized');
          win.rect = restored;
          start.x = start.px - restored.w * ratio;
          start.y = start.py - 18;
          updateMaxButton(win);
        }
        win.el.classList.add('is-dragging');
        document.body.classList.add('is-dragging');
      }
      win.rect = keepReachable({ x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py, w: win.rect.w, h: win.rect.h }, vp, titleMetrics(win));
      css(win);
      snapZone = detectSnapZone(ev);
      showSnap(snapZone);
    }, function (commit, event) {
      document.body.classList.remove('is-dragging');
      win.el.classList.remove('is-dragging');
      // pointerup 也要重判位置，不能使用最后一次贴边 move 的陈旧候选。
      snapZone = commit && event ? detectSnapZone(event) : null;
      if (commit && moved && snapZone) applySnap(win, snapZone);
      hideSnap();
      if (moved) emit('move', win);
    });
  }

  function detectSnapZone(e) {
    return snapZoneAt({ x: e.clientX, y: e.clientY }, viewport(), isMobile());
  }

  function snapRect(zone) {
    var vp = viewport();
    var halfW = Math.round(vp.w / 2);
    var halfH = Math.round(vp.h / 2);
    switch (zone && zone.type) {
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
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed' || !zone) return;
    if (isMobile() && zone.type !== 'max') return;
    var r = snapRect(zone);
    if (!r) return;
    if (win.state === 'min') restore(win);
    clearTransition(win);
    closeSnapLayouts();
    if (zone.type === 'max') {
      if (win.state !== 'max') { win.state = 'max'; applyMaximized(win, true); }
    } else {
      if (!win.snapZone && win.state !== 'max') win.prevRect = Object.assign({}, win.rect);
      win.state = 'normal';
      win.snapZone = zone.type;
      win.el.classList.remove('is-maximized');
      win.rect = r;
      css(win);
      updateMaxButton(win);
    }
    focus(win);
    emit('snap', win);
  }

  function closeSnapLayouts(returnFocus) {
    clearTimeout(snapTimer);
    if (!snapMenu) return;
    var button = snapMenu._button, closing = snapMenu;
    var hadFocus = closing.contains(document.activeElement);
    snapMenu = null; // inert/focusout 回调重入时，不再重复关闭同一面板。
    closing.removeAttribute('data-flyout');
    closing.inert = true;
    closing.style.pointerEvents = 'none';
    closing.classList.add('is-closing');
    setTimeout(function () { closing.remove(); }, Win.reduceMotion() ? 0 : 190);
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      if (returnFocus && hadFocus && button.isConnected && !Win.isLocked()) {
        var target = button.disabled || isMobile() ? button.closest('.window') : button;
        if (target) target.focus({ preventScroll: true });
      }
    }
  }
  function openSnapLayouts(win, keyboard) {
    if (!win || win.state === 'closed' || win.state === 'min' || isMobile() || Win.isLocked()) return;
    if (window.Shell) Shell.closeFlyouts();
    closeSnapLayouts();
    var button = win.el.querySelector('.caption-max');
    var menu = document.createElement('div');
    menu.className = 'snap-layouts';
    menu.dataset.flyout = 'snap';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', '窗口贴靠布局');
    menu._button = button;
    menu.innerHTML = '<div class="snap-layout-grid">' + [['left', '左半屏'], ['right', '右半屏'], ['tl', '左上角'], ['tr', '右上角'], ['bl', '左下角'], ['br', '右下角'], ['max', '最大化']].map(function (option, index) {
      return '<button type="button" role="menuitem" tabindex="' + (index === 0 ? '0' : '-1') + '" class="snap-layout-option" data-snap="' + option[0] + '">' + option[1] + '</button>';
    }).join('') + '</div>';
    menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    menu.addEventListener('click', function (e) {
      var target = e.target.closest('[data-snap]');
      if (target) applySnap(win, { type: target.dataset.snap });
    });
    function rove(target) {
      menu.querySelectorAll('button').forEach(function (item) { item.tabIndex = item === target ? 0 : -1; });
    }
    menu.addEventListener('focusin', function (e) {
      var target = e.target.closest('[data-snap]');
      if (target) rove(target);
    });
    menu.addEventListener('focusout', function (e) {
      if (snapMenu === menu && (!e.relatedTarget || !menu.contains(e.relatedTarget))) closeSnapLayouts();
    });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSnapLayouts(true); return; }
      if (e.key === 'Tab') {
        // 回到布局触发按钮作为顺序起点，不阻止浏览器随后原生 Tab/Shift+Tab 前进或后退。
        closeSnapLayouts(true);
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      var buttons = Array.prototype.slice.call(menu.querySelectorAll('button'));
      var index = buttons.indexOf(document.activeElement);
      if (/^Arrow/.test(e.key) || e.key === 'Home' || e.key === 'End') {
        e.preventDefault(); e.stopPropagation();
        var next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        rove(buttons[next]);
        buttons[next].focus();
      }
    });
    (document.getElementById('flyoutHost') || document.body).appendChild(menu);
    snapMenu = menu;
    button.setAttribute('aria-expanded', 'true');
    var r = button.getBoundingClientRect(), mr = { width: menu.offsetWidth, height: menu.offsetHeight };
    menu.style.left = Math.max(8, Math.min(r.right - mr.width, window.innerWidth - mr.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - mr.height - taskbarH() - 8)) + 'px';
    if (keyboard) menu.querySelector('button').focus();
  }

  function startResize(e, win, dir) {
    clearTransition(win);
    closeSnapLayouts();
    win.snapZone = null;
    var start = { px: e.clientX, py: e.clientY, r: Object.assign({}, win.rect) };
    var vp = viewport();
    var minW = Math.min(win.app.minWidth || 340, vp.w - 16);
    var minH = Math.min(win.app.minHeight || 220, vp.h - 16);
    win.el.classList.add('is-resizing');
    document.body.classList.add('is-resizing');
    trackPointer(e, win, function (ev) {
      var dx = ev.clientX - start.px, dy = ev.clientY - start.py;
      var r = Object.assign({}, start.r);
      if (dir.indexOf('e') > -1) r.w = Math.max(minW, start.r.w + dx);
      if (dir.indexOf('s') > -1) r.h = Math.max(minH, start.r.h + dy);
      if (dir.indexOf('w') > -1) {
        r.w = Math.max(minW, start.r.w - dx);
        r.x = start.r.x + start.r.w - r.w;
      }
      if (dir.indexOf('n') > -1) {
        r.h = Math.max(minH, start.r.h - dy);
        r.y = start.r.y + start.r.h - r.h;
      }
      win.rect = keepReachable(r, vp, titleMetrics(win));
      css(win);
    }, function () {
      win.el.classList.remove('is-resizing');
      document.body.classList.remove('is-resizing');
      emit('resize', win);
    });
  }

  /* ---------------- 视口变化 ---------------- */
  function fitWindow(w) {
    var vp = viewport();
    if (w.state === 'max' || (w.state === 'min' && w.prevState === 'max')) w.rect = { x: 0, y: 0, w: vp.w, h: vp.h };
    else if (w.snapZone && !isMobile()) w.rect = snapRect({ type: w.snapZone });
    else { w.snapZone = null; w.rect = reachableRect(w.rect, w); }
    css(w);
    updateMaxButton(w);
  }
  var onViewportResize = Win.debounce(function () {
    closeSnapLayouts(true);
    Object.keys(wins).forEach(function (id) { if (wins[id].cancelGesture) wins[id].cancelGesture(); fitWindow(wins[id]); });
  }, 100);
  window.addEventListener('resize', onViewportResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);

  function moveIntoView(win) {
    win = typeof win === 'string' ? wins[win] : win;
    if (!win || win.state === 'closed') return;
    if (win.cancelGesture) win.cancelGesture();
    if (win.state === 'min') restore(win);
    clearTransition(win);
    closeSnapLayouts();
    if (isMobile() || win.state === 'max') fitWindow(win);
    else { win.snapZone = null; win.rect = clampRect(win.rect, win.app); css(win); }
    updateMaxButton(win);
    focus(win);
    emit('recover', win);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    if (initialized) return;
    layer = document.getElementById('windowLayer');
    snapEl = document.getElementById('snapPreview');
    if (!layer) return;
    initialized = true;
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.snap-layouts,.caption-max')) closeSnapLayouts();
    });
    Win.bus.on('lock:request-close-all', function () {
      closeSnapLayouts();
      Object.keys(wins).forEach(function (id) { if (wins[id].cancelGesture) wins[id].cancelGesture(); });
    });
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
    snap: function (win, type) { applySnap(win, { type: type }); },
    restoreLayout: restoreLayout, moveIntoView: moveIntoView,
    geometry: { keepReachable: keepReachable, snapZoneAt: snapZoneAt },
    snapRect: snapRect, openSnapLayouts: openSnapLayouts, closeSnapLayouts: closeSnapLayouts,
    showDesktop: showDesktop, isDesktopShown: function () { return !!desktopSnapshot; },
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
