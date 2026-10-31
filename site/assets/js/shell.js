/* =====================================================================
   外壳：桌面图标 / 任务栏 / 开始菜单 / 搜索 / 日历通知 / 右键菜单 / 任务视图
   ===================================================================== */
window.Shell = (function () {
  'use strict';

  var state = {
    startOpen: false,
    searchOpen: false,
    calOpen: false,
    calTrigger: null,
    taskViewOpen: false,
    startFilter: '',
    startAll: false,
    quickOpen: false,
    calMonth: new Date()
  };
  var flyoutHost, initialized = false, previewTimer, previewCloseTimer;

  /* ================= 通用 ================= */
  function appDef(id) { return (window.Win.apps || {})[id] || null; }

  function manualSearchFocus() {
    return Win.isMobile() || window.matchMedia('(pointer: coarse)').matches;
  }

  function focusSearch(panel, input) {
    // A touch-opened menu is for browsing first. Only tapping its input opens IME.
    // Do not steal focus if the user already interacted during the opening delay.
    if (!panel.contains(document.activeElement)) {
      (manualSearchFocus() ? panel : input).focus({ preventScroll: true });
    }
  }

  function syncFlyoutViewport() {
    if (!flyoutHost) return;
    var height = window.innerHeight, inset = 0, viewport = window.visualViewport;
    // Keyboard resize/pan changes the visible area without always resizing layout.
    // Pinch zoom retains the page's normal scroll/zoom behavior.
    if (viewport && Math.abs((viewport.scale || 1) - 1) < 0.01) {
      height = Math.min(height, viewport.height);
      inset = Math.max(0, window.innerHeight - height - (viewport.offsetTop || 0));
    }
    flyoutHost.style.setProperty('--flyout-viewport-height', Math.max(1, height) + 'px');
    flyoutHost.style.setProperty('--flyout-inset-bottom', inset + 'px');
  }

  function closeTarget(id, returnFocus) {
    var nodes = Array.prototype.slice.call((flyoutHost || document).querySelectorAll('[data-flyout="' + id + '"]'));
    nodes.forEach(function (node) {
      // Escape/resize 只修复即将失去的面板内焦点，不抢夺页面其他区域的焦点。
      if (returnFocus && node.contains(document.activeElement) && !Win.isLocked()) {
        var target = node._returnFocus;
        if (!target || !target.isConnected) target = taskbarTarget(node._returnFocusKey) || document.getElementById('startBtn');
        if (target && !target.disabled && !target.closest('[inert]')) target.focus({ preventScroll: true });
      }
      node.removeAttribute('data-flyout');
      node.inert = true;
      node.style.pointerEvents = 'none';
      node.setAttribute('aria-hidden', 'true');
      node.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
      node.classList.add('is-closing');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, Win.reduceMotion() ? 0 : 190);
    });
  }

  function closeFlyouts(except, returnFocus) {
    clearTimeout(previewTimer);
    clearTimeout(previewCloseTimer);
    ['start', 'search', 'calendar', 'context', 'taskview', 'preview', 'quick'].forEach(function (id) {
      if (id !== except) closeTarget(id, returnFocus);
    });
    if (except !== 'snap' && window.WM && WM.closeSnapLayouts) WM.closeSnapLayouts(returnFocus);
    state.startOpen = except === 'start' && state.startOpen;
    state.searchOpen = except === 'search' && state.searchOpen;
    state.calOpen = except === 'calendar' && state.calOpen;
    if (!state.calOpen) state.calTrigger = null;
    state.taskViewOpen = except === 'taskview' && state.taskViewOpen;
    state.quickOpen = except === 'quick' && state.quickOpen;
    syncPanelButtons();
  }

  function syncPanelButtons() {
    [['startBtn', state.startOpen], ['searchBtn', state.searchOpen], ['taskViewBtn', state.taskViewOpen], ['trayClock', state.calOpen && state.calTrigger && state.calTrigger.id === 'trayClock'], ['notifBtn', state.calOpen && state.calTrigger && state.calTrigger.id === 'notifBtn'], ['trayTray', state.quickOpen]].forEach(function (item) {
      var button = document.getElementById(item[0]);
      if (button) { button.setAttribute('aria-expanded', String(!!item[1])); button.setAttribute('aria-haspopup', 'dialog'); }
    });
  }

  function prepareFlyout(node, trigger, label) {
    node._returnFocus = trigger || document.activeElement;
    node._returnFocusKey = taskbarKey(node._returnFocus);
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', label);
    node.tabIndex = -1;
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFlyouts(null, true); return; }
      if (e.key !== 'Tab') return;
      var controls = Array.prototype.slice.call(node.querySelectorAll('button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]')).filter(function (el) { return !el.hidden && el.getClientRects().length; });
      if (!controls.length) { e.preventDefault(); node.focus(); return; }
      var index = controls.indexOf(document.activeElement);
      if (e.shiftKey && index <= 0) { e.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!e.shiftKey && index === controls.length - 1) { e.preventDefault(); controls[0].focus(); }
    });
  }

  function keyboardResults(root, input, selector) {
    root.addEventListener('keydown', function (e) {
      if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      var results = Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (n) { return !n.disabled; });
      var current = results.indexOf(document.activeElement);
      var isInput = document.activeElement === input;
      if (e.key === 'Enter' && (isInput ? results[0] : results[current])) { e.preventDefault(); (isInput ? results[0] : results[current]).click(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (!isInput && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End'))) {
        if (!results.length) return;
        e.preventDefault();
        var previous = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
        var next = e.key === 'Home' ? 0 : e.key === 'End' ? results.length - 1 : current < 0 ? (previous ? results.length - 1 : 0) : (current + (previous ? -1 : 1) + results.length) % results.length;
        results[next].focus();
      }
    });
  }

  /* ================= 桌面图标 ================= */
  var selectedIcons = [], selectionAnchor = null;
  function desktopNodes() { return Array.prototype.slice.call(document.querySelectorAll('#desktopIcons .desktop-icon')); }
  function selectIcon(node, opts) {
    opts = opts || {};
    var nodes = desktopNodes();
    if (!node) { selectedIcons = []; selectionAnchor = null; }
    else if (opts.range && selectionAnchor && nodes.indexOf(selectionAnchor) !== -1) {
      var a = nodes.indexOf(selectionAnchor), b = nodes.indexOf(node);
      var range = nodes.slice(Math.min(a, b), Math.max(a, b) + 1);
      selectedIcons = opts.add ? selectedIcons.concat(range.filter(function (n) { return selectedIcons.indexOf(n) === -1; })) : range;
    } else if (opts.toggle) {
      var index = selectedIcons.indexOf(node);
      if (index === -1) selectedIcons.push(node); else selectedIcons.splice(index, 1);
      selectionAnchor = node;
    } else { selectedIcons = [node]; selectionAnchor = node; }
    paintSelection(node);
  }
  function paintSelection(focusNode) {
    desktopNodes().forEach(function (n, i) {
      var selected = selectedIcons.indexOf(n) !== -1;
      n.classList.toggle('is-selected', selected);
      n.setAttribute('aria-selected', String(selected));
      n.tabIndex = focusNode ? (n === focusNode ? 0 : -1) : (i === 0 ? 0 : -1);
    });
  }
  function openSelection(fallback) {
    var list = selectedIcons.length ? selectedIcons.slice() : (fallback ? [fallback] : []);
    list.forEach(function (node) { launchApp(node.dataset.app); });
  }
  function renderDesktop() {
    var host = document.getElementById('desktopIcons');
    if (!host) return;
    var ids = selectedIcons.map(function (node) { return node.dataset.app; });
    host.innerHTML = '';
    host.setAttribute('role', 'listbox');
    host.setAttribute('aria-multiselectable', 'true');
    host.setAttribute('aria-label', '桌面应用，方向键选择，Enter打开，Ctrl或Shift多选');
    var apps = (window.SITE.desktop || []).slice();
    if (Win.store.get('desktopSort', 'default') === 'name') apps.sort(function (a, b) { return (appDef(a) || {}).title.localeCompare((appDef(b) || {}).title, 'zh-CN'); });
    apps.forEach(function (appId) {
      var app = appDef(appId);
      if (!app) return;
      var node = document.createElement('button');
      node.className = 'desktop-icon' + (app.external ? ' is-shortcut' : '');
      node.type = 'button';
      node.setAttribute('role', 'option');
      node.setAttribute('aria-label', app.title);
      node.dataset.app = appId;
      if (app.external) node.title = app.shortcutHint || app.external;
      node.innerHTML = '<span class="di-icon">' + ICONS.app(app.icon) + '</span><span class="di-label">' + Win.esc(app.desktopLabel || app.title) + '</span>';
      var pointerType = 'mouse';
      node.addEventListener('pointerdown', function (e) { pointerType = e.pointerType; });
      node.addEventListener('click', function (e) {
        selectIcon(node, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey, add: e.ctrlKey || e.metaKey });
        if (pointerType === 'touch' && !e.ctrlKey && !e.shiftKey) launchApp(appId);
      });
      node.addEventListener('dblclick', function (e) { if (pointerType !== 'touch') { e.preventDefault(); launchApp(appId); } });
      node.addEventListener('contextmenu', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (selectedIcons.indexOf(node) === -1) selectIcon(node);
        var rect = node.getBoundingClientRect();
        openIconMenu(appId, e.clientX || rect.left, e.clientY || rect.bottom);
      });
      host.appendChild(node);
    });
    selectedIcons = desktopNodes().filter(function (n) { return ids.indexOf(n.dataset.app) !== -1; });
    selectionAnchor = selectedIcons[0] || null;
    paintSelection(selectionAnchor);
    if (!host._keyboardBound) {
      host._keyboardBound = true;
      host.addEventListener('keydown', function (e) {
        var node = e.target.closest('.desktop-icon');
        if (!node || e.isComposing || e.altKey || (e.metaKey && e.key.toLowerCase() !== 'a')) return;
        var nodes = desktopNodes();
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectedIcons = nodes.slice(); paintSelection(node); return; }
        if (e.key === 'Enter') { e.preventDefault(); openSelection(node); return; }
        if (e.key === ' ') { e.preventDefault(); selectIcon(node, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey }); return; }
        if (e.key === 'Escape') { selectIcon(null); return; }
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault(); var rect = node.getBoundingClientRect(); openIconMenu(node.dataset.app, rect.left, rect.bottom); return;
        }
        var next = null;
        if (e.key === 'Home') next = nodes[0];
        if (e.key === 'End') next = nodes[nodes.length - 1];
        if (/^Arrow/.test(e.key)) {
          var origin = node.getBoundingClientRect(), vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
          var positive = e.key === 'ArrowDown' || e.key === 'ArrowRight';
          var best = Infinity;
          nodes.forEach(function (candidate) {
            if (candidate === node) return;
            var r = candidate.getBoundingClientRect(), dx = r.left - origin.left, dy = r.top - origin.top;
            var major = vertical ? dy : dx, minor = vertical ? dx : dy;
            if ((positive ? major > 4 : major < -4) && Math.abs(major) + Math.abs(minor) * 3 < best) { next = candidate; best = Math.abs(major) + Math.abs(minor) * 3; }
          });
        }
        if (next) {
          e.preventDefault();
          if (!e.ctrlKey && !e.metaKey) selectIcon(next, { range: e.shiftKey }); else paintSelection(next);
          next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }
  }

  function startMarquee(e) {
    if (e.button !== 0 || e.isPrimary === false || e.pointerType === 'touch') return;
    var x = e.clientX, y = e.clientY, id = e.pointerId, box = null;
    var base = e.ctrlKey || e.metaKey || e.shiftKey ? selectedIcons.slice() : [];
    if (!base.length) selectIcon(null);
    function move(ev) {
      if (ev.pointerId !== id) return;
      if (!box && Math.abs(ev.clientX - x) + Math.abs(ev.clientY - y) < 4) return;
      ev.preventDefault();
      if (!box) { box = document.createElement('div'); box.className = 'desktop-selection'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box); }
      var left = Math.min(x, ev.clientX), top = Math.min(y, ev.clientY), right = Math.max(x, ev.clientX), bottom = Math.max(y, ev.clientY);
      box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.width = right - left + 'px'; box.style.height = bottom - top + 'px';
      selectedIcons = base.slice();
      desktopNodes().forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.right > left && r.left < right && r.bottom > top && r.top < bottom && selectedIcons.indexOf(n) === -1) selectedIcons.push(n);
      });
      paintSelection(selectedIcons[0]);
    }
    function finish(ev) {
      if (ev && ev.pointerId !== undefined && ev.pointerId !== id) return;
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', finish); window.removeEventListener('blur', finish);
      if (box) { box.remove(); selectionAnchor = selectedIcons[0] || null; if (selectionAnchor) selectionAnchor.focus({ preventScroll: true }); }
    }
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', finish); window.addEventListener('blur', finish);
  }

  function launchApp(appId) {
    if (!appDef(appId)) {
      Win.notify({ icon: 'info', title: '这个应用还在建设中', body: '换个图标试试？' });
      return;
    }
    closeFlyouts();
    WM.launch(appId);
  }

  /* ================= 任务栏 ================= */
  function tbButton(appId) {
    var app = appDef(appId);
    if (!app) return null;
    var btn = document.createElement('button');
    btn.className = 'tb-btn'; btn.type = 'button'; btn.dataset.taskbarApp = appId;
    btn.setAttribute('aria-label', app.title); btn.title = app.title + ' · 右键操作，↑ 预览';
    btn.innerHTML = ICONS.app(app.icon) + '<span class="indicator"></span>';
    btn.addEventListener('click', function () {
      closeFlyouts();
      var running = WM.byApp(appId);
      if (!running.length) { WM.launch(appId); return; }
      var top = running[running.length - 1];
      if (WM.isActiveApp(appId) && top.state !== 'min') WM.minimize(top);
      else { if (top.state === 'min') WM.restore(top); WM.focus(top); }
    });
    btn.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || state.startOpen || state.searchOpen || state.calOpen || state.taskViewOpen || state.quickOpen) return;
      clearTimeout(previewCloseTimer); clearTimeout(previewTimer);
      previewTimer = setTimeout(function () { openTaskbarPreview(appId, btn, false); }, 350);
    });
    btn.addEventListener('pointerleave', function () { clearTimeout(previewTimer); schedulePreviewClose(); });
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault(); e.stopPropagation();
      var r = btn.getBoundingClientRect(); openTaskbarMenu(appId, e.clientX || r.left, e.clientY || r.top, btn);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openTaskbarPreview(appId, btn, true); }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); var r = btn.getBoundingClientRect(); openTaskbarMenu(appId, r.left, r.top, btn); }
    });
    return btn;
  }

  function schedulePreviewClose() {
    clearTimeout(previewCloseTimer);
    previewCloseTimer = setTimeout(function () {
      var preview = document.querySelector('[data-flyout="preview"]');
      if (preview && !preview.contains(document.activeElement)) closeTarget('preview');
    }, 240);
  }
  function previewThumb(win) {
    var holder = document.createElement('div');
    holder.className = 'taskbar-preview-thumb'; holder.setAttribute('aria-hidden', 'true'); holder.inert = true;
    var clone = win.bodyEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
    clone.querySelectorAll('script,iframe,audio,video').forEach(function (n) { n.remove(); });
    clone.querySelectorAll('input,textarea,button,a,[contenteditable],[tabindex]').forEach(function (n) { n.tabIndex = -1; n.removeAttribute('autofocus'); n.removeAttribute('name'); });
    var originalInputs = win.bodyEl.querySelectorAll('input,textarea');
    clone.querySelectorAll('input,textarea').forEach(function (n, i) { if (originalInputs[i]) n.value = originalInputs[i].value; });
    var width = Math.max(1, win.rect.w), height = Math.max(1, win.rect.h - 36);
    var scale = Math.min(232 / width, 128 / height);
    clone.style.cssText = 'position:absolute;left:0;top:0;width:' + width + 'px;height:' + height + 'px;transform-origin:top left;transform:scale(' + scale + ');pointer-events:none;overflow:hidden';
    holder.appendChild(clone);
    return holder;
  }
  function openTaskbarPreview(appId, button, keyboard) {
    var running = WM.byApp(appId);
    if (!running.length || !button.isConnected || Win.isLocked()) return;
    closeFlyouts();
    var panel = document.createElement('div');
    panel.className = 'taskbar-preview'; panel.dataset.flyout = 'preview'; panel.dataset.previewApp = appId;
    prepareFlyout(panel, button, appDef(appId).title + ' 的窗口预览');
    panel.addEventListener('pointerenter', function () { clearTimeout(previewCloseTimer); });
    panel.addEventListener('pointerleave', schedulePreviewClose);
    running.forEach(function (w) {
      var row = document.createElement('div'); row.className = 'taskbar-preview-item'; row.dataset.win = w.id;
      var open = document.createElement('button'); open.type = 'button'; open.className = 'taskbar-preview-open';
      open.innerHTML = '<span class="taskbar-preview-title">' + Win.esc(w.title) + (w.state === 'min' ? ' · 已最小化' : '') + '</span>';
      open.appendChild(previewThumb(w));
      open.addEventListener('click', function () { closeFlyouts(); if (w.state === 'min') WM.restore(w); WM.focus(w); });
      var close = document.createElement('button'); close.type = 'button'; close.className = 'taskbar-preview-close'; close.setAttribute('aria-label', '关闭 ' + w.title); close.innerHTML = ICONS.glyph('close');
      close.addEventListener('click', function () {
        if (WM.close(w)) { row.remove(); if (!panel.querySelector('.taskbar-preview-item')) closeFlyouts(null, true); else panel.querySelector('button').focus(); }
      });
      row.appendChild(open); row.appendChild(close); panel.appendChild(row);
    });
    flyoutHost.appendChild(panel);
    var r = button.getBoundingClientRect(), pr = { width: panel.offsetWidth, height: panel.offsetHeight };
    panel.style.left = Math.max(8, Math.min(r.left + r.width / 2 - pr.width / 2, window.innerWidth - pr.width - 8)) + 'px';
    panel.style.top = Math.max(8, r.top - pr.height - 8) + 'px';
    if (keyboard) panel.querySelector('button').focus();
  }
  function taskbarKey(button) {
    if (!button) return '';
    return button.dataset && button.dataset.taskbarApp ? 'app:' + button.dataset.taskbarApp : button.id ? 'id:' + button.id : '';
  }
  function taskbarTarget(key) {
    if (!key) return null;
    if (key.indexOf('id:') === 0) return document.getElementById(key.slice(3));
    var host = document.getElementById('tbCenter');
    return host && Array.prototype.slice.call(host.querySelectorAll('[data-taskbar-app]')).filter(function (button) { return taskbarKey(button) === key; })[0] || null;
  }
  function taskbarSnapshot(host) {
    var buttons = Array.prototype.slice.call(host.querySelectorAll('.tb-btn'));
    var active = document.activeElement;
    return { active: active, hadFocus: host.contains(active), key: taskbarKey(active), index: buttons.indexOf(active),
      keys: buttons.map(taskbarKey), left: host.scrollLeft, top: host.scrollTop };
  }
  function restoreTaskbarSnapshot(host, saved) {
    // 同 app 优先；消失后按旧位置寻找最近存活的邻居，最后回开始按钮。
    if (saved.hadFocus && !saved.active.isConnected && !Win.isLocked() &&
        (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) {
      var target = taskbarTarget(saved.key);
      for (var distance = 1; !target && distance < saved.keys.length; distance++) {
        target = taskbarTarget(saved.keys[saved.index + distance]) || taskbarTarget(saved.keys[saved.index - distance]);
      }
      if (!target) target = document.getElementById('startBtn');
      if (target) target.focus({ preventScroll: true });
    }
    host.scrollLeft = saved.left;
    host.scrollTop = saved.top;
  }

  function togglePinned(appId) {
    var index = pinnedApps.indexOf(appId);
    if (index === -1) pinnedApps.push(appId); else pinnedApps.splice(index, 1);
    Win.store.set('taskbarPinned', pinnedApps);
    renderTaskbarCenter();
  }
  function openTaskbarMenu(appId, x, y, trigger) {
    var running = WM.byApp(appId), top = running[running.length - 1];
    var items = [{ icon: 'folder', label: '打开应用', action: function () { launchApp(appId); } }];
    if (top) {
      items.push({ icon: 'restore', label: '恢复 / 切换到窗口', action: function () { if (top.state === 'min') WM.restore(top); WM.focus(top); } });
      items.push({ icon: 'display', label: '移回屏幕', action: function () { WM.moveIntoView(top); } });
      items.push({ icon: 'minimize', label: '最小化', disabled: top.state === 'min', action: function () { WM.minimize(top); } });
      items.push({ icon: 'maximize', label: top.state === 'max' ? '向下还原' : '最大化', action: function () { if (top.state === 'min') WM.restore(top); WM.toggleMaximize(top); } });
      items.push({ icon: 'close', label: '关闭窗口', action: function () { WM.close(top); } });
      items.push({ sep: true });
    }
    items.push({ icon: 'pin', label: pinnedApps.indexOf(appId) === -1 ? '固定到任务栏' : '从任务栏取消固定', action: function () { togglePinned(appId); } });
    openContextMenu(items, x, y, { trigger: trigger || taskbarTarget('app:' + appId) });
  }

  function renderTaskbarCenter() {
    var host = document.getElementById('tbCenter');
    if (!host) return;
    var saved = taskbarSnapshot(host);
    host.innerHTML = '';

    var startBtn = document.createElement('button');
    startBtn.className = 'tb-btn tb-start';
    startBtn.type = 'button';
    startBtn.id = 'startBtn';
    startBtn.setAttribute('aria-label', '开始');
    startBtn.title = '开始';
    startBtn.innerHTML = ICONS.app('start');
    startBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleStart(); });
    host.appendChild(startBtn);

    var searchBtn = document.createElement('button');
    searchBtn.className = 'tb-btn';
    searchBtn.type = 'button';
    searchBtn.id = 'searchBtn';
    searchBtn.setAttribute('aria-label', '搜索');
    searchBtn.title = '搜索';
    searchBtn.innerHTML = ICONS.glyph('search');
    searchBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleSearch(); });
    host.appendChild(searchBtn);

    var viewBtn = document.createElement('button');
    viewBtn.className = 'tb-btn';
    viewBtn.type = 'button';
    viewBtn.id = 'taskViewBtn';
    viewBtn.setAttribute('aria-label', '任务视图');
    viewBtn.title = '任务视图';
    viewBtn.innerHTML = ICONS.glyph('taskview');
    viewBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleTaskView(); });
    host.appendChild(viewBtn);

    var pinned = pinnedApps.slice();
    pinned.forEach(function (appId) {
      var btn = tbButton(appId);
      if (btn) host.appendChild(btn);
    });
    syncTaskbar();
    syncPanelButtons();
    restoreTaskbarSnapshot(host, saved);
  }

  var pinnedApps = Win.store.get('taskbarPinned', (window.SITE.taskbarPinned || []).slice());
  if (!Array.isArray(pinnedApps)) pinnedApps = (window.SITE.taskbarPinned || []).slice();
  pinnedApps = pinnedApps.filter(function (id, index, all) { return typeof id === 'string' && all.indexOf(id) === index; });

  function syncTaskbar() {
    var host = document.getElementById('tbCenter');
    if (!host) return;
    var saved = taskbarSnapshot(host);
    var btns = Array.prototype.slice.call(host.querySelectorAll('[data-taskbar-app]'));
    var need = [];

    // 正在运行但未固定的应用，追加到任务栏
    WM.list().forEach(function (w) {
      if (!btns.some(function (b) { return b.dataset.taskbarApp === w.appId; }) && need.indexOf(w.appId) === -1) need.push(w.appId);
    });
    need.forEach(function (appId) {
      var btn = tbButton(appId);
      if (btn) { host.appendChild(btn); btns.push(btn); }
    });

    btns.forEach(function (btn) {
      var appId = btn.dataset.taskbarApp;
      var running = WM.byApp(appId).filter(function (w) { return w.state !== 'closed'; });
      var isRunning = running.length > 0;
      var isActive = WM.isActiveApp(appId) && running.some(function (w) { return w.state !== 'min'; });
      btn.classList.toggle('is-running', isRunning);
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
      running.forEach(function (w) { w.taskbarBtn = btn; });
      if (!isRunning && pinnedApps.indexOf(appId) === -1) btn.remove();
    });
    restoreTaskbarSnapshot(host, saved);
  }

  function renderTray() {
    var icons = document.getElementById('trayIcons');
    if (icons) {
      icons.innerHTML = '<span style="display:flex;align-items:center;gap:8px">' +
        ICONS.glyph('wifi') + ICONS.glyph('volume') + ICONS.glyph('battery') + '</span>';
      icons.style.display = 'flex';
    }
    var notifIcon = document.getElementById('notifIcon');
    if (notifIcon) notifIcon.innerHTML = ICONS.glyph('bell');
    var tray = document.getElementById('trayTray');
    if (tray) { tray.title = '网页快速设置（不控制系统网络或音量）'; tray.setAttribute('aria-label', '网页快速设置'); tray.addEventListener('click', toggleQuickSettings); }
    var taskbar = document.getElementById('taskbar');
    if (taskbar && !document.getElementById('showDesktopBtn')) {
      var desktop = document.createElement('button'); desktop.type = 'button'; desktop.id = 'showDesktopBtn'; desktop.className = 'tb-show-desktop';
      desktop.title = '显示桌面 / 恢复窗口 · Alt+Shift+D'; desktop.setAttribute('aria-label', '显示桌面或恢复窗口'); desktop.setAttribute('aria-pressed', 'false');
      desktop.addEventListener('click', function () { closeFlyouts(); WM.showDesktop(); }); taskbar.appendChild(desktop);
      Win.bus.on('wm:desktop', function (shown) { desktop.setAttribute('aria-pressed', String(shown)); });
    }
  }

  function initClock() {
    var t = document.getElementById('clockTime');
    var d = document.getElementById('clockDate');
    function update() {
      var now = new Date();
      if (t) t.textContent = Win.fmtTime(now);
      if (d) d.textContent = Win.fmtDateTaskbar(now);
    }
    update();
    setInterval(update, 1000);
    var clockBtn = document.getElementById('trayClock');
    if (clockBtn) clockBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleCalendar(e.currentTarget); });
    var notifBtn = document.getElementById('notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleCalendar(e.currentTarget); });
  }

  /* ================= 开始菜单 ================= */
  function buildStartMenu() {
    var menu = document.createElement('div');
    menu.className = 'start-menu';
    menu.dataset.flyout = 'start';
    prepareFlyout(menu, document.getElementById('startBtn'), '开始菜单');
    menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    var search = document.createElement('div');
    search.className = 'start-search';
    search.innerHTML = ICONS.glyph('search') +
      '<input type="text" id="startSearchInput" placeholder="搜索应用、文件和网页" autocomplete="off" spellcheck="false" aria-label="搜索">';
    menu.appendChild(search);

    var body = document.createElement('div');
    body.className = 'start-menu-body';
    menu.appendChild(body);

    var footer = document.createElement('div');
    footer.className = 'start-footer';
    footer.innerHTML =
      '<button class="start-user" type="button">' +
        '<span class="avatar">' + Win.avatarMarkup() + '</span>' +
        '<span class="su-name">' + Win.esc(window.SITE.profile.name) + '</span>' +
      '</button>' +
      '<button class="start-power" type="button" aria-label="电源" title="电源">' + ICONS.glyph('power') + '</button>';
    menu.appendChild(footer);

    footer.querySelector('.start-user').addEventListener('click', function () { launchApp('about'); });
    footer.querySelector('.start-power').addEventListener('click', function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      openContextMenu([
        { icon: 'lock', label: '锁定本网页', action: function () { Win.showLock(); } },
        { icon: 'refresh', label: '重新加载网页', action: function () { location.reload(); } },
        { sep: true },
        { icon: 'info', label: '网页不能关闭或休眠你的设备', disabled: true }
      ], r.left - 160, r.top - 140);
    });

    var input = search.querySelector('input');
    input.addEventListener('input', function () {
      state.startFilter = input.value.trim();
      renderStartBody(body);
    });
    keyboardResults(menu, input, '[data-app-target]');

    renderStartBody(body);
    return menu;
  }

  function renderStartBody(body) {
    var q = state.startFilter.toLowerCase();
    var apps = window.Win.appList ? window.Win.appList() : [];
    body.innerHTML = '';

    if (q || state.startAll) {
      var hits = apps.filter(function (a) {
        return (a.title + ' ' + (a.keywords || '')).toLowerCase().indexOf(q) > -1;
      });
      var head = document.createElement('div');
      head.className = 'start-section-head';
      head.innerHTML = '<span>' + (q ? '搜索结果' : '所有应用') + '</span><button type="button" class="more" data-start-back>返回已固定</button>';
      head.querySelector('button').addEventListener('click', function () { state.startAll = false; state.startFilter = ''; var menu = body.parentElement, input = menu.querySelector('input'); input.value = ''; renderStartBody(body); focusSearch(menu, input); });
      if (!q) hits.sort(function (a, b) { return a.title.localeCompare(b.title, 'zh-CN'); });
      body.appendChild(head);
      if (!hits.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:24px 4px;color:var(--text-tertiary);font-size:12px';
        empty.textContent = '没有找到「' + state.startFilter + '」，换个词试试？';
        body.appendChild(empty);
        return;
      }
      hits.forEach(function (a) {
        var row = document.createElement('button');
        row.className = 'rec-item';
        row.type = 'button';
        row.dataset.appTarget = a.id;
        row.style.width = '100%';
        row.innerHTML = '<span class="rec-icon">' + ICONS.app(a.icon) + '</span>' +
          '<span class="rec-text"><span class="rec-title">' + Win.esc(a.title) + '</span>' +
          '<span class="rec-sub">应用</span></span>';
        row.addEventListener('click', function () { launchApp(a.id); });
        body.appendChild(row);
      });
      return;
    }

    var head1 = document.createElement('div');
    head1.className = 'start-section-head';
    head1.innerHTML = '<span>已固定</span><button class="more" type="button" data-start-all>所有应用 ›</button>';
    head1.querySelector('button').addEventListener('click', function () { state.startAll = true; renderStartBody(body); var first = body.querySelector('[data-app-target]'); if (first) first.focus(); });
    body.appendChild(head1);

    var grid = document.createElement('div');
    grid.className = 'start-grid';
    (window.SITE.startPinned || []).forEach(function (appId) {
      var app = appDef(appId);
      if (!app) return;
      var tile = document.createElement('button');
      tile.className = 'start-tile';
      tile.type = 'button';
      tile.dataset.appTarget = appId;
      tile.title = app.title;
      tile.innerHTML = '<span class="st-icon">' + ICONS.app(app.icon) + '</span>' +
        '<span class="st-label">' + Win.esc(app.title) + '</span>';
      tile.addEventListener('click', function () { launchApp(appId); });
      grid.appendChild(tile);
    });
    body.appendChild(grid);

    var head2 = document.createElement('div');
    head2.className = 'start-section-head';
    head2.innerHTML = '<span>推荐的项目</span>' +
      '<button class="more" type="button">更多 ›</button>';
    body.appendChild(head2);

    var rec = document.createElement('div');
    rec.className = 'start-recommend';
    (window.SITE.recommended || []).forEach(function (item) {
      var row = document.createElement('button');
      row.className = 'rec-item';
      row.type = 'button';
      row.innerHTML = '<span class="rec-icon">' + ICONS.app(item.icon) + '</span>' +
        '<span class="rec-text"><span class="rec-title">' + Win.esc(item.title) + '</span>' +
        '<span class="rec-sub">' + Win.esc(item.sub) + '</span></span>';
      row.addEventListener('click', function () { launchApp(item.app); });
      rec.appendChild(row);
    });
    body.appendChild(rec);

    var moreBtn = head2.querySelector('.more');
    moreBtn.addEventListener('click', function () { launchApp('projects'); });
  }

  function toggleStart() {
    if (Win.isLocked()) return;
    if (state.startOpen) { closeFlyouts(null, true); return; }
    closeFlyouts();
    state.startFilter = '';
    state.startAll = false;
    var menu = buildStartMenu();
    flyoutHost.appendChild(menu);
    state.startOpen = true;
    syncPanelButtons();
    var input = menu.querySelector('#startSearchInput');
    setTimeout(function () { if (state.startOpen && menu.dataset.flyout && !Win.isLocked()) focusSearch(menu, input); }, Win.reduceMotion() ? 0 : 60);
  }

  /* ================= 搜索面板 ================= */
  function buildSearchPanel() {
    var panel = document.createElement('div');
    panel.className = 'flyout search-panel';
    panel.dataset.flyout = 'search';
    prepareFlyout(panel, document.getElementById('searchBtn'), '搜索应用与内容');
    panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    panel.innerHTML =
      '<div class="search-input-wrap">' + ICONS.glyph('search') +
        '<input type="text" id="globalSearchInput" placeholder="输入以搜索应用、项目、技能…" autocomplete="off" spellcheck="false">' +
      '</div>' +
      '<div class="search-results" id="searchResults"></div>';
    var input = panel.querySelector('input');
    var results = panel.querySelector('#searchResults');
    function render() {
      var q = input.value.trim().toLowerCase();
      var apps = window.Win.appList ? window.Win.appList() : [];
      results.innerHTML = '';

      var matchedApps = apps.filter(function (a) { return !q || (a.title + ' ' + (a.keywords || '')).toLowerCase().indexOf(q) > -1; });
      if (matchedApps.length) {
        var t1 = document.createElement('div');
        t1.className = 'search-group-title';
        t1.textContent = '应用';
        results.appendChild(t1);
        matchedApps.forEach(function (a) {
          var row = document.createElement('button');
          row.className = 'search-item';
          row.type = 'button';
          row.dataset.appTarget = a.id;
          row.innerHTML = '<span class="si-icon">' + ICONS.app(a.icon) + '</span>' +
            '<span><span class="si-title">' + Win.esc(a.title) + '</span></span>' +
            '<span class="si-kind">应用</span>';
          row.addEventListener('click', function () { launchApp(a.id); });
          results.appendChild(row);
        });
      }

      if (q) {
        var t2 = document.createElement('div');
        t2.className = 'search-group-title';
        t2.textContent = '内容';
        results.appendChild(t2);
        var found = 0;
        (window.SITE.projects || []).forEach(function (p) {
          if ((p.title + p.desc + (p.tags || []).join(' ')).toLowerCase().indexOf(q) === -1) return;
          found++;
          var row = document.createElement('button');
          row.className = 'search-item';
          row.type = 'button';
          row.innerHTML = '<span class="si-icon">' + ICONS.app(p.icon) + '</span>' +
            '<span><span class="si-title">' + Win.esc(p.title) + '</span><br><span class="si-sub">' + Win.esc(p.subtitle) + '</span></span>' +
            '<span class="si-kind">项目</span>';
          row.addEventListener('click', function () { launchApp('projects'); });
          results.appendChild(row);
        });
        (window.SITE.skills || []).forEach(function (g) {
          g.items.forEach(function (s) {
            if (s.name.toLowerCase().indexOf(q) === -1) return;
            found++;
            var row = document.createElement('button');
            row.className = 'search-item';
            row.type = 'button';
            row.innerHTML = '<span class="si-icon">' + ICONS.app(g.icon) + '</span>' +
              '<span><span class="si-title">' + Win.esc(s.name) + '</span><br><span class="si-sub">' + Win.esc(g.group) + ' · ' + Win.esc(s.level) + '%</span></span>' +
              '<span class="si-kind">技能</span>';
            row.addEventListener('click', function () { launchApp('skills'); });
            results.appendChild(row);
          });
        });
        if (!found) {
          var none = document.createElement('div');
          none.className = 'search-group-title';
          none.textContent = '没有匹配的内容';
          results.appendChild(none);
        }
        var web = document.createElement('a');
        web.className = 'search-web';
        web.href = 'https://www.bing.com/search?q=' + encodeURIComponent(input.value.trim());
        web.target = '_blank';
        web.rel = 'noopener noreferrer';
        web.innerHTML = ICONS.glyph('globe') + '<span>在 Bing 上搜索「' + Win.esc(input.value.trim()) + '」</span>' + ICONS.glyph('external');
        results.appendChild(web);
      }
    }
    input.addEventListener('input', render);
    keyboardResults(panel, input, '.search-item,.search-web');
    render();
    return panel;
  }

  function toggleSearch() {
    if (Win.isLocked()) return;
    if (state.searchOpen) { closeFlyouts(null, true); return; }
    closeFlyouts();
    var panel = buildSearchPanel();
    flyoutHost.appendChild(panel);
    state.searchOpen = true;
    syncPanelButtons();
    setTimeout(function () { var i = panel.querySelector('input'); if (state.searchOpen && panel.dataset.flyout && !Win.isLocked()) focusSearch(panel, i); }, Win.reduceMotion() ? 0 : 60);
  }

  /* ================= 日历 + 通知 ================= */
  function buildCalendarPanel(trigger) {
    var panel = document.createElement('div');
    panel.className = 'flyout calendar-panel';
    panel.dataset.flyout = 'calendar';
    prepareFlyout(panel, trigger || document.getElementById('trayClock'), '日历与通知');
    panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    panel.innerHTML =
      '<div class="calendar-clock"><span class="cc-time" data-clock="time">--:--</span><span class="cc-date" data-clock="date-cn"></span></div>' +
      '<div class="cal-head"><span class="cal-month"></span><span class="cal-nav">' +
        '<button type="button" data-cal="today" aria-label="回到今天">今天</button>' +
        '<button type="button" data-cal="prev" aria-label="上个月">' + ICONS.glyph('chevron-left') + '</button>' +
        '<button type="button" data-cal="next" aria-label="下个月">' + ICONS.glyph('chevron-right') + '</button>' +
      '</span></div>' +
      '<div class="cal-grid" id="calGrid"></div>' +
      '<div class="cal-section-title"><span>通知</span><button class="clear-all" type="button" id="clearAllNotifs">全部清除</button></div>' +
      '<div class="notif-list" id="notifList"></div>';

    panel.querySelector('[data-cal="today"]').addEventListener('click', function () { state.calMonth = new Date(); renderCalendar(panel); });
    panel.querySelector('[data-cal="prev"]').addEventListener('click', function () {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      renderCalendar(panel);
    });
    panel.querySelector('[data-cal="next"]').addEventListener('click', function () {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      renderCalendar(panel);
    });
    panel.querySelector('#clearAllNotifs').addEventListener('click', function () {
      Win.clearNotifications();
      renderNotifications(panel);
    });
    renderCalendar(panel);
    renderNotifications(panel);
    panel.querySelector('.cc-time').textContent = Win.fmtTime(new Date());
    panel.querySelector('.cc-date').textContent = Win.fmtDateCN(new Date());
    return panel;
  }

  function renderCalendar(panel) {
    var grid = panel.querySelector('#calGrid');
    var label = panel.querySelector('.cal-month');
    if (!grid) return;
    var d = state.calMonth;
    var year = d.getFullYear(), month = d.getMonth();
    label.textContent = year + '年' + (month + 1) + '月';
    var today = new Date();
    var first = new Date(year, month, 1);
    var startDow = first.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevDays = new Date(year, month, 0).getDate();

    var html = ['日', '一', '二', '三', '四', '五', '六'].map(function (w) {
      return '<span class="cal-dow">' + w + '</span>';
    }).join('');

    var cells = [];
    for (var i = startDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, muted: true });
    for (var day = 1; day <= daysInMonth; day++) cells.push({ day: day, muted: false });
    var trail = (7 - (cells.length % 7)) % 7;
    for (var t = 1; t <= trail; t++) cells.push({ day: t, muted: true });

    cells.forEach(function (c) {
      var isToday = !c.muted && c.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      html += '<span class="cal-day' + (c.muted ? ' is-muted' : '') + (isToday ? ' is-today' : '') +
        (isToday ? ' has-dot' : '') + '"' + (isToday ? ' aria-current="date"' : '') + '>' + c.day + '</span>';
    });
    grid.innerHTML = html;
  }

  function renderNotifications(panel) {
    var list = panel.querySelector('#notifList');
    if (!list) return;
    var items = Win.notifications;
    if (!items.length) {
      list.innerHTML = '<div class="notif-empty">' + ICONS.glyph('bell') + '<div>暂无通知</div></div>';
      return;
    }
    list.innerHTML = '';
    items.slice(0, 8).forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'notif-item';
      row.innerHTML = '<span class="ni-icon">' + ICONS.app(n.icon) + '</span>' +
        '<div><div class="ni-title">' + Win.esc(n.title) + '</div>' +
        '<div class="ni-body">' + Win.esc(n.body) + '</div></div>';
      list.appendChild(row);
    });
  }

  function toggleCalendar(trigger) {
    if (Win.isLocked()) return;
    trigger = trigger || state.calTrigger || document.getElementById('trayClock');
    if (state.calOpen) {
      if (trigger === state.calTrigger) { closeFlyouts(null, true); return; }
      var current = document.querySelector('[data-flyout="calendar"]');
      if (current) {
        state.calTrigger = trigger;
        current._returnFocus = trigger;
        current._returnFocusKey = taskbarKey(trigger);
        syncPanelButtons();
        current.querySelector('[data-cal="today"]').focus();
        return;
      }
    }
    closeFlyouts();
    var panel = buildCalendarPanel(trigger);
    flyoutHost.appendChild(panel);
    state.calOpen = true;
    state.calTrigger = trigger;
    syncPanelButtons();
    Win.markAllRead();
    panel.querySelector('[data-cal="today"]').focus();
  }

  /* ================= 网页快速设置 / 快捷键说明 ================= */
  function toggleQuickSettings() {
    if (Win.isLocked()) return;
    if (state.quickOpen) { closeFlyouts(null, true); return; }
    closeFlyouts();
    var panel = document.createElement('div'); panel.className = 'flyout quick-settings'; panel.dataset.flyout = 'quick';
    prepareFlyout(panel, document.getElementById('trayTray'), '网页快速设置');
    function render() {
      var focused = document.activeElement && document.activeElement.dataset.quick;
      panel.innerHTML = '<h2>网页快速设置</h2>' +
        '<button type="button" class="quick-setting" data-quick="theme" aria-pressed="' + (Win.effectiveTheme() === 'dark') + '">' + ICONS.glyph('moon') + ' 深色外观</button>' +
        '<button type="button" class="quick-setting" data-quick="motion" aria-pressed="' + Win.prefs.motion + '">' + ICONS.glyph('sparkle') + ' 窗口动效：' + (Win.prefs.motion ? '开启' : '关闭') + '</button>' +
        '<button type="button" class="quick-setting" data-quick="align">任务栏：' + (Win.prefs.align === 'center' ? '居中' : '左对齐') + '</button>' +
        '<button type="button" class="quick-setting" data-quick="settings">打开完整设置</button>' +
        '<p class="app-hint">' + (navigator.onLine ? '浏览器报告在线（不代表外部服务可达）' : '浏览器报告离线') + '。本网页不控制设备的网络、音量、关机或睡眠。</p>' +
        '<h3>网页快捷键</h3><p class="app-hint">焦点在本页时：Alt + Shift + S 开始；F 搜索；D 显示桌面 / 恢复；W 任务视图。窗口内非输入区：Alt + Shift + ← / → 左右贴靠，↑ 最大化，↓ 还原，M 最小化。最大化按钮按 ↓ 打开布局。输入法或系统可能占用组合键，所有功能均有按钮入口；不接管 Win、Alt+Tab、Ctrl+K、Ctrl+L。</p>' +
        '<p class="app-hint">桌面方向键移动，Enter 打开，Ctrl / Shift 多选，Shift+F10 右键菜单。菜单 Esc 关闭并返回焦点。记事本编辑区 Ctrl+S 保存到本浏览器。</p>';
      panel.querySelectorAll('[data-quick]').forEach(function (button) {
        button.addEventListener('click', function () {
          var action = button.dataset.quick;
          if (action === 'settings') { launchApp('settings'); return; }
          if (action === 'theme') Win.setPref('themeMode', Win.effectiveTheme() === 'dark' ? 'light' : 'dark');
          if (action === 'motion') Win.setPref('motion', !Win.prefs.motion);
          if (action === 'align') Win.setPref('align', Win.prefs.align === 'center' ? 'left' : 'center');
          render();
        });
      });
      if (focused) { var next = panel.querySelector('[data-quick="' + focused + '"]'); if (next) next.focus(); }
    }
    render(); flyoutHost.appendChild(panel); state.quickOpen = true; syncPanelButtons(); panel.querySelector('button').focus();
  }

  /* ================= 任务视图 ================= */
  function buildTaskView() {
    var overlay = document.createElement('div'); overlay.className = 'taskview-overlay'; overlay.dataset.flyout = 'taskview';
    prepareFlyout(overlay, document.getElementById('taskViewBtn'), '任务视图');
    var head = document.createElement('div'); head.className = 'taskview-head';
    head.innerHTML = '<h2>任务视图</h2><span>选择窗口切换 · Esc 返回</span><button type="button" class="btn" aria-label="关闭任务视图">关闭</button>';
    head.querySelector('button').addEventListener('click', function () { closeFlyouts(null, true); }); overlay.appendChild(head);
    var grid = document.createElement('div'); grid.className = 'taskview-grid';
    var list = WM.list();
    if (!list.length) { var empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '没有打开的窗口。双击桌面图标，或点开始菜单里的应用试试。'; grid.appendChild(empty); }
    list.forEach(function (w) {
      var card = document.createElement('button'); card.type = 'button'; card.className = 'taskview-card'; card.dataset.win = w.id;
      card.innerHTML = '<span class="taskbar-preview-title">' + ICONS.app(w.icon) + Win.esc(w.title) + ' · ' + (w.state === 'min' ? '已最小化' : '已打开') + '</span>';
      card.appendChild(previewThumb(w));
      card.addEventListener('click', function () { closeFlyouts(); if (w.state === 'min') WM.restore(w); WM.focus(w); }); grid.appendChild(card);
    });
    overlay.appendChild(grid); keyboardResults(overlay, null, '.taskview-card'); return overlay;
  }
  function toggleTaskView() {
    if (Win.isLocked()) return;
    if (state.taskViewOpen) { closeFlyouts(null, true); return; }
    closeFlyouts(); var panel = buildTaskView(); flyoutHost.appendChild(panel); state.taskViewOpen = true; syncPanelButtons();
    (panel.querySelector('.taskview-card') || panel.querySelector('button')).focus();
  }

  /* ================= 右键菜单 ================= */
  function openContextMenu(items, x, y, opts) {
    var active = document.activeElement;
    var parentPanel = active && active.closest('[data-flyout]');
    var returnFocus = opts && opts.trigger ? opts.trigger : parentPanel && parentPanel._returnFocus ? parentPanel._returnFocus : active;
    closeFlyouts();
    var menu = document.createElement('div'); menu.className = 'context-menu'; menu.dataset.flyout = 'context';
    prepareFlyout(menu, returnFocus, '操作菜单'); menu.setAttribute('role', 'menu');
    menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    items.forEach(function (item) {
      if (item.sep) { var sep = document.createElement('div'); sep.className = 'ctx-sep'; sep.setAttribute('role', 'separator'); menu.appendChild(sep); return; }
      var row = document.createElement('button'); row.className = 'ctx-item' + (item.disabled ? ' is-disabled' : ''); row.type = 'button'; row.setAttribute('role', 'menuitem'); row.disabled = !!item.disabled;
      row.innerHTML = '<span class="ctx-icon">' + (item.icon ? ICONS.glyph(item.icon) : '') + '</span><span class="ctx-label">' + Win.esc(item.label) + '</span>' + (item.shortcut ? '<span class="ctx-shortcut">' + Win.esc(item.shortcut) + '</span>' : '');
      if (!item.disabled && item.action) row.addEventListener('click', function () {
        // 同一次用户激活内执行，避免外链被延迟回调拦截或二次打开。
        closeTarget('context', true); item.action();
      });
      menu.appendChild(row);
    });
    (flyoutHost || document.body).appendChild(menu);
    menu.style.maxWidth = Math.max(1, window.innerWidth - 16) + 'px'; menu.style.maxHeight = Math.max(1, window.innerHeight - 16) + 'px'; menu.style.overflowY = 'auto';
    var rect = { width: menu.offsetWidth, height: menu.offsetHeight };
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + 'px';
    keyboardResults(menu, null, 'button:not(:disabled)');
    var first = menu.querySelector('button:not(:disabled)'); if (first) first.focus(); else menu.focus();
  }

  function openIconMenu(appId, x, y) {
    var app = appDef(appId); if (!app) return;
    var count = selectedIcons.length;
    openContextMenu([
      { icon: 'folder', label: count > 1 ? '打开所选 ' + count + ' 项' : '打开', action: function () { openSelection(); } },
      { icon: 'pin', label: pinnedApps.indexOf(appId) === -1 ? '固定到任务栏' : '从任务栏取消固定', action: function () { togglePinned(appId); } },
      { sep: true },
      { icon: 'info', label: app.external ? '网页快捷方式 · 在新标签页打开' : '本站应用 · 在网页窗口内打开', disabled: true }
    ], x, y);
  }

  function openDesktopMenu(x, y) {
    openContextMenu([
      { icon: 'grid-view', label: '全选桌面图标', shortcut: 'Ctrl+A（桌面内）', action: function () { selectedIcons = desktopNodes(); selectionAnchor = selectedIcons[0]; paintSelection(selectionAnchor); if (selectionAnchor) selectionAnchor.focus(); } },
      { icon: 'sort', label: '按名称排序', action: function () { Win.store.set('desktopSort', 'name'); renderDesktop(); } },
      { icon: 'sort', label: '恢复默认顺序', action: function () { Win.store.set('desktopSort', 'default'); renderDesktop(); } },
      { icon: 'refresh', label: '刷新桌面图标', action: renderDesktop },
      { sep: true },
      { icon: 'file', label: '新建便笺', action: function () { launchApp('notepad'); } },
      { icon: 'display', label: '显示桌面 / 恢复窗口', action: function () { WM.showDesktop(); } },
      { icon: 'palette', label: '个性化', action: function () { launchApp('settings'); } },
      { icon: 'info', label: '网页快捷键与快速设置', action: toggleQuickSettings },
      { icon: 'terminal', label: '打开模拟终端', action: function () { launchApp('terminal'); } }
    ], x, y);
  }

  /* ================= 全局事件 ================= */
  function bindGlobal() {
    document.addEventListener('pointerdown', function (e) {
      if (Win.isLocked()) return;
      var inFlyout = e.target.closest('[data-flyout]'), inTaskbar = e.target.closest('.taskbar');
      if (!inFlyout && !inTaskbar && !e.target.closest('.caption-max')) closeFlyouts();
      var onDesktop = e.target.id === 'desktop' || e.target.id === 'wallpaper' || e.target.id === 'desktopIcons' || e.target.id === 'windowLayer';
      if (onDesktop) { if (e.pointerType === 'touch') selectIcon(null); else startMarquee(e); }
    }, true);

    document.addEventListener('keydown', function (e) {
      if (Win.isLocked() || e.defaultPrevented || e.isComposing || e.repeat) return;
      if (e.key === 'Escape') { closeFlyouts(null, true); return; }
      // 不拦截浏览器/OS的Win、Alt+Tab、Ctrl+K、Ctrl+L等全局快捷键。
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      var key = e.key.toLowerCase(), action = null;
      if (key === 's') action = toggleStart;
      if (key === 'f') action = toggleSearch;
      if (key === 'd') action = function () { closeFlyouts(); WM.showDesktop(); };
      if (key === 'w') action = toggleTaskView;
      var win = WM.activeWin();
      if (win && win.el.contains(e.target)) {
        if (key === 'arrowleft') action = function () { WM.snap(win, 'left'); };
        if (key === 'arrowright') action = function () { WM.snap(win, 'right'); };
        if (key === 'arrowup') action = function () { WM.snap(win, 'max'); };
        if (key === 'arrowdown') action = function () { WM.restoreLayout(win); };
        if (key === 'm') action = function () { WM.minimize(win); };
      }
      if (action) { e.preventDefault(); action(); }
    });

    document.addEventListener('contextmenu', function (e) {
      if (Win.isLocked() || e.defaultPrevented || e.target.closest('.window,[data-flyout],.taskbar,.desktop-icon')) return;
      var desktop = e.target.closest('#desktop');
      if (desktop) { e.preventDefault(); selectIcon(null); openDesktopMenu(e.clientX, e.clientY); }
    });
    Win.bus.on('wm:change', function () { syncTaskbar(); });
    var viewportWidth = window.innerWidth;
    window.addEventListener('resize', function () {
      var sameWidth = window.innerWidth === viewportWidth;
      viewportWidth = window.innerWidth;
      syncFlyoutViewport();
      // Mobile keyboard/browser chrome height changes must not dismiss the panel.
      if (sameWidth && manualSearchFocus()) return;
      closeFlyouts(null, true);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncFlyoutViewport);
      window.visualViewport.addEventListener('scroll', syncFlyoutViewport);
    }
  }

  /* ================= 初始化 ================= */
  function init() {
    if (initialized) return;
    initialized = true;
    flyoutHost = document.getElementById('flyoutHost');
    renderDesktop();
    renderTaskbarCenter();
    renderTray();
    initClock();
    Win.renderNotificationBadge();
    syncFlyoutViewport();
    bindGlobal();
    Win.bus.on('notifications', function () {
      var panel = document.querySelector('[data-flyout="calendar"]');
      if (panel) renderNotifications(panel);
    });
    Win.bus.on('lock:request-close-all', function () { closeFlyouts(); });
    syncPanelButtons();
  }

  return {
    init: init,
    closeFlyouts: closeFlyouts,
    launchApp: launchApp,
    openDesktopMenu: openDesktopMenu,
    renderDesktop: renderDesktop,
    toggleStart: toggleStart,
    toggleSearch: toggleSearch,
    toggleCalendar: toggleCalendar,
    toggleTaskView: toggleTaskView,
    toggleQuickSettings: toggleQuickSettings,
    openContextMenu: openContextMenu,
    selectedApps: function () { return selectedIcons.map(function (node) { return node.dataset.app; }); }
  };
})();
